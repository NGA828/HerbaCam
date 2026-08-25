import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { identificationAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { Camera, Upload, X, AlertCircle, Leaf, CheckCircle, AlertTriangle, ArrowRight, Image } from 'lucide-react';

export default function IdentifyPage() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
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
    if (!file) return;
    if (!user) { setError('Please log in to use plant identification.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await identificationAPI.identify(formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Identification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-600 bg-green-50';
    if (conf >= 0.5) return 'text-amber-600 bg-amber-50';
    if (conf >= 0.3) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 0.8) return 'High Confidence';
    if (conf >= 0.5) return 'Moderate Confidence';
    if (conf >= 0.3) return 'Low Confidence';
    return 'Uncertain';
  };

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Identify a Plant</h1>
          <p className="text-stone-500">Upload a photo and our AI will help identify the plant species</p>
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
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-green-700 text-white rounded-xl cursor-pointer hover:bg-green-800 transition-colors">
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
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" /> Identify Plant
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* Result */}
          <div>
            {result && !error ? (
              <div className="space-y-4">
                {result.results?.map((r, i) => (
                  <div key={r.id || i} className={`bg-white rounded-2xl p-6 border ${i === 0 ? 'border-green-200 shadow-md' : 'border-stone-200'}`}>
                    {i === 0 && <p className="text-xs text-green-600 font-medium mb-3 uppercase tracking-wider">Primary Identification</p>}
                    {i > 0 && <p className="text-xs text-stone-400 font-medium mb-3 uppercase tracking-wider">Alternative</p>}
                    <h3 className="text-xl font-bold text-stone-800 italic">{r.scientific_name}</h3>
                    {r.common_name && <p className="text-stone-600">{r.common_name}</p>}
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getConfidenceColor(r.confidence)}`}>
                        {getConfidenceLabel(r.confidence)} ({(r.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="mt-3 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${r.confidence * 100}%` }} />
                    </div>
                    {i === 0 && r.plant && (
                      <Link to={`/plants/${r.plant}`} className="inline-flex items-center gap-2 mt-4 text-green-700 font-medium hover:text-green-800">
                        View Plant Details <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                ))}
                {result.error && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {result.error}
                  </div>
                )}
                <div className="bg-stone-100 rounded-xl p-4">
                  <p className="text-xs text-stone-500 italic">
                    <strong>Note:</strong> AI identification is probabilistic and should not be considered absolute certainty.
                    Always verify with a botanical expert for critical decisions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
                <Image className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="font-medium text-stone-600 mb-2">Upload an image to get started</h3>
                <p className="text-sm text-stone-400">
                  Take a clear photo of a leaf, flower, fruit, or the whole plant for best results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
