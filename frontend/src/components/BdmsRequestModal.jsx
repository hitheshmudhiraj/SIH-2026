import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Clock, MapPin,
  Calendar, Wrench, ArrowRight, Bell, Send, Check, RefreshCw
} from 'lucide-react';
import { checkBlockOverlap, submitBlockRequest } from '../lib/api';

const CORRIDORS = [
  { id: 'C01', name: 'C01: Vijayawada - Gudur (Grand Trunk)', defaultKm: 124.4, defaultStation: 'OGL' },
  { id: 'C02', name: 'C02: Vijayawada - Visakhapatnam (Coastal)', defaultKm: 150.0, defaultStation: 'SLO' },
  { id: 'C03', name: 'C03: Vijayawada - Guntur (High-Density)', defaultKm: 30.0, defaultStation: 'GNT' },
  { id: 'C04', name: 'C04: Guntakal - Renigunta (Rayalaseema)', defaultKm: 187.0, defaultStation: 'HX' }
];

const DEPARTMENTS = [
  { id: 'Engineering', label: 'Engineering (TMS)', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'S&T', label: 'S&T (SMMS)', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'Traction', label: 'Traction (TDMS)', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }
];

export default function BdmsRequestModal({ isOpen, onClose, initialCorridor = 'C01', initialKm = 124.4, onSubmitted }) {
  const [department, setDepartment] = useState('Engineering');
  const [corridorId, setCorridorId] = useState(initialCorridor);
  const [station, setStation] = useState('OGL');
  const [km, setKm] = useState(initialKm);
  const [requestedDate, setRequestedDate] = useState('2026-09-09');
  const [requestedStart, setRequestedStart] = useState('01:30');
  const [requestedEnd, setRequestedEnd] = useState('04:30');
  const [durationMin, setDurationMin] = useState(180);
  const [reason, setReason] = useState('Scheduled turnout tamping & sensor integrity check');

  // Overlap analysis state
  const [isChecking, setIsChecking] = useState(false);
  const [overlapData, setOverlapData] = useState(null);
  const [selectedCoordJobId, setSelectedCoordJobId] = useState(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCorridor) setCorridorId(initialCorridor);
      if (initialKm) setKm(initialKm);
      setSubmitResult(null);
      setError(null);
    }
  }, [isOpen, initialCorridor, initialKm]);

  // Recalculate duration when times change
  useEffect(() => {
    try {
      const [sh, sm] = requestedStart.split(':').map(Number);
      const [eh, em] = requestedEnd.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // wraps over midnight
      if (diff > 0) setDurationMin(diff);
    } catch {
      // fallback keep duration
    }
  }, [requestedStart, requestedEnd]);

  // Real-time pre-submit overlap check
  const runOverlapCheck = useCallback(async () => {
    if (!corridorId || km === undefined || km === '') return;
    setIsChecking(true);
    try {
      const data = await checkBlockOverlap({
        corridor_id: corridorId,
        km: parseFloat(km),
        date_start: requestedDate,
        date_end: requestedDate,
        department: department
      });
      setOverlapData(data);
      // Auto-select first joint opportunity if available
      if (data?.overlaps?.length > 0) {
        const topJob = data.overlaps[0];
        setSelectedCoordJobId(topJob.id);
      } else {
        setSelectedCoordJobId(null);
      }
    } catch (err) {
      console.error('Error checking overlap:', err);
    } finally {
      setIsChecking(false);
    }
  }, [corridorId, km, requestedDate, department]);

  // Trigger check on corridor, km, date, or department change (debounced)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      runOverlapCheck();
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen, corridorId, km, requestedDate, department, runOverlapCheck]);

  if (!isOpen) return null;

  // Handle final submission with explicit user choice
  const handleSubmit = async (choice) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const matchedJob = overlapData?.overlaps?.find(o => o.id === selectedCoordJobId);
      const payload = {
        corridor_id: corridorId,
        department: department,
        station: station,
        km: parseFloat(km),
        requested_date: requestedDate,
        requested_start: requestedStart,
        requested_end: requestedEnd,
        requested_duration_min: parseInt(durationMin, 10),
        reason: reason,
        submission_choice: choice, // 'PROCEED_ANYWAY' or 'COORDINATE_JOINT_BLOCK'
        coordinated_with_id: choice === 'COORDINATE_JOINT_BLOCK' ? selectedCoordJobId : null,
        notified_department: choice === 'COORDINATE_JOINT_BLOCK' ? (matchedJob?.department || null) : null,
        overlap_count: overlapData?.overlap_count || 0
      };

      const res = await submitBlockRequest(payload);
      setSubmitResult(res);
      if (onSubmitted) onSubmitted(res);
    } catch (err) {
      setError(err.message || 'Failed to submit block request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const directCollisions = overlapData?.overlaps?.filter(o => o.category === 'DIRECT_COLLISION') || [];
  const jointOpportunities = overlapData?.overlaps?.filter(o => o.category === 'JOINT_BLOCK_OPPORTUNITY') || [];
  const hasOverlap = overlapData?.has_overlap;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/30 overflow-hidden text-slate-100">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">BDMS Block Demand Request</h2>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Pre-Submission Guard
                </span>
              </div>
              <p className="text-xs text-slate-400">
                South Coast Railway (SCoR) • Cross-Department Spatial Conflict & Joint-Block Detector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6">

          {submitResult ? (
            /* SUCCESS CONFIRMATION VIEW */
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Block Request Successfully Registered</h3>
                <p className="text-sm text-slate-300 mt-1 max-w-lg mx-auto">
                  {submitResult.message}
                </p>
              </div>

              <div className="max-w-md mx-auto bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">BDMS Request ID:</span>
                  <span className="text-cyan-400 font-bold">{submitResult.block_request_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audit Trail ID:</span>
                  <span className="text-amber-400 font-bold">{submitResult.audit_id || 'AUD-LOGGED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Resolution Decision:</span>
                  <span className={submitResult.submission_choice === 'COORDINATE_JOINT_BLOCK' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {submitResult.submission_choice}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Corridor & KM:</span>
                  <span className="text-slate-200">{corridorId} • KM {km} ({station})</span>
                </div>
              </div>

              <div className="pt-4 flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setSubmitResult(null);
                    setKm(prev => (parseFloat(prev) + 1.0).toFixed(1));
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Submit Another Request
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30"
                >
                  Done & Return to Map
                </button>
              </div>
            </div>
          ) : (
            /* FORM & OVERLAP GUARD VIEW */
            <>
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* SECTION 1: REQUEST PARAMETERS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Requesting Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Requesting Department
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPARTMENTS.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDepartment(d.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          department === d.id
                            ? `${d.badge} ring-2 ring-cyan-500/40 bg-slate-800 shadow-md`
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {d.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corridor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Corridor
                  </label>
                  <select
                    value={corridorId}
                    onChange={(e) => {
                      setCorridorId(e.target.value);
                      const sel = CORRIDORS.find(c => c.id === e.target.value);
                      if (sel) {
                        setKm(sel.defaultKm);
                        setStation(sel.defaultStation);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {CORRIDORS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Station & Location KM */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Station Code
                    </label>
                    <input
                      type="text"
                      value={station}
                      onChange={(e) => setStation(e.target.value.toUpperCase())}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-cyan-500"
                      placeholder="e.g. OGL"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Location (KM)</span>
                      <span className="text-[10px] text-slate-400 font-mono">Tolerance: 50m</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={km}
                      onChange={(e) => setKm(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      placeholder="124.4"
                    />
                  </div>
                </div>

                {/* Proposed Date & Time Window */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Proposed Date & Window
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="date"
                      value={requestedDate}
                      onChange={(e) => setRequestedDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="time"
                      value={requestedStart}
                      onChange={(e) => setRequestedStart(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="time"
                      value={requestedEnd}
                      onChange={(e) => setRequestedEnd(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono text-right">
                    Calculated duration: <span className="text-cyan-400 font-semibold">{durationMin} min</span>
                  </div>
                </div>
              </div>

              {/* Maintenance Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Scope of Maintenance & Equipment Required
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                  placeholder="Describe maintenance scope, machine requirement, speed restrictions..."
                />
              </div>

              {/* SECTION 2: LIVE PRE-SUBMISSION OVERLAP ANALYSIS */}
              <div className="border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Live Pre-Submission Overlap Analysis
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isChecking && (
                      <span className="text-[11px] text-cyan-400 flex items-center space-x-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Querying unified jobs...</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={runOverlapCheck}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-check</span>
                    </button>
                  </div>
                </div>

                {/* STATUS BANNER */}
                {!isChecking && !hasOverlap && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-start space-x-3">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide">
                        Clean Corridor Window (No Overlaps)
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        No cross-department maintenance jobs or conflicting BDMS requests found within 2.0 km around KM {km} on {requestedDate}. Safe for direct submission.
                      </p>
                    </div>
                  </div>
                )}

                {!isChecking && hasOverlap && (
                  <div className="space-y-3">
                    {/* Collisions Summary Banner */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">
                            Detected {overlapData.overlap_count} Overlapping Asset/Corridor Event(s)
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {directCollisions.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              {directCollisions.length} Direct Collision (&le; 50m)
                            </span>
                          )}
                          {jointOpportunities.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              {jointOpportunities.length} Joint-Block Opportunity (&le; 2km)
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Review the conflicting or adjacent tasks below before submitting. You may coordinate to bundle possessions into a single window or proceed as a separate request.
                      </p>
                    </div>

                    {/* OVERLAPS LIST */}
                    <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                      {overlapData.overlaps.map((item) => {
                        const isDirect = item.category === 'DIRECT_COLLISION';
                        const isSelected = selectedCoordJobId === item.id;
                        const deptColor =
                          item.department === 'Engineering' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                          item.department === 'S&T' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
                          'text-blue-400 bg-blue-500/10 border-blue-500/30';

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedCoordJobId(item.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-800/90 border-cyan-500 ring-1 ring-cyan-500 shadow-md'
                                : isDirect
                                ? 'bg-rose-950/20 border-rose-500/40 hover:bg-rose-950/30'
                                : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptColor}`}>
                                  {item.department}
                                </span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                  isDirect
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                }`}>
                                  {isDirect ? 'DIRECT COLLISION' : 'JOINT OPPORTUNITY'}
                                </span>
                                <span className="text-xs font-mono text-slate-300 font-semibold">{item.id}</span>
                              </div>

                              <div className="text-right">
                                <span className={`text-xs font-bold font-mono ${isDirect ? 'text-rose-400' : 'text-cyan-400'}`}>
                                  {item.distance_m}m away
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 font-mono">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Location</span>
                                <span>KM {item.km} ({item.station || 'Section'})</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Date & Window</span>
                                <span>{item.date} • {item.time_window}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-[10px]">Scope / Activity</span>
                                <span className="truncate block">{item.activity}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1.5 italic">
                              {item.description}
                            </p>

                            {/* COORDINATE SELECTOR */}
                            <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs">
                              <span className="text-[10px] text-slate-400">
                                {isSelected ? '✓ Selected for Joint Coordination' : 'Click to select for joint block bundling'}
                              </span>
                              <span className={`text-[11px] font-semibold ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {isSelected ? 'Primary Coordination Target' : 'Select Target'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: EXPLICIT RESOLUTION CHOICES & SUBMISSION BUTTONS */}
              <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                {!hasOverlap ? (
                  /* Standard Clean Submission */
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit('CLEAN_SUBMISSION')}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Submit Clean Block Request</span>
                  </button>
                ) : (
                  /* Two Explicit Choices when Overlap Detected */
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    
                    {/* CHOICE A: PROCEED ANYWAY */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit('PROCEED_ANYWAY')}
                      className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                      title="Submits separate request. Cross-department conflict is logged to audit trail for Sr. DOM review."
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>(a) Proceed Anyway (Flag Conflict)</span>
                    </button>

                    {/* CHOICE B: COORDINATE / JOIN */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit('COORDINATE_JOINT_BLOCK')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                      title="Bundles with selected job. Logs joint-coordination intent and notifies department."
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>(b) Coordinate & Join Block</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
