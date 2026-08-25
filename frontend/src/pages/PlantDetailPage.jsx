import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { plantsAPI, knowledgeAPI, evidenceAPI, safetyAPI, analyticsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { plantImage, withImageFallback } from '../utils/images';
import { Heart, MapPin, AlertTriangle, Shield, BookOpen, ArrowLeft, CheckCircle } from 'lucide-react';

export default function PlantDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [plant, setPlant] = useState(null);
  const [uses, setUses] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [safety, setSafety] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      plantsAPI.detail(id),
      knowledgeAPI.traditionalUses({ plant: id }),
      evidenceAPI.list({ plant: id }),
      safetyAPI.list({ plant: id }),
    ]).then(([plantRes, usesRes, evidRes, safeRes]) => {
      setPlant(plantRes.data);
      setUses(usesRes.data.results || usesRes.data);
      setEvidence(evidRes.data.results || evidRes.data);
      setSafety(safeRes.data.results || safeRes.data);
    }).catch(() => {}).finally(() => setLoading(false));

    if (user) {
      analyticsAPI.checkFavorite(id).then(r => setIsFavorite(r.data.is_favorite)).catch(() => {});
    }
  }, [id, user]);

  const toggleFavorite = async () => {
    if (!user) return;
    if (isFavorite) {
      await analyticsAPI.removeFavorite(parseInt(id));
      setIsFavorite(false);
    } else {
      await analyticsAPI.addFavorite(parseInt(id));
      setIsFavorite(true);
    }
  };

  if (loading) return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 animate-pulse">
        <div className="h-8 bg-stone-100 rounded w-1/3 mb-4" />
        <div className="h-64 bg-stone-100 rounded-2xl mb-6" />
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-4 bg-stone-100 rounded" />)}</div>
      </div>
    </div>
  );

  if (!plant) return (
    <div className="pt-20 pb-12 min-h-screen text-center">
      <h2 className="text-2xl font-bold text-stone-800">Plant not found</h2>
      <Link to="/plants" className="text-green-700 mt-4 inline-block">← Back to plants</Link>
    </div>
  );

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/plants" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-green-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Plants
        </Link>

        {/* Hero */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden mb-8">
          <div className="aspect-[16/9] sm:aspect-[21/9] bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center relative overflow-hidden">
            <img
              src={plantImage(plant)}
              alt={plant.common_name || plant.scientific_name}
              className="w-full h-full object-cover"
              onError={withImageFallback(plant)}
            />
            {user && (
              <button onClick={toggleFavorite}
                className={`absolute top-4 right-4 p-3 rounded-full bg-white/90 backdrop-blur-sm shadow-md transition-all ${isFavorite ? 'text-red-500' : 'text-stone-400 hover:text-red-400'}`}>
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-stone-800">{plant.common_name || plant.scientific_name}</h1>
                <p className="text-lg text-green-700 italic mt-1">{plant.scientific_name}</p>
              </div>
              <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium shrink-0">
                {plant.family}
              </span>
            </div>
            {plant.description && <p className="text-stone-600 mt-4 leading-relaxed">{plant.description}</p>}
            {plant.local_names?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-stone-500 mb-2">Local Names</h3>
                <div className="flex flex-wrap gap-2">
                  {plant.local_names.map(ln => (
                    <span key={ln.id} className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg text-sm">
                      {ln.name} {ln.language && <span className="text-amber-600">({ln.language})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {plant.region_names?.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                <MapPin className="w-4 h-4" />
                Found in: {plant.region_names.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Traditional Uses */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-600" /> Traditional Uses
          </h2>
          {uses.length === 0 ? (
            <p className="text-stone-500 bg-white rounded-xl p-6 border border-stone-200">
              No documented traditional uses available yet.
            </p>
          ) : (
            <div className="space-y-4">
              {uses.map(use => (
                <div key={use.id} className="bg-white rounded-xl p-5 border border-stone-200">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-stone-800">{use.symptom_name}</h3>
                    {use.is_verified && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full shrink-0">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-stone-600 mt-2 text-sm leading-relaxed">{use.description}</p>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-stone-500">
                    {use.part_display && <span className="px-2 py-1 bg-stone-100 rounded">{use.part_display}</span>}
                    {use.preparation_display && <span className="px-2 py-1 bg-stone-100 rounded">{use.preparation_display}</span>}
                    {use.region_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {use.region_name}</span>}
                  </div>
                  {use.cultural_context && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 italic">
                      {use.cultural_context}
                    </p>
                  )}
                  <p className="text-xs text-stone-400 mt-2 italic">
                    Traditionally associated with this symptom. This is not medical advice.
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Evidence */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" /> Scientific Evidence
          </h2>
          {evidence.length === 0 ? (
            <p className="text-stone-500 bg-white rounded-xl p-6 border border-stone-200">
              Scientific evidence has not been documented for this plant yet.
            </p>
          ) : (
            <div className="space-y-4">
              {evidence.map(ev => (
                <div key={ev.id} className="bg-white rounded-xl p-5 border border-stone-200">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ev.level === 'STRONG' ? 'bg-green-100 text-green-700' :
                      ev.level === 'MODERATE' ? 'bg-blue-100 text-blue-700' :
                      ev.level === 'PRELIMINARY' ? 'bg-amber-100 text-amber-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {ev.level_display}
                    </span>
                  </div>
                  <p className="text-stone-600 text-sm">{ev.summary}</p>
                  <p className="text-xs text-stone-400 mt-2">Source: {ev.source}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Safety */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" /> Safety Information
          </h2>
          {safety.length === 0 ? (
            <p className="text-stone-500 bg-white rounded-xl p-6 border border-stone-200">
              Safety information has not been documented yet. Please consult healthcare professionals.
            </p>
          ) : (
            <div className="space-y-4">
              {safety.map(s => (
                <div key={s.id} className={`rounded-xl p-5 border ${
                  s.risk_level === 'HIGH' ? 'bg-red-50 border-red-200' :
                  s.risk_level === 'MODERATE' ? 'bg-amber-50 border-amber-200' :
                  'bg-white border-stone-200'
                }`}>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    s.risk_level === 'HIGH' ? 'bg-red-100 text-red-700' :
                    s.risk_level === 'MODERATE' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {s.risk_level_display}
                  </span>
                  {s.precautions && <p className="mt-3 text-sm text-stone-700"><strong>Precautions:</strong> {s.precautions}</p>}
                  {s.contraindications && <p className="mt-2 text-sm text-stone-700"><strong>Contraindications:</strong> {s.contraindications}</p>}
                  {s.pregnancy_warning && <p className="mt-2 text-sm text-red-700 font-medium">⚠ Not recommended during pregnancy</p>}
                  {s.children_warning && <p className="mt-1 text-sm text-red-700 font-medium">⚠ Not recommended for children</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="bg-stone-100 rounded-xl p-6 text-center">
          <p className="text-sm text-stone-600">
            <strong>Disclaimer:</strong> HerbaCam is an educational platform. This information does not constitute medical advice.
            Always consult qualified healthcare professionals before using any plant for medicinal purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
