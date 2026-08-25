import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geographyAPI, plantsAPI } from '../api/client';
import { MapPin, Leaf, Info, Layers } from 'lucide-react';

// Fix default marker icons for Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CAMEROON_CENTER = [7.3697, 12.3547];
const CAMEROON_ZOOM = 6;

export default function MapPage() {
  const [regions, setRegions] = useState([]);
  const [plants, setPlants] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewMode, setViewMode] = useState('regions'); // 'regions' or 'plants'

  useEffect(() => {
    geographyAPI.regions({ detailed: true }).then(r => {
      const data = r.data.results || r.data;
      setRegions(data.filter(reg => reg.latitude && reg.longitude));
    }).catch(() => {});
    plantsAPI.list().then(r => setPlants(r.data.results || r.data)).catch(() => {});
  }, []);

  const regionColors = [
    '#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb',
    '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c',
  ];

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-800 mb-1 flex items-center gap-3">
              <MapPin className="w-7 h-7 text-green-600" /> Geographic Knowledge Map
            </h1>
            <p className="text-stone-500">Explore plant distribution across Cameroon's regions</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('regions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'regions' ? 'bg-green-700 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-1.5" />Regions
            </button>
            <button
              onClick={() => setViewMode('plants')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'plants' ? 'bg-green-700 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              <Leaf className="w-4 h-4 inline mr-1.5" />Plants
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm" style={{ height: '600px' }}>
            <MapContainer
              center={CAMEROON_CENTER}
              zoom={CAMEROON_ZOOM}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {viewMode === 'regions' && regions.map((region, i) => (
                <CircleMarker
                  key={region.id}
                  center={[parseFloat(region.latitude), parseFloat(region.longitude)]}
                  radius={20}
                  fillColor={regionColors[i % regionColors.length]}
                  color="white"
                  weight={2}
                  opacity={1}
                  fillOpacity={0.7}
                  eventHandlers={{ click: () => setSelectedRegion(region) }}
                >
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <h3 className="font-bold text-stone-800">{region.name} Region</h3>
                      <p className="text-xs text-stone-500 mt-1">Code: {region.code}</p>
                      {region.description && <p className="text-xs text-stone-600 mt-2">{region.description}</p>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {viewMode === 'plants' && regions.map((region, i) => (
                <Marker
                  key={region.id}
                  position={[parseFloat(region.latitude), parseFloat(region.longitude)]}
                  eventHandlers={{ click: () => setSelectedRegion(region) }}
                >
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <h3 className="font-bold text-stone-800">{region.name}</h3>
                      <p className="text-xs text-stone-500 mt-1">
                        Plants documented in this region
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected Region Info */}
            {selectedRegion ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" /> {selectedRegion.name}
                </h3>
                <p className="text-sm text-stone-500 mt-1">Region Code: {selectedRegion.code}</p>
                {selectedRegion.description && (
                  <p className="text-sm text-stone-600 mt-3">{selectedRegion.description}</p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-700">
                      {selectedRegion.latitude?.toFixed(2)}°
                    </p>
                    <p className="text-xs text-green-600">Latitude</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-700">
                      {selectedRegion.longitude?.toFixed(2)}°
                    </p>
                    <p className="text-xs text-green-600">Longitude</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRegion(null)} className="mt-4 text-sm text-stone-500 hover:text-stone-700">
                  ← Back to all regions
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-stone-400" />
                  <p className="text-sm font-medium text-stone-600">Click a region on the map</p>
                </div>
                <p className="text-xs text-stone-400">Select a region to see detailed information about its traditional knowledge.</p>
              </div>
            )}

            {/* Regions List */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-800 mb-3">All Regions ({regions.length})</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {regions.map((region, i) => (
                  <button
                    key={region.id}
                    onClick={() => setSelectedRegion(region)}
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                      selectedRegion?.id === region.id ? 'bg-green-50 text-green-800' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: regionColors[i % regionColors.length] }} />
                    <span className="text-sm font-medium">{region.name}</span>
                    <span className="ml-auto text-xs text-stone-400">{region.code}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
