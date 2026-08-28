import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { articlesAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import { articleImage } from '../utils/images';

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
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

  if (loading) {
    return (
      <div className="pt-20 pb-12 min-h-screen">
      <div className="fixed left-0 top-16 z-40 h-0.5 bg-emerald-600 transition-[width] duration-150" style={{ width: `${progress}%` }} />
        <div className="max-w-3xl mx-auto px-4">
          <div className="skeleton-shimmer h-8 rounded w-1/2 mb-4" />
          <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton-shimmer h-4 rounded" />)}</div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="pt-24 pb-12 text-center">
        <h2 className="text-2xl font-bold">Article not found</h2>
        <Link to="/articles" className="mt-4 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800">Back to articles</Link>
      </div>
    );
  }

  const words = article.content?.trim().split(/\s+/).length || 0;
  const readingMinutes = Math.max(1, Math.round(words / 200));

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="fixed left-0 top-16 z-40 h-0.5 bg-emerald-600 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/articles" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-green-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Articles
        </Link>
        <Reveal>
        <article className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {article.cover_image && (
            <div className="aspect-[21/9] bg-stone-100">
              <img src={articleImage(article)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.opacity = '0'; }} />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <span className="text-xs font-medium text-green-600 uppercase tracking-wider">{article.category?.name || 'Article'}</span>
            <h1 className="text-3xl font-bold text-stone-800 mt-3 mb-4">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500 mb-8 pb-6 border-b border-stone-100">
              <span className="flex items-center gap-1"><User className="w-4 h-4" /> {article.author_name}</span>
              {article.published_at && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(article.published_at).toLocaleDateString()}</span>}
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {readingMinutes} min read</span>
              {article.category?.name && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{article.category.name}</span>
              )}
            </div>
            <div className="prose prose-stone max-w-none">
              {article.content.split('\n').map((para, i) => {
                if (para.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-stone-800 mt-6 mb-3">{para.replace('## ', '')}</h2>;
                if (para.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-stone-700 mt-4 mb-2">{para.replace('### ', '')}</h3>;
                if (para.startsWith('*') && para.endsWith('*')) return <p key={i} className="italic text-stone-500 mt-4">{para.replace(/\*/g, '')}</p>;
                if (para.startsWith('- ')) return <li key={i} className="ml-5 list-disc text-stone-700 leading-relaxed">{para.replace('- ', '')}</li>;
                if (para.trim()) return <p key={i} className="text-stone-700 leading-relaxed mb-4">{para}</p>;
                return null;
              })}
            </div>
          </div>
        </article>
        </Reveal>

        <div className="mt-8 flex justify-center">
          <Link to="/articles" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]">
            <ArrowLeft className="h-4 w-4" /> More articles
          </Link>
        </div>
      </div>
    </div>
  );
}
