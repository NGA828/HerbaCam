import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, identificationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Leaf, Camera, Heart, ArrowRight, TrendingUp, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useToast } from '../contexts/ToastContext';
import { CountUp, Reveal } from '../components/ui/motion';
import { plantImage } from '../utils/images';

const COLORS = ['#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed'];

export default function UserDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [recentIds, setRecentIds] = useState([]);

  useEffect(() => {
    analyticsAPI.dashboard()
      .then(r => setStats(r.data))
      .catch(() => toast.error('Dashboard data unavailable', 'Some statistics could not be loaded.'));
    identificationAPI.history()
      .then(r => setRecentIds((r.data.results || r.data).slice(0, 5)))
      .catch(() => {});
  }, [toast]);

  const pieData = stats ? [
    { name: 'Plants', value: stats.total_plants || 0 },
    { name: 'Traditional Uses', value: stats.total_traditional_uses || 0 },
    { name: 'Identifications', value: stats.total_identifications || 0 },
  ].filter(d => d.value > 0) : [];

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-48 rounded-2xl" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-shimmer h-28 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="skeleton-shimmer h-72 rounded-xl" />
          <div className="lg:col-span-2 skeleton-shimmer h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative">
          <h2 className="text-2xl font-bold mb-2">Welcome back, {user?.first_name || user?.username}! 👋</h2>
          <p className="text-green-100 mb-6">Explore traditional plant knowledge and identify medicinal plants with AI.</p>
          <div className="flex gap-3">
            <Link to="/identify" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-green-700 rounded-xl font-medium hover:bg-green-50 transition-colors shadow-sm">
              <Camera className="w-4 h-4" /> Identify Plant
            </Link>
            <Link to="/symptoms" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-colors">
              Search Symptoms
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Leaf, label: 'Plants in Database', value: stats?.total_plants || 0, bgColor: 'bg-green-50', iconColor: 'text-green-600', ringColor: 'ring-green-100' },
          { icon: Camera, label: 'My Identifications', value: stats?.my_identifications || 0, bgColor: 'bg-blue-50', iconColor: 'text-blue-600', ringColor: 'ring-blue-100' },
          { icon: Heart, label: 'My Favorites', value: stats?.my_favorites || 0, bgColor: 'bg-red-50', iconColor: 'text-red-600', ringColor: 'ring-red-100' },
          { icon: TrendingUp, label: 'Traditional Uses', value: stats?.total_traditional_uses || 0, bgColor: 'bg-amber-50', iconColor: 'text-amber-600', ringColor: 'ring-amber-100' },
        ].map((stat, i) => (
          <Reveal key={stat.label} delay={i * 70}>
            <div className="rounded-xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${stat.bgColor} ring-1 ${stat.ringColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-800"><CountUp value={stat.value} /></p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" /> Knowledge Overview
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-stone-400 text-sm">
              Loading chart...
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* Recent Identifications */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-800">Recent Identifications</h3>
            <Link to="/history" className="text-sm text-green-700 font-medium hover:text-green-800 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {recentIds.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-500">No identifications yet.</p>
              <Link to="/identify" className="text-green-700 font-medium text-sm mt-2 inline-block">Try one now →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentIds.map((id, index) => (
                <div key={id.id} style={{ animationDelay: `${index * 60}ms` }} className="animate-rise flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-stone-50">
                  <div className="w-14 h-14 bg-stone-100 rounded-xl overflow-hidden shrink-0 shadow-sm border border-stone-200">
                    <img src={plantImage(id.image)} alt="Identification" className="w-full h-full object-cover transition-transform hover:scale-110" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-stone-800 truncate">
                      {id.primary_result?.scientific_name || 'Processing...'}
                    </p>
                    <p className="text-xs text-stone-500">
                      {id.primary_result && `${(id.primary_result.confidence * 100).toFixed(0)}% confidence`}
                      {' • '}{new Date(id.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
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
    </div>
  );
}
