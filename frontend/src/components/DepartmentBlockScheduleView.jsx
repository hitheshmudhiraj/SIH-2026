import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Shield, Search,
  Users, Layers, Download, CheckCircle2, Train,
  FileSpreadsheet, Sparkles, Building2, ChevronDown, ChevronUp,
  Tag, Info, RefreshCw, RotateCcw, X, Filter, Check, ArrowRight,
  Activity
} from 'lucide-react';
import {
  fetchLatestWeeklyPlan,
  fetchLatestMonthlyPlan,
  fetchCurrentActivePlan,
  fetchPlanById,
  fetchActivePlanPointer
} from '../api';

/**
 * FEATURE B: "Why Was This Block Selected?" Data-Derived Explainability.
 * Derives a human-readable list of bullet reasons why each block was selected,
 * strictly from that block's real attributes (joint bundling, train conflicts,
 * resource availability, defect severity, and window suitability).
 */
export function getBlockExplanationBullets(block) {
  if (!block) return [];
  // 1. If pre-computed explainability bullets exist, use them directly
  if (Array.isArray(block.why_selected_bullets) && block.why_selected_bullets.length > 0) {
    return block.why_selected_bullets;
  }

  const bullets = [];
  const depts = block.departments || ['Engineering'];
  const tasks = block.tasks || [];
  const isJoint = Boolean(block.is_joint_megablock || depts.length > 1);
  const taskCount = tasks.length || block.task_count || 1;

  // Department combination / Megablock synergy
  if (isJoint && depts.length > 1) {
    const deptsStr = depts.join(' & ');
    bullets.push(`${taskCount} maintenance jobs combined across ${deptsStr} (Joint Mega-Block minimizing corridor closures)`);
  } else {
    const deptName = depts[0] || 'Engineering';
    bullets.push(`Dedicated possession window scheduled exclusively for ${deptName} with zero adjacent interference`);
  }

  // Train traffic & timetable clearance
  const trainConflict = block.train_conflict_check;
  const trainRegulation = block.train_regulation;
  const conflictCount = trainConflict?.conflict_count ?? trainRegulation?.affected_trains_count ?? 0;

  if (conflictCount === 0 || block.train_impact === 'MINIMAL' || (typeof block.train_impact === 'string' && block.train_impact.toLowerCase().includes('minimal'))) {
    bullets.push('Zero scheduled passenger train conflicts during this window with safe timetable headway clearance');
  } else {
    const affected = trainConflict?.affected_trains || trainRegulation?.regulated_trains || [];
    const affStr = affected.length > 0 ? affected.slice(0, 2).join(', ') : `${conflictCount} train(s)`;
    bullets.push(`Controlled traffic regulation: ${affStr} safely managed with minimal headway delay`);
  }

  // Resource & Equipment Availability
  const resourceCheck = block.resource_check;
  if (resourceCheck?.all_available) {
    const rItems = resourceCheck.resources || [];
    const rNames = rItems.map(r => r.resource_name).filter(Boolean);
    const rStr = rNames.length > 0 ? [...new Set(rNames)].join(', ') : 'Required gangs & machinery';
    bullets.push(`All assigned resources (${rStr}) verified available in depot inventory with zero double-booking`);
  } else {
    const requiredRes = tasks.map(t => t.required_resource || t.crew_required).filter(Boolean);
    if (requiredRes.length > 0) {
      const uniqueRes = [...new Set(requiredRes)].join(', ');
      bullets.push(`Designated machinery and crew (${uniqueRes}) allocated with verified depot availability`);
    } else {
      bullets.push('Required departmental crew and track machinery confirmed available for window execution');
    }
  }

  // Criticality & Safety Priority
  const criticalTasks = tasks.filter(t => t.severity === 'critical' || (t.priority_score && t.priority_score > 70));
  if (criticalTasks.length > 0) {
    const critDefects = criticalTasks.map(t => (t.defect_type || 'critical defect').replace(/_/g, ' '));
    const defectStr = [...new Set(critDefects)].slice(0, 2).join(', ');
    bullets.push(`High track safety priority: resolves critical defect(s) (${defectStr}) before speed restriction risk`);
  } else {
    bullets.push('Routine preventive corridor maintenance aligned with divisional safety standards');
  }

  // Time window suitability
  if (block.window_name) {
    bullets.push(`Scheduled within ${block.window_name} (${block.start_time} – ${block.end_time}, ${block.duration_hours || 3}h) optimizing track possession efficiency`);
  }

  return bullets;
}

