import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articlesAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Reveal } from '../components/ui/motion';
import { BookOpen, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { articleImage } from '../utils/images';

export default function ArticlesPage() {
  const { toast } = useToast();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesAPI.categories().then(r => setCategories(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    articlesAPI.list(category ? { category } : undefined)
      .then(r => { setArticles(r.data.results || r.data); })
      .catch(() => toast.error('Could not load articles', 'The reading room did not respond.'))
      .finally(() => setLoading(false));
  }, [category, toast]);

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Educational Articles</h1>
          <p className="text-stone-500">
            Learn about traditional medicine, plant knowledge, and preservation
            {!loading && <span className="ml-2 text-stone-400">· {articles.length} published</span>}
            {loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-stone-300" />}
          </p>
        </div>
        </Reveal>

        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!category ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.slug)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${category === c.slug ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-40 rounded-2xl" />)}</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-600">No articles yet</h3>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article, index) => (
              <Reveal key={article.id} delay={Math.min(index * 70, 350)}>
              <Link to={`/articles/${article.slug}`}
                className="card-hover hover-zoom block overflow-hidden rounded-2xl border border-stone-200 bg-white group">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-48 aspect-[16/9] sm:aspect-auto bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shrink-0">
                    {article.cover_image ? (
                      <img
                        src={articleImage(article)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none'; const sib = e.currentTarget.nextElementSibling; if (sib) sib.style.display = ''; }}
                      />
                    ) : null}
                    <BookOpen className={`w-12 h-12 text-green-300 ${article.cover_image ? 'hidden' : ''}`} />
                  </div>
                  <div className="p-6 flex-1">
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wider">{article.category_name || 'Article'}</span>
                    <h2 className="text-xl font-bold text-stone-800 mt-2 group-hover:text-green-700 transition-colors">{article.title}</h2>
                    <p className="text-stone-500 mt-2 line-clamp-2">{article.summary}</p>
                    <div className="flex items-center gap-4 mt-4 text-sm text-stone-400">
                      <span>{article.author_name}</span>
                      {article.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(article.published_at).toLocaleDateString()}
                        </span>
                      )}
                      <span className="ml-auto text-green-700 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Read more <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
