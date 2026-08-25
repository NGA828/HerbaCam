import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { articlesAPI } from '../api/client';
import { ArrowLeft, Calendar, User } from 'lucide-react';

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesAPI.detail(slug).then(r => { setArticle(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="pt-20 pb-12 min-h-screen"><div className="max-w-3xl mx-auto px-4 animate-pulse"><div className="h-8 bg-stone-100 rounded w-1/2 mb-4" /><div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-stone-100 rounded" />)}</div></div></div>;
  if (!article) return <div className="pt-20 pb-12 text-center"><h2 className="text-2xl font-bold">Article not found</h2><Link to="/articles" className="text-green-700 mt-4 inline-block">← Back to articles</Link></div>;

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/articles" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-green-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Articles
        </Link>
        <article className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {article.cover_image && (
            <div className="aspect-[21/9] bg-stone-100">
              <img src={`${article.cover_image.replace(/^https?:\/\/[^/]+/, '')}`} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <span className="text-xs font-medium text-green-600 uppercase tracking-wider">{article.category?.name || 'Article'}</span>
            <h1 className="text-3xl font-bold text-stone-800 mt-3 mb-4">{article.title}</h1>
            <div className="flex items-center gap-4 text-sm text-stone-500 mb-8 pb-6 border-b border-stone-100">
              <span className="flex items-center gap-1"><User className="w-4 h-4" /> {article.author_name}</span>
              {article.published_at && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(article.published_at).toLocaleDateString()}</span>}
            </div>
            <div className="prose prose-stone max-w-none">
              {article.content.split('\n').map((para, i) => {
                if (para.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-stone-800 mt-6 mb-3">{para.replace('## ', '')}</h2>;
                if (para.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-stone-700 mt-4 mb-2">{para.replace('### ', '')}</h3>;
                if (para.startsWith('*') && para.endsWith('*')) return <p key={i} className="italic text-stone-500 mt-4">{para.replace(/\*/g, '')}</p>;
                if (para.trim()) return <p key={i} className="text-stone-700 leading-relaxed mb-4">{para}</p>;
                return null;
              })}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
