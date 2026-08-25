import { useState, useEffect } from 'react';
import { knowledgeAPI } from '../api/client';
import { ClipboardCheck, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

export default function ExpertDashboard() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeAPI.pending().then(r => { setPending(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleReview = async (id, action) => {
    const reason = action === 'reject' ? prompt('Reason for rejection:') : '';
    if (action === 'reject' && !reason) return;
    try {
      await knowledgeAPI.review(id, { action, reason, comments: '' });
      setPending(prev => prev.filter(p => p.id !== id));
    } catch {
      alert('Review failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Expert Review Panel</h2>
        <p className="text-blue-100">Review and verify traditional knowledge submissions.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending.length}</p>
              <p className="text-xs text-stone-500">Pending Reviews</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-800 mb-4">Pending Submissions</h3>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-lg animate-pulse" />)}</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-stone-500">All caught up! No pending submissions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(sub => (
              <div key={sub.id} className="border border-stone-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="font-semibold text-stone-800">
                      Submission #{sub.id} by {sub.contributor_name || 'Practitioner'}
                    </h4>
                    <p className="text-sm text-stone-500">{new Date(sub.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">{sub.status}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
                  <div><span className="text-stone-500">Plant:</span> <span className="font-medium">{sub.plant_name || sub.proposed_scientific_name || 'N/A'}</span></div>
                  <div><span className="text-stone-500">Local Name:</span> <span className="font-medium">{sub.local_name || 'N/A'}</span></div>
                  <div><span className="text-stone-500">Symptom:</span> <span className="font-medium">{sub.proposed_symptom_name || sub.symptom || 'N/A'}</span></div>
                  <div><span className="text-stone-500">Region:</span> <span className="font-medium">{sub.region || 'N/A'}</span></div>
                  <div><span className="text-stone-500">Part:</span> <span className="font-medium">{sub.plant_part || 'N/A'}</span></div>
                  <div><span className="text-stone-500">Preparation:</span> <span className="font-medium">{sub.preparation_method || 'N/A'}</span></div>
                </div>

                <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3 mb-4">
                  <strong>Description:</strong> {sub.traditional_use_description}
                </p>
                {sub.cultural_context && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4 italic">
                    <strong>Cultural Context:</strong> {sub.cultural_context}
                  </p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => handleReview(sub.id, 'approve')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleReview(sub.id, 'reject')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => handleReview(sub.id, 'request_revision')}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                    <MessageSquare className="w-4 h-4" /> Request Revision
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
