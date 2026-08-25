import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articlesAPI } from '../api/client';
import { BookOpen, Calendar, ArrowRight } from 'lucide-react';

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesAPI.list().then(r => { setArticles(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="pt-20 pb-12 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Educational Articles</h1>
          <p className="text-stone-500">Learn about traditional medicine, plant knowledge, and preservation</p>
        </div>

        {loading ? (
          <div className="space-y-6">{[1,2,3].map(i => <div key={i} className="h-40 bg-stone-100 rounded-2xl animate-pulse" />)}</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-600">No articles yet</h3>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map(article => (
              <Link key={article.id} to={`/articles/${article.slug}`}
                className="block bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-48 aspect-[16/9] sm:aspect-auto bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shrink-0">
                    {article.cover_image ? (
                      <img src={`${article.cover_image.replace(/^https?:\/\/[^/]+/, '')}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-12 h-12 text-green-300" />
                    )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
