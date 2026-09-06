import React, { useState } from 'react';
import { AlertTriangle, Layers, Clock, CheckCircle2, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';

export default function ConflictsView({ conflictsData, onTriggerOptimize }) {
  const [activeTab, setActiveTab] = useState('conflicts'); // 'conflicts' or 'compatibilities'

  const { conflicts = [], compatibilities = [], total_conflicts = 0, total_compatibilities = 0 } = conflictsData || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold mb-1">
          <AlertTriangle className="w-4 h-4" />
          <span>Layer 2: Pre-Optimization Topology Analysis</span>
        </div>
        <h3 className="text-xl font-bold text-white">
          Cross-System Conflicts & Compatibility Engine
        </h3>
        <p className="text-xs text-slate-400 max-w-3xl mt-1">
          Before feeding requests to Google OR-Tools CP-SAT, the platform scans for spatial corridor contention, specialized heavy machinery bottlenecks, passenger timetable interference, and joint block grouping opportunities.
        </p>

        {/* Tab Toggle */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'conflicts'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Active Clashes Detected ({total_conflicts})</span>
          </button>

          <button
            onClick={() => setActiveTab('compatibilities')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'compatibilities'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Compatible Grouping Opportunities ({total_compatibilities})</span>
          </button>
        </div>
      </div>

      {/* Content: Conflicts Tab */}
      {activeTab === 'conflicts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>The following requests clash in time, space, or resources under uncoordinated operations.</span>
            <button
              onClick={onTriggerOptimize}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Resolve All Clashes via CP-SAT</span>
            </button>
          </div>

          {conflicts.length > 0 ? (
            conflicts.map((conf) => (
              <div 
                key={conf.conflict_id}
                className="bg-slate-900 border border-rose-500/30 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      {conf.conflict_type}
                    </span>
                    <span className="text-xs text-slate-300 font-bold">
                      {conf.corridor_name} ({conf.day_of_week} {conf.start_time} - {conf.end_time})
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {conf.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500">Involved Departments:</span>
                    {conf.departments?.map((dep, idx) => (
                      <span key={idx} className="bg-slate-800 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 bg-slate-950 p-3 rounded-lg border border-slate-800 text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Severity</div>
                  <div className="text-sm font-black text-rose-400">{conf.severity} IMPACT</div>
                  <div className="text-[10px] text-slate-500 mt-1">Requires Optimization</div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-white">Zero Active Clashes</div>
              <p className="text-xs text-slate-400 mt-1">All corridor windows and resource demands are coordinated.</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Compatibilities Tab */}
      {activeTab === 'compatibilities' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Synergistic tasks on the same corridor that can be consolidated into shared "Megablocks" or "Shadow Blocks".</span>
            <span className="text-purple-400 font-medium">Auto-rewarded in CP-SAT objective function (+80 pts)</span>
          </div>

          {compatibilities.length > 0 ? (
            compatibilities.map((comp) => (
              <div 
                key={comp.group_id}
                className="bg-slate-900 border border-purple-500/30 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      JOINT SHADOW BLOCK
                    </span>
                    <span className="text-xs text-slate-300 font-bold">
                      {comp.corridor_name} (Suggested Window: {comp.suggested_day} {comp.suggested_start_time} - {comp.suggested_end_time})
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {comp.shared_benefit}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500">Participating Units:</span>
                    {comp.departments?.map((dep, idx) => (
                      <span key={idx} className="bg-purple-950/40 border border-purple-800/40 text-purple-300 text-[10px] font-medium px-2 py-0.5 rounded">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 bg-slate-950 p-3 rounded-lg border border-slate-800 text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Track Possession Saved</div>
                  <div className="text-sm font-black text-purple-400">+{comp.estimated_saved_hours} Hours</div>
                  <div className="text-[10px] text-emerald-400 mt-1">Consolidation Bonus</div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-white">No Grouping Candidates</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
