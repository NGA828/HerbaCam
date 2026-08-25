import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Search, Leaf, MapPin, Shield, BookOpen, ChevronRight,
  Brain, Users, BarChart3, AlertTriangle, Sparkles, ArrowRight,
  Eye, Heart, Globe, TrendingUp
} from 'lucide-react';
import { plantsAPI, articlesAPI } from '../api/client';

function AnimatedCounter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [plants, setPlants] = useState([]);
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    plantsAPI.list({ page_size: 4 }).then(r => setPlants(r.data.results || [])).catch(() => {});
    articlesAPI.list({ page_size: 3 }).then(r => setArticles(r.data.results || [])).catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-emerald-900" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-green-200 text-sm mb-6">
                <Sparkles className="w-4 h-4" /> AI-Powered Plant Identification
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Preserving Cameroon's{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-300">
                  Traditional Healing
                </span>{' '}
                Knowledge
              </h1>
              <p className="text-lg text-green-100/80 mb-8 max-w-xl leading-relaxed">
                Identify medicinal plants with AI, explore centuries of traditional knowledge,
                and help preserve Cameroonian herbal medicine heritage for future generations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/identify"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-800 rounded-xl font-semibold hover:bg-green-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  <Camera className="w-5 h-5" /> Identify a Plant
                </Link>
                <Link to="/symptoms"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all">
                  <Search className="w-5 h-5" /> Search by Symptom
                </Link>
              </div>
            </div>

            <div className="hidden lg:block relative">
              <div className="relative w-full aspect-square max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-3xl backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
                      <Leaf className="w-12 h-12 text-green-300" />
                    </div>
                    <p className="text-white/60 text-sm">Upload a plant photo</p>
                    <p className="text-white/40 text-xs mt-1">AI will identify it in seconds</p>
                  </div>
                </div>
                {/* Floating cards */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl p-3 shadow-xl animate-bounce-slow">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Brain className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">AI Confidence</p>
                      <p className="text-sm font-bold text-green-600">91%</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-3 shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Region</p>
                      <p className="text-sm font-bold text-amber-700">Northwest</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Leaf, value: 8, suffix: '+', label: 'Medicinal Plants' },
              { icon: Search, value: 16, suffix: '+', label: 'Traditional Uses' },
              { icon: MapPin, value: 10, label: 'Regions Covered' },
              { icon: Users, value: 12, label: 'Symptoms Indexed' },
            ].map((stat, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-green-50 rounded-xl flex items-center justify-center mb-3">
                    <stat.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-3xl font-bold text-stone-800">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix || ''} />
                  </p>
                  <p className="text-sm text-stone-500 mt-1">{stat.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-4">How HerbaCam Works</h2>
              <p className="text-stone-500 max-w-2xl mx-auto">From plant identification to knowledge preservation — explore our intelligent platform.</p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Camera, title: 'Upload & Identify', desc: 'Take a photo of any plant and our AI will identify the species with confidence scoring.', color: 'green' },
              { icon: Search, title: 'Search & Explore', desc: 'Find plants by symptom, region, or traditional use. Discover connections in the knowledge network.', color: 'blue' },
              { icon: Shield, title: 'Preserve & Protect', desc: 'Help document traditional knowledge before it disappears. Track preservation risk indicators.', color: 'amber' },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 150}>
                <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-stone-100 group hover:-translate-y-1">
                  <div className={`w-14 h-14 rounded-2xl bg-${item.color === 'green' ? 'green' : item.color === 'blue' ? 'blue' : 'amber'}-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-7 h-7 text-${item.color === 'green' ? 'green' : item.color === 'blue' ? 'blue' : 'amber'}-600`} />
                  </div>
                  <h3 className="text-xl font-semibold text-stone-800 mb-3">{item.title}</h3>
                  <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Plants */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-2">Featured Medicinal Plants</h2>
                <p className="text-stone-500">Discover Cameroon's rich botanical heritage</p>
              </div>
              <Link to="/plants" className="hidden sm:flex items-center gap-2 text-green-700 font-medium hover:text-green-800">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plants.map((plant, i) => (
              <ScrollReveal key={plant.id} delay={i * 100}>
                <Link to={`/plants/${plant.id}`}
                  className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
                    {plant.image ? (
                      <img src={`http://localhost:8000${plant.image}`} alt={plant.common_name} className="w-full h-full object-cover" />
                    ) : (
                      <Leaf className="w-16 h-16 text-green-200 group-hover:text-green-300 transition-colors" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-800 group-hover:text-green-700 transition-colors">
                      {plant.common_name || plant.scientific_name}
                    </h3>
                    <p className="text-sm text-stone-500 italic">{plant.scientific_name}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        {plant.family || 'Documented'}
                      </span>
                      {plant.regions_count > 0 && (
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{plant.regions_count} regions
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
            {plants.length === 0 && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-stone-100 rounded-2xl animate-pulse h-64" />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link to="/plants" className="inline-flex items-center gap-2 text-green-700 font-medium">
              View all plants <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Knowledge Preservation */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full text-green-700 text-sm font-medium mb-4">
                  <AlertTriangle className="w-4 h-4" /> Knowledge at Risk
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-6">
                  Traditional Knowledge Is Disappearing
                </h2>
                <p className="text-stone-600 leading-relaxed mb-6">
                  Every year, traditional healers pass away taking decades of medicinal plant knowledge with them.
                  HerbaCam's risk assessment system helps identify which knowledge areas need urgent documentation.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Users, text: 'Track number of knowledge contributors per plant' },
                    { icon: TrendingUp, text: 'Monitor submission trends over time' },
                    { icon: Globe, text: 'Analyze geographic distribution of knowledge' },
                    { icon: BarChart3, text: 'Generate preservation risk scores' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <item.icon className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-stone-700">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-stone-100">
                <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" /> Preservation Risk Indicators
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Contributor Scarcity', score: 75, color: 'bg-red-500' },
                    { label: 'Knowledge Recency', score: 60, color: 'bg-amber-500' },
                    { label: 'Geographic Concentration', score: 45, color: 'bg-yellow-500' },
                    { label: 'Documentation Scarcity', score: 80, color: 'bg-red-500' },
                    { label: 'Submission Decline', score: 30, color: 'bg-green-500' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-stone-600">{item.label}</span>
                        <span className="font-medium">{item.score}/100</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-400 mt-4 italic">
                  These are analytical indicators for prioritizing documentation, not scientific predictions.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Evidence & Safety */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-4">Evidence & Safety First</h2>
              <p className="text-stone-500 max-w-2xl mx-auto">
                We clearly distinguish traditional knowledge from scientific evidence and always prioritize safety information.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Eye, title: 'Traditional Knowledge', desc: 'Documented traditional uses with provenance — contributor, region, community, and verification status.', color: 'green' },
              { icon: BarChart3, title: 'Scientific Evidence', desc: 'Evidence levels from Insufficient to Strong, with references and expert reviews.', color: 'blue' },
              { icon: Shield, title: 'Safety Information', desc: 'Precautions, contraindications, interactions, and warnings reviewed by experts.', color: 'red' },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 150}>
                <div className="p-8 rounded-2xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all">
                  <item.icon className={`w-10 h-10 mb-4 text-${item.color === 'green' ? 'green' : item.color === 'blue' ? 'blue' : 'red'}-600`} />
                  <h3 className="text-xl font-semibold text-stone-800 mb-3">{item.title}</h3>
                  <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl font-bold text-stone-800 mb-2">Educational Articles</h2>
                <p className="text-stone-500">Learn more about traditional medicine and plant knowledge</p>
              </div>
              <Link to="/articles" className="hidden sm:flex items-center gap-2 text-green-700 font-medium">
                All articles <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {articles.map((article, i) => (
              <ScrollReveal key={article.id} delay={i * 100}>
                <Link to={`/articles/${article.slug}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-stone-200 hover:shadow-lg transition-all duration-300">
                  <div className="aspect-[16/9] bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-green-300" />
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wider">
                      {article.category_name || 'Article'}
                    </span>
                    <h3 className="font-semibold text-stone-800 mt-2 group-hover:text-green-700 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-stone-500 mt-2 line-clamp-2">{article.summary}</p>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
            {articles.length === 0 && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-stone-100 rounded-2xl animate-pulse h-64" />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-green-800 to-emerald-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Ready to Explore Traditional Plant Knowledge?
            </h2>
            <p className="text-green-100/80 mb-8 max-w-2xl mx-auto">
              Join HerbaCam to identify plants with AI, explore traditional medicine, and help preserve knowledge for future generations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-800 rounded-xl font-semibold hover:bg-green-50 transition-all shadow-lg">
                Create Free Account <ChevronRight className="w-5 h-5" />
              </Link>
              <Link to="/plants"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all">
                Browse Plants
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