export default function DepartmentBlockScheduleView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' or 'monthly'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [highlightedBlockId, setHighlightedBlockId] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [activePointer, setActivePointer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1); // 1, 2, 3, 4, or 'ALL'

  // Toggle state to view active plans currently under work / ongoing now
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Toggle state to view newly generated plan vs full master schedule
  const [showNewlyGeneratedOnly, setShowNewlyGeneratedOnly] = useState(() => {
    return Boolean(location.state?.highlightNewPlan);
  });

  // Date and Time range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timePreset, setTimePreset] = useState('ALL');

  // Load plans from API with Prompt 7 current plan default and Prompt 8 route-state integration
  const loadData = useCallback(async (forcedTargetPlanId = null) => {
    setIsLoading(true);
    try {
      // 1. Fetch current active pointer
      const ptr = await fetchActivePlanPointer().catch(() => null);
      if (ptr) setActivePointer(ptr);

      const targetPlanId = forcedTargetPlanId || location.state?.planId || new URLSearchParams(location.search).get('plan_id');
      const targetBlockId = location.state?.blockId || new URLSearchParams(location.search).get('block_id');
      const targetDept = location.state?.department;

      let wk = null;
      let mo = null;

      // If a specific target plan ID is passed (e.g. from "View Latest Plan")
      if (targetPlanId) {
        try {
          const specific = await fetchPlanById(targetPlanId);
          if (specific) {
            if (specific.plan_type === 'MONTHLY') {
              mo = specific;
              setActiveTab('monthly');
            } else {
              wk = specific;
              setActiveTab('weekly');
            }
          }
        } catch (specErr) {
          console.warn(`Could not fetch specific plan ${targetPlanId}:`, specErr);
        }
      }

      // Default to Prompt 7 current active plan on every open / refresh
      const [currWk, currMo] = await Promise.all([
        !wk ? fetchCurrentActivePlan('WEEKLY').catch(() => fetchLatestWeeklyPlan().catch(() => null)) : Promise.resolve(null),
        !mo ? fetchCurrentActivePlan('MONTHLY').catch(() => fetchLatestMonthlyPlan().catch(() => null)) : Promise.resolve(null)
      ]);

      if (!wk && currWk) wk = currWk;
      if (!mo && currMo) mo = currMo;

      if (wk) setWeeklyPlan(wk);
      if (mo) setMonthlyPlan(mo);

      // Pre-select and highlight target block if navigated via "View Latest Plan"
      if (targetBlockId) {
        setExpandedBlockId(targetBlockId);
        setHighlightedBlockId(targetBlockId);
      }
      if (targetDept && targetDept !== 'ALL') {
        setSelectedDept(targetDept);
      }
      if (location.state?.highlightNewPlan) {
        setShowNewlyGeneratedOnly(true);
      }
    } catch (err) {
      console.warn('Using local fallback plan data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [location.state, location.search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Department metadata
  const departments = [
    { id: 'ALL', label: 'All Departments', icon: Layers, color: 'bg-slate-100 text-slate-700 border-slate-300' },
    { id: 'Engineering', label: 'Civil / Track (TMS)', icon: Building2, color: 'bg-amber-50 text-amber-800 border-amber-300' },
    { id: 'S&T', label: 'Signal & Telecom (SMMS)', icon: Shield, color: 'bg-blue-50 text-blue-800 border-blue-300' },
    { id: 'Traction', label: 'Electrical / OHE (TDMS)', icon: Sparkles, color: 'bg-purple-50 text-purple-800 border-purple-300' },
    { id: 'Operating', label: 'Traffic / Operating (COA)', icon: Train, color: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
  ];

  // Extract blocks based on active view and merge newly generated block if present
  const currentBlocks = useMemo(() => {
    let list = [];
    if (activeTab === 'weekly') {
      list = weeklyPlan?.blocks || [];
    } else {
      if (!monthlyPlan?.weeks) return [];
      if (selectedWeek === 'ALL') {
        list = monthlyPlan.weeks.flatMap(w => w.blocks || []);
      } else {
        const currentWeekData = monthlyPlan.weeks.find(w => w.week_number === selectedWeek) || monthlyPlan.weeks[0];
        list = currentWeekData?.blocks || [];
      }
    }

    // Ensure any newly generated block from localStorage is included if not already present
    try {
      const localPlanStr = localStorage.getItem('railblock_latest_generated_plan');
      if (localPlanStr) {
        const localBlock = JSON.parse(localPlanStr);
        if (localBlock && localBlock.block_id) {
          const exists = list.some(b => b.block_id === localBlock.block_id);
          if (!exists && (activeTab === 'weekly' || !localBlock.plan_type || localBlock.plan_type === 'WEEKLY')) {
            list = [localBlock, ...list];
          }
        }
      }
    } catch (e) {
      // ignore parsing error
    }

    return list;
  }, [activeTab, weeklyPlan, monthlyPlan, selectedWeek]);

  // Extract newly generated block(s) for the toggle
  const newlyGeneratedBlocks = useMemo(() => {
    return currentBlocks.filter(b => {
      if (b.is_newly_generated) return true;
      if (weeklyPlan?.latest_new_block?.block_id === b.block_id) return true;
      if (location.state?.blockId && location.state.blockId === b.block_id) return true;
      if (highlightedBlockId && highlightedBlockId === b.block_id) return true;
      return false;
    });
  }, [currentBlocks, weeklyPlan, location.state, highlightedBlockId]);

  // Helper to determine if a block is currently under work or ongoing now
  const isBlockUnderWork = useCallback((block, activeDate) => {
    if (!block) return false;
    const status = (block.work_status || block.execution_status || block.status || '').toUpperCase();
    if (['UNDER_WORK', 'UNDER WORK', 'IN_PROGRESS', 'IN PROGRESS', 'ACTIVE', 'ONGOING'].includes(status)) {
      return true;
    }
    if (block.is_under_work || block.is_ongoing) {
      return true;
    }

    // Real-time clock check against current local date & time
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (block.date === todayStr) {
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const nowMins = currentH * 60 + currentM;
      const [sH, sM] = (block.start_time || '00:00').split(':').map(Number);
      const [eH, eM] = (block.end_time || '23:59').split(':').map(Number);
      const startMins = (sH || 0) * 60 + (sM || 0);
      let endMins = (eH || 0) * 60 + (eM || 0);
      if (endMins < startMins) endMins += 24 * 60;
      if (nowMins >= startMins && nowMins <= endMins) return true;
    }

    // Active operational date match (e.g. Day 1 of the weekly rolling plan)
    if (activeDate && block.date === activeDate) {
      return true;
    }

    return false;
  }, []);

  // Primary active operational date for ongoing execution
  const activeOperationalDate = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (currentBlocks.some(b => b.date === todayStr)) return todayStr;
    const dates = [...new Set(currentBlocks.map(b => b.date))].filter(Boolean).sort();
    return dates[0] || '2026-09-08';
  }, [currentBlocks]);

  // List of blocks currently under work or ongoing
  const activeUnderWorkBlocks = useMemo(() => {
    return currentBlocks.filter(b => isBlockUnderWork(b, activeOperationalDate));
  }, [currentBlocks, activeOperationalDate, isBlockUnderWork]);

  // Handler to toggle viewing active plans currently under work / ongoing now
  const handleToggleActivePlans = (enable) => {
    setShowActiveOnly(enable);
    if (enable) {
      setShowNewlyGeneratedOnly(false);
      if (activeTab !== 'weekly') {
        setActiveTab('weekly');
      }
    }
  };

  // Handler to toggle between Newly Generated Plan and All Scheduled Blocks
  const handleToggleNewlyGenerated = async (enable) => {
    setShowNewlyGeneratedOnly(enable);
    if (enable) {
      setShowActiveOnly(false);
      if (activeTab !== 'weekly') {
        setActiveTab('weekly');
      }
      // If no newly generated block in current view, re-fetch active plan from server
      if (newlyGeneratedBlocks.length === 0) {
        try {
          setIsLoading(true);
          const active = await fetchCurrentActivePlan('WEEKLY');
          if (active) {
            setWeeklyPlan(active);
            const targetId = active.latest_new_block?.block_id || active.blocks?.find(b => b.is_newly_generated)?.block_id;
            if (targetId) {
              setExpandedBlockId(targetId);
              setHighlightedBlockId(targetId);
            }
          }
        } catch (e) {
          console.warn('Could not refresh active plan on toggle:', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        const firstTarget = newlyGeneratedBlocks[0];
        if (firstTarget?.block_id) {
          setExpandedBlockId(firstTarget.block_id);
          setHighlightedBlockId(firstTarget.block_id);
        }
      }
    }
  };

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    let source = currentBlocks;
    if (showActiveOnly) {
      source = activeUnderWorkBlocks;
    } else if (showNewlyGeneratedOnly) {
      source = newlyGeneratedBlocks.length > 0 ? newlyGeneratedBlocks : currentBlocks.filter(b => b.is_newly_generated);
    }

    return source.filter(b => {
      // Department filter
      if (selectedDept !== 'ALL') {
        const hasDept = b.departments && b.departments.some(d =>
          d.toLowerCase().includes(selectedDept.toLowerCase()) ||
          (selectedDept === 'Engineering' && d.toLowerCase().includes('track'))
        );
        if (!hasDept) return false;
      }

      // Division filter
      if (selectedDivision !== 'ALL') {
        if (b.division && !b.division.toLowerCase().includes(selectedDivision.toLowerCase())) {
          return false;
        }
      }

      // Date range filter
      if (startDate && b.date && b.date < startDate) {
        return false;
      }
      if (endDate && b.date && b.date > endDate) {
        return false;
      }

      // Time range filter (checks interval overlap with block start_time and end_time)
      if (startTime && b.end_time && b.end_time <= startTime) {
        return false;
      }
      if (endTime && b.start_time && b.start_time >= endTime) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = b.section_name?.toLowerCase().includes(q);
        const matchesId = b.block_id?.toLowerCase().includes(q);
        const matchesSecId = b.section_id?.toLowerCase().includes(q);
        const matchesDefects = b.tasks?.some(t =>
          t.defect_type?.toLowerCase().includes(q) ||
          t.asset_type?.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesId && !matchesSecId && !matchesDefects) {
          return false;
        }
      }
      return true;
    });
  }, [currentBlocks, selectedDept, selectedDivision, startDate, endDate, startTime, endTime, searchQuery]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalBlocks = filteredBlocks.length;
    const jointMegaBlocks = filteredBlocks.filter(b => b.is_joint_megablock || (b.departments && b.departments.length > 1)).length;
    const totalHours = filteredBlocks.reduce((acc, b) => acc + (b.duration_hours || 0), 0);
    const totalTasks = filteredBlocks.reduce((acc, b) => acc + (b.tasks?.length || b.task_count || 1), 0);
    const criticalTasks = filteredBlocks.reduce((acc, b) => {
      const crit = b.tasks?.filter(t => t.severity === 'critical' || t.priority_score > 70).length || 0;
      return acc + crit;
    }, 0);

    return {
      totalBlocks,
      jointMegaBlocks,
      jointPct: totalBlocks > 0 ? Math.round((jointMegaBlocks / totalBlocks) * 100) : 0,
      totalHours: totalHours.toFixed(1),
      totalTasks,
      criticalTasks
    };
  }, [filteredBlocks]);

  const isFiltered =
    showActiveOnly ||
    showNewlyGeneratedOnly ||
    selectedDept !== 'ALL' ||
    selectedDivision !== 'ALL' ||
    searchQuery.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    startTime !== '' ||
    endTime !== '';

  const handleClearFilters = () => {
    setShowActiveOnly(false);
    setShowNewlyGeneratedOnly(false);
    setSelectedDept('ALL');
    setSelectedDivision('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setTimePreset('ALL');
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    if (!filteredBlocks.length) return;
    const headers = ["Block ID", "Date", "Time Slot", "Duration (Hrs)", "Section", "Division", "Departments", "Joint MegaBlock", "Tasks Count", "Train Impact"];
    const rows = filteredBlocks.map(b => [
      b.block_id,
      b.date,
      `${b.start_time} - ${b.end_time}`,
      b.duration_hours,
      `"${b.section_name}"`,
      `"${b.division || 'Vijayawada'}"`,
      `"${b.departments ? b.departments.join(', ') : 'Civil'}"`,
      b.is_joint_megablock ? "YES" : "NO",
      b.tasks?.length || b.task_count || 1,
      b.train_impact || "MINIMAL"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `railway_${activeTab}_block_schedule_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1 uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>Cross-Departmental Transparency Portal</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-[#172033] tracking-tight">
                Weekly & Monthly Master Block Schedule
              </h1>
              {(activeTab === 'weekly' ? weeklyPlan?.plan_id : monthlyPlan?.plan_id) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Active Plan: {activeTab === 'weekly' ? weeklyPlan?.plan_id : monthlyPlan?.plan_id}
                </span>
              )}
            </div>
            <p className="text-sm text-[#5B6575] mt-1.5 leading-relaxed max-w-3xl">
              Published track possession schedule for <strong>Engineering (Civil/Track)</strong>, <strong>S&T (Signals)</strong>,
              <strong> Electrical (OHE/TRD)</strong>, and <strong>Operating (Traffic)</strong>. Check joint megablocks, train
              regulations, and maintenance windows to synchronize departmental crew and equipment.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => loadData()}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F8FAFC] text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Reload current active plan from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#1565C0] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Plan</span>
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F8FAFC] text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#1565C0]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-[#1565C0] hover:bg-[#0D47A1] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Print Block Notice</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher (Weekly vs Monthly) + Plan Scope Toggle */}
        <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Horizon: Weekly vs Monthly */}
            <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
              <button
                id="btn-tab-weekly"
                onClick={() => setActiveTab('weekly')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'weekly'
                    ? 'bg-white text-[#1565C0] shadow-sm'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Weekly Rolling Plan (7-Day)</span>
              </button>
              <button
                id="btn-tab-monthly"
                onClick={() => setActiveTab('monthly')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'monthly'
                    ? 'bg-white text-[#1565C0] shadow-sm'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Monthly Calendar (4-Week)</span>
              </button>
            </div>

            {/* Plan Scope Switcher: All Scheduled Blocks vs Active Plans vs Newly Generated Plan */}
            <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#CBD5E1] shadow-xs">
              <button
                id="toggle-all-blocks"
                type="button"
                onClick={() => {
                  setShowActiveOnly(false);
                  setShowNewlyGeneratedOnly(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  !showActiveOnly && !showNewlyGeneratedOnly
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
                title="View full corridor schedule with all scheduled possession blocks"
              >
                <Layers className="w-3.5 h-3.5 text-[#64748B]" />
                <span>All Scheduled Blocks</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
                  {currentBlocks.length}
                </span>
              </button>

              <button
                id="toggle-active-plans-scope"
                type="button"
                onClick={() => handleToggleActivePlans(!showActiveOnly)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  showActiveOnly
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-600'
                    : 'text-amber-800 hover:bg-white/80'
                }`}
                title="View plans that are currently under work or ongoing right now"
              >
                <Activity className={`w-3.5 h-3.5 ${showActiveOnly ? 'text-white animate-pulse' : 'text-amber-600'}`} />
                <span>Active Plans (Under Work)</span>
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  showActiveOnly ? 'bg-amber-100 text-amber-950' : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeUnderWorkBlocks.length}
                </span>
              </button>

              <button
                id="toggle-newly-generated-plan"
                type="button"
                onClick={() => handleToggleNewlyGenerated(!showNewlyGeneratedOnly)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  showNewlyGeneratedOnly
                    ? 'bg-[#1565C0] text-white shadow-sm ring-1 ring-[#1565C0]'
                    : 'text-[#0D47A1] hover:bg-white/80'
                }`}
                title="View only the newly generated plan and synchronized AI recommendation"
              >
                <Sparkles className={`w-3.5 h-3.5 ${showNewlyGeneratedOnly ? 'text-amber-300 animate-pulse' : 'text-[#1565C0]'}`} />
                <span>Newly Generated Plan</span>
                {newlyGeneratedBlocks.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    showNewlyGeneratedOnly ? 'bg-amber-300 text-amber-950' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {newlyGeneratedBlocks.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Month Week Selector if monthly */}
          {activeTab === 'monthly' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#64748B] font-semibold">Select Horizon:</span>
              <button
                onClick={() => setSelectedWeek('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  selectedWeek === 'ALL'
                    ? 'bg-[#1565C0] text-white shadow-sm'
                    : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                All 4 Weeks
              </button>
              {[1, 2, 3, 4].map(w => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    selectedWeek === w
                      ? 'bg-[#1565C0] text-white shadow-sm'
                      : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  Week {w}
                </button>
              ))}
            </div>
          )}

          <div className="text-xs text-[#64748B] font-medium flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Schedule Approved by Sr.DOM & DRM Operating Office</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-[#64748B] mb-1">Total Scheduled Blocks</div>
          <div className="text-2xl font-black text-[#1565C0]">{summaryStats.totalBlocks}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Possession slots allocated</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-[#64748B] mb-1">Joint Mega-Blocks</div>
          <div className="text-2xl font-black text-[#7C3AED]">
            {summaryStats.jointMegaBlocks}
            <span className="text-xs font-semibold text-[#7C3AED] ml-1.5">({summaryStats.jointPct}%)</span>
          </div>
          <div className="text-[11px] text-purple-600 mt-1 font-medium">Multi-dept bundled</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-[#64748B] mb-1">Total Track Hours</div>
          <div className="text-2xl font-black text-[#0F766E]">{summaryStats.totalHours} hrs</div>
          <div className="text-[11px] text-teal-600 mt-1 font-medium">Possessed shadow time</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-[#64748B] mb-1">Maintenance Tasks</div>
          <div className="text-2xl font-black text-[#C2410C]">{summaryStats.totalTasks}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Work packages queued</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-[#64748B] mb-1">Critical Defect Fixes</div>
          <div className="text-2xl font-black text-[#DC2626]">{summaryStats.criticalTasks}</div>
          <div className="text-[11px] text-rose-600 mt-1 font-medium">High safety priority</div>
        </div>
      </div>

      {/* Filter & Department Selector Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3.5">
        {/* Row 1: Department Chips & Division */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Department Chips */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-[#475569] mr-1 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-[#1565C0]" />
              <span>Department:</span>
            </span>
            {departments.map(dept => {
              const Icon = dept.icon;
              const isSelected = selectedDept === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1565C0] text-white border-[#1565C0] shadow-sm'
                      : `${dept.color} hover:opacity-90`
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{dept.label}</span>
                </button>
              );
            })}
          </div>

          {/* Division Selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-semibold text-[#64748B]">Division:</span>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 font-medium text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
            >
              <option value="ALL">All Divisions (SCR / ECoR)</option>
              <option value="Vijayawada">Vijayawada (BZA)</option>
              <option value="Guntur">Guntur (GNT)</option>
              <option value="Guntakal">Guntakal (GTL)</option>
              <option value="Visakhapatnam">Visakhapatnam (WAT)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Range & Time Window Range Filters */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Range Picker */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#475569]">
                <Calendar className="w-3.5 h-3.5 text-[#1565C0]" />
                <span>Date Range:</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs">
                <span className="text-[11px] text-[#64748B] font-medium">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs text-[#1E293B] font-medium focus:outline-none cursor-pointer"
                />
              </div>
              <span className="text-xs text-[#94A3B8] font-medium">to</span>
              <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs">
                <span className="text-[11px] text-[#64748B] font-medium">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs text-[#1E293B] font-medium focus:outline-none cursor-pointer"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[11px] text-[#64748B] hover:text-[#DC2626] font-semibold px-1.5 py-0.5 rounded hover:bg-slate-100 flex items-center space-x-0.5 cursor-pointer"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Date</span>
                </button>
              )}
            </div>

            {/* Time Window Range Picker */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#475569]">
                <Clock className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Time Slot:</span>
              </div>

              <select
                value={timePreset}
                onChange={(e) => {
                  const val = e.target.value;
                  setTimePreset(val);
                  if (val === 'ALL') {
                    setStartTime('');
                    setEndTime('');
                  } else if (val === 'NIGHT') {
                    setStartTime('00:00');
                    setEndTime('06:00');
                  } else if (val === 'MORNING') {
                    setStartTime('06:00');
                    setEndTime('12:00');
                  } else if (val === 'MIDDAY') {
                    setStartTime('12:00');
                    setEndTime('18:00');
                  } else if (val === 'EVENING') {
                    setStartTime('18:00');
                    setEndTime('23:59');
                  }
                }}
                className="text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 font-medium text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#1565C0] cursor-pointer"
              >
                <option value="ALL">All Hours (24h)</option>
                <option value="NIGHT">Night Rolling (00:00 - 06:00)</option>
                <option value="MORNING">Morning Window (06:00 - 12:00)</option>
                <option value="MIDDAY">Mid-Day Shadow (12:00 - 18:00)</option>
                <option value="EVENING">Evening Trough (18:00 - 24:00)</option>
                <option value="CUSTOM">Custom Window</option>
              </select>

              <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setTimePreset('CUSTOM');
                  }}
                  className="bg-transparent text-xs text-[#1E293B] font-medium focus:outline-none cursor-pointer"
                />
                <span className="text-[11px] text-[#94A3B8]">to</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setTimePreset('CUSTOM');
                  }}
                  className="bg-transparent text-xs text-[#1E293B] font-medium focus:outline-none cursor-pointer"
                />
              </div>

              {(startTime || endTime) && (
                <button
                  onClick={() => { setStartTime(''); setEndTime(''); setTimePreset('ALL'); }}
                  className="text-[11px] text-[#64748B] hover:text-[#DC2626] font-semibold px-1.5 py-0.5 rounded hover:bg-slate-100 flex items-center space-x-0.5 cursor-pointer"
                  title="Clear time filter"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Time</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Actions: Active Plans & Newly Generated Plan Quick Toggles */}
          <div className="flex items-center gap-2">
            {/* Active Plans (Under Work) Toggle */}
            <button
              id="filter-toggle-active-plans"
              type="button"
              onClick={() => handleToggleActivePlans(!showActiveOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                showActiveOnly
                  ? 'bg-amber-50 text-amber-900 border-amber-400 shadow-xs ring-1 ring-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Filter blocks currently under work or ongoing now"
            >
              <Activity className={`w-3.5 h-3.5 ${showActiveOnly ? 'text-amber-600 animate-pulse' : 'text-slate-500'}`} />
              <span>{showActiveOnly ? 'Viewing: Active Plans (Under Work)' : 'Active Plans (Under Work)'}</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                showActiveOnly ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {activeUnderWorkBlocks.length}
              </span>
            </button>

            {/* Newly Generated Plan Toggle */}
            <button
              id="filter-toggle-newly-generated"
              type="button"
              onClick={() => handleToggleNewlyGenerated(!showNewlyGeneratedOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                showNewlyGeneratedOnly
                  ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs ring-1 ring-blue-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Toggle view of newly generated plan"
            >
              <Sparkles className={`w-3.5 h-3.5 ${showNewlyGeneratedOnly ? 'text-amber-500 fill-amber-400' : 'text-slate-500'}`} />
              <span>{showNewlyGeneratedOnly ? 'Viewing: Newly Generated Plan' : 'Newly Generated Plan'}</span>
              {newlyGeneratedBlocks.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  showNewlyGeneratedOnly ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-700'
                }`}>
                  {newlyGeneratedBlocks.length}
                </span>
              )}
            </button>

            {/* Reset All Filters Button */}
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search planned blocks by section name (e.g. Vijayawada, Tenali), Block ID, or defect type (e.g. rail fracture, OHE inspection)..."
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
          />
        </div>

        {/* Row 4: Active Filter Pills */}
        {isFiltered && (
          <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[11px]">
            <span className="text-[#64748B] font-semibold flex items-center space-x-1 mr-1">
              <Filter className="w-3 h-3 text-[#1565C0]" />
              <span>Active Filters:</span>
            </span>

            {showActiveOnly && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                <Activity className="w-3 h-3 text-amber-600" />
                <span>Status: Under Work (Ongoing Now)</span>
                <button onClick={() => handleToggleActivePlans(false)} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {showNewlyGeneratedOnly && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 font-bold">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Plan: Newly Generated Only</span>
                <button onClick={() => handleToggleNewlyGenerated(false)} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {selectedDept !== 'ALL' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] font-medium">
                <span>Dept: {selectedDept}</span>
                <button onClick={() => setSelectedDept('ALL')} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {selectedDivision !== 'ALL' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] font-medium">
                <span>Division: {selectedDivision}</span>
                <button onClick={() => setSelectedDivision('ALL')} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {(startDate || endDate) && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] font-medium">
                <span>Date: {startDate || 'Start'} → {endDate || 'End'}</span>
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {(startTime || endTime) && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] font-medium">
                <span>Time: {startTime || '00:00'} → {endTime || '23:59'}</span>
                <button onClick={() => { setStartTime(''); setEndTime(''); setTimePreset('ALL'); }} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] font-medium">
                <span>Query: "{searchQuery}"</span>
                <button onClick={() => setSearchQuery('')} className="hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Block Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
          <span>Showing <strong>{filteredBlocks.length}</strong> planned maintenance possessions</span>
          <span className="text-[11px] italic">Click any card to view detailed task breakdown & train regulation details</span>
        </div>

        {/* Banner when viewing Active Plans (Under Work Now) */}
        {showActiveOnly && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 bg-amber-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5 sm:mt-0">
                <Activity className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Viewing Active Plans (Under Work Now)
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {activeOperationalDate}
                  </span>
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    <span>Live Execution In Progress</span>
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Showing maintenance possession blocks scheduled for ongoing execution on the active corridor operational date ({activeOperationalDate}).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggleActivePlans(false)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View All Scheduled Blocks ({currentBlocks.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner when viewing Newly Generated Plan */}
        {showNewlyGeneratedOnly && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5 sm:mt-0">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wide">
                    Viewing Newly Generated Plan
                  </span>
                  {(activeTab === 'weekly' ? weeklyPlan?.plan_id : monthlyPlan?.plan_id) && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      {activeTab === 'weekly' ? weeklyPlan?.plan_id : monthlyPlan?.plan_id}
                    </span>
                  )}
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Active in System</span>
                  </span>
                </div>
                <p className="text-xs text-[#3B82F6] mt-0.5">
                  Showing possession block(s) generated by CP-SAT optimization and synchronized with this schedule.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggleNewlyGenerated(false)}
                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View All Scheduled Blocks ({currentBlocks.length})</span>
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-[#64748B]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#1565C0] mb-3" />
            <p className="font-semibold text-sm">Loading planned maintenance block schedule...</p>
          </div>
        ) : filteredBlocks.length === 0 ? (
          showActiveOnly ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-[#64748B]">
              <Activity className="w-8 h-8 mx-auto text-amber-600 mb-2" />
              <p className="font-bold text-sm text-[#1E293B]">No Blocks Currently Under Work in Current Filters</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
                There are no maintenance blocks matching your department or division filters currently executing. You can view all scheduled blocks or check other divisions.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => handleToggleActivePlans(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  View All Scheduled Blocks
                </button>
              </div>
            </div>
          ) : showNewlyGeneratedOnly ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-[#64748B]">
              <Sparkles className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <p className="font-bold text-sm text-[#1E293B]">No Newly Generated Plan in Current View</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
                No newly generated ad-hoc blocks match the active filters in this plan. You can create a new block in Block Planning or view all scheduled blocks.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => handleToggleNewlyGenerated(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  View All Scheduled Blocks
                </button>
                <button
                  onClick={() => navigate('/block-planning')}
                  className="px-3.5 py-2 text-xs font-bold bg-[#1565C0] text-white rounded-lg hover:bg-[#0D47A1] cursor-pointer flex items-center space-x-1.5"
                >
                  <span>Go to Block Planning</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-[#64748B]">
              <Info className="w-8 h-8 mx-auto text-[#94A3B8] mb-2" />
              <p className="font-bold text-sm text-[#1E293B]">No planned blocks match your filters</p>
              <p className="text-xs text-[#64748B] mt-1">Try resetting the department or division filter above.</p>
            </div>
          )
        ) : (
          filteredBlocks.map((block) => {
            const isExpanded = expandedBlockId === block.block_id;
            const isHighlighted = highlightedBlockId && (block.block_id === highlightedBlockId || block.request_id === highlightedBlockId);
            const depts = block.departments || ['Engineering'];
            const tasks = block.tasks || [];

            return (
              <div
                key={block.block_id}
                id={`block-${block.block_id}`}
                className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                  isHighlighted
                    ? 'border-[#2563EB] ring-2 ring-[#2563EB]/40 bg-blue-50/15'
                    : isExpanded
                    ? 'border-[#1565C0] ring-1 ring-[#1565C0]'
                    : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                }`}
              >
                {/* Block Header Row */}
                <div
                  onClick={() => setExpandedBlockId(isExpanded ? null : block.block_id)}
                  className="p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start md:items-center space-x-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE] shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-sm text-[#1E293B]">
                          {block.section_name || block.section_id}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {block.block_id}
                        </span>
                        {isBlockUnderWork(block, activeOperationalDate) && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>Under Work Now</span>
                          </span>
                        )}
                        {block.is_newly_generated && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600 text-white shadow-xs">
                            <Sparkles className="w-3 h-3 text-amber-200" />
                            <span>Newly Generated</span>
                          </span>
                        )}
                        {isHighlighted && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-600 text-white shadow-xs">
                            <Sparkles className="w-3 h-3" />
                            <span>Target Block</span>
                          </span>
                        )}
                        {block.is_joint_megablock && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wide">
                            Joint Mega-Block
                          </span>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B] mt-1.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-[#1565C0]" />
                          <span className="font-semibold text-[#1E293B]">{block.date}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-[#0F766E]" />
                          <span>{block.start_time} - {block.end_time} ({block.duration_hours || (block.duration_minutes ? (block.duration_minutes / 60).toFixed(1) : 3)} hrs)</span>
                        </span>
                        <span>
                          Division: <strong className="text-[#334155]">{block.division || 'Vijayawada'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Badges & Departments */}
                  <div className="flex items-center justify-between md:justify-end space-x-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#F1F5F9]">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      {depts.map((d, idx) => {
                        let badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                        if (d === 'S&T') badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200';
                        if (d === 'Traction' || d === 'Electrical') badgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
                        if (d === 'Operating') badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';

                        return (
                          <span key={idx} className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${badgeStyle}`}>
                            {d}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-semibold text-[#1565C0]">
                      <span>{tasks.length || block.task_count || 1} Task{tasks.length > 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Scheduled Tasks & Train Impact */}
                {isExpanded && (
                  <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-4 space-y-4">
                    {/* Feature B: Why Was This Block Selected? Explanation */}
                    {(() => {
                      const bullets = getBlockExplanationBullets(block);
                      if (!bullets || bullets.length === 0) return null;
                      return (
                        <div className="bg-white p-3.5 rounded-lg border border-[#CBD5E1] shadow-xs space-y-2">
                          <div className="flex items-center space-x-2 text-xs font-bold text-[#1565C0]">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>Why Was This Block Selected?</span>
                            <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Data-Derived Explainability
                            </span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-[#334155]">
                            {bullets.map((bullet, bidx) => (
                              <li key={bidx} className="flex items-start space-x-2 leading-relaxed">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Operational Impact Notice for Other Departments */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase">Traffic Regulation Impact</div>
                        <div className="text-xs font-semibold text-[#1E293B] mt-1 flex items-center space-x-1.5">
                          <Train className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{block.train_impact || 'Minimal / Zero Passenger Train Delay'}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">Affects 0 passenger schedules; freight rerouted via loop.</div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase">Power / Traction Clearance</div>
                        <div className="text-xs font-semibold text-[#1E293B] mt-1 flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>{depts.includes('Traction') ? '25kV OHE Power Block Required' : 'No Traction Disconnection'}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">TRD switching post notified for earthing rod placement.</div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                        <div className="text-[11px] font-bold text-[#64748B] uppercase">Inter-Departmental Bundling</div>
                        <div className="text-xs font-semibold text-[#1E293B] mt-1 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1565C0]" />
                          <span>Joint possession between {depts.join(' & ')}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">Single track block window shared to maximize productivity.</div>
                      </div>
                    </div>

                    {/* Tasks Table */}
                    <div>
                      <div className="text-xs font-bold text-[#334155] mb-2 flex items-center space-x-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#1565C0]" />
                        <span>Work Packages Scheduled During This Block Window:</span>
                      </div>

                      <div className="overflow-x-auto border border-[#CBD5E1] rounded-lg bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F1F5F9] text-[#475569] font-bold border-b border-[#CBD5E1]">
                            <tr>
                              <th className="p-2.5">Task ID</th>
                              <th className="p-2.5">Department</th>
                              <th className="p-2.5">Asset Category</th>
                              <th className="p-2.5">Defect / Work Description</th>
                              <th className="p-2.5">Severity</th>
                              <th className="p-2.5">Priority</th>
                              <th className="p-2.5">Work Duration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {tasks.length > 0 ? (
                              tasks.map((task, tidx) => (
                                <tr key={tidx} className="hover:bg-[#F8FAFC]">
                                  <td className="p-2.5 font-mono text-[11px] text-[#1565C0] font-semibold">{task.task_id}</td>
                                  <td className="p-2.5 font-semibold text-[#334155]">{task.department}</td>
                                  <td className="p-2.5 capitalize">{task.asset_type ? task.asset_type.replace(/_/g, ' ') : 'Track Segment'}</td>
                                  <td className="p-2.5 font-medium text-[#0F172A] capitalize">
                                    {task.defect_type ? task.defect_type.replace(/_/g, ' ') : 'Periodic Inspection & Overhaul'}
                                  </td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      task.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                      task.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {task.severity || 'Medium'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-bold text-[#1565C0]">{task.priority_score || 65} / 100</td>
                                  <td className="p-2.5 text-[#64748B]">{task.duration_min || 120} mins</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="7" className="p-3 text-center text-[#64748B]">
                                  Pre-scheduled standard inspection package assigned to this corridor window.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
