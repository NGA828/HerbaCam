import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/client';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle, Camera } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '',
    email: user?.email || '', bio: user?.bio || '', phone: user?.phone || '',
  });
  const [passForm, setPassForm] = useState({ old_password: '', new_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');

  const handleUpdate = async (e) => {
    e.preventDefault();
    try { await updateProfile(form); setMsg('Profile updated!'); setErr(''); }
    catch { setErr('Update failed.'); setMsg(''); }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { setErr('Choose an image smaller than 5 MB.'); return; }
    const payload = new FormData(); payload.append('avatar', file);
    try { const updated = await authAPI.updateProfile(payload); updateProfile(updated.data); setAvatarPreview(URL.createObjectURL(file)); setMsg('Profile image updated.'); setErr(''); }
    catch { setErr('Profile image upload failed.'); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    try { await authAPI.changePassword(passForm); setMsg('Password changed!'); setErr(''); setPassForm({ old_password: '', new_password: '' }); }
    catch { setErr('Password change failed. Check your old password.'); setMsg(''); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-stone-800">My Profile</h2>

      {msg && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {msg}</div>}
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {err}</div>}

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-800 mb-4">Profile Information</h3>
        <div className="mb-5 flex items-center gap-4"><div className="h-16 w-16 overflow-hidden rounded-full bg-emerald-100"><>{avatarPreview ? <img src={avatarPreview.replace(/^https?:\/\/[^/]+/, '')} alt="Profile" className="h-full w-full object-cover"/> : <User className="m-5 h-6 w-6 text-emerald-700"/>}</></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"><Camera className="h-4 w-4"/> Update photo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatar}/></label></div>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Bio</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={3}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none" />
          </div>
          <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-green-700 text-white rounded-xl font-medium hover:bg-green-800">
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-800 mb-4">Change Password</h3>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Current Password</label>
            <input type="password" value={passForm.old_password} onChange={e => setPassForm({...passForm, old_password: e.target.value})}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">New Password</label>
            <input type="password" value={passForm.new_password} onChange={e => setPassForm({...passForm, new_password: e.target.value})}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" minLength={8} />
          </div>
          <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-stone-700 text-white rounded-xl font-medium hover:bg-stone-800">
            <Lock className="w-4 h-4" /> Change Password
          </button>
        </form>
      </div>

      <div className="bg-stone-100 rounded-xl p-4 text-sm text-stone-500">
        <p><strong>Role:</strong> {user?.role}</p>
        <p><strong>Username:</strong> {user?.username}</p>
        <p><strong>Joined:</strong> {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}</p>
      </div>
    </div>
  );
}
