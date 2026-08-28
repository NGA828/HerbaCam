import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { geographyAPI, knowledgeAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { ExternalLink, Info, Layers, Leaf, MapPin } from 'lucide-react';
import { plantImage } from '../utils/images';

const CAMEROON_CENTER = [7.3697, 12.3547];
const CAMEROON_ZOOM = 6;

const REGION_COLORS = [
  '#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb',
  '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c',
];

/** Radius (px) that scales with how many plants are documented in a region. */
function radiusFor(count) {
  return 12 + Math.min(26, Math.sqrt(count) * 5);
}

export default function MapPage() {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [uses, setUses] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewMode, setViewMode] = useState('regions'); // 'regions' | 'plants'
  const [loading, setLoading] = useState(true);

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

  /** region id → { count, plants: Map(plantId → name) } */
  const byRegion = useMemo(() => {
    const map = new Map();
    uses.forEach((use) => {
      if (!use.region) return;
      if (!map.has(use.region)) map.set(use.region, { count: 0, plants: new Map() });
      const entry = map.get(use.region);
      entry.count += 1;
      if (use.plant && !entry.plants.has(use.plant)) entry.plants.set(use.plant, use.plant_name);
    });
    return map;
  }, [uses]);

  const regionPlants = useMemo(() => {
    if (!selectedRegion) return [];
    const entry = byRegion.get(selectedRegion.id);
    if (!entry) return [];
    return [...entry.plants.entries()].map(([id, name]) => ({ id, name }));
  }, [selectedRegion, byRegion]);

  const totalDocumentedPlants = useMemo(() => {
    const set = new Set();
    byRegion.forEach((entry) => entry.plants.forEach((_, id) => set.add(id)));
    return set.size;
  }, [byRegion]);

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-stone-800 mb-1 flex items-center gap-3">
                <MapPin className="w-7 h-7 text-green-600" /> Geographic Knowledge Map
              </h1>
              <p className="text-stone-500">
                Explore plant distribution across Cameroon’s regions
                {!loading && (
                  <span className="ml-2 text-stone-400">
                    · {regions.length} regions · {totalDocumentedPlants} plants with documented uses
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('regions')}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                  viewMode === 'regions' ? 'bg-green-700 text-white shadow-sm' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                }`}
              >
                <Layers className="w-4 h-4 mr-1.5" /> Regions
              </button>
              <button
                onClick={() => setViewMode('plants')}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                  viewMode === 'plants' ? 'bg-green-700 text-white shadow-sm' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                }`}
              >
                <Leaf className="w-4 h-4 mr-1.5" /> Plant density
              </button>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map */}
          <Reveal className="lg:col-span-3" delay={60}>
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm" style={{ height: '600px' }}>
              {loading ? (
                <div className="skeleton-shimmer h-full w-full" />
              ) : (
                <MapContainer center={CAMEROON_CENTER} zoom={CAMEROON_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {regions.map((region, i) => {
                    const entry = byRegion.get(region.id);
                    const plantCount = entry ? entry.plants.size : 0;
                    const radius = viewMode === 'plants' ? radiusFor(plantCount) : 20;
                    return (
                      <CircleMarker
                        key={region.id}
                        center={[parseFloat(region.latitude), parseFloat(region.longitude)]}
                        radius={radius}
                        fillColor={REGION_COLORS[i % REGION_COLORS.length]}
                        color={selectedRegion?.id === region.id ? '#14532d' : 'white'}
                        weight={selectedRegion?.id === region.id ? 3 : 2}
                        fillOpacity={viewMode === 'plants' ? 0.55 : 0.7}
                        eventHandlers={{ click: () => setSelectedRegion(region) }}
                      >
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <h3 className="font-bold text-stone-800">{region.name} Region</h3>
                            <p className="text-xs text-stone-500 mt-1">Code: {region.code}</p>
                            <p className="mt-2 text-xs text-stone-600">
                              <b>{plantCount}</b> plant{plantCount === 1 ? '' : 's'} · <b>{entry?.count || 0}</b> documented use{entry?.count === 1 ? '' : 's'}
                            </p>
                            {region.description && <p className="mt-2 text-xs text-stone-600">{region.description}</p>}
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              )}
            </div>
          </Reveal>

          {/* Sidebar */}
          <div className="space-y-4">
            {selectedRegion ? (
              <div className="animate-scale-in bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" /> {selectedRegion.name}
                </h3>
                <p className="text-sm text-stone-500 mt-1">Region Code: {selectedRegion.code}</p>
                {selectedRegion.description && (
                  <p className="text-sm text-stone-600 mt-3 leading-relaxed">{selectedRegion.description}</p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-700">{Number(selectedRegion.latitude).toFixed(2)}°</p>
                    <p className="text-xs text-green-600">Latitude</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-700">{Number(selectedRegion.longitude).toFixed(2)}°</p>
                    <p className="text-xs text-green-600">Longitude</p>
                  </div>
                </div>

                {regionPlants.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">
                      Plants documented here ({regionPlants.length})
                    </p>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {regionPlants.map((plant) => (
                        <Link
                          key={plant.id}
                          to={`/plants/${plant.id}`}
                          className="group flex items-center gap-2.5 rounded-lg p-1.5 text-sm text-stone-700 transition hover:bg-emerald-50"
                        >
                          <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-emerald-50">
                            <img
                              src={plantImage({ image: '', scientific_name: plant.name })}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="truncate italic group-hover:text-emerald-700">{plant.name}</span>
                          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-stone-300 group-hover:text-emerald-600" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedRegion(null)}
                  className="mt-4 text-sm text-stone-500 transition hover:text-stone-700"
                >
                  ← Back to all regions
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-stone-400" />
                  <p className="text-sm font-medium text-stone-600">Click a region on the map</p>
                </div>
                <p className="text-xs text-stone-400">
                  Select a region to see its coordinates and the plants whose traditional uses are documented there.
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-800 mb-3">All Regions ({regions.length})</h3>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {regions.map((region, i) => {
                  const entry = byRegion.get(region.id);
                  const plantCount = entry ? entry.plants.size : 0;
                  return (
                    <button
                      key={region.id}
                      onClick={() => setSelectedRegion(region)}
                      className={`w-full text-left flex items-center gap-3 rounded-lg p-2.5 transition-all ${
                        selectedRegion?.id === region.id ? 'bg-green-50 text-green-800' : 'hover:bg-stone-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: REGION_COLORS[i % REGION_COLORS.length] }} />
                      <span className="text-sm font-medium">{region.name}</span>
                      <span className="ml-auto text-xs text-stone-400">{plantCount} plants</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
