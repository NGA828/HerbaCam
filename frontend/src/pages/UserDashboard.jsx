import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, identificationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Leaf, Camera, Heart, Clock, ArrowRight, TrendingUp } from 'lucide-react';

export default function UserDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentIds, setRecentIds] = useState([]);

  useEffect(() => {
    analyticsAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
    identificationAPI.history().then(r => setRecentIds((r.data.results || r.data).slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 sm:p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Welcome back, {user?.first_name || user?.username}!</h2>
        <p className="text-green-100">Explore traditional plant knowledge and identify medicinal plants with AI.</p>
        <div className="flex gap-3 mt-6">
          <Link to="/identify" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-green-700 rounded-xl font-medium hover:bg-green-50 transition-colors">
            <Camera className="w-4 h-4" /> Identify Plant
          </Link>
          <Link to="/symptoms" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-colors">
            Search Symptoms
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Leaf, label: 'Plants in Database', value: stats?.total_plants || 0, color: 'green' },
          { icon: Camera, label: 'My Identifications', value: stats?.my_identifications || 0, color: 'blue' },
          { icon: Heart, label: 'My Favorites', value: stats?.my_favorites || 0, color: 'red' },
          { icon: TrendingUp, label: 'Traditional Uses', value: stats?.total_traditional_uses || 0, color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-stone-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Identifications */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-stone-800">Recent Identifications</h3>
          <Link to="/history" className="text-sm text-green-700 font-medium hover:text-green-800 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentIds.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center">No identifications yet. <Link to="/identify" className="text-green-700 font-medium">Try one now!</Link></p>
        ) : (
          <div className="space-y-3">
            {recentIds.map(id => (
              <div key={id.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-stone-50">
                <div className="w-12 h-12 bg-stone-100 rounded-lg overflow-hidden shrink-0">
                  {id.image && <img src={`http://localhost:8000${id.image}`} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-stone-800 truncate">
                    {id.primary_result?.scientific_name || 'Processing...'}
                  </p>
                  <p className="text-xs text-stone-500">
                    {id.primary_result && `${(id.primary_result.confidence * 100).toFixed(0)}% confidence`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  id.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                  id.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {id.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
