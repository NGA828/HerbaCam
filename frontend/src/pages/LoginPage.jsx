import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Leaf, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form);
      toast.success(
        `Welcome back, ${user.first_name || user.username}`,
        'You are signed in to HerbaCam.',
      );
      navigate(user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'EXPERT' ? '/expert/dashboard' : user.role === 'PRACTITIONER' ? '/practitioner/dashboard' : '/dashboard');
    } catch (err) {
      const message = err.response?.data?.detail || 'Invalid credentials. Please try again.';
      setError(message);
      toast.error('Sign in failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-stone-50 to-emerald-50 px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-stone-100">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Welcome Back</h1>
            <p className="text-stone-500 mt-1">Sign in to your HerbaCam account</p>
          </div>

          {error && (
            <div className="animate-shake mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter username" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter password" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 disabled:opacity-50 transition-all shadow-sm active:scale-[0.99]">
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-700 font-medium hover:text-green-800">Create one</Link>
          </p>

          <div className="mt-6 p-4 bg-stone-50 rounded-xl">
            <p className="text-xs text-stone-400 font-medium mb-2">Demo Accounts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-stone-500">
              <span>admin / admin123!</span>
              <span>drnkeng / expert123!</span>
              <span>mbaforc / pract123!</span>
              <span>demo_user / user1234!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
