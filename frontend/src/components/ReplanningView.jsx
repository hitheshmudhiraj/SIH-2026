import React from 'react';
import { GitCompare, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Cpu, Layers } from 'lucide-react';

export default function ReplanningView({ 
  replanResult, 
  onTriggerReplan, 
  isReplanning,
  currentPlan
}) {
  const diffItems = replanResult?.diff || [];

  const getChangeBadge = (type) => {
    switch (type) {
      case 'ADDED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MOVED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'GROUPED':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Layer 6: Real-Time Operational Resilience</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Dynamic Emergency Re-Planning Engine
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            When sudden ultrasonic rail fractures, broken point switches, or fallen catenaries occur mid-week, RailBlock AI recalculates priorities and runs incremental CP-SAT re-optimization to accommodate the crisis while minimizing passenger train disruption.
          </p>
        </div>

        <button
          onClick={onTriggerReplan}
          disabled={isReplanning}
          className="bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 transition-all cursor-pointer"
        >
          <Cpu className={`w-4 h-4 ${isReplanning ? 'animate-spin' : ''}`} />
          <span>{isReplanning ? 'Re-optimizing Plan...' : 'Simulate Emergency Rail Fracture'}</span>
        </button>
      </div>

      {/* Plan Versioning Banner */}
      {replanResult ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-blue-500/30 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold px-3 py-1 rounded-full">
                Plan V{replanResult.old_version} → Plan V{replanResult.new_version}
              </span>
              <span className="text-xs text-slate-400">
                Incrementally Re-optimized in &lt;100ms via Google OR-Tools
              </span>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
              Dynamic Diff Computed
            </span>
          </div>

          <p className="text-xs text-slate-300">
            {replanResult.message}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          <GitCompare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <div className="text-sm font-bold text-white">No Re-planning Simulation Active</div>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Click "Simulate Emergency Rail Fracture" above to inject a Priority 98/100 ultrasonic track defect on Corridor C1 and observe the real-time CP-SAT schedule re-optimization diff.
          </p>
        </div>
      )}

      {/* Schedule Diff Inspector */}
      {diffItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <GitCompare className="w-4 h-4 text-amber-400" />
              <span>Schedule Modification Diff (Plan V{replanResult.old_version} vs Plan V{replanResult.new_version})</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">{diffItems.length} items analyzed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Change Type</th>
                  <th className="px-4 py-3">Work Item</th>
                  <th className="px-4 py-3">Previous Schedule (V1)</th>
                  <th className="px-4 py-3">New Schedule (V2)</th>
                  <th className="px-4 py-3">Operational Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {diffItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3 font-mono">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getChangeBadge(item.change_type)}`}>
                        {item.change_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{item.work_title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.work_item_id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {item.old_slot || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-300">
                      {item.new_slot || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-[11px] max-w-xs">
                      {item.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
