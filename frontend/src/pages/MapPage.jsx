import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
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
  ChevronRight
} from 'lucide-react';
import { plantImage } from '../utils/images';

const CAMEROON_CENTER = [7.3697, 12.3547];
const CAMEROON_ZOOM = 6;

const REGION_COLORS = [
  '#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb',
  '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c',
];

/** Radius (px) that scales with how many plants are documented in a region. */
function radiusFor(count) {
  return 14 + Math.min(28, Math.sqrt(count) * 6);
}

export default function MapPage() {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [uses, setUses] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewMode, setViewMode] = useState('regions');
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

  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
    // Optional: smoothly pan map to region (requires map ref, omitted for simplicity but recommended)
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
                <Sprout className="w-4 h-4" /> Plant Density
              </button>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* Map Container */}
          <Reveal className="lg:col-span-8" delay={60}>
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm relative h-[500px] lg:h-[650px]">
              {loading ? (
                <div className="absolute inset-0 bg-stone-100 animate-pulse flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-8 h-8 text-stone-300 mx-auto mb-3 animate-spin" />
                    <p className="text-sm font-medium text-stone-400">Loading geographic data...</p>
                  </div>
                </div>
              ) : (
                <MapContainer 
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

                  {regions.map((region, i) => {
                    const entry = byRegion.get(region.id);
                    const plantCount = entry ? entry.plants.size : 0;
                    const useCount = entry ? entry.count : 0;
                    const radius = viewMode === 'plants' ? radiusFor(plantCount) : 18;
                    const isSelected = selectedRegion?.id === region.id;
                    const color = REGION_COLORS[i % REGION_COLORS.length];

                    return (
                      <CircleMarker
                        key={region.id}
                        center={[parseFloat(region.latitude), parseFloat(region.longitude)]}
                        radius={radius}
                        fillColor={color}
                        color={isSelected ? '#14532d' : '#ffffff'}
                        weight={isSelected ? 3 : 2}
                        fillOpacity={viewMode === 'plants' ? 0.6 : 0.75}
                        eventHandlers={{ 
                          click: () => handleRegionSelect(region),
                          mouseover: (e) => { if (!isSelected) e.target.setStyle({ weight: 3, color: '#ffffff' }); },
                          mouseout: (e) => { if (!isSelected) e.target.setStyle({ weight: 2, color: '#ffffff' }); }
                        }}
                      >
                        <Popup className="custom-leaflet-popup" maxWidth={280}>
                          <div className="p-1">
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
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              )}
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
                              src={plantImage({ image: '', scientific_name: plant.name })}
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
                      Click on any region marker on the map, or select one from the list below, to view its coordinates and documented medicinal plants.
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
      
      {/* Global style override for Leaflet popup to match our design */}
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