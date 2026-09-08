import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert, Cpu, Layers } from 'lucide-react';

export default function ConflictsView({ conflictsData, onTriggerOptimize }) {
  const [activeTab, setActiveTab] = useState('conflicts');

  const { conflicts = [], compatibilities = [], total_conflicts = 0, total_compatibilities = 0 } = conflictsData || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
          <AlertTriangle className="w-4 h-4" />
          <span>CONFLICT ANALYSIS & OPTIMIZATION</span>
        </div>
        <h3 className="text-xl font-bold text-[#172033]">
          Cross-System Conflicts & Compatibility Engine
        </h3>
        <p className="text-xs text-[#7A8494] max-w-3xl mt-1">
          Pre-optimization analysis identifying spatial corridor conflicts, resource bottlenecks, timetable interference, and joint block opportunities.
        </p>

        {/* Tab Toggle */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'conflicts'
                ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                : 'bg-[#F8FAFC] text-[#7A8494] hover:text-[#172033] border border-[#E2E8F0]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Active Conflicts ({total_conflicts})</span>
          </button>

          <button
            onClick={() => setActiveTab('compatibilities')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'compatibilities'
                ? 'bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]'
                : 'bg-[#F8FAFC] text-[#7A8494] hover:text-[#172033] border border-[#E2E8F0]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Joint Opportunities ({total_compatibilities})</span>
          </button>
        </div>
      </div>

      {/* Conflicts Tab */}
      {activeTab === 'conflicts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#7A8494] px-1">
            <span>The following requests clash in time, space, or resources</span>
            <button
              onClick={onTriggerOptimize}
              className="bg-[#15803D] hover:bg-[#166534] text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Resolve via CP-SAT</span>
            </button>
          </div>

          {conflicts.length > 0 ? (
            conflicts.map((conf) => (
              <div
                key={conf.conflict_id}
                className="bg-white border border-[#FECACA] rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="bg-[#FEF2F2] text-[#B91C1C] text-[10px] font-bold px-2 py-1 rounded border border-[#FECACA]">
                      {conf.conflict_type}
                    </span>
                    <span className="text-xs text-[#172033] font-bold">
                      {conf.corridor_name} ({conf.day_of_week} {conf.start_time} - {conf.end_time})
                    </span>
                  </div>

                  <p className="text-xs text-[#5B6575] leading-relaxed">
                    {conf.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#7A8494]">Departments:</span>
                    {conf.departments?.map((dep, idx) => (
                      <span key={idx} className="bg-[#F8FAFC] text-[#5B6575] text-[10px] font-medium px-2 py-1 rounded border border-[#E2E8F0]">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 bg-[#FEF2F2] p-3 rounded-lg border border-[#FECACA] text-right">
                  <div className="text-[10px] text-[#7A8494] uppercase font-semibold">Severity</div>
                  <div className="text-sm font-black text-[#B91C1C]">{conf.severity}</div>
                  <div className="text-[10px] text-[#7A8494] mt-1">Requires Resolution</div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#15803D]">No Conflicts Detected</p>
              <p className="text-xs text-[#166534] mt-1">All maintenance requests are compatible</p>
            </div>
          )}
        </div>
      )}

      {/* Compatibilities Tab */}
      {activeTab === 'compatibilities' && (
        <div className="space-y-3">
          {compatibilities.length > 0 ? (
            compatibilities.map((comp) => (
              <div
                key={comp.grouping_id}
                className="bg-white border border-[#DDD6FE] rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold px-2 py-1 rounded border border-[#DDD6FE]">
                      JOINT BLOCK OPPORTUNITY
                    </span>
                    <span className="text-xs text-[#172033] font-bold">
                      {comp.corridor_name} • {comp.compatible_window}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#15803D] bg-[#F0FDF4] px-2 py-1 rounded border border-[#BBF7D0]">
                    {comp.compatibility_score}% Match
                  </span>
                </div>

                <p className="text-xs text-[#5B6575] mb-2">{comp.reason}</p>

                <div className="flex flex-wrap gap-2">
                  {comp.work_items?.map((item, idx) => (
                    <span key={idx} className="bg-[#F8FAFC] text-[#5B6575] text-[10px] px-2 py-1 rounded border border-[#E2E8F0]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 text-center">
              <Layers className="w-8 h-8 text-[#7A8494] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#5B6575]">No Compatible Groupings Found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
