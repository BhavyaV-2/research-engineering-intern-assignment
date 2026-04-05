'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Server } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  created_utc: number;
  bot_suspicion_score: number;
  similarity_score: number;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setResults([]);
    setSuggestions([]);
    setError(null);
    setQuery(searchQuery);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/search?query=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.status === '404_SEMANTIC') {
        setError(data.message);
        setSuggestions(data.suggestions || []);
      } else {
        setResults(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="py-20 bg-slate-950 text-white border-t border-slate-800">
      <div className="max-w-3xl mx-auto px-6 font-sans">
        <div className="text-xs font-mono uppercase tracking-widest text-emerald-500 mb-3">Archive Access — Interactive</div>
        <h2 className="text-4xl font-black text-white mb-2 tracking-tight">The Evidence Archive</h2>
        <p className="text-slate-400 mb-10 text-lg max-w-xl">
          Interrogate the dataset. Our AI retrieves posts by <em>semantic meaning</em>, not keyword.
        </p>

        <div className="relative mb-8">
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden focus-within:border-emerald-500 transition-colors">
            <Search className="absolute left-4 text-slate-500 w-5 h-5" />
            <input
              suppressHydrationWarning
              type="text"
              className="w-full text-lg py-4 pl-12 pr-4 focus:outline-none bg-transparent text-white placeholder:text-slate-500"
              placeholder="e.g. 'election interference', 'derechos civiles'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              suppressHydrationWarning
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="shrink-0 m-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSearching ? <Server className="w-4 h-4 animate-pulse" /> : 'Search'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 bg-slate-800 border border-emerald-500/40 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-white mb-1">AI Intercept: No semantic match found</div>
                  <p className="text-slate-400 text-sm mb-3">Gemini suggested these relevant topics:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => handleSearch(s)} className="px-3 py-1.5 bg-slate-900 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-900/30 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {results.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-4">{results.length} semantic matches</div>
              {results.map((post, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 px-2 py-1 rounded">r/{post.subreddit}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">SIMILARITY {(post.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="font-medium text-slate-200 leading-snug mb-3">{post.title}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className={post.bot_suspicion_score > 50 ? 'text-red-400 font-bold' : ''}>by {post.author}</span>
                    {post.bot_suspicion_score > 50 && (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-red-900/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">High Threat</span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
