import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { geographyAPI, knowledgeAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import {
  ExternalLink,
  Info,
  MapPin,
  Globe,
  Sprout,
  X,
  ChevronRight,
  Navigation
} from 'lucide-react';
import { plantImage, PLANT_PLACEHOLDER } from '../utils/images';

const CAMEROON_CENTER = [7.3697, 12.3547];
const CAMEROON_ZOOM = 6;

const REGION_COLORS = [
  '#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb',
  '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c',
];

/**
 * Spread the plants of one region around its center on a golden-angle
 * spiral so every plant photo is visible instead of stacked on one point.
 * Offsets are in degrees — small enough to stay inside the region.
 */
function spiralOffset(index, total) {
  if (total <= 1) return [0, 0];
  const angle = index * 2.39996; // golden angle
  const ring = Math.floor(index / 6);
  const radius = 0.28 + ring * 0.3 + (index % 6) * 0.02;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/**
 * Region pin: a real plant photo from that region inside a map pin,
 * with a badge showing how many distinct plants are documented there.
 */
function regionPinIcon({ image, count, color, selected }) {
  const size = selected ? 62 : 54;
  return L.divIcon({
    className: 'hc-marker-wrap',
    html: `
      <div class="hc-region-pin ${selected ? 'hc-selected' : ''}"
           style="width:${size}px;height:${size}px;border-color:${color};">
        <img src="${image}" alt="" draggable="false" />
        <span class="hc-region-badge" style="background:${color};">${count}</span>
      </div>
      <div class="hc-pin-tip" style="border-top-color:${selected ? '#14532d' : color};"></div>
    `,
    iconSize: [size, size + 14],
    iconAnchor: [size / 2, size + 12],
    popupAnchor: [0, -(size + 12)],
  });
}

/**
 * Single plant marker: the plant's own photo in a leaf-shaped frame.
 */
function plantThumbIcon({ image, name, selected }) {
  const size = 46;
  const safeName = (name || '').replace(/"/g, '&quot;');
  return L.divIcon({
    className: 'hc-marker-wrap',
    html: `
      <div class="hc-plant-thumb ${selected ? 'hc-selected' : ''}"
           style="width:${size}px;height:${size}px;" title="${safeName}">
        <img src="${image}" alt="${safeName}" draggable="false" />
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function MapPage() {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [uses, setUses] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewMode, setViewMode] = useState('regions');
  const [loading, setLoading] = useState(true);
  // "Use my location" — resolves the browser position against the platform's
  // own region coordinates (see /api/geography/locate/).
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState(null);
  const mapRef = useRef(null);

  function locateMe() {
    if (!navigator.geolocation) {
      toast.warning('Location is unavailable', 'This browser does not expose a geolocation API.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const res = await geographyAPI.locate(lat, lng);
          setNearby({ ...res.data, lat, lng });
          setSelectedRegion(res.data.region.id);
          mapRef.current?.flyTo([lat, lng], 7, { duration: 1.1 });
          toast.success(
            'Centred on your location',
            `${res.data.region.name} is the nearest documented region, about ${res.data.distance_km} km away.`,
          );
        } catch {
          toast.error('Could not resolve that location', 'The nearest-region lookup failed. Try again in a moment.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.warning('Location not shared', 'Allow camera and location access, or pick a region from the list.');
      },
      { timeout: 8000, maximumAge: 300000 },
    );
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      geographyAPI.regions({ detailed: true, page_size: 50 }),
      knowledgeAPI.traditionalUses({ page_size: 500 }),
    ])
      .then(([regionRes, usesRes]) => {
        setRegions((regionRes.data.results || regionRes.data || []).filter((r) => r.latitude && r.longitude));
        setUses(usesRes.data.results || usesRes.data || []);
      })
      .catch(() => toast.error('Could not load the map', 'Region data did not load. Please refresh.'))
      .finally(() => setLoading(false));
  }, [toast]);

  /** region id → { count, plants: Map(plantId → { name, image, uses }) } */
  const byRegion = useMemo(() => {
    const map = new Map();
    uses.forEach((use) => {
      if (!use.region) return;
      if (!map.has(use.region)) map.set(use.region, { count: 0, plants: new Map() });
      const entry = map.get(use.region);
      entry.count += 1;
      if (use.plant) {
        if (!entry.plants.has(use.plant)) {
          entry.plants.set(use.plant, {
            name: use.plant_name,
            image: plantImage({
              image: use.plant_image || '',
              scientific_name: use.plant_name,
              common_name: use.plant_common_name || '',
            }),
            uses: 0,
          });
        }
        entry.plants.get(use.plant).uses += 1;
      }
    });
    return map;
  }, [uses]);

  const regionPlants = useMemo(() => {
    if (!selectedRegion) return [];
    const entry = byRegion.get(selectedRegion.id);
    if (!entry) return [];
    return [...entry.plants.entries()].map(([id, info]) => ({ id, ...info }));
  }, [selectedRegion, byRegion]);

  const totalDocumentedPlants = useMemo(() => {
    const set = new Set();
    byRegion.forEach((entry) => entry.plants.forEach((_, id) => set.add(id)));
    return set.size;
  }, [byRegion]);

  /** Flat list of one marker per (region, plant) for Plant mode. */
  const plantMarkers = useMemo(() => {
    const list = [];
    regions.forEach((region) => {
      const entry = byRegion.get(region.id);
      if (!entry || entry.plants.size === 0) return;
      const plants = [...entry.plants.entries()];
      plants.forEach(([plantId, info], i) => {
        const [dLat, dLng] = spiralOffset(i, plants.length);
        list.push({
          key: `${region.id}-${plantId}`,
          region,
          plantId,
          ...info,
          position: [parseFloat(region.latitude) + dLat, parseFloat(region.longitude) + dLng],
        });
      });
    });
    return list;
  }, [regions, byRegion]);

  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header Section */}
        <Reveal>
          <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
                <Globe className="w-3.5 h-3.5" /> Interactive Atlas
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
                Geographic Knowledge Map
              </h1>
              <p className="mt-2 text-stone-500 max-w-2xl leading-relaxed">
                Explore the distribution of medicinal plants across Cameroon’s regions.
                {!loading && (
                  <span className="ml-1.5 font-medium text-stone-700">
                    Covering {regions.length} regions and {totalDocumentedPlants} documented plants.
                  </span>
                )}
              </p>
            </div>

            {/* Segmented Control */}
            <div className="inline-flex bg-stone-200/60 p-1 rounded-xl backdrop-blur-sm">
              <button
                onClick={() => setViewMode('regions')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  viewMode === 'regions'
                    ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'
                }`}
              >
                <MapPin className="w-4 h-4" /> Regions
              </button>
              <button
                onClick={() => setViewMode('plants')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  viewMode === 'plants'
                    ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'
                }`}
              >
                <Sprout className="w-4 h-4" /> Plants
              </button>
            </div>

            <button
              onClick={locateMe}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
            >
              <Navigation className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
        </Reveal>

        {nearby && (
          <Reveal className="mb-4 block">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-3.5">
              <p className="text-sm text-emerald-900">
                <span className="font-bold">{nearby.region.name}</span> is the region nearest to you
                <span className="text-emerald-700"> · about {nearby.distance_km} km away</span>
                <span className="text-emerald-700"> · {nearby.plant_count} plant{nearby.plant_count === 1 ? '' : 's'} documented there</span>
                {!nearby.in_cameroon && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    outside Cameroon — showing the closest region
                  </span>
                )}
              </p>
              <button
                onClick={() => setNearby(null)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </Reveal>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* Map Container */}
          <Reveal className="lg:col-span-8" delay={60}>
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm relative">
              <div className="relative h-[500px] lg:h-[650px]">
                {loading ? (
                  <div className="absolute inset-0 bg-stone-100 animate-pulse flex items-center justify-center">
                    <div className="text-center">
                      <Loader2Icon className="w-8 h-8 text-stone-300 mx-auto mb-3 animate-spin" />
                      <p className="text-sm font-medium text-stone-400">Loading geographic data...</p>
                    </div>
                  </div>
                ) : (
                  <MapContainer
                    ref={mapRef}
                    center={CAMEROON_CENTER}
                    zoom={CAMEROON_ZOOM}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom
                    className="z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright" class="text-stone-500 hover:underline">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* REGIONS MODE — one plant-photo pin per region */}
                    {viewMode === 'regions' && regions.map((region, i) => {
                      const entry = byRegion.get(region.id);
                      const plantCount = entry ? entry.plants.size : 0;
                      const useCount = entry ? entry.count : 0;
                      const isSelected = selectedRegion?.id === region.id;
                      const color = REGION_COLORS[i % REGION_COLORS.length];
                      const firstPlant = entry ? [...entry.plants.values()][0] : null;
                      const pinImage = firstPlant ? firstPlant.image : PLANT_PLACEHOLDER;

                      return (
                        <Marker
                          key={`region-${region.id}-${isSelected ? 'sel' : 'idle'}`}
                          position={[parseFloat(region.latitude), parseFloat(region.longitude)]}
                          icon={regionPinIcon({ image: pinImage, count: plantCount, color, selected: isSelected })}
                          eventHandlers={{ click: () => handleRegionSelect(region) }}
                        >
                          <Popup className="custom-leaflet-popup" maxWidth={280}>
                            <div className="p-1">
                              <div className="mb-2 h-28 w-full overflow-hidden rounded-xl bg-stone-100">
                                <img src={pinImage} alt="" className="h-full w-full object-cover" />
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <h3 className="font-bold text-stone-900 text-base">{region.name} Region</h3>
                              </div>
                              <div className="flex gap-3 text-xs text-stone-600 mb-3">
                                <span className="bg-stone-100 px-2 py-1 rounded-md font-medium">{plantCount} Plants</span>
                                <span className="bg-stone-100 px-2 py-1 rounded-md font-medium">{useCount} Uses</span>
                              </div>
                              {region.description && (
                                <p className="text-xs text-stone-500 leading-relaxed border-t border-stone-100 pt-2">
                                  {region.description}
                                </p>
                              )}
                              <button
                                onClick={() => handleRegionSelect(region)}
                                className="mt-3 w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                              >
                                View Details →
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}

                    {/* PLANTS MODE — one photo marker per plant, spread around its region */}
                    {viewMode === 'plants' && plantMarkers.map((m) => (
                      <Marker
                        key={m.key}
                        position={m.position}
                        icon={plantThumbIcon({
                          image: m.image,
                          name: m.name,
                          selected: selectedRegion?.id === m.region.id,
                        })}
                        eventHandlers={{ click: () => handleRegionSelect(m.region) }}
                      >
                        <Popup className="custom-leaflet-popup" maxWidth={260}>
                          <div className="p-1">
                            <div className="mb-2 h-28 w-full overflow-hidden rounded-xl bg-stone-100">
                              <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
                            </div>
                            <p className="font-bold text-stone-900 text-sm italic leading-snug">{m.name}</p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {m.region.name} Region · {m.uses} documented use{m.uses === 1 ? '' : 's'}
                            </p>
                            <Link
                              to={`/plants/${m.plantId}`}
                              className="mt-2.5 flex items-center justify-center gap-1 w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                            >
                              Open plant page <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-xs text-stone-500">
                {viewMode === 'regions' ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-5 w-5 overflow-hidden rounded-full ring-2 ring-emerald-500">
                        <span className="block h-full w-full bg-emerald-200" />
                      </span>
                      Plant photo = a species documented in that region
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">8</span>
                      Badge = number of distinct plants
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-emerald-600" />
                    Each leaf marker is one documented plant, placed around its region — click it for details.
                  </span>
                )}
              </div>
            </div>
          </Reveal>

          {/* Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            {selectedRegion ? (
              <Reveal className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Selected Region Header */}
                <div className="p-5 border-b border-stone-100 bg-stone-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white"
                        style={{ backgroundColor: REGION_COLORS[regions.findIndex(r => r.id === selectedRegion.id) % REGION_COLORS.length] }}
                      />
                      <div>
                        <h3 className="font-bold text-stone-900 text-lg leading-tight">{selectedRegion.name}</h3>
                        <p className="text-xs font-medium text-stone-500 mt-0.5">Code: {selectedRegion.code}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRegion(null)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-colors"
                      aria-label="Close region details"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedRegion.description && (
                    <p className="text-sm text-stone-600 mt-3 leading-relaxed">{selectedRegion.description}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-white border border-stone-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-stone-800">{Number(selectedRegion.latitude).toFixed(2)}°</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 mt-0.5">Latitude</p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-stone-800">{Number(selectedRegion.longitude).toFixed(2)}°</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 mt-0.5">Longitude</p>
                    </div>
                  </div>
                </div>

                {/* Plant List */}
                {regionPlants.length > 0 ? (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Documented Plants
                      </p>
                      <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {regionPlants.length}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                      {regionPlants.map((plant) => (
                        <Link
                          key={plant.id}
                          to={`/plants/${plant.id}`}
                          className="group flex items-center gap-3 rounded-xl p-2 text-sm text-stone-700 transition-all hover:bg-emerald-50/60 hover:ring-1 hover:ring-emerald-100"
                        >
                          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200">
                            <img
                              src={plant.image}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="flex-1 truncate font-medium italic group-hover:text-emerald-800 transition-colors">
                            {plant.name}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-300 group-hover:text-emerald-600 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Sprout className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-stone-500">No plants documented yet</p>
                    <p className="text-xs text-stone-400 mt-1">This region has no recorded traditional uses in our database.</p>
                  </div>
                )}
              </Reveal>
            ) : (
              <Reveal className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                    <Info className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">Explore the Map</p>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Click on any plant marker on the map, or select a region from the list below, to view its coordinates and documented medicinal plants.
                    </p>
                  </div>
                </div>
              </Reveal>
            )}

            {/* All Regions List */}
            <Reveal delay={100} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-stone-800 text-sm">All Regions</h3>
                <span className="text-xs font-medium text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-md">{regions.length}</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                {regions.map((region, i) => {
                  const entry = byRegion.get(region.id);
                  const plantCount = entry ? entry.plants.size : 0;
                  const isSelected = selectedRegion?.id === region.id;
                  const color = REGION_COLORS[i % REGION_COLORS.length];

                  return (
                    <button
                      key={region.id}
                      onClick={() => handleRegionSelect(region)}
                      className={`w-full text-left flex items-center gap-3 rounded-xl p-3 transition-all group ${
                        isSelected
                          ? 'bg-emerald-50 ring-1 ring-emerald-200'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm transition-transform group-hover:scale-110"
                        style={{ backgroundColor: color }}
                      />
                      <span className={`flex-1 text-sm font-medium truncate ${isSelected ? 'text-emerald-900' : 'text-stone-700'}`}>
                        {region.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                          isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200'
                        }`}>
                          {plantCount}
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-colors ${isSelected ? 'text-emerald-600' : 'text-stone-300 group-hover:text-stone-500'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Leaflet + plant-marker styles */}
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          border: 1px solid #e7e5e4;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }
        .leaflet-popup-tip {
          background: #ffffff;
          border: 1px solid #e7e5e4;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #78716c;
          padding: 8px 8px 0 0;
          font-size: 18px;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #14532d;
          background: #f0fdf4;
          border-radius: 4px;
        }
        /* Custom scrollbar for sidebar lists */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e7e5e4;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #d6d3d1;
        }

        /* ---- Plant markers (replaces the plain circles) ---- */
        .hc-marker-wrap {
          background: transparent;
          border: none;
        }
        .hc-region-pin {
          position: relative;
          border-radius: 9999px;
          border: 3px solid #16a34a;
          overflow: visible;
          box-shadow: 0 6px 16px -4px rgb(0 0 0 / 0.35);
          background: #ecfdf5;
          transition: transform 0.15s ease;
        }
        .hc-region-pin img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 9999px;
          display: block;
          pointer-events: none;
        }
        .hc-marker-wrap:hover .hc-region-pin {
          transform: scale(1.08);
        }
        .hc-region-pin.hc-selected {
          border-color: #14532d;
          border-width: 4px;
          box-shadow: 0 0 0 4px rgb(20 83 45 / 0.2), 0 8px 20px -4px rgb(0 0 0 / 0.4);
        }
        .hc-region-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          min-width: 22px;
          height: 22px;
          padding: 0 5px;
          border-radius: 9999px;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          line-height: 22px;
          text-align: center;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgb(0 0 0 / 0.3);
          pointer-events: none;
        }
        .hc-pin-tip {
          width: 0;
          height: 0;
          margin: -2px auto 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 12px solid #16a34a;
          filter: drop-shadow(0 3px 3px rgb(0 0 0 / 0.25));
        }
        .hc-plant-thumb {
          border-radius: 50% 50% 50% 10px;
          transform: rotate(-8deg);
          border: 3px solid #fff;
          outline: 2px solid #16a34a;
          overflow: hidden;
          box-shadow: 0 6px 14px -4px rgb(0 0 0 / 0.4);
          background: #ecfdf5;
          transition: transform 0.15s ease;
        }
        .hc-plant-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          transform: rotate(8deg) scale(1.15);
        }
        .hc-marker-wrap:hover .hc-plant-thumb {
          transform: rotate(-8deg) scale(1.15);
          z-index: 999;
        }
        .hc-plant-thumb.hc-selected {
          outline-color: #14532d;
          outline-width: 3px;
        }
      `}</style>
    </div>
  );
}

// Simple inline loader component to avoid missing import if lucide-react Loader2 isn't preferred
function Loader2Icon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
