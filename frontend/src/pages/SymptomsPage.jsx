import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { symptomsAPI } from '../api/client';
import { Search, Leaf, AlertTriangle } from 'lucide-react';
import { plantImage } from '../utils/images';

export default function SymptomsPage() {
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
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await symptomsAPI.search(query);
      setResults(res.data);
    } catch { setResults({ results: [], symptoms: [], message: 'Search failed.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Symptom Search</h1>
          <p className="text-stone-500">Find plants traditionally associated with specific symptoms</p>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input type="text" placeholder="Search by symptom (e.g., cough, fever, malaria...)" value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="px-8 py-4 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 transition-all">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Quick symptom buttons */}
        {!searched && symptoms.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-medium text-stone-500 mb-3">Popular searches:</p>
            <div className="flex flex-wrap gap-2">
              {symptoms.slice(0, 12).map(s => (
                <button key={s.id} onClick={() => { setQuery(s.name); handleSearch(); }}
                  className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm text-stone-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all">
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {results.results?.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-stone-600">No results found</h3>
                <p className="text-stone-400 mt-2">Try a different symptom or browse all plants</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-stone-500">{results.count || results.results?.length} result(s) found</p>
                {results.results?.map((item, i) => (
                  <div key={i} className="bg-white rounded-xl p-5 border border-stone-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                        {item.plant.image ? (
                          <img src={plantImage(item.plant.image)} alt="" className="w-full h-full object-cover rounded-xl transition-transform hover:scale-110" />
                        ) : (
                          <Leaf className="w-8 h-8 text-green-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/plants/${item.plant.id}`} className="font-semibold text-stone-800 hover:text-green-700 transition-colors">
                          {item.plant.common_name || item.plant.scientific_name}
                        </Link>
                        <p className="text-sm text-green-600 italic">{item.plant.scientific_name}</p>
                        <p className="text-sm text-stone-600 mt-2">{item.traditional_use}</p>
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                          {item.plant_part && <span className="px-2 py-1 bg-stone-100 rounded text-stone-600">{item.plant_part}</span>}
                          {item.preparation && <span className="px-2 py-1 bg-stone-100 rounded text-stone-600">{item.preparation}</span>}
                          {item.region && <span className="px-2 py-1 bg-green-50 rounded text-green-700">{item.region}</span>}
                          {item.is_verified && <span className="px-2 py-1 bg-blue-50 rounded text-blue-700">✓ Verified</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <strong>Disclaimer:</strong> These results show traditional associations, not medical treatments.
                    This information is educational and should not replace professional medical advice.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
