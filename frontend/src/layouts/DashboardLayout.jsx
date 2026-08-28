import { useMemo, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { PageTransition } from '../components/ui/motion';
import {
  Home, Leaf, Search, Camera, Heart, Clock, BookOpen, User, Bell,
  Menu, X, LogOut, ChevronDown, FileText, BarChart3, Shield,
  Users, MapPin, AlertTriangle, ClipboardCheck, Plus, Map
} from 'lucide-react';

const navItems = {
  USER: [
    { path: '/user/dashboard', label: 'Dashboard', icon: Home },
    { path: '/user/identify', label: 'Identify Plant', icon: Camera },
    { path: '/user/symptoms', label: 'Symptom Search', icon: Search },
    { path: '/plants', label: 'Browse Plants', icon: Leaf },
    { path: '/user/favorites', label: 'Favorites', icon: Heart },
    { path: '/user/history', label: 'History', icon: Clock },
    { path: '/articles', label: 'Articles', icon: BookOpen },
    { path: '/user/notifications', label: 'Notifications', icon: Bell },
    { path: '/user/profile', label: 'Profile', icon: User },
  ],
  PRACTITIONER: [
    { path: '/practitioner/dashboard', label: 'Dashboard', icon: Home },
    { path: '/practitioner/contributions/new', label: 'New Contribution', icon: Plus },
    { path: '/practitioner/contributions', label: 'My Contributions', icon: FileText },
    { path: '/identify', label: 'Identify Plant', icon: Camera },
    { path: '/plants', label: 'Plants', icon: Leaf },
    { path: '/symptoms', label: 'Symptom Search', icon: Search },
    { path: '/map', label: 'Map', icon: Map },
  ],
  EXPERT: [
    { path: '/expert/dashboard', label: 'Dashboard', icon: Home },
    { path: '/expert/reviews', label: 'Pending Reviews', icon: ClipboardCheck },
    { path: '/expert/knowledge', label: 'Knowledge', icon: FileText },
    { path: '/expert/evidence', label: 'Evidence', icon: BarChart3 },
    { path: '/expert/safety', label: 'Safety', icon: Shield },
    { path: '/expert/preservation', label: 'Preservation', icon: AlertTriangle },
    { path: '/expert/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/expert/notifications', label: 'Notifications', icon: Bell },
    { path: '/expert/profile', label: 'Profile', icon: User },
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

function NotificationDropdown({ onClose }) {
  const { notifications, markRead, markAllRead } = useNotifications();
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-stone-200 z-50 overflow-hidden animate-scale-in">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Notifications</h3>
          {notifications.filter(n => !n.is_read).length > 0 && (
            <button onClick={markAllRead} className="text-xs text-green-700 font-medium hover:text-green-800">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-400">No notifications yet</p>
          ) : (
            notifications.slice(0, 10).map(n => (
              <div key={n.id}
                className={`px-4 py-3 border-b border-stone-50 hover:bg-stone-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-green-50/50' : ''}`}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className={`text-sm ${!n.is_read ? 'font-medium text-stone-800' : 'text-stone-600'}`}>{n.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-stone-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || 'USER';
  const items = navItems[role] || navItems.USER;

  const pageTitle = useMemo(() => {
    const all = [...navItems.USER, ...navItems.PRACTITIONER, ...navItems.EXPERT, ...navItems.ADMIN];
    const exact = all.find(i => i.path === location.pathname);
    if (exact) return exact.label;
    if (location.pathname.startsWith('/expert/reviews')) return 'Pending Reviews';
    if (location.pathname.startsWith('/practitioner/contributions')) return 'My Contributions';
    if (location.pathname.startsWith('/admin')) return 'Administration';
    return 'Dashboard';
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-stone-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-stone-100 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg flex items-center justify-center shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-green-800">HerbaCam</span>
          <button className="ml-auto lg:hidden p-1 rounded hover:bg-stone-100" onClick={() => setSidebarOpen(false)}>
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-green-50 text-green-800 shadow-sm ring-1 ring-green-100'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-green-600' : 'text-stone-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-100 shrink-0">
          <div className="px-3 py-2 text-xs text-stone-400 uppercase tracking-wider font-medium">
            {role.charAt(0) + role.slice(1).toLowerCase()} Panel
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-stone-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-stone-800 hidden lg:block">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                className="relative p-2 rounded-lg hover:bg-stone-100 transition-colors"
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell className="w-5 h-5 text-stone-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center ring-2 ring-green-200">
                  <span className="text-xs font-bold text-green-700">
                    {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-stone-700">
                  {user?.first_name || user?.username}
                </span>
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-2 z-50 animate-scale-in">
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="font-medium text-sm">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-stone-500">{user?.email}</p>
                      <p className="text-xs text-green-600 font-medium mt-0.5">{role}</p>
                    </div>
                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setProfileOpen(false)}>
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link to="/" className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setProfileOpen(false)}>
                      <Home className="w-4 h-4" /> Public Site
                    </Link>
                    <hr className="my-1 border-stone-100" />
                    <button className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full" onClick={handleLogout}>
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
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
