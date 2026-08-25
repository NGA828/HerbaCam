import { useState, useEffect } from 'react';
import { analyticsAPI, preservationAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { Users, Leaf, FileText, AlertTriangle, BarChart3, Shield, MapPin } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    analyticsAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
    preservationAPI.risk({ level: 'HIGH' }).then(r => setRisks((r.data.results || r.data).slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-6 sm:p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Administration Dashboard</h2>
        <p className="text-stone-300">Manage the HerbaCam platform and monitor system health.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Users', value: stats?.total_users || 0, color: 'blue' },
          { icon: Leaf, label: 'Plants', value: stats?.total_plants || 0, color: 'green' },
          { icon: FileText, label: 'Pending Reviews', value: stats?.pending_submissions || 0, color: 'amber' },
          { icon: BarChart3, label: 'Identifications', value: stats?.total_identifications || 0, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-stone-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> User Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-stone-600">Practitioners</span><span className="font-medium">{stats?.total_practitioners || 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-stone-600">Experts</span><span className="font-medium">{stats?.total_experts || 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-stone-600">Total Submissions</span><span className="font-medium">{stats?.total_submissions || 0}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" /> High Risk Knowledge
          </h3>
          {risks.length === 0 ? (
            <p className="text-sm text-stone-500">No high-risk items detected.</p>
          ) : (
            <div className="space-y-2">
              {risks.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium text-stone-800">{r.plant_name || r.region_name}</span>
                  <span className="text-sm font-bold text-red-600">{r.risk_score}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Manage Plants', path: '/admin/plants', icon: Leaf, color: 'green' },
          { label: 'Manage Users', path: '/admin/users', icon: Users, color: 'blue' },
          { label: 'Knowledge', path: '/admin/knowledge', icon: FileText, color: 'amber' },
        ].map((item, i) => (
          <Link key={i} to={item.path}
            className="bg-white rounded-xl p-5 border border-stone-200 hover:shadow-md transition-all flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${item.color}-50 flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 text-${item.color}-600`} />
            </div>
            <span className="font-medium text-stone-700">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
