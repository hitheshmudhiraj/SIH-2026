import React, { useState } from 'react';
import { RotateCcw, Shield, Clock, Search, ChevronDown, ChevronRight, User } from 'lucide-react';

export default function AuditTrailView({ auditLogs = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const filteredLogs = auditLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    return log.action.toLowerCase().includes(term) ||
           log.event_type.toLowerCase().includes(term) ||
           log.user_id.toLowerCase().includes(term) ||
           log.entity_id.toLowerCase().includes(term);
  });

  const getEventBadge = (type) => {
    switch (type) {
      case 'EMERGENCY_TRIGGER':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'PLANNER_MODIFY':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'PLAN_APPROVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'OPTIMIZE_RUN':
      case 'REPLAN_COMPLETE':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'INGESTION':
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold mb-1">
            <Shield className="w-4 h-4" />
            <span>Layer 5: Immutable Accountability</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Divisional Audit Trail & Governance Log
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Every optimization execution, human planner schedule shift, emergency defect injection, and executive sign-off is cryptographically logged with user identity and timestamp.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit actions, users, IDs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 w-64 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">User / System</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Recorded Action</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => toggleExpand(log.id)}
                      className="hover:bg-slate-850/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${getEventBadge(log.event_type)}`}>
                          {log.event_type}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[150px]">{log.user_id}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-400">
                        {log.entity_id}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-200">
                        {log.action}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-500">
                        <span className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable JSON Inspector */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan="6" className="px-6 py-3 border-y border-slate-800/80">
                          <div className="text-[11px] font-mono text-slate-400 mb-1">
                            Payload Context:
                          </div>
                          <pre className="bg-slate-900 border border-slate-800 text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
