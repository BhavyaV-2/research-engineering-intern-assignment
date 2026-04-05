'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Network, AlertTriangle } from 'lucide-react';

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 150 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 75 });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = 'left' as any;
    node.sourcePosition = 'right' as any;
    node.position = {
      x: nodeWithPosition.x - 110,
      y: nodeWithPosition.y - 37.5,
    };
  });
  return { nodes, edges };
};

export default function CoordinatedBehavior() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<string>('');
  const [cibEvents, setCibEvents] = useState<any[]>([]);
  
  const fetchSummary = async () => {
    try {
      setSummary('');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/summary/network`);
      if (!response.body) return;
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setSummary((prev) => prev + decoder.decode(value));
      }
    } catch (e) {
      console.error("Summary error", e);
    }
  };

  const fetchNetwork = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude_nodes: excluded })
      });
      const data = await res.json();
      
      const unlayoutedNodes = data.nodes.map((n: any) => {
        const isBot = n.type === 'author' && n.bot_suspicion_score > 50;
        return {
          id: n.id,
          position: { x: 0, y: 0 },
          data: { label: n.id, type: n.type, pr: n.pagerank, threat: n.bot_suspicion_score },
          className: n.type === 'author' 
            ? (isBot ? 'bg-red-50 border-2 border-red-500 rounded p-2 text-xs font-mono shadow-sm' : 'bg-white border-2 border-slate-300 w-[180px] rounded p-2 text-xs font-mono')
            : 'bg-slate-900 border-2 border-slate-900 rounded-lg p-3 text-sm font-bold shadow-md text-white'
        };
      });

      const unlayoutedEdges = data.edges.map((e: any, i: number) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#cbd5e1', strokeWidth: 1.5 }
      }));
      
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        unlayoutedNodes,
        unlayoutedEdges
      );
      
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      
      const cibRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/cib_events`);
      const cibData = await cibRes.json();
      setCibEvents(cibData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [excluded]);

  useEffect(() => {
    fetchNetwork();
    fetchSummary();
  }, [fetchNetwork]);

  return (
    <section className="py-20 border-t border-slate-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 font-sans mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-3">Finding #3 — Network</div>
        <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">The Puppeteers</h2>
        <p className="text-slate-500 max-w-xl">
          Red nodes = high-velocity amplifiers posting identical URLs across multiple subreddits.
          <strong className="text-slate-700"> Click a red node to deplatform it</strong> and watch the network recalculate.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 font-sans">
        <div className="bg-white border text-left border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl p-8 mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-4 items-center">
               <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <Network className="w-6 h-6 text-slate-700" />
               </div>
               <div>
                 <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Active Disinformation Network</h3>
                 <p className="text-sm text-slate-500 mt-1 font-mono uppercase tracking-widest">Bipartite PageRank Engine :: K-Cluster 1 & 2</p>
               </div>
            </div>
            {excluded.length > 0 && (
              <button onClick={() => setExcluded([])} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 transition-colors text-white rounded-lg text-sm font-bold shadow-sm">
                Restore Suspended Accounts ({excluded.length})
              </button>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl h-[650px] relative overflow-hidden shadow-inner">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex justify-center items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900" /></div>}
            <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => setSelectedNode(node)} fitView attributionPosition="top-right">
              <Background color="#cbd5e1" gap={20} size={2} />
              <Controls position="bottom-right" className="shadow-md bg-white text-slate-700" />
            </ReactFlow>
          </div>

          {selectedNode && (
            <div className={`mt-6 p-6 border rounded-xl flex flex-col md:flex-row justify-between md:items-center shadow-sm transition-all ${selectedNode.data.type === 'author' && selectedNode.data.threat > 50 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex gap-5 items-center mb-4 md:mb-0">
                {selectedNode.data.type === 'author' && selectedNode.data.threat > 50 ? (
                  <div className="bg-red-100 p-3 rounded-full border border-red-200"><AlertTriangle className="text-red-500 w-8 h-8" /></div>
                ) : (
                  <div className="bg-slate-200 p-3 rounded-full border border-slate-300"><Network className="text-slate-500 w-8 h-8" /></div>
                )}
                <div>
                  <div className="font-black text-xl text-slate-900 tracking-tight">{selectedNode.data.label}</div>
                  <div className="text-sm mt-1 flex flex-wrap gap-3">
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold text-xs uppercase tracking-widest">{selectedNode.data.type}</span>
                    <span className="text-slate-600">Centrality Weight: <span className="font-mono font-bold text-slate-900 bg-white px-1 border border-slate-200 rounded shadow-sm py-0.5">{selectedNode.data.pr.toFixed(5)}</span></span>
                    {selectedNode.data.type === 'author' && (
                      <span className="text-slate-600">Heuristic Score: <span className={`font-mono font-bold px-1 rounded border shadow-sm py-0.5 ${selectedNode.data.threat > 50 ? 'text-red-700 bg-red-100 border-red-200' : 'text-slate-900 bg-white border-slate-200'}`}>{selectedNode.data.threat} / 100</span></span>
                    )}
                  </div>
                </div>
              </div>
              {selectedNode.data.type === 'author' && selectedNode.data.threat > 50 && (
                <button 
                  onClick={() => {
                    setExcluded([...excluded, selectedNode.data.label]);
                    setSelectedNode(null);
                  }}
                  className="px-8 py-3 bg-red-600 w-full md:w-auto text-white font-black uppercase tracking-wider rounded-lg hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                  Deplatform Node
                </button>
              )}
            </div>
          )}
          
          {cibEvents.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900">Synchronized Cross-Posting Activity</h3>
                   <p className="text-sm text-slate-500">Actors detected posting identical URLs across multiple ideological spaces within abnormal time windows.</p>
                 </div>
                 <div className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-widest rounded border border-red-200 shadow-sm animate-pulse">
                    Threat Rule: CIB-01 Active
                 </div>
               </div>
               <div className="overflow-x-auto border border-slate-200 rounded-xl">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                       <tr>
                          <th className="px-4 py-3">Actor / Agent</th>
                          <th className="px-4 py-3">Cross-Pollination</th>
                          <th className="px-4 py-3">Time Delta</th>
                          <th className="px-4 py-3 text-right">URL Vector</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {cibEvents.slice(0, 5).map((event, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                             <td className="px-4 py-3 font-mono font-bold text-slate-900">{event.author}</td>
                             <td className="px-4 py-3">
                               <span className="inline-flex items-center justify-center bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-black">
                                 {event.sub_count} Subreddits
                               </span>
                             </td>
                             <td className="px-4 py-3 font-mono text-slate-500">
                               {event.time_delta_seconds}s
                             </td>
                             <td className="px-4 py-3 text-right text-blue-600 truncate max-w-[200px]" title={event.url}>
                               {event.url}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

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
