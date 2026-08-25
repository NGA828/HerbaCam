import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { plantsAPI, geographyAPI } from '../api/client';
import { Leaf, Search, MapPin, Filter, X } from 'lucide-react';

export default function PlantsPage() {
  const [plants, setPlants] = useState([]);
  const [regions, setRegions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    geographyAPI.regions().then(r => setRegions(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (selectedRegion) params.region = selectedRegion;
    plantsAPI.list(params).then(r => { setPlants(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [search, selectedRegion]);

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Medicinal Plants</h1>
          <p className="text-stone-500">Explore Cameroonian traditional medicinal plants</p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input type="text" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
          </div>
          <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
            className="px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-w-[180px]">
            <option value="">All Regions</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {(search || selectedRegion) && (
            <button onClick={() => { setSearch(''); setSelectedRegion(''); }}
              className="flex items-center gap-2 px-4 py-3 text-stone-600 hover:text-red-600 transition-colors">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-stone-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-stone-100 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : plants.length === 0 ? (
          <div className="text-center py-20">
            <Leaf className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-600">No plants found</h3>
            <p className="text-stone-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plants.map(plant => (
              <Link key={plant.id} to={`/plants/${plant.id}`}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="aspect-[4/3] bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
                  {plant.image ? (
                    <img src={plant.image.replace(/^https?:\/\/[^/]+/, '')} alt={plant.common_name} className="w-full h-full object-cover" />
                  ) : (
                    <Leaf className="w-16 h-16 text-green-200 group-hover:text-green-300 transition-colors" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-stone-800 group-hover:text-green-700 transition-colors">
                    {plant.common_name || plant.scientific_name}
                  </h3>
                  <p className="text-sm text-stone-500 italic">{plant.scientific_name}</p>
                  {plant.local_names?.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1 truncate">
                      Also known as: {plant.local_names.map(n => n.name).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">{plant.family || 'Documented'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
