import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { plantsAPI, geographyAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { Leaf, Search, X, SlidersHorizontal, Loader2 } from 'lucide-react';
import { plantImage, withImageFallback } from '../utils/images';

const HABITATS = ['FOREST', 'SAVANNA', 'MOUNTAIN', 'WETLAND', 'COASTAL', 'URBAN'];
const PARTS = [
  ['LEAF', 'Leaf'], ['ROOT', 'Root'], ['BARK', 'Bark'], ['STEM', 'Stem'],
  ['FLOWER', 'Flower'], ['FRUIT', 'Fruit'], ['SEED', 'Seed'], ['TUBER', 'Tuber'],
  ['WHOLE', 'Whole plant'], ['SAP', 'Sap'],
];
const EVIDENCE_LEVELS = ['INSUFFICIENT', 'PRELIMINARY', 'MODERATE', 'STRONG'];

export default function PlantsPage() {
  const { toast } = useToast();
  const [plants, setPlants] = useState([]);
  const [regions, setRegions] = useState([]);
  const [families, setFamilies] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [habitat, setHabitat] = useState('');
  const [family, setFamily] = useState('');
  const [part, setPart] = useState('');
  const [evidence, setEvidence] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    geographyAPI.regions().then(r => setRegions(r.data.results || r.data)).catch(() => {});
  }, []);

  const activeFilters = Boolean(search || selectedRegion || habitat || family || part || evidence);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // The advanced endpoint supports plant-part and evidence filters; the list
    // endpoint covers text, region, family and habitat.
    const advanced = Boolean(part || evidence);
    const params = {};
    if (search) params[advanced ? 'q' : 'search'] = search;
    if (selectedRegion) params.region = selectedRegion;
    if (habitat) params.habitat = habitat;
    if (family) params.family = family;
    if (part) params.part = part;
    if (evidence) params.evidence = evidence;

    const request = advanced ? plantsAPI.search(params) : plantsAPI.list(params);
    request
      .then(r => {
        if (cancelled) return;
        const rows = r.data.results || r.data || [];
        setPlants(rows);
        setFamilies(prev => {
          const known = new Set(prev);
          rows.forEach(p => p.family && known.add(p.family));
          return [...known].sort();
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load plants', 'The plant library did not respond. Please retry.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [search, selectedRegion, habitat, family, part, evidence, toast]);

  const clearFilters = () => {
    setLoading(true);
    setSearch('');
    setSelectedRegion('');
    setHabitat('');
    setFamily('');
    setPart('');
    setEvidence('');
  };

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Medicinal Plants</h1>
          <p className="text-stone-500">
            Explore Cameroonian traditional medicinal plants
            {!loading && <span className="ml-2 text-stone-400">· {plants.length} documented</span>}
          </p>
        </div>
        </Reveal>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input type="text" placeholder="Search by name or local name..." value={search} onChange={e => { setLoading(true); setSearch(e.target.value); }}
              className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow" />
            {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-300" />}
          </div>
          <select value={selectedRegion} onChange={e => { setLoading(true); setSelectedRegion(e.target.value); }}
            className="px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-w-[180px]">
            <option value="">All Regions</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => setShowFilters(v => !v)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition ${showFilters || part || evidence || habitat || family ? 'border-green-300 bg-green-50 text-green-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
          {activeFilters && (
            <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-3 text-stone-600 hover:text-red-600 transition-colors">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Habitat</span>
              <select value={habitat} onChange={e => { setLoading(true); setHabitat(e.target.value); }}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Any habitat</option>
                {HABITATS.map(h => <option key={h} value={h}>{h.charAt(0) + h.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Family</span>
              <select value={family} onChange={e => { setLoading(true); setFamily(e.target.value); }}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Any family</option>
                {families.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Plant part used</span>
              <select value={part} onChange={e => { setLoading(true); setPart(e.target.value); }}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Any part</option>
                {PARTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Evidence level</span>
              <select value={evidence} onChange={e => { setLoading(true); setEvidence(e.target.value); }}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Any level</option>
                {EVIDENCE_LEVELS.map(l => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="skeleton-shimmer aspect-[4/3]" />
                <div className="p-4 space-y-2">
                  <div className="skeleton-shimmer h-4 rounded w-3/4" />
                  <div className="skeleton-shimmer h-3 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : plants.length === 0 ? (
          <div className="text-center py-20 animate-fade-in-up">
            <Leaf className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-600">No plants found</h3>
            <p className="text-stone-400">Try adjusting your search or filters</p>
            {activeFilters && (
              <button onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800">
                <X className="w-4 h-4" /> Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plants.map((plant, index) => (
              <Link key={plant.id} to={`/plants/${plant.id}`}
                style={{ animationDelay: `${Math.min(index * 45, 500)}ms` }}
                className="animate-rise group card-hover hover-zoom bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="aspect-[4/3] bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
                  <img
                    src={plantImage(plant)}
                    alt={plant.common_name || plant.scientific_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={withImageFallback(plant)}
                  />
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
