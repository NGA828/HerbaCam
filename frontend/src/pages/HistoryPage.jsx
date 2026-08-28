import { useState, useEffect } from 'react';
import { identificationAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Reveal } from '../components/ui/motion';
import { Camera, Trash2, Leaf, Flag, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { plantImage } from '../utils/images';

export default function HistoryPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    identificationAPI.history()
      .then(r => { setHistory(r.data.results || r.data); })
      .catch(() => toast.error('Could not load history', 'Your identification history did not load.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete this identification?',
      message: 'The image and its results will be removed from your history. This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await identificationAPI.delete(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success('Identification deleted', 'The record was removed from your history.');
    } catch {
      toast.error('Delete failed', 'The identification could not be removed.');
    }
  };

  const handleReport = async (item) => {
    const ok = await confirm({
      title: 'Report this identification?',
      message: 'Let reviewers know the result is wrong so matching can improve.',
      confirmLabel: 'Send report',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      await identificationAPI.report(item.id, { reason: 'Incorrect identification reported from history' });
      toast.success('Report sent', 'Thank you — reviewers will check this result.');
    } catch {
      toast.error('Could not send report', 'Please try again in a moment.');
    }
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
          {history.map((item, index) => (
            <Reveal key={item.id} delay={Math.min(index * 50, 300)}>
            <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-16 h-16 bg-stone-100 rounded-lg overflow-hidden shrink-0">
                {item.image && <img src={plantImage(item.image)} alt="" className="w-full h-full object-cover transition-transform hover:scale-110" />}
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
              <div className="flex items-center gap-1 shrink-0">
                <Link to={`/user/identify/${item.id}`} title="Open result" className="p-2 text-emerald-600 rounded-lg transition hover:bg-emerald-50">
                  <ExternalLink className="w-4 h-4" />
                </Link>
                {item.primary_result?.plant && (
                  <Link to={`/plants/${item.primary_result.plant}`} title="View plant" className="p-2 text-green-600 rounded-lg transition hover:bg-green-50">
                    <Leaf className="w-4 h-4" />
                  </Link>
                )}
                {item.status === 'COMPLETED' && (
                  <button onClick={() => handleReport(item)} title="Report incorrect" className="p-2 text-amber-500 rounded-lg transition hover:bg-amber-50">
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(item.id)} title="Delete" className="p-2 text-red-400 rounded-lg transition hover:bg-red-50 active:scale-90">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
