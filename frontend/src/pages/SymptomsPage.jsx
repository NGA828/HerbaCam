import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { symptomsAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { 
  Search, 
  Leaf, 
  AlertTriangle, 
  Loader2, 
  X, 
  Sprout, 
  MapPin, 
  FlaskConical, 
  CheckCircle2 
} from 'lucide-react';
import { plantImage } from '../utils/images';

export default function SymptomsPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    symptomsAPI.list().then(r => setSymptoms(r.data.results || r.data)).catch(() => {});
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) {
      toast.info('Enter a symptom', 'Type a symptom such as "malaria" or "cough".');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await symptomsAPI.search(query);
      setResults(res.data);
      const count = res.data?.results?.length || 0;
      if (count === 0) {
        toast.warning('No matches', `No traditionally documented plant use was found for "${query}".`);
      } else {
        toast.success(`${count} result${count === 1 ? '' : 's'} found`, `Traditional uses documented for "${query}".`);
      }
    } catch {
      setResults({ results: [], symptoms: [], message: 'Search failed.' });
      toast.error('Search failed', 'We could not reach the symptom search service.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearched(false);
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <Reveal>
            <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-2xl mb-4">
              <Sprout className="w-8 h-8 text-green-700" />
            </div>
            <h1 className="text-4xl font-bold text-stone-800 mb-3 tracking-tight">
              Traditional Symptom Search
            </h1>
            <p className="text-lg text-stone-500 max-w-2xl mx-auto leading-relaxed">
              Discover plants traditionally associated with specific health symptoms. 
              Explore centuries of botanical knowledge.
            </p>
          </Reveal>
        </div>

        {/* Search Form */}
        <Reveal delay={100}>
          <form onSubmit={handleSearch} className="mb-10 relative max-w-3xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-5 w-5 h-5 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search by symptom (e.g., cough, fever, malaria...)" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-14 pr-32 py-4 bg-white border border-stone-200 rounded-2xl text-lg shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-stone-400" 
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-24 p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button 
                type="submit" 
                disabled={loading}
                className="absolute right-2 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Searching</>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>
        </Reveal>

        {/* Quick Symptom Buttons */}
        {!searched && symptoms.length > 0 && (
          <Reveal delay={200}>
            <div className="mb-12 max-w-3xl mx-auto">
              <p className="text-sm font-semibold text-stone-500 mb-4 uppercase tracking-wider text-center">
                Popular Searches
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {symptoms.slice(0, 12).map(s => (
                  <Link 
                    key={s.id} 
                    to={`/symptoms/${s.id}`}
                    className="group inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:border-green-300 hover:bg-green-50 hover:text-green-800 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <Leaf className="w-3.5 h-3.5 text-stone-400 group-hover:text-green-600 transition-colors" />
                    {s.name}
                    {s.traditional_uses_count ? (
                      <span className="ml-1 px-1.5 py-0.5 bg-stone-100 group-hover:bg-green-100 rounded-md text-xs text-stone-500 group-hover:text-green-700 transition-colors">
                        {s.traditional_uses_count}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Results Section */}
        {searched && (
          <div className="max-w-3xl mx-auto">
            {loading ? (
              // Skeleton Loader
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm animate-pulse">
                    <div className="flex items-start gap-5">
                      <div className="w-24 h-24 bg-stone-200 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-stone-200 rounded w-1/3" />
                        <div className="h-4 bg-stone-200 rounded w-1/4" />
                        <div className="h-4 bg-stone-200 rounded w-full" />
                        <div className="flex gap-2 mt-2">
                          <div className="h-6 bg-stone-200 rounded w-16" />
                          <div className="h-6 bg-stone-200 rounded w-20" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results?.results?.length === 0 ? (
              // Empty State
              <Reveal>
                <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 border-dashed">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-stone-50 rounded-full mb-6">
                    <Search className="w-10 h-10 text-stone-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-stone-700 mb-2">No results found</h3>
                  <p className="text-stone-500 max-w-md mx-auto mb-6">
                    We couldn't find any traditionally documented plant uses for "<span className="font-medium text-stone-700">{query}</span>". Try a different keyword or browse our popular searches.
                  </p>
                  <button 
                    onClick={clearSearch}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              </Reveal>
            ) : (
              // Results List
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-stone-500">
                    <span className="text-stone-800 font-semibold">{results.count || results.results?.length}</span> result(s) found for "<span className="text-stone-800">{query}</span>"
                  </p>
                  <button 
                    onClick={clearSearch}
                    className="text-sm text-green-700 hover:text-green-800 font-medium hover:underline"
                  >
                    Clear search
                  </button>
                </div>
                
                <div className="space-y-4">
                  {results.results?.map((item, i) => (
                    <Reveal key={item.plant.id || i} delay={Math.min(i * 50, 300)}>
                      <Link to={`/plants/${item.plant.id}`} className="block group">
                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-green-200">
                          <div className="flex items-start gap-5">
                            {/* Plant Image */}
                            <div className="w-24 h-24 bg-stone-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-stone-100 group-hover:border-green-100 transition-colors">
                              {item.plant.image ? (
                                <img 
                                  src={plantImage(item.plant.image)} 
                                  alt={item.plant.common_name || item.plant.scientific_name} 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  loading="lazy"
                                />
                              ) : (
                                <Leaf className="w-10 h-10 text-stone-300" />
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-bold text-lg text-stone-800 group-hover:text-green-800 transition-colors line-clamp-1">
                                    {item.plant.common_name || item.plant.scientific_name}
                                  </h3>
                                  <p className="text-sm text-stone-500 italic font-medium">
                                    {item.plant.scientific_name}
                                  </p>
                                </div>
                                {item.is_verified && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100 shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Verified
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-stone-600 mt-3 leading-relaxed line-clamp-2">
                                {item.traditional_use}
                              </p>
                              
                              {/* Metadata Badges */}
                              <div className="flex flex-wrap gap-2 mt-4">
                                {item.plant_part && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-medium border border-stone-200">
                                    <Sprout className="w-3.5 h-3.5" />
                                    {item.plant_part}
                                  </span>
                                )}
                                {item.preparation && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-medium border border-stone-200">
                                    <FlaskConical className="w-3.5 h-3.5" />
                                    {item.preparation}
                                  </span>
                                )}
                                {item.region && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-100">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {item.region}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>

                {/* Disclaimer */}
                <Reveal delay={400}>
                  <div className="mt-8 p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-4">
                    <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-1">Medical Disclaimer</h4>
                      <p className="text-sm text-amber-800/90 leading-relaxed">
                        These results reflect <strong>traditional and historical associations</strong>, not clinically proven medical treatments. 
                        This information is provided strictly for educational purposes and should never replace professional medical advice, 
                        diagnosis, or treatment. Always consult a qualified healthcare provider before using any plant for medicinal purposes.
                      </p>
                    </div>
                  </div>
                </Reveal>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}