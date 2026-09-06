import React from 'react';
import { X, HelpCircle, AlertTriangle, Shield, CheckCircle2, TrendingUp, Cpu } from 'lucide-react';

export default function ExplainabilityDrawer({ data, isOpen, onClose }) {
  if (!isOpen || !data) return null;

  const {
    work_id,
    title,
    department,
    corridor,
    asset_name,
    priority_score,
    priority_tier,
    factors,
    justification,
    ml_confidence,
    recommended_action
  } = data;

  const factorItems = [
    { label: 'Safety Risk', val: factors?.safety_risk ?? 0, max: 25, color: 'bg-rose-500', desc: 'Risk to train derailment or structural track collapse' },
    { label: 'Asset Criticality', val: factors?.asset_criticality ?? 0, max: 20, color: 'bg-amber-500', desc: 'Location on high-speed diamond junction or primary trunk route' },
    { label: 'Overdue Days', val: factors?.overdue_days ?? 0, max: 15, color: 'bg-orange-500', desc: 'Days exceeded beyond Indian Railways statutory P-Way manual limits' },
    { label: 'Failure History', val: factors?.failure_history ?? 0, max: 15, color: 'bg-yellow-500', desc: 'Repeated micro-defects or heat/corrosion incidents in last 12 months' },
    { label: 'Predicted Failure Probability (ML)', val: factors?.failure_probability ?? 0, max: 15, color: 'bg-indigo-500', desc: 'Logistic Regression calibrated on axle-load and asset age' },
    { label: 'Traffic Density (Corridor GMT)', val: factors?.traffic_density ?? 0, max: 10, color: 'bg-blue-500', desc: 'Annual Gross Million Tonnes carrying heavy coal/freight traffic' },
    { label: 'Deferral Consequence', val: factors?.deferral_consequence ?? 0, max: 10, color: 'bg-emerald-500', desc: 'Speed restrictions (TSR 30 km/h) imposed if maintenance is postponed' },
  ];

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header & Close */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">{work_id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getTierBadge(priority_tier)}`}>
                  {priority_tier} PRIORITY
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1 leading-snug">{title}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {department} • {corridor} • <span className="text-slate-300 font-medium">{asset_name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Big Score Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Explainable Priority Score
              </div>
              <div className="text-3xl font-black text-white mt-0.5">
                {priority_score} <span className="text-sm font-medium text-slate-500">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Transparent multi-factor mathematical calculation
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-[10px] text-slate-400">ML Confidence</div>
                <div className="text-xs font-bold text-indigo-300">{Math.round(ml_confidence * 100)}%</div>
              </div>
            </div>
          </div>

          {/* Factor Contribution Breakdown (The Core Innovation) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Factor Breakdown & Weight Contributions</span>
              </h4>
              <span className="text-xs text-slate-400">Additive Linear Sum</span>
            </div>

            <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
              {factorItems.map((f, i) => {
                const pct = Math.round((f.val / f.max) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{f.label}</span>
                      <span className="font-mono font-bold text-white">
                        +{f.val.toFixed(0)} <span className="text-slate-500 font-normal">/ {f.max}</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${f.color} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">{f.desc}</div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                <span>Calculated Total</span>
                <span className="font-mono text-emerald-400">{priority_score} / 100</span>
              </div>
            </div>
          </div>

          {/* Why? Justification Details */}
          <div>
            <h4 className="text-sm font-bold text-white mb-2 flex items-center space-x-1.5">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Why Was This Item Marked Critical?</span>
            </h4>
            <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300">
              {justification && justification.length > 0 ? (
                justification.map((j, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{j}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">Standard operational maintenance parameters.</div>
              )}
            </div>
          </div>

          {/* Recommended Action */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
            <div className="text-xs font-bold text-amber-300 flex items-center space-x-1 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>System Recommendation for Section Controller</span>
            </div>
            <p className="text-xs text-slate-300">{recommended_action}</p>
          </div>
        </div>

        {/* Footer Close */}
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Close Explanation View
          </button>
        </div>
      </div>
    </div>
  );
}
