import { useState } from 'react';
import { Search, Filter, HelpCircle, AlertOctagon, CheckCircle2, AlertTriangle } from 'lucide-react';

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
        return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
      case 'HIGH':
        return 'bg-[#FFFBEB] text-[#B45309] border-[#FED7AA]';
      case 'MEDIUM':
        return 'bg-[#EFF6FF] text-[#1565C0] border-[#BFDBFE]';
      default:
        return 'bg-[#F8FAFC] text-[#7A8494] border-[#E2E8F0]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>PRIORITY INTELLIGENCE MATRIX</span>
          </div>
          <h3 className="text-xl font-bold text-[#172033]">
            Unified Maintenance Priority Scoring
          </h3>
          <p className="text-xs text-[#7A8494] max-w-2xl mt-1">
            Transparent 0–100 scoring based on safety hazard, asset criticality, overdue days, and ML failure risk
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#7A8494] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search work or corridor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-[#E2E8F0] text-[#172033] text-xs rounded-lg pl-9 pr-3 py-2 w-48 focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#EFF6FF]"
            />
          </div>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="bg-white border border-[#E2E8F0] text-[#172033] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#1565C0] cursor-pointer"
          >
            <option value="ALL">All Tiers</option>
            <option value="CRITICAL">Critical Only (≥80)</option>
            <option value="HIGH">High Only (65–79)</option>
            <option value="MEDIUM">Medium (45–64)</option>
          </select>

          <select
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
            className="bg-white border border-[#E2E8F0] text-[#172033] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#1565C0] cursor-pointer"
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
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#7A8494] uppercase tracking-wider font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Work ID & Source</th>
                <th className="px-4 py-3">Maintenance Description</th>
                <th className="px-4 py-3">Corridor & Asset</th>
                <th className="px-4 py-3 text-center">Duration</th>
                <th className="px-4 py-3 text-center">Overdue</th>
                <th className="px-4 py-3 text-center">ML Fail Prob</th>
                <th className="px-4 py-3 text-center">Priority Score</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-[#172033]">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-[#1565C0]">{item.id}</div>
                    <div className="text-[10px] text-[#7A8494]">{item.source_system}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium truncate">{item.title}</div>
                    <div className="text-[10px] text-[#7A8494]">{item.department}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.corridor_name}</div>
                    <div className="text-[10px] text-[#7A8494]">{item.asset_id}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{item.duration_minutes} min</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      item.overdue_days > 0 ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]' : 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                    }`}>
                      {item.overdue_days > 0 ? `+${item.overdue_days}d` : 'On Time'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-[#B45309]">
                    {item.ml_failure_prob}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-lg font-black text-[#172033]">{item.priority_score}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getTierBadge(item.priority_tier)}`}>
                        {item.priority_tier}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onSelectExplain(item.id)}
                      className="text-[#1565C0] hover:text-[#0D47A1] text-[10px] font-semibold flex items-center space-x-1 mx-auto cursor-pointer"
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

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-[#7A8494]">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No items match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
