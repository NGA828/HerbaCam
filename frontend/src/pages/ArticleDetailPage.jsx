import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { articlesAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { ArrowLeft, Calendar, Clock, FileX } from 'lucide-react';
import { articleImage } from '../utils/images';

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    setLoading(true);
    articlesAPI.detail(slug)
      .then(r => { setArticle(r.data); })
      .catch(() => toast.error('Article unavailable', 'It may have been unpublished or removed.'))
      .finally(() => setLoading(false));
  }, [slug, toast]);

  // Reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [article]);

  // Robust content renderer that properly groups lists and formats text
  const renderContent = (content) => {
    if (!content) return null;
    const lines = content.split('\n');
    const elements = [];
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc pl-5 space-y-2 text-stone-700 leading-relaxed mb-6 marker:text-emerald-600">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={i} className="text-2xl font-bold text-stone-800 mt-10 mb-4">{trimmed.replace('## ', '')}</h2>);
      } else if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={i} className="text-xl font-semibold text-stone-800 mt-8 mb-3">{trimmed.replace('### ', '')}</h3>);
      } else if (trimmed.startsWith('- ')) {
        listItems.push(trimmed.replace('- ', ''));
      } else if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) {
        flushList();
        elements.push(
          <p key={i} className="italic text-stone-500 mt-8 mb-8 border-l-4 border-emerald-200 bg-emerald-50/30 py-4 pl-6 rounded-r-lg">
            {trimmed.replace(/\*/g, '')}
          </p>
        );
      } else {
        flushList();
        elements.push(<p key={i} className="text-stone-700 leading-relaxed mb-5 text-[1.05rem]">{trimmed}</p>);
      }
    });
    flushList();
    return elements;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 pt-24 pb-16">
        <div className="fixed left-0 top-16 z-50 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="skeleton-shimmer h-4 w-24 rounded-full mb-6" />
          <div className="skeleton-shimmer h-10 w-3/4 rounded-xl mb-3" />
          <div className="skeleton-shimmer h-10 w-1/2 rounded-xl mb-8" />
          <div className="flex gap-4 mb-8">
            <div className="skeleton-shimmer h-5 w-32 rounded" />
            <div className="skeleton-shimmer h-5 w-24 rounded" />
            <div className="skeleton-shimmer h-5 w-20 rounded" />
          </div>
          <div className="skeleton-shimmer aspect-[16/9] rounded-2xl mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-shimmer h-4 rounded w-full" style={{ width: `${85 + (i % 3) * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center pt-20 pb-16 px-4 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-stone-100">
          <FileX className="h-10 w-10 text-stone-400" />
        </div>
        <h2 className="text-3xl font-bold text-stone-800">Article not found</h2>
        <p className="mt-3 max-w-md text-stone-500 leading-relaxed">
          The article you're looking for may have been unpublished, removed, or the URL is incorrect.
        </p>
        <Link to="/articles" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 shadow-sm hover:shadow-md">
          <ArrowLeft className="h-4 w-4" /> Back to all articles
        </Link>
      </div>
    );
  }

  const words = article.content?.trim().split(/\s+/).length || 0;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const authorInitial = article.author_name?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16">
      {/* Reading Progress Bar */}
      <div className="fixed left-0 top-16 z-50 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Link to="/articles" className="group inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-emerald-700 transition-colors mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200/60 group-hover:bg-emerald-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Articles
          </Link>
        </Reveal>

        <Reveal delay={100}>
          <article className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            {article.cover_image && (
              <div className="aspect-[16/9] bg-stone-100 relative">
                <img 
                  src={articleImage(article)} 
                  alt={article.title} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { 
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.opacity = '0';
                  }} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
            )}
            
            <div className="p-6 sm:p-10 lg:p-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 border border-emerald-100">
                  {article.category?.name || 'Article'}
                </span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 leading-tight tracking-tight mb-6">
                {article.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-stone-500 mb-10 pb-8 border-b border-stone-100">
                <span className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs ring-2 ring-white">
                    {authorInitial}
                  </div>
                  <span className="font-medium text-stone-700">{article.author_name}</span>
                </span>
                
                {article.published_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-stone-400" /> 
                    {new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-stone-400" /> 
                  {readingMinutes} min read
                </span>
              </div>
              
              <div className="prose prose-stone max-w-none">
                {renderContent(article.content)}
              </div>
            </div>
          </article>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-10 flex justify-center">
            <Link to="/articles" className="group inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 hover:shadow-md active:scale-[0.98]">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
              Explore more articles
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}