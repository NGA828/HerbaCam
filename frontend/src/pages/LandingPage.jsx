import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Search, Leaf, MapPin, Shield, BookOpen, ChevronRight,
  Brain, Users, BarChart3, AlertTriangle, Sparkles, ArrowRight,
  Eye, Heart, Globe, TrendingUp, CheckCircle
} from 'lucide-react';
import { plantsAPI, articlesAPI, analyticsAPI } from '../api/client';
import heroImg from '../assets/hero-botanical.jpg';

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
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [plants, setPlants] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    plantsAPI.list({ page_size: 4 }).then(r => setPlants(r.data.results || r.data)).catch(() => {});
    articlesAPI.list({ page_size: 3 }).then(r => setArticles(r.data.results || r.data)).catch(() => {});
    analyticsAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[92vh] flex items-center pt-16">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Cameroonian botanical heritage" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/80 to-emerald-900/70" />
        </div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-[fadeInUp_1s_ease-out]">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-green-200 text-sm mb-6 border border-white/10">
                <Sparkles className="w-4 h-4 text-yellow-300" /> AI-Powered Plant Identification
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
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-800 rounded-xl font-semibold hover:bg-green-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <Camera className="w-5 h-5" /> Identify a Plant
                </Link>
                <Link to="/symptoms"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all">
                  <Search className="w-5 h-5" /> Search by Symptom
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-8 text-green-200/70 text-sm">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> Free to use</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> Expert-verified</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> AI-powered</span>
              </div>
            </div>

            <div className="hidden lg:block relative">
              <div className="relative w-full aspect-square max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl backdrop-blur-sm border border-white/10 p-8 flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-4">
                    {plants.slice(0, 4).map((plant) => (
                      <Link key={plant.id} to={`/plants/${plant.id}`} className="group bg-white/10 rounded-2xl p-3 hover:bg-white/20 transition-all">
                        <div className="aspect-square rounded-xl overflow-hidden mb-2">
                          {plant.image ? (
                            <img src={`${plant.image.replace(/^https?:\/\/[^/]+/, '')}`} alt={plant.common_name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-green-600/30 flex items-center justify-center">
                              <Leaf className="w-8 h-8 text-green-300" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-white/80 font-medium truncate">{plant.common_name}</p>
                        <p className="text-[10px] text-white/50 italic truncate">{plant.scientific_name}</p>
                      </Link>
                    ))}
                  </div>
                </div>
                {/* Floating cards */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl p-3 shadow-2xl animate-[bounce_3s_ease-in-out_infinite]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Brain className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-600">AI Confidence</p>
                      <p className="text-sm font-bold text-green-600">91%</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-3 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-600">Region</p>
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
              { icon: Leaf, value: stats?.total_plants || 8, suffix: '+', label: 'Medicinal Plants' },
              { icon: Search, value: stats?.total_traditional_uses || 16, suffix: '+', label: 'Traditional Uses' },
              { icon: MapPin, value: 10, label: 'Regions Covered' },
              { icon: Users, value: 12, label: 'Symptoms Indexed' },
            ].map((stat, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto bg-green-50 rounded-2xl flex items-center justify-center mb-3 ring-1 ring-green-100">
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
              <span className="text-sm font-medium text-green-600 uppercase tracking-wider">Our Process</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mt-2 mb-4">How HerbaCam Works</h2>
              <p className="text-stone-500 max-w-2xl mx-auto">From plant identification to knowledge preservation — explore our intelligent platform.</p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Camera, title: 'Upload & Identify', desc: 'Take a photo of any plant and our AI will identify the species with confidence scoring.', bgColor: 'bg-green-50', iconColor: 'text-green-600', ringColor: 'ring-green-100' },
              { icon: Search, title: 'Search & Explore', desc: 'Find plants by symptom, region, or traditional use. Discover connections in the knowledge network.', bgColor: 'bg-blue-50', iconColor: 'text-blue-600', ringColor: 'ring-blue-100' },
              { icon: Shield, title: 'Preserve & Protect', desc: 'Help document traditional knowledge before it disappears. Track preservation risk indicators.', bgColor: 'bg-amber-50', iconColor: 'text-amber-600', ringColor: 'ring-amber-100' },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 150}>
                <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-stone-100 group hover:-translate-y-1">
                  <div className={`w-14 h-14 rounded-2xl ${item.bgColor} ring-1 ${item.ringColor} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-7 h-7 ${item.iconColor}`} />
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
                <span className="text-sm font-medium text-green-600 uppercase tracking-wider">Botanical Heritage</span>
                <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mt-2 mb-2">Featured Medicinal Plants</h2>
                <p className="text-stone-500">Discover Cameroon's rich botanical heritage</p>
              </div>
              <Link to="/plants" className="hidden sm:flex items-center gap-2 text-green-700 font-medium hover:text-green-800 bg-green-50 px-4 py-2 rounded-lg">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plants.map((plant, i) => (
              <ScrollReveal key={plant.id} delay={i * 100}>
                <Link to={`/plants/${plant.id}`}
                  className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden relative">
                    {plant.image ? (
                      <img src={`${plant.image.replace(/^https?:\/\/[^/]+/, '')}`} alt={plant.common_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="w-16 h-16 text-green-200 group-hover:text-green-300 transition-colors" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-green-700 shadow-sm">
                      {plant.family || 'Documented'}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-800 group-hover:text-green-700 transition-colors">
                      {plant.common_name || plant.scientific_name}
                    </h3>
                    <p className="text-sm text-stone-500 italic">{plant.scientific_name}</p>
                    {plant.local_names?.length > 0 && (
                      <p className="text-xs text-stone-400 mt-1.5 truncate">
                        {plant.local_names.map(n => n.name).join(' • ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
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
              <div key={i} className="bg-stone-100 rounded-2xl animate-pulse h-72" />
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full text-red-700 text-sm font-medium mb-4 ring-1 ring-red-200">
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
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm ring-1 ring-stone-100">
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
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-stone-600">{item.label}</span>
                        <span className="font-semibold text-stone-800">{item.score}/100</span>
                      </div>
                      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: visible => `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-400 mt-4 italic bg-stone-50 p-3 rounded-lg">
                  <strong>Note:</strong> These are analytical indicators for prioritizing documentation, not scientific predictions.
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
              <span className="text-sm font-medium text-green-600 uppercase tracking-wider">Trust & Transparency</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mt-2 mb-4">Evidence & Safety First</h2>
              <p className="text-stone-500 max-w-2xl mx-auto">
                We clearly distinguish traditional knowledge from scientific evidence and always prioritize safety information.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Eye, title: 'Traditional Knowledge', desc: 'Documented traditional uses with provenance — contributor, region, community, and verification status.', bgColor: 'bg-green-50', iconColor: 'text-green-600' },
              { icon: BarChart3, title: 'Scientific Evidence', desc: 'Evidence levels from Insufficient to Strong, with references and expert reviews.', bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
              { icon: Shield, title: 'Safety Information', desc: 'Precautions, contraindications, interactions, and warnings reviewed by experts.', bgColor: 'bg-red-50', iconColor: 'text-red-600' },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 150}>
                <div className="p-8 rounded-2xl border border-stone-200 hover:border-stone-300 hover:shadow-lg transition-all bg-white">
                  <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center mb-4`}>
                    <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-stone-800 mb-3">{item.title}</h3>
                  <p className="text-stone-500 leading-relaxed">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Geographic Knowledge */}
      <section className="py-20 bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-sm font-medium text-green-400 uppercase tracking-wider">Geographic Intelligence</span>
                <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-6">
                  Knowledge Mapped Across Cameroon
                </h2>
                <p className="text-stone-300 leading-relaxed mb-6">
                  Explore how traditional medicinal plant knowledge varies across Cameroon's ten regions.
                  From the Sahelian North to the coastal Littoral, each area holds unique botanical heritage.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-bold text-green-400">10</p>
                    <p className="text-sm text-stone-400">Regions Mapped</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-3xl font-bold text-green-400">50+</p>
                    <p className="text-sm text-stone-400">Local Names</p>
                  </div>
                </div>
                <Link to="/map" className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors">
                  <MapPin className="w-4 h-4" /> Explore Map
                </Link>
              </div>
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl border border-white/10 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <Globe className="w-20 h-20 text-green-400/50 mx-auto mb-4" />
                    <p className="text-stone-400 text-sm">Interactive map showing plant distribution</p>
                    <p className="text-stone-500 text-xs mt-1">across Cameroon's 10 regions</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Articles */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-12">
              <div>
                <span className="text-sm font-medium text-green-600 uppercase tracking-wider">Learn More</span>
                <h2 className="text-3xl font-bold text-stone-800 mt-2 mb-2">Educational Articles</h2>
                <p className="text-stone-500">Deep dives into traditional medicine and plant knowledge</p>
              </div>
              <Link to="/articles" className="hidden sm:flex items-center gap-2 text-green-700 font-medium bg-green-50 px-4 py-2 rounded-lg">
                All articles <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {articles.map((article, i) => (
              <ScrollReveal key={article.id} delay={i * 100}>
                <Link to={`/articles/${article.slug}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-stone-200 hover:shadow-lg transition-all duration-300">
                  <div className="aspect-[16/9] bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center relative overflow-hidden">
                    <BookOpen className="w-12 h-12 text-green-300 group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-green-900/20 to-transparent" />
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                      {article.category_name || 'Article'}
                    </span>
                    <h3 className="font-semibold text-stone-800 mt-2 group-hover:text-green-700 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-stone-500 mt-2 line-clamp-2">{article.summary}</p>
                    <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      Read article <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
            {articles.length === 0 && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-stone-100 rounded-2xl animate-pulse h-72" />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 to-emerald-900/95" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Ready to Explore Traditional Plant Knowledge?
            </h2>
            <p className="text-green-100/80 mb-8 max-w-2xl mx-auto text-lg">
              Join HerbaCam to identify plants with AI, explore traditional medicine, and help preserve knowledge for future generations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-800 rounded-xl font-semibold hover:bg-green-50 transition-all shadow-lg hover:shadow-xl">
                Create Free Account <ChevronRight className="w-5 h-5" />
              </Link>
              <Link to="/plants"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all backdrop-blur-sm">
                Browse Plants
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
