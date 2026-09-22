import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { identificationAPI, knowledgeAPI, safetyAPI } from '../api/client';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Reveal } from '../components/ui/motion';
import DosageInfo from '../components/DosageInfo';
import {
  Camera, Upload, X, AlertCircle, Leaf, AlertTriangle, ArrowRight, Image, Info,
  Brain, Flag, Loader2, CheckCircle2, Sparkles, ScanEye
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
  const [isDragging, setIsDragging] = useState(false);
  const resultsRef = useRef(null);

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

  useEffect(() => {
    if (!result?.results?.length || loading) return;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result, loading]);

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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
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
    const pending = toast.loading('Analysing your image…', 'The vision model is comparing it with the Ancestor library.');
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
    if (conf >= 0.8) return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
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
    if (conf >= 0.8) return 'bg-emerald-500';
    if (conf >= 0.5) return 'bg-amber-500';
    if (conf >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> AI-Powered
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight flex items-center gap-3 justify-center sm:justify-start">
              <ScanEye className="w-8 h-8 text-emerald-600" /> Identify a Plant
            </h1>
            <p className="mt-2 text-stone-500 max-w-2xl leading-relaxed">
              Upload a clear photo and our AI will analyze its botanical features to identify the species and provide traditional context.
            </p>
          </Reveal>
        </div>

        {!user && (
          <Reveal delay={100}>
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                Please <Link to="/login" className="font-semibold underline decoration-amber-300 hover:decoration-amber-600 transition-colors">log in</Link> or <Link to="/register" className="font-semibold underline decoration-amber-300 hover:decoration-amber-600 transition-colors">create an account</Link> to use the plant identification feature.
              </p>
            </div>
          </Reveal>
        )}

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Upload & Info */}
          <div className="lg:col-span-5 space-y-6">
            <Reveal delay={150}>
              <div
                className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50/60 scale-[1.02] shadow-lg' 
                    : preview 
                      ? 'border-emerald-200 bg-emerald-50/30' 
                      : 'border-stone-200 hover:border-emerald-400 hover:bg-stone-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {preview ? (
                  <div className="relative group">
                    <img src={preview} alt="Preview" className="w-full max-h-80 object-contain rounded-2xl shadow-sm" />
                    <button 
                      onClick={() => { setFile(null); setPreview(null); setResult(null); setError(''); }}
                      className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-red-50 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-3xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105">
                      <Camera className="w-9 h-9 text-emerald-600" />
                    </div>
                    <p className="font-semibold text-stone-800 text-lg mb-2">Drop your plant image here</p>
                    <p className="text-sm text-stone-500 mb-6">or click to browse your files</p>
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer hover:bg-emerald-800 transition-all shadow-sm hover:shadow-md active:scale-95">
                      <Upload className="w-4 h-4" /> Choose Image
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-xs text-stone-400 mt-4 font-medium">JPEG, PNG, or WebP • Max 10MB</p>
                  </div>
                )}
              </div>
            </Reveal>

            {file && (
              <Reveal delay={200}>
                <button 
                  onClick={handleIdentify} 
                  disabled={loading || !user}
                  className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-semibold hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" /> Identify Plant
                    </>
                  )}
                </button>
              </Reveal>
            )}

            {error && (
              <Reveal>
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-sm text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Identification Error</p>
                    <p className="mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
              </Reveal>
            )}

            {/* How it works */}
            <Reveal delay={250}>
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <h3 className="font-semibold text-stone-800 text-sm mb-4 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600" /> How It Works
                </h3>
                <div className="space-y-4">
                  {[
                    { step: 1, text: "Upload a clear photo of the plant (leaf, flower, fruit, or whole plant)" },
                    { step: 2, text: "Our AI analyzes the image using vision models trained on botanical data" },
                    { step: 3, text: "The system matches the identification against our Cameroonian plant database" },
                    { step: 4, text: "You receive the identification with a confidence score and traditional knowledge" }
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        {item.step}
                      </span>
                      <span className="text-sm text-stone-600 leading-relaxed pt-0.5">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Results */}
          <div ref={resultsRef} className="scroll-mt-24 lg:col-span-7">
            {result && result.results ? (
              <div className="space-y-6 animate-fade-in-up">
                {/* Mode indicator */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                  <Brain className="w-4 h-4" />
                  <span>Live AI Analysis — Powered by OpenRouter</span>
                </div>

                {/* Database not found notice */}
                {result.database_notice && (
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-800">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Knowledge Unavailable
                    </p>
                    <p className="leading-relaxed">{result.database_notice}</p>
                  </div>
                )}

                {/* Botanical Analysis */}
                {result.analysis && (
                  <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-5 flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5" /> Botanical Analysis
                    </p>
                    
                    <div className="space-y-6">
                      {result.analysis.visual_observations?.length > 0 && (
                        <AnalysisList title="Visual observations" items={result.analysis.visual_observations} icon={ScanEye} />
                      )}
                      {result.analysis.traditional_context && (
                        <div>
                          <p className="text-sm font-semibold text-stone-800 mb-2">Traditional context</p>
                          <p className="text-sm text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100">
                            {result.analysis.traditional_context}
                          </p>
                        </div>
                      )}
                      {result.analysis.potential_uses?.length > 0 && (
                        <AnalysisList title="Potential uses" items={result.analysis.potential_uses} icon={CheckCircle2} />
                      )}
                      {result.analysis.safety_notes?.length > 0 && (
                        <AnalysisList title="Safety notes" items={result.analysis.safety_notes} tone="amber" icon={AlertTriangle} />
                      )}
                      {result.analysis.next_steps?.length > 0 && (
                        <AnalysisList title="Recommended verification" items={result.analysis.next_steps} icon={Info} />
                      )}
                    </div>
                  </div>
                )}

                {/* Identification results */}
                {result.results.map((r, i) => (
                  <div key={r.id || i} className={`bg-white rounded-2xl border transition-all duration-300 ${i === 0 ? 'border-emerald-200 shadow-md ring-1 ring-emerald-100' : 'border-stone-200 hover:border-stone-300'}`}>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        {i === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Primary Identification
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Alternative Match #{i}</span>
                        )}
                      </div>
                      
                      <h3 className="text-2xl font-bold text-stone-900 italic">{r.scientific_name}</h3>
                      {r.common_name && <p className="text-stone-600 mt-1 font-medium">{r.common_name}</p>}
                      
                      <div className="mt-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ring-1 ${getConfidenceColor(r.confidence)}`}>
                            {getConfidenceLabel(r.confidence)}
                          </span>
                          <span className="text-sm font-bold text-stone-700">
                            {(r.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${getConfidenceBarColor(r.confidence)}`}
                            style={{ width: `${r.confidence * 100}%` }} 
                          />
                        </div>
                      </div>
                      
                      {i === 0 && (
                        <div className="mt-6 pt-5 border-t border-stone-100">
                          {r.plant ? (
                            <>
                              <MatchedPlantDosage
                                plantId={r.plant}
                                initialUses={i === 0 ? result.traditional_uses : undefined}
                                initialRisk={i === 0 ? result.safety?.risk_level : undefined}
                              />
                              <Link to={`/plants/${r.plant}`} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800 transition-all shadow-sm hover:shadow-md active:scale-[0.98] text-sm">
                                View Plant Details <ArrowRight className="w-4 h-4" />
                              </Link>
                            </>
                          ) : (
                            <p className="text-sm text-stone-500 italic flex items-center gap-2">
                              <Info className="w-4 h-4" /> This plant is not yet in our Cameroon-specific database.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Feedback on the result */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={reportResult}
                    disabled={reporting}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:scale-95 disabled:opacity-60"
                  >
                    {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                    Report incorrect identification
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); setResult(null); setError(''); }}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-800 active:scale-95"
                  >
                    <X className="h-4 w-4" /> Clear & Start Over
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/60">
                  <p className="text-sm text-amber-900/80 flex items-start gap-3 leading-relaxed">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      <strong className="text-amber-900">Disclaimer:</strong> AI identification is probabilistic and should not be considered absolute certainty. 
                      Always verify with a botanical expert for critical decisions. This information is for educational purposes and is not medical advice.
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <Reveal delay={150}>
                <div className="h-full min-h-[400px] bg-white rounded-3xl border border-stone-200 border-dashed p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center mb-6">
                    <Image className="w-10 h-10 text-stone-300" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-800 mb-2">Upload an image to get started</h3>
                  <p className="text-sm text-stone-500 max-w-sm mb-8 leading-relaxed">
                    Take a clear, well-lit photo of a leaf, flower, fruit, or the whole plant for the most accurate results.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-stone-500">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full"><Leaf className="w-3.5 h-3.5" /> Leaves</span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full">🌸 Flowers</span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full">🍎 Fruits</span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full">🌿 Whole plant</span>
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Verified traditional uses (with dosage) for the matched database plant. */
function MatchedPlantDosage({ plantId, initialUses, initialRisk }) {
  const [uses, setUses] = useState(initialUses || []);
  const [risk, setRisk] = useState(initialRisk || '');
  const [loaded, setLoaded] = useState(Boolean(initialUses));

  useEffect(() => {
    // Fresh identifications already carry dosage from the backend; older
    // history entries are backfilled with a fetch by plant id.
    if (initialUses) {
      setUses(initialUses);
      setRisk(initialRisk || '');
      setLoaded(true);
      return;
    }
    let cancelled = false;
    Promise.all([
      knowledgeAPI.traditionalUses({ plant: plantId, page_size: 3 }),
      safetyAPI.list({ plant: plantId }),
    ]).then(([usesRes, safeRes]) => {
      if (cancelled) return;
      setUses(usesRes.data.results || usesRes.data || []);
      const records = safeRes.data.results || safeRes.data || [];
      setRisk(records[0]?.risk_level || '');
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [plantId, initialUses, initialRisk]);

  if (!loaded || uses.length === 0) return null;
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
        In our Cameroon knowledge base — how it is traditionally taken
      </p>
      {uses.slice(0, 2).map((u) => (
        <div key={u.id} className="mt-2">
          <p className="text-sm font-semibold text-stone-800">{u.symptom_name}</p>
          <DosageInfo use={u} riskLevel={risk} compact />
        </div>
      ))}
      <p className="mt-2 text-[11px] italic text-stone-500">
        Full preparation details, safety and evidence are on the plant page.
      </p>
    </div>
  );
}

function AnalysisList({ title, items, tone = 'blue', icon: Icon = CheckCircle2 }) {
  const bulletClass = tone === 'amber' ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
  const textClass = tone === 'amber' ? 'text-amber-900/80' : 'text-stone-700';
  
  return (
    <div>
      <p className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`} />
        {title}
      </p>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${bulletClass.replace('text-', 'bg-')}`} />
            <span className={textClass}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}