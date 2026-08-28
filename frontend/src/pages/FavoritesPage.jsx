import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Reveal } from '../components/ui/motion';
import { Link } from 'react-router-dom';
import { Heart, Leaf, Trash2 } from 'lucide-react';
import { plantImage, withImageFallback } from '../utils/images';

export default function FavoritesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.favorites()
      .then(r => { setFavorites(r.data.results || r.data); })
      .catch(() => toast.error('Could not load favorites', 'Your saved plants did not load.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const remove = async (fav) => {
    const ok = await confirm({
      title: 'Remove from favorites?',
      message: 'You can always save this plant again from its detail page.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await analyticsAPI.removeFavorite(fav.plant);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
      toast.success('Removed from favorites', `${fav.plant_detail?.common_name || 'Plant'} is no longer saved.`);
    } catch {
      toast.error('Could not remove favorite', 'Please try again in a moment.');
    }
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
          {favorites.map((fav, index) => (
            <Reveal key={fav.id} delay={Math.min(index * 50, 300)}>
            <div className="group rounded-xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <Link to={`/plants/${fav.plant}`} className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-green-50 shrink-0">
                  <img
                    src={plantImage(fav.plant_detail)}
                    alt={fav.plant_detail?.common_name || 'Plant'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onError={withImageFallback(fav.plant_detail)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-800 group-hover:text-green-700 truncate">
                    {fav.plant_detail?.common_name || fav.plant_detail?.scientific_name || `Plant #${fav.plant}`}
                  </p>
                  <p className="text-xs text-stone-500 italic truncate">{fav.plant_detail?.scientific_name}</p>
                </div>
              </Link>
              <button onClick={() => remove(fav)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700 active:scale-95">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
