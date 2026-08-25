import { useState, useEffect } from 'react';
import { knowledgeAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { FileText, Plus, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function PractitionerDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeAPI.submissions().then(r => { setSubmissions(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const statusCounts = submissions.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 sm:p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Practitioner Dashboard</h2>
        <p className="text-amber-100">Share your traditional medicine knowledge with the community.</p>
        <Link to="/practitioner/contributions/new" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-white text-amber-700 rounded-xl font-medium hover:bg-amber-50 transition-colors">
          <Plus className="w-4 h-4" /> New Contribution
        </Link>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: submissions.length, color: 'stone', icon: FileText },
          { label: 'Approved', count: statusCounts.PUBLISHED || 0, color: 'green', icon: CheckCircle },
          { label: 'Pending', count: (statusCounts.SUBMITTED || 0) + (statusCounts.UNDER_REVIEW || 0), color: 'amber', icon: Clock },
          { label: 'Rejected', count: statusCounts.REJECTED || 0, color: 'red', icon: XCircle },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-stone-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-800 mb-4">My Submissions</h3>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-stone-100 rounded-lg animate-pulse" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">No submissions yet.</p>
            <Link to="/practitioner/contributions/new" className="text-green-700 font-medium text-sm mt-2 inline-block">
              Submit your first contribution →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.slice(0, 10).map(sub => (
              <div key={sub.id} className="flex items-center gap-4 p-4 rounded-lg border border-stone-100 hover:border-stone-200 transition-colors">
                <div className={`w-2 h-12 rounded-full ${
                  sub.status === 'PUBLISHED' ? 'bg-green-500' :
                  sub.status === 'REJECTED' ? 'bg-red-500' :
                  sub.status === 'REVISION_REQUESTED' ? 'bg-amber-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-stone-800 truncate">
                    {sub.proposed_scientific_name || sub.plant || 'New submission'} - {sub.traditional_use_description?.slice(0, 60)}...
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                    {sub.review_comments && ` • Review: ${sub.review_comments.slice(0, 50)}...`}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  sub.status === 'PUBLISHED' ? 'bg-green-50 text-green-700' :
                  sub.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                  sub.status === 'REVISION_REQUESTED' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {sub.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
