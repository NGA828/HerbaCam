import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Home, Leaf, Search, Camera, Heart, Clock, BookOpen, User, Bell,
  Menu, X, LogOut, ChevronDown, FileText, BarChart3, Shield,
  Users, Settings, MapPin, AlertTriangle, ClipboardCheck, Plus
} from 'lucide-react';

const navItems = {
  USER: [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/identify', label: 'Identify Plant', icon: Camera },
    { path: '/symptoms', label: 'Symptom Search', icon: Search },
    { path: '/plants', label: 'Plants', icon: Leaf },
    { path: '/favorites', label: 'Favorites', icon: Heart },
    { path: '/history', label: 'History', icon: Clock },
    { path: '/articles', label: 'Articles', icon: BookOpen },
  ],
  PRACTITIONER: [
    { path: '/practitioner/dashboard', label: 'Dashboard', icon: Home },
    { path: '/practitioner/contributions/new', label: 'New Contribution', icon: Plus },
    { path: '/practitioner/contributions', label: 'My Contributions', icon: FileText },
    { path: '/identify', label: 'Identify Plant', icon: Camera },
    { path: '/plants', label: 'Plants', icon: Leaf },
    { path: '/symptoms', label: 'Symptom Search', icon: Search },
  ],
  EXPERT: [
    { path: '/expert/dashboard', label: 'Dashboard', icon: Home },
    { path: '/expert/reviews', label: 'Pending Reviews', icon: ClipboardCheck },
    { path: '/expert/evidence', label: 'Evidence', icon: BarChart3 },
    { path: '/expert/safety', label: 'Safety', icon: Shield },
    { path: '/expert/preservation', label: 'Preservation', icon: AlertTriangle },
    { path: '/plants', label: 'Plants', icon: Leaf },
  ],
  ADMIN: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/plants', label: 'Plants', icon: Leaf },
    { path: '/admin/knowledge', label: 'Knowledge', icon: FileText },
    { path: '/admin/practitioners', label: 'Practitioners', icon: User },
    { path: '/admin/articles', label: 'Articles', icon: BookOpen },
    { path: '/admin/evidence', label: 'Evidence', icon: BarChart3 },
    { path: '/admin/safety', label: 'Safety', icon: Shield },
    { path: '/admin/geography', label: 'Geography', icon: MapPin },
    { path: '/admin/preservation', label: 'Preservation', icon: AlertTriangle },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/audit', label: 'Audit Logs', icon: Shield },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || 'USER';
  const items = navItems[role] || navItems.USER;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-stone-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-stone-100">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-green-800">HerbaCam</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-green-50 text-green-800 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-green-600' : 'text-stone-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-100">
          <div className="px-3 py-2 text-xs text-stone-400 uppercase tracking-wider">
            {role.charAt(0) + role.slice(1).toLowerCase()} Panel
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-stone-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-stone-800">
              {items.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <Bell className="w-5 h-5 text-stone-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-green-700" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-stone-700">
                  {user?.first_name || user?.username}
                </span>
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="font-medium text-sm">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-stone-500">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link
                      to="/"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Home className="w-4 h-4" /> Public Site
                    </Link>
                    <button
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
