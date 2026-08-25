import { useState, useEffect } from 'react';
import { analyticsAPI, preservationAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { Users, Leaf, FileText, AlertTriangle, BarChart3, Shield, MapPin, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    analyticsAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
    preservationAPI.risk({ level: 'HIGH' }).then(r => setRisks((r.data.results || r.data).slice(0, 5))).catch(() => {});
  }, []);

  const userPieData = stats ? [
    { name: 'Practitioners', value: stats.total_practitioners || 0 },
    { name: 'Experts', value: stats.total_experts || 0 },
    { name: 'Users', value: Math.max(0, (stats.total_users || 0) - (stats.total_practitioners || 0) - (stats.total_experts || 0)) },
  ].filter(d => d.value > 0) : [];

  const activityData = stats ? [
    { name: 'Plants', count: stats.total_plants || 0 },
    { name: 'Uses', count: stats.total_traditional_uses || 0 },
    { name: 'Submissions', count: stats.total_submissions || 0 },
    { name: 'Identifications', count: stats.total_identifications || 0 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <h2 className="text-2xl font-bold mb-2">Administration Dashboard</h2>
          <p className="text-stone-300">Manage the HerbaCam platform and monitor system health.</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Users', value: stats?.total_users || 0, bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
          { icon: Leaf, label: 'Plants', value: stats?.total_plants || 0, bgColor: 'bg-green-50', iconColor: 'text-green-600' },
          { icon: FileText, label: 'Pending Reviews', value: stats?.pending_submissions || 0, bgColor: 'bg-amber-50', iconColor: 'text-amber-600' },
          { icon: BarChart3, label: 'Identifications', value: stats?.total_identifications || 0, bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-stone-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" /> Platform Activity
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* User Distribution */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> User Distribution
          </h3>
          {userPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={userPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                    {userPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-4 justify-center mt-2">
                {userPieData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-stone-400 text-sm">Loading...</div>
          )}
        </div>
      </div>

      {/* Risk Alert */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" /> High Risk Knowledge
        </h3>
        {risks.length === 0 ? (
          <div className="text-center py-6">
            <Shield className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">No high-risk items detected.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {risks.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-800">{r.plant_name || r.region_name}</p>
                    <p className="text-xs text-stone-500">{r.total_contributors} contributors • {r.total_traditional_uses} uses</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{r.risk_score}</p>
                  <p className="text-xs text-red-500 font-medium">{r.risk_level}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Manage Plants', path: '/admin/plants', icon: Leaf, bgColor: 'bg-green-50', iconColor: 'text-green-600' },
          { label: 'Manage Users', path: '/admin/users', icon: Users, bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
          { label: 'Knowledge', path: '/admin/knowledge', icon: FileText, bgColor: 'bg-amber-50', iconColor: 'text-amber-600' },
          { label: 'Analytics', path: '/admin/analytics', icon: BarChart3, bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
        ].map((item, i) => (
          <Link key={i} to={item.path}
            className="bg-white rounded-xl p-5 border border-stone-200 hover:shadow-md transition-all flex items-center gap-3 group">
            <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <item.icon className={`w-5 h-5 ${item.iconColor}`} />
            </div>
            <span className="font-medium text-stone-700">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
