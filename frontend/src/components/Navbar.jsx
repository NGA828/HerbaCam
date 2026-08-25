import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Leaf, Menu, X, User, LogIn } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const links = [
    { path: '/plants', label: 'Plants' },
    { path: '/symptoms', label: 'Symptoms' },
    { path: '/identify', label: 'Identify' },
    { path: '/articles', label: 'Articles' },
    { path: '/about', label: 'About' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white/80 backdrop-blur-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-green-800">HerbaCam</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-green-700 bg-green-50'
                    : 'text-stone-600 hover:text-green-700 hover:bg-green-50/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                to={user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'EXPERT' ? '/expert/dashboard' : user.role === 'PRACTITIONER' ? '/practitioner/dashboard' : '/dashboard'}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors shadow-sm"
              >
                <User className="w-4 h-4" /> Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-stone-700 hover:text-green-700 transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors shadow-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-stone-100 py-3 px-4 space-y-1 animate-in slide-in-from-top-2">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-stone-700 hover:bg-green-50 hover:text-green-700"
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-stone-100" />
          {user ? (
            <Link to="/dashboard" className="block px-4 py-2.5 rounded-lg text-sm font-medium bg-green-50 text-green-700">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="block px-4 py-2.5 rounded-lg text-sm font-medium text-stone-700">Log in</Link>
              <Link to="/register" className="block px-4 py-2.5 rounded-lg text-sm font-medium bg-green-700 text-white text-center">Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
