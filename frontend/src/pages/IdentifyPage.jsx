import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { identificationAPI } from '../api/client';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Reveal } from '../components/ui/motion';
import {
  Camera, Upload, X, AlertCircle, Leaf, AlertTriangle, ArrowRight, Image, Info,
  Brain, FlaskConical, Flag, Loader2,
} from 'lucide-react';

export default function IdentifyPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Visiting /user/identify/<id> reopens a previous identification.
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    identificationAPI.detail(id)
      .then((res) => {
        setResult(res.data);
        toast.info(`Identification #${id} loaded`, 'This is a previous result from your history.');
      })
      .catch(() => {
        setError('That identification could not be loaded.');
        toast.error('Identification unavailable', 'It may have been deleted from your history.');
      })
      .finally(() => setLoading(false));
  }, [id, toast]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.');
      toast.error('Unsupported file type', 'Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      toast.error('Image too large', 'The image must be under 10 MB.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    toast.success('Image ready', `${f.name} is ready to analyse.`);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const input = { target: { files: [f] } };
      handleFileChange(input);
    }
  };

  const handleIdentify = async () => {
    if (!file) {
      toast.info('Choose an image first', 'Upload or drop a photo of the plant you want identified.');
      return;
    }
    if (!user) {
      setError('Please log in to use plant identification.');
      toast.warning('Sign in required', 'Log in to analyse a plant image with AI.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    const pending = toast.loading('Analysing your image…', 'The vision model is comparing it with the HerbaCam library.');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await identificationAPI.identify(formData);
      setResult(res.data);
      const primary = (res.data.results || []).find((r) => r.is_primary);
      const failed = res.data.status === 'FAILED' || res.data.error;
      toast.dismiss(pending);
      if (failed) {
        toast.error('Identification inconclusive', res.data.error || 'The model could not identify this image.');
      } else {
        toast.success(
          'Identification complete',
          primary ? `Best match: ${primary.scientific_name} (${Math.round((primary.confidence || 0) * 100)}% confidence).` : 'Results are ready below.',
        );
      }
    } catch (err) {
      toast.dismiss(pending);
      const message = err.response?.data?.error || err.response?.data?.detail || 'Identification failed. Please try again.';
      setError(message);
      toast.error('Identification failed', message);
    } finally {
      setLoading(false);
    }
  };

  const reportResult = async () => {
    const idToReport = result?.id || id;
    if (!idToReport) return;
    const ok = await confirm({
      title: 'Report this identification?',
      message: 'Tell our reviewers what is wrong so the AI matching can be improved. Your report is attached to this identification.',
      confirmLabel: 'Send report',
      tone: 'primary',
    });
    if (!ok) return;
    setReporting(true);
    try {
      await identificationAPI.report(idToReport, { reason: 'Flagged as incorrect from the identification screen' });
      toast.success('Report sent', 'Thank you — our reviewers will look at this identification.');
    } catch {
      toast.error('Could not send report', 'Please try again from your history page.');
    } finally {
      setReporting(false);
    }
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-700 bg-green-50 ring-green-200';
    if (conf >= 0.5) return 'text-amber-700 bg-amber-50 ring-amber-200';
    if (conf >= 0.3) return 'text-orange-700 bg-orange-50 ring-orange-200';
    return 'text-red-700 bg-red-50 ring-red-200';
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 0.8) return 'High Confidence';
    if (conf >= 0.5) return 'Moderate Confidence';
    if (conf >= 0.3) return 'Low Confidence';
    return 'Uncertain';
  };

  const getConfidenceBarColor = (conf) => {
    if (conf >= 0.8) return 'bg-green-500';
    if (conf >= 0.5) return 'bg-amber-500';
    if (conf >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const isDemo = result?.mode === 'demo';

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2 flex items-center gap-3">
            <Brain className="w-8 h-8 text-green-600" /> Identify a Plant
          </h1>
          <p className="text-stone-500">Upload a photo and our AI will analyze and identify the plant species</p>
        </div>

        {!user && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Please <Link to="/login" className="font-medium underline">log in</Link> or <Link to="/register" className="font-medium underline">create an account</Link> to use plant identification.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload */}
          <div>
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${preview ? 'border-green-300 bg-green-50/50' : 'border-stone-300 hover:border-green-400 hover:bg-green-50/30'}`}
              onDragOver={e => e.preventDefault()} onDrop={handleDrop}
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Preview" className="w-full max-h-80 object-contain rounded-xl" />
                  <button onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ) : (
                <div className="py-8">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                    <Camera className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="font-medium text-stone-700 mb-2">Drop your plant image here</p>
                  <p className="text-sm text-stone-500 mb-4">or click to browse</p>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-green-700 text-white rounded-xl cursor-pointer hover:bg-green-800 transition-colors shadow-sm">
                    <Upload className="w-4 h-4" /> Choose Image
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                  </label>
                  <p className="text-xs text-stone-400 mt-3">JPEG, PNG, or WebP • Max 10MB</p>
                </div>
              )}
            </div>

            {file && (
              <button onClick={handleIdentify} disabled={loading || !user}
                className="w-full mt-4 py-4 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" /> Identify Plant
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Identification Error</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* How it works */}
            <Reveal>
            <div className="mt-6 bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> How It Works
              </h3>
              <div className="space-y-2 text-sm text-stone-600">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold shrink-0">1</span>
                  <span>Upload a clear photo of the plant (leaf, flower, fruit, or whole plant)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold shrink-0">2</span>
                  <span>Our AI analyzes the image using vision models trained on botanical data</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold shrink-0">3</span>
                  <span>Django matches the identification against our Cameroonian plant database</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold shrink-0">4</span>
                  <span>You receive the identification with confidence score and traditional knowledge</span>
                </div>
              </div>
            </div>
            </Reveal>
          </div>

          {/* Result */}
          <div>
            {result && result.results ? (
              <div className="space-y-4 animate-fade-in-up">
                {/* Mode indicator */}
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                  isDemo ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {isDemo ? (
                    <>
                      <FlaskConical className="w-4 h-4" />
                      <span>Demo Mode — Using simulated AI identification</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>Live AI Analysis — Powered by OpenRouter</span>
                    </>
                  )}
                </div>

                {/* Demo notice */}
                {result.demo_notice && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    <p className="font-medium mb-1">⚗️ Demo Mode Notice</p>
                    <p>{result.demo_notice}</p>
                    <p className="mt-2 text-xs text-amber-600">
                      To enable live AI: Set <code className="bg-amber-100 px-1 rounded">OPENROUTER_API_KEY</code> in your <code className="bg-amber-100 px-1 rounded">.env</code> file.
                    </p>
                  </div>
                )}

                {/* Database not found notice */}
                {result.database_notice && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                    <p className="font-medium mb-1">📚 Knowledge Unavailable</p>
                    <p>{result.database_notice}</p>
                  </div>
                )}

                {/* Identification results */}
                {result.results.map((r, i) => (
                  <div key={r.id || i} className={`bg-white rounded-2xl p-6 border transition-all ${i === 0 ? 'border-green-200 shadow-md ring-1 ring-green-100' : 'border-stone-200'}`}>
                    {i === 0 && (
                      <p className="text-xs text-green-600 font-semibold mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5" /> Primary Identification
                      </p>
                    )}
                    {i > 0 && <p className="text-xs text-stone-400 font-medium mb-3 uppercase tracking-wider">Alternative #{i}</p>}
                    
                    <h3 className="text-xl font-bold text-stone-800 italic">{r.scientific_name}</h3>
                    {r.common_name && <p className="text-stone-600 mt-0.5">{r.common_name}</p>}
                    
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ${getConfidenceColor(r.confidence)}`}>
                        {getConfidenceLabel(r.confidence)} — {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${getConfidenceBarColor(r.confidence)}`}
                          style={{ width: `${r.confidence * 100}%` }} />
                      </div>
                    </div>
                    
                    {i === 0 && r.plant && (
                      <Link to={`/plants/${r.plant}`} className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors text-sm">
                        View Plant Details <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    
                    {i === 0 && !r.plant && (
                      <p className="mt-4 text-sm text-stone-500 italic">
                        This plant is not yet in our Cameroon-specific database.
                      </p>
                    )}
                  </div>
                ))}

                {/* Feedback on the result */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={reportResult}
                    disabled={reporting}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:scale-95 disabled:opacity-60"
                  >
                    {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                    Report incorrect identification
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); setResult(null); setError(''); }}
                    className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 active:scale-95"
                  >
                    <X className="h-4 w-4" /> Clear
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <p className="text-xs text-stone-500 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      <strong>Disclaimer:</strong> AI identification is probabilistic and should not be considered absolute certainty.
                      Always verify with a botanical expert for critical decisions. This is not medical advice.
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
                <Image className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="font-medium text-stone-600 mb-2">Upload an image to get started</h3>
                <p className="text-sm text-stone-400 mb-4">
                  Take a clear photo of a leaf, flower, fruit, or the whole plant for best results.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-stone-400">
                  <span className="flex items-center gap-1"><Leaf className="w-3 h-3" /> Leaves</span>
                  <span className="flex items-center gap-1">🌸 Flowers</span>
                  <span className="flex items-center gap-1">🍎 Fruits</span>
                  <span className="flex items-center gap-1">🌿 Whole plant</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
