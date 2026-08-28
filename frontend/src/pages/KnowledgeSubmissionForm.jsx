import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeAPI, plantsAPI, symptomsAPI, geographyAPI } from '../api/client';
import { useToast, describeError } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { Save, Send, Loader2 } from 'lucide-react';

export default function KnowledgeSubmissionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    plant: '', proposed_scientific_name: '', proposed_common_name: '',
    local_name: '', language: '', symptom: '', proposed_symptom_name: '',
    plant_part: '', preparation_method: '', traditional_use_description: '',
    cultural_context: '', region: '', community_name: '', supporting_information: '',
  });
  const [plants, setPlants] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState([]);
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    plantsAPI.list({ page_size: 200 }).then(r => setPlants(r.data.results || r.data)).catch(() => {});
    symptomsAPI.list({ page_size: 200 }).then(r => setSymptoms(r.data.results || r.data)).catch(() => {});
    geographyAPI.regions({ page_size: 50 }).then(r => setRegions(r.data.results || r.data)).catch(() => {});
    knowledgeAPI.preparationMethods({ page_size: 50 }).then(r => setMethods(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.region) { setCommunities([]); return; }
    geographyAPI.communities({ region: form.region, page_size: 100 })
      .then(r => setCommunities(r.data.results || r.data))
      .catch(() => setCommunities([]));
  }, [form.region]);

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    if (!form.traditional_use_description.trim()) {
      setError('Describe how the plant is traditionally used — it is the core of the record.');
      toast.warning('Description required', 'Reviewers cannot verify a submission without the preparation and use description.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = { ...form, status: isDraft ? 'DRAFT' : 'SUBMITTED' };
      await knowledgeAPI.createSubmission(data);
      if (isDraft) {
        toast.success('Draft saved', 'You can finish and submit it later from your contributions.');
      } else {
        toast.success('Submitted for review', 'An expert reviewer has been notified.');
      }
      navigate('/practitioner/contributions');
    } catch (err) {
      const message = describeError(err);
      setError(message);
      toast.error(isDraft ? 'Could not save draft' : 'Submission failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800">Submit Traditional Knowledge</h2>
        <p className="text-stone-500 mt-1">Share your knowledge about medicinal plants. All submissions will be reviewed by experts.</p>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 animate-shake">{error}</div>}

      <Reveal>
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 bg-white rounded-2xl border border-stone-200 p-6">
        <section>
          <h3 className="font-semibold text-stone-800 mb-4 pb-2 border-b border-stone-100">Plant Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Plant (if known)</label>
              <select value={form.plant} onChange={e => setForm({...form, plant: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">-- Select or enter below --</option>
                {plants.map(p => <option key={p.id} value={p.id}>{p.scientific_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Proposed Scientific Name</label>
              <input type="text" value={form.proposed_scientific_name} onChange={e => setForm({...form, proposed_scientific_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Local Name</label>
              <input type="text" value={form.local_name} onChange={e => setForm({...form, local_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Language</label>
              <input type="text" value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Common Name</label>
              <input type="text" value={form.proposed_common_name} onChange={e => setForm({...form, proposed_common_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-stone-800 mb-4 pb-2 border-b border-stone-100">Use & Preparation</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Symptom</label>
              <select value={form.symptom} onChange={e => setForm({...form, symptom: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">-- Select or enter below --</option>
                {symptoms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Proposed Symptom (if not listed)</label>
              <input type="text" value={form.proposed_symptom_name} onChange={e => setForm({...form, proposed_symptom_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Plant Part Used</label>
              <select value={form.plant_part} onChange={e => setForm({...form, plant_part: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">Select...</option>
                <option value="LEAF">Leaf</option><option value="ROOT">Root</option>
                <option value="BARK">Bark</option><option value="STEM">Stem</option>
                <option value="FLOWER">Flower</option><option value="FRUIT">Fruit</option>
                <option value="SEED">Seed</option><option value="WHOLE">Whole Plant</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Preparation Method</label>
              <select value={form.preparation_method} onChange={e => setForm({...form, preparation_method: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">Select...</option>
                {methods.length ? methods.map(m => (
                  <option key={m.id} value={m.name}>{m.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                )) : (
                  <>
                    <option value="DECOCTION">Decoction</option>
                    <option value="INFUSION">Infusion</option>
                    <option value="POULTICE">Poultice</option>
                    <option value="POWDER">Powder</option>
                    <option value="JUICE">Juice</option>
                    <option value="RAW">Raw</option>
                    <option value="OTHER">Other</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">Traditional Use Description *</label>
            <textarea value={form.traditional_use_description} onChange={e => setForm({...form, traditional_use_description: e.target.value})}
              rows={4} required
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Describe how this plant is traditionally used..." />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">Cultural Context</label>
            <textarea value={form.cultural_context} onChange={e => setForm({...form, cultural_context: e.target.value})}
              rows={2}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Any cultural or ceremonial significance..." />
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-stone-800 mb-4 pb-2 border-b border-stone-100">Location & Source</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Region</label>
              <select value={form.region} onChange={e => setForm({...form, region: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="">Select region...</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Community</label>
              {communities.length > 0 ? (
                <select value={form.community_name} onChange={e => setForm({...form, community_name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  <option value="">-- Select a community --</option>
                  {communities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              ) : (
                <input type="text" value={form.community_name} onChange={e => setForm({...form, community_name: e.target.value})}
                  placeholder="Type the community name"
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              )}
              <p className="mt-1 text-xs text-stone-400">{communities.length ? 'Communities recorded for the selected region.' : 'Select a region to pick a recorded community, or type the name.'}</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">Supporting Information</label>
            <textarea value={form.supporting_information} onChange={e => setForm({...form, supporting_information: e.target.value})}
              rows={3}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Any additional context, sources, or references..." />
          </div>
        </section>

        <div className="flex gap-3 pt-4 border-t border-stone-100">
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 transition-all active:scale-[0.99]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
          <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-300 disabled:opacity-50 transition-all active:scale-[0.99]">
            <Save className="w-4 h-4" /> Save Draft
          </button>
        </div>
      </form>
      </Reveal>
    </div>
  );
}
