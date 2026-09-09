import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, Edit3, Check, X,
  Filter, Eye, ChevronDown, ChevronUp, RefreshCw, Sparkles,
  Info, ShieldAlert, Clock, ArrowRight, UserCheck
} from 'lucide-react';
import { fetchInvalidRecordsQueue, submitReviewDecision } from '../lib/api';

export default function ReviewQueuePanel({ onRecordUpdated }) {
  const [records, setRecords] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, pending_count: 0, approved_count: 0, rejected_count: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterErrorType, setFilterErrorType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL'); // ALL, VALIDATION_ONLY, DEFAULTED_ONLY
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editFormErrors, setEditFormErrors] = useState([]);
  const [rejectingRecord, setRejectingRecord] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDept !== 'ALL') params.department = filterDept;
      if (filterErrorType !== 'ALL') params.error_type = filterErrorType;
      if (filterStatus !== 'ALL') params.status = filterStatus;
      if (filterCategory === 'DEFAULTED_ONLY') params.is_defaulted = 'true';
      if (filterCategory === 'VALIDATION_ONLY') params.is_defaulted = 'false';

      const data = await fetchInvalidRecordsQueue(params);
      setRecords(data.records || []);
      setMetrics({
        total: data.total || 0,
        pending_count: data.pending_count || 0,
        approved_count: data.approved_count || 0,
        rejected_count: data.rejected_count || 0
      });
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [filterDept, filterErrorType, filterStatus, filterCategory]);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Direct Approve
  const handleApprove = async (rec) => {
    setActionLoading(rec.id);
    try {
      const res = await submitReviewDecision(rec.id, {
        action: 'APPROVE',
        reason: rec.is_defaulted ? 'Approved auto-defaulted values' : 'Approved as-is by operator',
        user: 'SafetyOfficer'
      });
      if (res.success) {
        showToast(`Record ${rec.job_id} approved and integrated into unified dataset!`);
        await loadQueue();
        if (onRecordUpdated) onRecordUpdated();
      } else {
        alert(res.message || 'Approval failed');
      }
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (rec) => {
    const raw = rec.raw_source || {};
    setEditingRecord(rec);
    setEditFormErrors([]);
    setEditFormData({
      asset_id: raw.asset_id || raw.track_id || raw.ohe_id || raw.equipment_id || '',
      corridor_id: raw.corridor_id || rec.corridor_id || 'C01',
      station: raw.station || rec.station || 'OGL',
      km: raw.km !== undefined ? raw.km : rec.km || 0.0,
      estimated_duration_min: raw.estimated_duration_min || 60,
      due_date: raw.due_date || new Date().toISOString().split('T')[0],
      severity: raw.severity || 'MEDIUM',
      job_type: raw.job_type || rec.job_type || 'GENERAL_MAINTENANCE',
      review_comments: 'Corrected invalid values for pipeline re-entry'
    });
  };

  // Submit Edit & Approve
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setActionLoading(editingRecord.id);
    try {
      const res = await submitReviewDecision(editingRecord.id, {
        action: 'EDIT_AND_APPROVE',
        reason: editFormData.review_comments || 'Corrected fields submitted by operator',
        user: 'SafetyOfficer',
        corrected_fields: {
          asset_id: editFormData.asset_id,
          corridor_id: editFormData.corridor_id,
          station: editFormData.station,
          km: parseFloat(editFormData.km) || 0.0,
          estimated_duration_min: parseInt(editFormData.estimated_duration_min) || 60,
          due_date: editFormData.due_date,
          severity: editFormData.severity,
          job_type: editFormData.job_type
        }
      });

      if (res.success) {
        showToast(`Record ${editingRecord.job_id} successfully reprocessed and integrated!`);
        setEditingRecord(null);
        await loadQueue();
        if (onRecordUpdated) onRecordUpdated();
      } else {
        setEditFormErrors(res.errors || [{ message: res.message }]);
      }
    } catch (err) {
      setEditFormErrors([{ message: err.message }]);
    } finally {
      setActionLoading(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (rec) => {
    setRejectingRecord(rec);
    setRejectionReason('Duplicate work order or decommissioned asset specification');
  };

  // Submit Reject
  const handleRejectSubmit = async () => {
    if (!rejectingRecord) return;
    setActionLoading(rejectingRecord.id);
    try {
      const res = await submitReviewDecision(rejectingRecord.id, {
        action: 'REJECT',
        reason: rejectionReason || 'Rejected by safety review officer',
        user: 'SafetyOfficer'
      });
      if (res.success) {
        showToast(`Record ${rejectingRecord.job_id} rejected and permanently excluded from unified store.`, 'error');
        setRejectingRecord(null);
        await loadQueue();
        if (onRecordUpdated) onRecordUpdated();
      } else {
        alert(res.message || 'Rejection failed');
      }
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Client search filtering
  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.job_id && r.job_id.toLowerCase().includes(q)) ||
      (r.source_system && r.source_system.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.raw_source?.asset_id && String(r.raw_source.asset_id).toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`p-3 rounded-lg text-xs font-bold flex items-center justify-between shadow-md transition-all ${
          toastMessage.type === 'error'
            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
            : 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
        }`}>
          <div className="flex items-center space-x-2">
            {toastMessage.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMessage.msg}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#7A8494] text-xs font-medium">
            <span>Total Logged</span>
            <AlertTriangle className="w-4 h-4 text-[#1565C0]" />
          </div>
          <div className="text-2xl font-black text-[#172033] mt-1">{metrics.total}</div>
          <div className="text-[11px] text-[#7A8494] mt-0.5">Persisted in review store</div>
        </div>

        <div className="bg-white border border-[#FDE68A] rounded-xl p-4 shadow-sm bg-gradient-to-br from-white to-[#FEF3C7]/20">
          <div className="flex items-center justify-between text-[#92400E] text-xs font-medium">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-[#B45309]" />
          </div>
          <div className="text-2xl font-black text-[#B45309] mt-1">{metrics.pending_count}</div>
          <div className="text-[11px] text-[#92400E] mt-0.5">Awaiting human decision</div>
        </div>

        <div className="bg-white border border-[#BBF7D0] rounded-xl p-4 shadow-sm bg-gradient-to-br from-white to-[#F0FDF4]">
          <div className="flex items-center justify-between text-[#166534] text-xs font-medium">
            <span>Approved / Reprocessed</span>
            <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="text-2xl font-black text-[#15803D] mt-1">{metrics.approved_count}</div>
          <div className="text-[11px] text-[#166534] mt-0.5">Unified & deduplicated</div>
        </div>

        <div className="bg-white border border-[#FECACA] rounded-xl p-4 shadow-sm bg-gradient-to-br from-white to-[#FEF2F2]">
          <div className="flex items-center justify-between text-[#991B1B] text-xs font-medium">
            <span>Excluded / Rejected</span>
            <XCircle className="w-4 h-4 text-[#B91C1C]" />
          </div>
          <div className="text-2xl font-black text-[#B91C1C] mt-1">{metrics.rejected_count}</div>
          <div className="text-[11px] text-[#991B1B] mt-0.5">Permanently isolated</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-[#1565C0]" />
            <span className="text-xs font-bold text-[#172033]">Filter Review Queue:</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadQueue}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-bold text-[#5B6575] flex items-center space-x-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-xs">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8494] uppercase mb-1">Department</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#172033] focus:outline-none focus:border-[#1565C0]"
            >
              <option value="ALL">All Departments</option>
              <option value="Engineering">Engineering (TMS)</option>
              <option value="S&T">S&T (SMMS)</option>
              <option value="Traction">Traction (TDMS)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8494] uppercase mb-1">Review Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#172033] focus:outline-none focus:border-[#1565C0]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved / Reprocessed</option>
              <option value="EDITED_AND_APPROVED">Edited & Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Error Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8494] uppercase mb-1">Issue / Error Type</label>
            <select
              value={filterErrorType}
              onChange={(e) => setFilterErrorType(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#172033] focus:outline-none focus:border-[#1565C0]"
            >
              <option value="ALL">All Issue Types</option>
              <option value="MISSING_ASSET_ID">Missing Asset ID</option>
              <option value="INVALID_CORRIDOR">Invalid Corridor</option>
              <option value="INVALID_LOCATION">Invalid KM Location</option>
              <option value="DEFAULTED_DURATION">Auto-Defaulted Duration</option>
              <option value="DEFAULTED_DATE">Auto-Defaulted Date</option>
              <option value="SCHEMA_VALIDATION_ERROR">Schema Validation Error</option>
            </select>
          </div>

          {/* Category Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8494] uppercase mb-1">Issue Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#172033] focus:outline-none focus:border-[#1565C0]"
            >
              <option value="ALL">All Categories</option>
              <option value="DEFAULTED_ONLY">Auto-Defaulted Only</option>
              <option value="VALIDATION_ONLY">Validation Errors Only</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8494] uppercase mb-1">Search Identifier</label>
            <input
              type="text"
              placeholder="Search Job ID or Asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#172033] focus:outline-none focus:border-[#1565C0]"
            />
          </div>
        </div>
      </div>

      {/* Review Queue Records List */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-[#1565C0]" />
            <h3 className="font-bold text-sm text-[#172033]">
              Human Review & Triage Queue ({filteredRecords.length} records)
            </h3>
          </div>
          <span className="text-xs text-[#7A8494]">
            Actionable items are highlighted with immediate pipeline re-entry
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#7A8494] text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1565C0] mb-2" />
            <span>Loading review queue records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-[#7A8494] text-xs">
            <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto mb-2 opacity-80" />
            <p className="font-bold text-sm text-[#172033]">Queue Clean & Fully Reconciled</p>
            <p className="mt-1">No invalid or defaulted records match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {filteredRecords.map((rec) => {
              const isPending = rec.status === 'PENDING_REVIEW';
              const isApproved = rec.status === 'APPROVED' || rec.status === 'EDITED_AND_APPROVED';
              const isRejected = rec.status === 'REJECTED';
              const isExpanded = expandedId === rec.id;

              return (
                <div
                  key={rec.id}
                  className={`p-4 transition-colors ${
                    isPending ? 'bg-white hover:bg-[#FBFDFF]' : isRejected ? 'bg-[#FFF5F5]/40' : 'bg-[#F0FDF4]/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Record Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-[#172033] tracking-tight">{rec.job_id}</span>

                        {/* Source System */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          rec.source_system === 'TMS'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                            : rec.source_system === 'TDMS'
                            ? 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]'
                            : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'
                        }`}>
                          {rec.source_system} ({rec.department})
                        </span>

                        {/* Location */}
                        <span className="text-[11px] text-[#5B6575] bg-[#F1F5F9] px-2 py-0.5 rounded font-mono">
                          {rec.corridor_id} • {rec.station} @ KM {rec.km}
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                          isPending
                            ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                            : isApproved
                            ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
                            : 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]'
                        }`}>
                          {isPending && <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] animate-ping" />}
                          <span>{rec.status.replace(/_/g, ' ')}</span>
                        </span>
                      </div>

                      {/* Error & Defaulting Tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {rec.has_validation_errors && (
                          <span className="text-[11px] font-bold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Errors: {rec.validation_errors.map(e => e.message).join(' • ')}</span>
                          </span>
                        )}

                        {rec.is_defaulted && rec.defaults_applied?.map((d, i) => (
                          <span key={i} className="text-[11px] font-bold text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-[#2563EB]" />
                            <span>Auto-Defaulted {d.field}: {d.defaulted_value} ({d.reason})</span>
                          </span>
                        ))}
                      </div>

                      {/* Rejection / Decision Log details */}
                      {isRejected && (
                        <div className="text-[11px] text-[#991B1B] bg-[#FEF2F2] p-2 rounded border border-[#FECACA] mt-2">
                          <strong>Rejection Reason:</strong> {rec.rejection_reason}
                          <span className="text-[#7A8494] ml-2 font-mono">({rec.rejection_timestamp?.slice(0, 19)})</span>
                        </div>
                      )}

                      {isApproved && rec.review_decision && (
                        <div className="text-[11px] text-[#166534] bg-[#F0FDF4] p-2 rounded border border-[#BBF7D0] mt-2">
                          <strong>Decision:</strong> {rec.review_decision.action} by {rec.review_decision.decided_by}
                          <span className="text-[#7A8494] ml-2 font-mono">({rec.review_decision.decided_at?.slice(0, 19)})</span>
                          {rec.review_decision.comments && (
                            <div className="text-[#5B6575] mt-0.5 italic">"{rec.review_decision.comments}"</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className="p-2 text-[#7A8494] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-all"
                        title="View Raw Source Data"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleApprove(rec)}
                            disabled={actionLoading === rec.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => openEditModal(rec)}
                            disabled={actionLoading === rec.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-[#1565C0] hover:bg-[#0D47A1] text-white rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit & Approve</span>
                          </button>

                          <button
                            onClick={() => openRejectModal(rec)}
                            disabled={actionLoading === rec.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded-lg font-bold text-xs transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#1565C0] hover:bg-[#EFF6FF] rounded border border-[#BFDBFE] transition-all"
                          >
                            Re-edit & Ingest
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Raw Source Drawer */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#172033] flex items-center space-x-1.5">
                          <Eye className="w-3.5 h-3.5 text-[#1565C0]" />
                          <span>Raw Source Record Payload ({rec.source_system})</span>
                        </span>
                        <span className="text-[10px] text-[#7A8494] font-mono">ID: {rec.id}</span>
                      </div>
                      <pre className="bg-[#172033] text-[#F8FAFC] p-3 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                        {JSON.stringify(rec.raw_source, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: EDIT AND APPROVE */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-[#1565C0]" />
                <div>
                  <h3 className="font-bold text-sm text-[#172033]">
                    Edit & Re-validate: {editingRecord.job_id}
                  </h3>
                  <p className="text-[11px] text-[#7A8494]">
                    Source: {editingRecord.source_system} • System: {editingRecord.department}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-[#7A8494] hover:bg-[#F1F5F9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              {/* Validation errors inside modal */}
              {editFormErrors.length > 0 && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Pipeline Validation Rejection:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {editFormErrors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Asset ID */}
                <div className="col-span-2">
                  <label className="block font-bold text-[#172033] mb-1">
                    Canonical / Raw Asset ID <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.asset_id}
                    onChange={(e) => setEditFormData({ ...editFormData, asset_id: e.target.value })}
                    placeholder="e.g. TMS-C01-TRK-0001 or SMMS-C01-SIG-0501"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                  <span className="text-[10px] text-[#7A8494]">Must resolve to a registered asset in Asset Master Registry.</span>
                </div>

                {/* Corridor */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">Corridor ID</label>
                  <select
                    value={editFormData.corridor_id}
                    onChange={(e) => setEditFormData({ ...editFormData, corridor_id: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-medium text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  >
                    <option value="C01">C01 (Chennai - Gudur - Vijayawada)</option>
                    <option value="C02">C02 (Vijayawada - Kazipet)</option>
                    <option value="C03">C03 (Guntakal - Wadi)</option>
                    <option value="C04">C04 (Renigunta - Guntakal)</option>
                  </select>
                </div>

                {/* Station */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">Station Code</label>
                  <input
                    type="text"
                    value={editFormData.station}
                    onChange={(e) => setEditFormData({ ...editFormData, station: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                </div>

                {/* KM Location */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">KM Location</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.km}
                    onChange={(e) => setEditFormData({ ...editFormData, km: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">Estimated Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={editFormData.estimated_duration_min}
                    onChange={(e) => setEditFormData({ ...editFormData, estimated_duration_min: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block font-bold text-[#172033] mb-1">Severity</label>
                  <select
                    value={editFormData.severity}
                    onChange={(e) => setEditFormData({ ...editFormData, severity: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 font-medium text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                {/* Reviewer Comments */}
                <div className="col-span-2">
                  <label className="block font-bold text-[#172033] mb-1">Operator Notes / Rationale</label>
                  <textarea
                    rows={2}
                    value={editFormData.review_comments}
                    onChange={(e) => setEditFormData({ ...editFormData, review_comments: e.target.value })}
                    placeholder="Enter justification for correction..."
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:border-[#1565C0]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-white hover:bg-[#F1F5F9] text-[#5B6575] font-bold rounded-lg border border-[#CBD5E1] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === editingRecord.id}
                  className="px-5 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLoading === editingRecord.id ? 'Re-validating...' : 'Validate, Deduplicate & Ingest'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT REASON */}
      {rejectingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#FEF2F2]">
              <div className="flex items-center space-x-2 text-[#B91C1C]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">
                  Confirm Rejection: {rejectingRecord.job_id}
                </h3>
              </div>
              <button
                onClick={() => setRejectingRecord(null)}
                className="p-1 rounded-lg text-[#7A8494] hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#5B6575] leading-relaxed">
                Rejecting this record will <strong>strictly exclude</strong> it from the Unified Maintenance dataset
                and prevent it from appearing in Corridor and Block planning schedules.
              </p>

              <div>
                <label className="block font-bold text-[#172033] mb-1">
                  Rejection Reason / Justification <span className="text-[#B91C1C]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this record cannot be salvaged or mapped..."
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#B91C1C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRejectingRecord(null)}
                  className="px-4 py-2 bg-white hover:bg-[#F1F5F9] text-[#5B6575] font-bold rounded-lg border border-[#CBD5E1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={!rejectionReason.trim() || actionLoading === rejectingRecord.id}
                  className="px-5 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{actionLoading === rejectingRecord.id ? 'Excluding...' : 'Exclude & Log Rejection'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
