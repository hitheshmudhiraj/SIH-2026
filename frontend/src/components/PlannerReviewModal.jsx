import React, { useState } from 'react';
import { FileText, CheckCircle2, Edit3, UserCheck, Shield, AlertCircle, X } from 'lucide-react';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlannerReviewModal({
  currentPlan,
  modifyingItem,
  onCloseModal,
  onSubmitModification,
  onApprovePlan,
  isSubmitting
}) {
  const [selectedDay, setSelectedDay] = useState(modifyingItem?.day_of_week || 'Tuesday');
  const [startHour, setStartHour] = useState(
    modifyingItem ? Math.floor(modifyingItem.scheduled_start_minute / 60) : 10
  );
  const [durationHours, setDurationHours] = useState(
    modifyingItem ? Math.ceil(modifyingItem.duration_minutes / 60) : 3
  );
  const [plannerName, setPlannerName] = useState('Chief Section Controller (DLI)');
  const [reason, setReason] = useState('Adjusted slot due to VIP freight corridor pathing and rake handover');
  const [approverName, setApproverName] = useState('Senior Divisional Operations Manager (Sr. DOM)');
  const [approvalNotes, setApprovalNotes] = useState('Approved following joint multi-department review with Sr. DEN and Sr. DEE/TRD.');

  const handleModifySubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('A valid operational justification reason is mandatory for human-in-the-loop modifications.');
      return;
    }

    const newStartMinute = startHour * 60;
    const newEndMinute = newStartMinute + durationHours * 60;

    onSubmitModification({
      plan_id: currentPlan.id,
      work_item_id: modifyingItem.work_item_id,
      new_day_of_week: selectedDay,
      new_start_minute: newStartMinute,
      new_end_minute: newEndMinute,
      modified_by: plannerName,
      reason: reason
    });
  };

  const handleApproveSubmit = (e) => {
    e.preventDefault();
    onApprovePlan({
      plan_id: currentPlan.id,
      approved_by: approverName,
      comments: approvalNotes
    });
  };

  return (
    <div className="space-y-6">
      {/* Modification Modal (Triggered when modifyingItem is set) */}
      {modifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Human Planner Schedule Override</h3>
              </div>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="text-slate-400 font-mono">{modifyingItem.work_item_id}</div>
              <div className="text-sm font-bold text-white mt-0.5">{modifyingItem.work_title}</div>
              <div className="text-slate-400 mt-1">
                Current Slot: <span className="text-amber-400 font-semibold">{modifyingItem.day_of_week} ({modifyingItem.start_time_formatted} - {modifyingItem.end_time_formatted})</span>
              </div>
            </div>

            <form onSubmit={handleModifySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">New Day of Week</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Hour (24h)</label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Planner Officer Name / Designation</label>
                <input
                  type="text"
                  value={plannerName}
                  onChange={(e) => setPlannerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-amber-400 font-bold mb-1 flex items-center space-x-1">
                  <span>Operational Justification (Mandatory for Audit Trail)</span>
                </label>
                <textarea
                  rows="2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State reason for shifting schedule..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Recording Change...' : 'Save & Log in Audit Trail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Screen Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Layer 4: Human-in-the-Loop Governance</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Planner Review & Official Authorization
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Mathematical optimization provides recommendations. The human Section Controller and Divisional Operations Manager retain ultimate responsibility and sign-off authority.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Current Plan Status:</span>
          <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {currentPlan?.status || 'NO PLAN'}
          </span>
        </div>
      </div>

      {/* Schedule Table for Review */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">
            Plan V{currentPlan?.version || 1} Schedule Review ({currentPlan?.items?.length || 0} Scheduled Blocks)
          </h4>
          <span className="text-xs text-slate-400">Click any row to modify schedule slot</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Work ID</th>
                <th className="px-4 py-3">Work Title</th>
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3">Scheduled Day & Time</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-center">Modified?</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {currentPlan?.items?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-white">
                    {item.work_item_id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-200">
                    {item.work_title}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.corridor_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-amber-300">
                    {item.day_of_week} ({item.start_time_formatted} - {item.end_time_formatted})
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_shadow_block ? (
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded">
                        JOINT SHADOW
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_modified_by_planner ? (
                      <span className="bg-blue-500/20 text-blue-300 font-bold text-[10px] px-2 py-0.5 rounded">
                        Modified
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSubmitModification({ triggerItem: item })}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
                    >
                      Modify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Approval Form */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 text-emerald-400 text-sm font-bold mb-3">
          <Shield className="w-5 h-5" />
          <span>Authorize and Approve Schedule Execution</span>
        </div>

        <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Authorizing Officer (Approver)</label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Divisional Approval Notes</label>
              <input
                type="text"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <p className="text-slate-400 text-[11px]">
              Approval officially stamps Plan V{currentPlan?.version || 1} and triggers notifications to all 5 operating systems.
            </p>
            <button
              type="submit"
              disabled={isSubmitting || currentPlan?.status === 'APPROVED'}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{currentPlan?.status === 'APPROVED' ? 'Plan Already Approved' : 'Sign & Authorize Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
