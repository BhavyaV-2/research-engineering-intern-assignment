export default function ControlGroup() {
  return (
    <section className="py-20 border-t border-slate-100 bg-white">
      <div className="max-w-4xl mx-auto px-6 font-sans">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-3">Finding #1 — Baseline</div>
        <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">The Control Group</h2>
        <p className="text-lg text-slate-500 mb-10 max-w-2xl">
          Organic communities (r/memes, r/aww) show high entropy — scattered timing and loose semantics.
          Political fronts show extreme density — velocities that exceed human physical limits.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-t-4 border-emerald-500 bg-slate-50 rounded-b-2xl p-8">
            <div className="text-emerald-600 font-bold text-xs uppercase tracking-widest mb-2">Organic Baseline</div>
            <div className="text-3xl font-black text-slate-900 mb-3">High Entropy</div>
            <p className="text-slate-600 leading-relaxed">
              Non-political boards exhibit natural human chaos — scattered timing, isolated spikes, no orchestrated amplification.
            </p>
          </div>
          <div className="border-t-4 border-red-600 bg-slate-50 rounded-b-2xl p-8">
            <div className="text-red-600 font-bold text-xs uppercase tracking-widest mb-2">Signal: Inorganic Control</div>
            <div className="text-3xl font-black text-slate-900 mb-3">Structured Density</div>
            <p className="text-slate-600 leading-relaxed">
              Political fronts showed posting velocities under 60-second intervals — a clear behavioral signature of automated amplification.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
