'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function EchoChambers() {
  const [aiSummary, setAiSummary] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/timeline`)
      .then(res => res.json())
      .then(data => setTimeline(data))
      .catch(console.error);

    let isMounted = true;
    const fetchStream = async () => {
      setIsStreaming(true);
      try {
        setAiSummary('');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/summary?query=politics`);
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          if (isMounted) setAiSummary(prev => prev + chunk);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsStreaming(false);
      }
    };
    fetchStream();
    return () => { isMounted = false; };
  }, []);

  const keys = timeline.length > 0 ? Object.keys(timeline[0]).filter(k => k !== 'date') : [];
  const colors = ['#dc2626', '#2563eb', '#059669', '#7c3aed', '#ea580c'];

  return (
    <section className="py-20 border-t border-slate-100 bg-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6 font-sans">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-3">Finding #2 — Temporal</div>
        <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Echo Chamber Dynamics</h2>
        <p className="text-slate-500 mb-8 max-w-xl">Live DuckDB aggregation of posting velocity by community, synthesized by Gemini.</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <div className="font-bold text-slate-900 text-lg">Narrative Velocity Over Time</div>
              <div className="text-sm text-slate-400">Weekly post volume by ideological community</div>
            </div>
          </div>

          <div className="h-[360px] w-full">
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 30px rgba(0,0,0,0.08)' }} labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }} />
                  <Legend wrapperStyle={{ paddingTop: '16px' }} iconType="circle" />
                  {keys.map((k, i) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 flex-col gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-slate-400 text-sm">Aggregating timeline data...</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Macro-Synthesis</span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-full">Google Gemini 3.0 Flash</span>
            </div>
            <p className="text-base text-slate-700 font-serif leading-relaxed italic">
              {aiSummary || <span className="text-slate-400">Synthesizing trend data...</span>}
              {isStreaming && <span className="inline-block w-2 h-4 bg-blue-500 ml-1 translate-y-0.5 animate-pulse" />}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
