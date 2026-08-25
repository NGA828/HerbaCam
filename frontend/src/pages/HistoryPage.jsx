import { useState, useEffect } from 'react';
import { identificationAPI } from '../api/client';
import { Camera, Trash2, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    identificationAPI.history().then(r => { setHistory(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this identification from history?')) return;
    await identificationAPI.delete(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800">Identification History</h2>
        <Link to="/identify" className="px-4 py-2 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800">
          New Identification
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />)}</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Camera className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-medium text-stone-600">No identification history</h3>
          <p className="text-sm text-stone-400 mt-1">Your plant identifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-stone-100 rounded-lg overflow-hidden shrink-0">
                {item.image && <img src={`${item.image.replace(/^https?:\/\/[^/]+/, '')}`} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800">
                  {item.primary_result?.scientific_name || 'Processing...'}
                </p>
                <p className="text-sm text-stone-500">
                  {item.primary_result && `${(item.primary_result.confidence * 100).toFixed(0)}% confidence`}
                  {' • '}{new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.primary_result?.plant && (
                  <Link to={`/plants/${item.primary_result.plant}`} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                    <Leaf className="w-4 h-4" />
                  </Link>
                )}
                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
