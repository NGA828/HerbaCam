import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { Heart, Leaf } from 'lucide-react';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.favorites().then(r => { setFavorites(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const remove = async (plantId) => {
    await analyticsAPI.removeFavorite(plantId);
    setFavorites(prev => prev.filter(f => f.plant !== plantId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800">My Favorites</h2>
        <span className="text-sm text-stone-500">{favorites.length} plant(s)</span>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Heart className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-medium text-stone-600">No favorites yet</h3>
          <p className="text-sm text-stone-400 mt-1">Browse plants and add them to your favorites.</p>
          <Link to="/plants" className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800">
            <Leaf className="w-4 h-4" /> Browse Plants
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map(fav => (
            <div key={fav.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <Link to={`/plants/${fav.plant}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                  <Leaf className="w-6 h-6 text-green-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-800 group-hover:text-green-700 truncate">
                    {fav.plant_detail?.common_name || fav.plant_detail?.scientific_name || `Plant #${fav.plant}`}
                  </p>
                  <p className="text-xs text-stone-500 italic">{fav.plant_detail?.scientific_name}</p>
                </div>
              </Link>
              <button onClick={() => remove(fav.plant)} className="mt-3 text-xs text-red-500 hover:text-red-700">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
