import { useState, useEffect } from 'react';
import { knowledgeAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { CountUp, Reveal } from '../components/ui/motion';
import { FileText, Plus, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';

export default function PractitionerDashboard() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeAPI.submissions({ page_size: 100 })
      .then(r => { setSubmissions(r.data.results || r.data); })
      .catch(() => toast.error('Could not load your contributions', 'Please refresh to try again.'))
      .finally(() => setLoading(false));
  }, [toast]);

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
          { label: 'Total', count: submissions.length, tone: 'bg-stone-100 text-stone-600', icon: FileText },
          { label: 'Approved', count: statusCounts.PUBLISHED || 0, tone: 'bg-green-50 text-green-600', icon: CheckCircle },
          { label: 'Pending', count: (statusCounts.SUBMITTED || 0) + (statusCounts.UNDER_REVIEW || 0), tone: 'bg-amber-50 text-amber-600', icon: Clock },
          { label: 'Needs revision', count: (statusCounts.REJECTED || 0) + (statusCounts.REVISION_REQUESTED || 0), tone: 'bg-red-50 text-red-600', icon: XCircle },
        ].map((stat, i) => (
          <Reveal key={stat.label} delay={i * 70}>
            <div className="rounded-xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-800"><CountUp value={stat.count} /></p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              </div>
            </div>
          </Reveal>
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
            {submissions.slice(0, 10).map((sub, index) => (
              <Link key={sub.id} to={`/practitioner/contributions/${sub.id}`}
                style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                className="animate-rise flex items-center gap-4 rounded-lg border border-stone-100 p-4 transition-all hover:-translate-y-0.5 hover:border-stone-200 hover:shadow-sm">
                <div className={`w-2 h-12 rounded-full ${
                  sub.status === 'PUBLISHED' ? 'bg-green-500' :
                  sub.status === 'REJECTED' ? 'bg-red-500' :
                  sub.status === 'REVISION_REQUESTED' ? 'bg-amber-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">
                    {sub.plant_name || sub.proposed_scientific_name || 'Plant request'}
                    <span className="text-stone-400"> — {sub.traditional_use_description?.slice(0, 60)}…</span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                    {sub.review_comments && ` • Review: ${sub.review_comments.slice(0, 50)}…`}
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
                  sub.status === 'PUBLISHED' ? 'bg-green-50 text-green-700' :
                  sub.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                  sub.status === 'REVISION_REQUESTED' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {sub.status.replace('_', ' ')}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
