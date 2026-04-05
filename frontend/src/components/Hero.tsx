'use client';

import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <header className="pt-32 pb-12 px-6 bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 font-mono">
            An Arbiter Protocol Investigation · SimPPL Research
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-[1.02]">
            Anatomy of an<br />Echo Chamber
          </h1>
          <p className="text-xl md:text-2xl text-slate-500 font-serif leading-relaxed max-w-2xl mb-10">
            Mapping the physical structure of manufactured polarization on Reddit — using multilingual AI embeddings, Bipartite PageRank, and real-time DuckDB analytics.
          </p>

          <div className="flex items-center gap-2 text-sm font-sans text-slate-400">
            <span className="font-bold text-slate-600">The SimPPL Desk</span>
            <span>·</span>
            <span>April 2026</span>
          </div>
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-4 gap-0 border border-slate-100 rounded-2xl overflow-hidden font-sans">
        {[
          { val: "8,799", label: "Posts Analyzed" },
          { val: "10", label: "Subreddits" },
          { val: "384D", label: "MiniLM Embeddings" },
          { val: "Gemini", label: "AI Synthesis" },
        ].map((s, i) => (
          <div key={i} className={`text-center py-6 px-4 ${i < 3 ? 'border-r border-slate-100' : ''}`}>
            <div className="text-3xl font-black text-slate-900">{s.val}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
