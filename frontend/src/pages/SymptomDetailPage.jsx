import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { symptomsAPI, knowledgeAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { 
  ArrowLeft, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  Sprout, 
  FlaskConical, 
  MapPin, 
  ArrowRight,
  Leaf
} from 'lucide-react';
import { Reveal, CountUp } from '../components/ui/motion';
import DosageInfo from '../components/DosageInfo';
import { plantImage, withImageFallback } from '../utils/images';

/**
 * Public symptom page — mirrors GET /api/symptoms/<id>/ and lists the
 * traditional uses documented for that symptom.
 */
export default function SymptomDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [symptom, setSymptom] = useState(null);
  const [uses, setUses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [detailRes, usesRes] = await Promise.all([
        symptomsAPI.detail(id),
        knowledgeAPI.traditionalUses({ symptom: id, page_size: 100 }),
      ]);
      setSymptom(detailRes.data);
      setUses(usesRes.data.results || usesRes.data || []);
    } catch {
      setError('We could not load this symptom. It may have been removed.');
      toast.error('Symptom unavailable', 'The symptom record could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 pt-24 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8 animate-pulse">
          <div className="h-6 w-32 bg-stone-200 rounded-md" />
          <div className="h-72 bg-stone-200 rounded-3xl" />
          <div className="space-y-4 pt-4">
            <div className="h-8 w-64 bg-stone-200 rounded-md" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-stone-100 rounded-2xl border border-stone-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !symptom) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center pt-20 pb-16 px-4 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800">Symptom not found</h1>
        <p className="mt-3 max-w-md text-stone-500 leading-relaxed">
          {error || "We couldn't find the symptom you're looking for. It may have been removed or the URL is incorrect."}
        </p>
        <Link 
          to="/symptoms" 
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 shadow-sm hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to symptom search
        </Link>
      </div>
    );
  }

  const plants = [...new Map(uses.map((u) => [u.plant, u])).values()];

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <Reveal>
          <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 p-8 text-white shadow-xl sm:p-10">
            {/* Decorative background blurs */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
            
            <div className="relative z-10">
              <Link to="/symptoms" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-200 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back to all symptoms
              </Link>
              
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                {symptom.category || 'General Symptom'}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                {symptom.name}
              </h1>
              
              {symptom.description && (
                <p className="mt-4 max-w-2xl text-lg text-emerald-50/80 leading-relaxed">
                  {symptom.description}
                </p>
              )}
              
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-3 backdrop-blur-sm border border-white/10">
                  <div className="text-3xl font-bold text-white">
                    <CountUp value={symptom.traditional_uses_count ?? uses.length} />
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-200/80 leading-tight">
                    Documented<br/>Uses
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-3 backdrop-blur-sm border border-white/10">
                  <div className="text-3xl font-bold text-white">
                    <CountUp value={plants.length} />
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-200/80 leading-tight">
                    Unique<br/>Plants
                  </div>
                </div>
              </div>
            </div>
          </header>
        </Reveal>

        {/* Traditional Associations List */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-stone-800">
              <Search className="h-5 w-5 text-emerald-600" /> 
              Traditional Associations
            </h2>
            <span className="text-sm font-medium text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
              {uses.length} record{uses.length !== 1 ? 's' : ''}
            </span>
          </div>

          {uses.length === 0 ? (
            <Reveal>
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
                  <Search className="h-8 w-8 text-stone-400" />
                </div>
                <p className="font-semibold text-stone-700">No documented uses yet</p>
                <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto">
                  Practitioners have not published a verified traditional use for this symptom in our archive yet.
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="space-y-4">
              {uses.map((use, index) => (
                <Reveal key={use.id} delay={Math.min(index * 50, 300)}>
                  <Link to={`/plants/${use.plant}`} className="block group">
                    <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-emerald-200">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-stone-800 group-hover:text-emerald-700 transition-colors">
                              {use.plant_name}
                            </h3>
                            {use.is_verified && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            )}
                          </div>
                          <p className="text-stone-600 leading-relaxed line-clamp-3">
                            {use.description}
                          </p>
                          <DosageInfo use={use} compact />
                          
                          <div className="mt-4 flex flex-wrap gap-2">
                            {use.part_display && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 border border-stone-200">
                                <Sprout className="h-3.5 w-3.5 text-stone-500" /> {use.part_display}
                              </span>
                            )}
                            {use.preparation_display && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 border border-stone-200">
                                <FlaskConical className="h-3.5 w-3.5 text-stone-500" /> {use.preparation_display}
                              </span>
                            )}
                            {use.region_name && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {use.region_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-stone-50 group-hover:bg-emerald-50 group-hover:text-emerald-600 text-stone-400 transition-colors">
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      </div>
                    </article>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* Plants Grid */}
        {plants.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 text-xl font-bold text-stone-800 flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-600" />
              Plants Documented for {symptom.name}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plants.map((use, index) => (
                <Reveal key={use.plant} delay={Math.min(index * 50, 300)}>
                  <Link
                    to={`/plants/${use.plant}`}
                    className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-emerald-200"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-stone-100 relative">
                      <img
                        src={plantImage({ image: use.plant_image || '', scientific_name: use.plant_name, common_name: use.plant_common_name || '' })}
                        alt={use.plant_common_name || use.plant_name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={withImageFallback({ scientific_name: use.plant_name, common_name: use.plant_common_name || '' })}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-5">
                      <p className="font-bold text-stone-800 transition group-hover:text-emerald-700 line-clamp-1">
                        {use.plant_name}
                      </p>
                      <p className="text-sm text-stone-500 mt-1.5 flex items-center gap-1.5 font-medium">
                        View plant details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <Reveal delay={400}>
          <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 flex items-start gap-4">
            <div className="p-2 bg-amber-100 rounded-xl shrink-0">
              <ShieldAlert className="h-6 w-6 text-amber-700" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 mb-1">Medical Disclaimer</h4>
              <p className="text-sm text-amber-800/90 leading-relaxed">
                These are traditional associations recorded by contributors, not clinically proven medical treatments. 
                Ancestor is an educational archive — always consult a qualified health professional before using any plant for medicinal purposes.
              </p>
            </div>
          </div>
        </Reveal>

      </div>
    </div>
  );
}