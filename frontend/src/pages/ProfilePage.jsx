import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, geographyAPI, practitionersAPI } from '../api/client';
import { useToast, describeError } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import {
  AlertCircle, BadgeCheck, Camera, CheckCircle, Loader2, Lock, MapPin, Save, User,
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition';
const primaryBtn = 'inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100';

function Feedback({ tone, children }) {
  if (!children) return null;
  const styles = tone === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  const Icon = tone === 'error' ? AlertCircle : CheckCircle;
  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm animate-fade-in-up ${styles}`}>
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}

function PractitionerSection() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [regions, setRegions] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([practitionersAPI.profile(), geographyAPI.regions({ page_size: 50 })])
      .then(([profileRes, regionRes]) => {
        const data = profileRes.data;
        setProfile(data);
        setForm({
          region: data.region ?? '',
          community_name: data.community_name || '',
          years_of_experience: data.years_of_experience ?? 0,
          areas_of_knowledge: data.areas_of_knowledge || '',
          traditional_training: data.traditional_training || '',
        });
        setRegions(regionRes.data.results || regionRes.data || []);
      })
      .catch(() => toast.error('Could not load practitioner profile', 'Please refresh and try again.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await practitionersAPI.updateProfile(form);
      setProfile(res.data);
      toast.success('Practitioner profile saved', 'Your practice details were updated.');
    } catch (err) {
      toast.error('Could not save profile', describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="skeleton-shimmer h-5 w-48 rounded" />
        <div className="skeleton-shimmer mt-4 h-24 w-full rounded-xl" />
      </div>
    );
  }
  if (!form) return null;

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-stone-800">
          <BadgeCheck className="h-4 w-4 text-emerald-600" /> Practitioner profile
        </h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile?.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {profile?.is_verified ? 'Verified' : 'Awaiting verification'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Region of practice</label>
          <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inputCls}>
            <option value="">Select a region…</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Community</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={form.community_name} onChange={(e) => setForm({ ...form, community_name: e.target.value })} className={inputCls + ' pl-9'} placeholder="e.g. Bambui" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Years of experience</label>
          <input type="number" min="0" max="90" value={form.years_of_experience} onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Areas of knowledge</label>
          <input value={form.areas_of_knowledge} onChange={(e) => setForm({ ...form, areas_of_knowledge: e.target.value })} className={inputCls} placeholder="e.g. Respiratory, wound care" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Traditional training</label>
        <textarea rows={3} value={form.traditional_training} onChange={(e) => setForm({ ...form, traditional_training: e.target.value })} className={inputCls + ' resize-none'} placeholder="How did you learn this knowledge?" />
      </div>

      <button type="submit" disabled={saving} className={primaryBtn}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving…' : 'Save practitioner profile'}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '',
    email: user?.email || '', bio: user?.bio || '', phone: user?.phone || '',
  });
  const [passForm, setPassForm] = useState({ old_password: '', new_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setBusy('profile');
    setMsg(''); setErr('');
    try {
      await updateProfile(form);
      setMsg('Profile updated!');
      toast.success('Profile saved', 'Your details were updated.');
    } catch (error) {
      const message = describeError(error);
      setErr(message);
      toast.error('Could not save profile', message);
    } finally {
      setBusy('');
    }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setErr('Choose an image smaller than 5 MB.');
      toast.error('Image too large', 'Choose a JPEG, PNG or WebP image under 5 MB.');
      return;
    }
    const payload = new FormData();
    payload.append('avatar', file);
    setBusy('avatar');
    try {
      const updated = await authAPI.updateProfile(payload);
      updateProfile(updated.data);
      setAvatarPreview(URL.createObjectURL(file));
      setMsg('Profile image updated.');
      setErr('');
      toast.success('Profile photo updated', 'Your new avatar is live.');
    } catch (error) {
      const message = describeError(error);
      setErr(message);
      toast.error('Upload failed', message);
    } finally {
      setBusy('');
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setBusy('password');
    setMsg(''); setErr('');
    try {
      await authAPI.changePassword(passForm);
      setMsg('Password changed!');
      setPassForm({ old_password: '', new_password: '' });
      toast.success('Password changed', 'Use your new password the next time you sign in.');
    } catch (error) {
      const message = describeError(error);
      setErr(message);
      toast.error('Could not change password', message);
    } finally {
      setBusy('');
    }
  };

  return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-stone-800">My Profile</h2>

        <Feedback tone="success">{msg}</Feedback>
        <Feedback tone="error">{err}</Feedback>

        <Reveal>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-stone-800">Profile Information</h3>
            <div className="mb-5 flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-emerald-200/60 transition hover:ring-emerald-300">
                {avatarPreview ? (
                  <img src={avatarPreview.replace(/^https?:\/\/[^/]+/, '')} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="m-5 h-6 w-6 text-emerald-700" />
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 active:scale-[0.98]">
                {busy === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Update photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatar} />
              </label>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">First Name</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Last Name</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+237 …" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Bio</label>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
              </div>
              <button type="submit" disabled={busy === 'profile'} className={primaryBtn}>
                {busy === 'profile' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </form>
          </div>
        </Reveal>

        {(user?.role === 'PRACTITIONER' || user?.role === 'ADMIN') && (
          <Reveal delay={80}>
            <PractitionerSection />
          </Reveal>
        )}

        <Reveal delay={120}>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-stone-800">
              <Lock className="h-4 w-4 text-stone-500" /> Change Password
            </h3>
            <form onSubmit={handlePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Current Password</label>
                  <input type="password" value={passForm.old_password} onChange={(e) => setPassForm({ ...passForm, old_password: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">New Password</label>
                  <input type="password" value={passForm.new_password} onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })} className={inputCls} minLength={8} />
                </div>
              </div>
              <button type="submit" disabled={busy === 'password'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-700 px-6 py-2.5 font-medium text-white transition hover:bg-stone-800 active:scale-[0.98] disabled:opacity-60">
                {busy === 'password' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Change Password
              </button>
            </form>
          </div>
        </Reveal>

        <div className="rounded-xl bg-stone-100 p-4 text-sm text-stone-500">
          <p><strong>Role:</strong> {user?.role}</p>
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Joined:</strong> {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>
  );
}
