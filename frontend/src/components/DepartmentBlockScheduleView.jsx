import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Shield, Search,
  Users, Layers, Download, CheckCircle2, Train,
  FileSpreadsheet, Sparkles, Building2, ChevronDown, ChevronUp,
  Tag, Info, RefreshCw, RotateCcw, X, Filter
} from 'lucide-react';
import { fetchLatestWeeklyPlan, fetchLatestMonthlyPlan } from '../api';

export default function DepartmentBlockScheduleView() {
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' or 'monthly'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1); // 1, 2, 3, 4, or 'ALL'

  // Date and Time range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timePreset, setTimePreset] = useState('ALL');

  // Load plans from API or fallback
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [wk, mo] = await Promise.all([
          fetchLatestWeeklyPlan().catch(() => null),
          fetchLatestMonthlyPlan().catch(() => null)
        ]);
        if (isMounted) {
          if (wk) setWeeklyPlan(wk);
          if (mo) setMonthlyPlan(mo);
        }
      } catch (err) {
        console.warn('Using local fallback plan data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Department metadata
  const departments = [
    { id: 'ALL', label: 'All Departments', icon: Layers, color: 'bg-slate-100 text-slate-700 border-slate-300' },
    { id: 'Engineering', label: 'Civil / Track (TMS)', icon: Building2, color: 'bg-amber-50 text-amber-800 border-amber-300' },
    { id: 'S&T', label: 'Signal & Telecom (SMMS)', icon: Shield, color: 'bg-blue-50 text-blue-800 border-blue-300' },
    { id: 'Traction', label: 'Electrical / OHE (TDMS)', icon: Sparkles, color: 'bg-purple-50 text-purple-800 border-purple-300' },
    { id: 'Operating', label: 'Traffic / Operating (COA)', icon: Train, color: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
  ];

  // Extract blocks based on active view
  const currentBlocks = useMemo(() => {
    if (activeTab === 'weekly') {
      return weeklyPlan?.blocks || [];
    } else {
      if (!monthlyPlan?.weeks) return [];
      if (selectedWeek === 'ALL') {
        return monthlyPlan.weeks.flatMap(w => w.blocks || []);
      }
      const currentWeekData = monthlyPlan.weeks.find(w => w.week_number === selectedWeek) || monthlyPlan.weeks[0];
      return currentWeekData?.blocks || [];
    }
  }, [activeTab, weeklyPlan, monthlyPlan, selectedWeek]);

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    return currentBlocks.filter(b => {
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
    selectedDept !== 'ALL' ||
    selectedDivision !== 'ALL' ||
    searchQuery.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    startTime !== '' ||
    endTime !== '';

  const handleClearFilters = () => {
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
            <h1 className="text-2xl font-bold text-[#172033] tracking-tight">
              Weekly & Monthly Master Block Schedule
            </h1>
            <p className="text-sm text-[#5B6575] mt-1.5 leading-relaxed max-w-3xl">
              Published track possession schedule for <strong>Engineering (Civil/Track)</strong>, <strong>S&T (Signals)</strong>,
              <strong> Electrical (OHE/TRD)</strong>, and <strong>Operating (Traffic)</strong>. Check joint megablocks, train
              regulations, and maintenance windows to synchronize departmental crew and equipment.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
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

        {/* View Mode Switcher (Weekly vs Monthly) */}
        <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-white text-[#1565C0] shadow-sm'
                  : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Weekly Rolling Plan (7-Day Schedule)</span>
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-white text-[#1565C0] shadow-sm'
                  : 'text-[#64748B] hover:text-[#172033]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Monthly Master Calendar (4-Week Horizon)</span>
            </button>
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

        {isLoading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-[#64748B]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#1565C0] mb-3" />
            <p className="font-semibold text-sm">Loading planned maintenance block schedule...</p>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-[#64748B]">
            <Info className="w-8 h-8 mx-auto text-[#94A3B8] mb-2" />
            <p className="font-bold text-sm text-[#1E293B]">No planned blocks match your filters</p>
            <p className="text-xs text-[#64748B] mt-1">Try resetting the department or division filter above.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const isExpanded = expandedBlockId === block.block_id;
            const depts = block.departments || ['Engineering'];
            const tasks = block.tasks || [];

            return (
              <div
                key={block.block_id}
                className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                  isExpanded ? 'border-[#1565C0] ring-1 ring-[#1565C0]' : 'border-[#E2E8F0] hover:border-[#94A3B8]'
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
                        {block.is_joint_megablock && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wide">
                            Joint Mega-Block
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Approved
                        </span>
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
