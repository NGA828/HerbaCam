import { Link } from 'react-router-dom';
import { Leaf, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">HerbaCam</span>
            </Link>
            <p className="text-sm text-stone-400 leading-relaxed">
              AI-Powered Identification and Preservation of Cameroonian Traditional Medicinal Plant Knowledge.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/plants" className="hover:text-green-400 transition-colors">Medicinal Plants</Link></li>
              <li><Link to="/symptoms" className="hover:text-green-400 transition-colors">Symptom Search</Link></li>
              <li><Link to="/identify" className="hover:text-green-400 transition-colors">AI Identification</Link></li>
              <li><Link to="/articles" className="hover:text-green-400 transition-colors">Articles</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">About</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-green-400 transition-colors">About HerbaCam</Link></li>
              <li><Link to="/about" className="hover:text-green-400 transition-colors">Our Mission</Link></li>
              <li><Link to="/about" className="hover:text-green-400 transition-colors">Knowledge Preservation</Link></li>
              <li><Link to="/about" className="hover:text-green-400 transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Disclaimer</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              HerbaCam is an educational and informational platform. It is NOT a replacement for professional medical diagnosis or treatment. Always consult qualified healthcare providers for medical decisions.
            </p>
          </div>
        </div>

        <div className="border-t border-stone-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-stone-500">
            © {new Date().getFullYear()} HerbaCam. Educational Platform for Traditional Medicinal Plant Knowledge.
          </p>
          <p className="text-sm text-stone-500 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-400" /> for Cameroon
          </p>
        </div>
      </div>
    </footer>
  );
}
