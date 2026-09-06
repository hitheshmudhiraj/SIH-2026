import React, { useState } from 'react';
import { Search, Filter, HelpCircle, AlertOctagon, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function PriorityView({ workItems, onSelectExplain }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [selectedCorridor, setSelectedCorridor] = useState('ALL');

  const filteredItems = workItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.corridor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = selectedTier === 'ALL' || item.priority_tier === selectedTier;
    const matchesCorridor = selectedCorridor === 'ALL' || item.corridor_id === selectedCorridor;
    return matchesSearch && matchesTier && matchesCorridor;
  });

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Layer 1: Transparent Weighted Scoring Model</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Unified Priority Intelligence Matrix
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Every maintenance demand is assigned an interpretable 0–100 score based on safety hazard, asset criticality, overdue days, and ML failure risk. Planners never see a black box.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search work or corridor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 w-48 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Tiers</option>
            <option value="CRITICAL">Critical Only (≥80)</option>
            <option value="HIGH">High Only (65–79)</option>
            <option value="MEDIUM">Medium (45–64)</option>
          </select>

          <select
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Corridors</option>
            <option value="C1">C1: NDLS-GZB</option>
            <option value="C2">C2: NDLS-PWL</option>
            <option value="C3">C3: BRC-ST</option>
            <option value="C4">C4: HWH-BWN</option>
            <option value="C5">C5: MAS-AJJ</option>
            <option value="C6">C6: PNVL-ROHA</option>
          </select>
        </div>
      </div>

      {/* Work Items Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Work ID & Source</th>
                <th className="px-4 py-3">Maintenance Description</th>
                <th className="px-4 py-3">Corridor & Asset</th>
                <th className="px-4 py-3 text-center">Duration</th>
                <th className="px-4 py-3 text-center">Overdue</th>
                <th className="px-4 py-3 text-center">ML Fail Prob</th>
                <th className="px-4 py-3 text-center">Priority Score</th>
                <th className="px-4 py-3 text-right">Explainability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    <div className="font-bold text-white">{item.id}</div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-sans">
                      {item.source_system} • {item.department_name?.split(' ')[0]}
                    </span>
                  </td>

                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-semibold text-slate-200 line-clamp-1">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                      <span>Resource: {item.required_resource || 'Standard Gang'}</span>
                      {item.is_emergency && (
                        <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1 rounded font-bold">
                          EMERGENCY
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-300">{item.corridor_name || item.corridor_id}</div>
                    <div className="text-[11px] text-slate-500">{item.asset_name || item.asset_id}</div>
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-slate-300">
                    {Math.round(item.duration_minutes / 60)}h ({item.duration_minutes}m)
                  </td>

                  <td className="px-4 py-3 text-center">
                    {item.overdue_days > 0 ? (
                      <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[11px]">
                        +{item.overdue_days}d
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono">Current</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center font-mono">
                    <span className={`text-xs font-semibold ${item.failure_probability >= 0.75 ? 'text-rose-400' : (item.failure_probability >= 0.5 ? 'text-amber-400' : 'text-slate-400')}`}>
                      {Math.round(item.failure_probability * 100)}%
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${getTierBadge(item.priority_tier)}`}>
                        {item.priority_score} / 100
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {item.priority_tier}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelectExplain(item.id)}
                      className="inline-flex items-center space-x-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2.5 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Why?</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
