import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { symptomsAPI, knowledgeAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Loader2, Search, ShieldAlert } from 'lucide-react';
import { Reveal, CountUp } from '../components/ui/motion';
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
      <div className="flex min-h-[60vh] items-center justify-center pt-20">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !symptom) {
    return (
      <div className="pt-24 pb-16 text-center">
        <h1 className="text-2xl font-bold text-stone-800">Symptom not found</h1>
        <p className="mt-2 text-stone-500">{error}</p>
        <Link to="/symptoms" className="mt-6 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800">
          Back to symptom search
        </Link>
      </div>
    );
  }

  const plants = [...new Map(uses.map((u) => [u.plant, u])).values()];

  return (
      <div className="pt-20 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Link to="/symptoms" className="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-emerald-700">
            <ArrowLeft className="h-4 w-4" /> All symptoms
          </Link>

          <Reveal>
            <header className="rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 p-7 text-white shadow-lg sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                {symptom.category || 'General'}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{symptom.name}</h1>
              {symptom.description && (
                <p className="mt-3 max-w-2xl text-emerald-50/90">{symptom.description}</p>
              )}
              <div className="mt-6 flex flex-wrap gap-6">
                <div>
                  <p className="text-2xl font-bold">
                    <CountUp value={symptom.traditional_uses_count ?? uses.length} />
                  </p>
                  <p className="text-xs uppercase tracking-wide text-emerald-200/80">Documented uses</p>
                </div>
                <div>
                  <p className="text-2xl font-bold"><CountUp value={plants.length} /></p>
                  <p className="text-xs uppercase tracking-wide text-emerald-200/80">Plants referenced</p>
                </div>
              </div>
            </header>
          </Reveal>

          <section className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-stone-800">
              <Search className="h-5 w-5 text-emerald-600" /> Traditional associations
            </h2>

            {uses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
                <p className="font-medium text-stone-600">No documented uses yet</p>
                <p className="mt-1 text-sm text-stone-400">
                  Practitioners have not published a verified use for this symptom yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {uses.map((use, index) => (
                  <Reveal key={use.id} delay={Math.min(index * 50, 300)}>
                    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            to={`/plants/${use.plant}`}
                            className="font-semibold text-stone-800 transition hover:text-emerald-700"
                          >
                            {use.plant_name}
                          </Link>
                          {use.is_verified && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Verified
                            </span>
                          )}
                        </div>
                        {use.region_name && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                            {use.region_name}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">{use.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {use.part_display && <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">{use.part_display}</span>}
                        {use.preparation_display && <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">{use.preparation_display}</span>}
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}
          </section>

          {plants.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-bold text-stone-800">Plants documented for {symptom.name}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plants.map((use) => (
                  <Link
                    key={use.plant}
                    to={`/plants/${use.plant}`}
                    className="card-hover group overflow-hidden rounded-2xl border border-stone-200 bg-white"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-emerald-50">
                      <img
                        src={plantImage({ image: '', scientific_name: use.plant_name })}
                        alt={use.plant_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={withImageFallback({ scientific_name: use.plant_name })}
                      />
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-stone-800 transition group-hover:text-emerald-700">
                        {use.plant_name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              These are traditional associations recorded by contributors, not medical treatments.
              HerbaCam is an educational archive — always consult a qualified health professional.
            </p>
          </div>
        </div>
      </div>
  );
}
