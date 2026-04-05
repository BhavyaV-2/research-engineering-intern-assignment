'use client';

import { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#4f46e5', '#ca8a04', '#0891b2', '#ea580c', '#65a30d', '#0d9488'];

export default function TopicClustering() {
  const [kValue, setKValue] = useState(10);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<string>('');
  
  const fetchSummary = async (k: number) => {
    try {
      setSummary('');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/summary/clusters?k=${k}`);
      if (!response.body) return;
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setSummary((prev) => prev + decoder.decode(value));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchClusters = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/clusters?k=${kValue}`);
        const result = await res.json();
        if (active) setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    
    const timer = setTimeout(() => {
      fetchClusters();
      fetchSummary(kValue);
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [kValue]);

  return (
    <section className="py-20 border-t border-slate-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 font-sans mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-3">Finding #4 — Semantic</div>
        <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">The Semantic Divide</h2>
        <p className="text-slate-500 max-w-xl">
          8,799 posts projected into 2D UMAP space — sorted by <em>meaning</em>, not keyword.
          Adjust the slider to fragment the ideological space.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
          Analyst Note: r/worldpolitics detected as a semantic outlier (anime/memes — not politics)
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 font-sans space-y-10">
        <div className="bg-white border border-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl p-8">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-900">Dense Embedding Topography</h3>
            <p className="text-sm text-slate-500 mt-1">Interactive DataMapPlot projection of the complete 384-dimensional dataset.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl h-[600px] w-full overflow-hidden relative">
            <iframe 
               src="/datamapplot.html" 
               className="w-full h-full border-0 absolute inset-0"
               title="DataMapPlot Embedding Visualizer"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl p-8">
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Coordinate Space Clusters</h3>
              <p className="text-sm text-slate-500 mt-1">Live <code className="bg-slate-100 px-1 rounded">sklearn.cluster.KMeans</code> over 2D UMAP projection.</p>
            </div>
            
            <div className="flex items-center gap-5 w-full md:w-96 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <span className="text-sm font-bold text-slate-700 whitespace-nowrap uppercase tracking-widest">Clusters: {kValue}</span>
              <input 
                suppressHydrationWarning
                type="range" min="2" max="100" value={kValue} 
                onChange={(e) => setKValue(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-[600px] relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex justify-center items-center z-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 shadow-sm"></div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x_coord" hide domain={['dataMin - 1', 'dataMax + 1']} />
                <YAxis type="number" dataKey="y_coord" hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} 
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const d = payload[0].payload;
                      const isBot = d.bot_suspicion_score > 50;
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded shadow-2xl text-sm min-w-[160px] font-sans">
                          <p className="font-bold mb-1 uppercase tracking-wider text-xs bg-slate-800 px-2 py-1 fit-content inline-block rounded">{d.subreddit}</p>
                          <hr className="border-slate-700 my-3" />
                          <p className="text-slate-300 flex justify-between">
                            <span>K-Cluster:</span> <span className="font-mono font-bold text-white">{d.cluster_id}</span>
                          </p>
                          <p className={`flex justify-between mt-2 ${isBot ? 'text-red-400 font-medium' : 'text-slate-300'}`}>
                            <span>Bot Score:</span> <span className="font-mono text-white bg-slate-800 px-1 rounded">{d.bot_suspicion_score}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={data} fill="#8884d8">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.cluster_id % COLORS.length]} opacity={0.65} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-200">
             <div className="flex items-center gap-2 mb-3">
               <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
               <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Macro-Synthesis</span>
               <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 font-mono">Google Gemini 3.0 Flash</span>
             </div>
             <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[80px]">
                {summary ? (
                  <p className="text-slate-700 leading-relaxed font-serif text-lg">{summary}</p>
                ) : (
                  <div className="flex space-x-2 w-full h-full items-center">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}
