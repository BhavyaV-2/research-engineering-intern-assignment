'use client';

import Hero from '@/components/Hero';
import ControlGroup from '@/components/ControlGroup';
import EchoChambers from '@/components/EchoChambers';
import CoordinatedBehavior from '@/components/CoordinatedBehavior';
import TopicClustering from '@/components/TopicClustering';
import SemanticSearch from '@/components/SemanticSearch';

export default function InvestigationPage() {
  return (
    <main className="bg-[#FAF9F6] min-h-screen text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      <nav className="fixed top-0 w-full bg-[#FAF9F6]/80 backdrop-blur-md border-b border-slate-200 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-sm flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-sm animate-pulse" />
              </div>
              <div className="font-black text-2xl tracking-tighter text-slate-900 uppercase uppercase">ARBITER <span className="opacity-40 font-normal">Protocol</span></div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-500 uppercase tracking-widest">
               <a href="#findings" className="hover:text-slate-900 transition-colors">The Investigation</a>
               <a href="#search" className="hover:text-slate-900 transition-colors">Archive Access</a>
               <span className="px-3 py-1 bg-red-100 rounded text-[10px] font-black text-red-700 border border-red-200">INTERNAL USE</span>
            </div>
          </div>
        </div>
      </nav>

      <Hero />

      <div id="findings" className="scroll-mt-20">
        <ControlGroup />
        <EchoChambers />
        <CoordinatedBehavior />
        <TopicClustering />
      </div>

      <div id="search" className="scroll-mt-0">
        <SemanticSearch />
      </div>

      <footer className="bg-black text-slate-400 py-20 text-center border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
            <div className="w-12 h-12 bg-white rounded-sm flex items-center justify-center mb-6">
                 <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <div className="font-black text-3xl tracking-tighter text-white mb-4 uppercase">ARBITER <span className="opacity-50 font-normal">Protocol</span></div>
            <p className="text-base max-w-md mx-auto mb-8 font-serif leading-relaxed">An investigative toolkit engineered for structural machine learning analysis. End of report.</p>
            <div className="w-full flex justify-center gap-6 text-xs font-mono opacity-50 uppercase tracking-widest border-t border-slate-800 pt-8 mt-8">
                <span>COMMIT: dcb39f</span>
                <span>STATUS: SECURE</span>
                <span>ORIGIN: BATCH 9</span>
            </div>
        </div>
      </footer>
    </main>
  );
}
