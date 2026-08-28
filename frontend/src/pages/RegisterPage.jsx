import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast, describeError } from '../contexts/ToastContext';
import { Leaf, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', password_confirm: '', role: 'USER'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password_confirm) {
      setError('Passwords do not match.');
      toast.error('Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form);
      toast.success('Account created', `Welcome to HerbaCam, ${user.first_name || user.username}!`);
      navigate(user.role === 'PRACTITIONER' ? '/practitioner/dashboard' : '/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'object' && !Array.isArray(data)) {
        setError(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(', '));
      } else {
        setError('Registration failed. Please try again.');
      }
      toast.error('Registration failed', describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-stone-50 to-emerald-50 px-4 py-20">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-stone-100">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Create Account</h1>
            <p className="text-stone-500 mt-1">Join HerbaCam to explore plant knowledge</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">First Name</label>
                <input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-block text-sm font-medium text-stone-700 mb-1">Last Name</label>
                <input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Account Type</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                <option value="USER">Regular User</option>
                <option value="PRACTITIONER">Traditional Medicine Practitioner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required minLength={8} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="password" value={form.password_confirm} onChange={e => setForm({...form, password_confirm: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 transition-all shadow-sm active:scale-[0.99]">
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-green-700 font-medium hover:text-green-800">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
