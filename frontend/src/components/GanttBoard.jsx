import React, { useState } from 'react';
import { Calendar, Clock, Layers, AlertCircle, Train, CheckCircle2, ChevronRight, Edit3 } from 'lucide-react';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const CORRIDORS = [
  { id: 'C1', code: 'NDLS-GZB', name: 'New Delhi – Ghaziabad' },
  { id: 'C2', code: 'NDLS-PWL', name: 'New Delhi – Palwal' },
  { id: 'C3', code: 'BRC-ST', name: 'Vadodara – Surat' },
  { id: 'C4', code: 'HWH-BWN', name: 'Howrah – Bardhaman' },
  { id: 'C5', code: 'MAS-AJJ', name: 'Chennai – Arakkonam' },
  { id: 'C6', code: 'PNVL-ROHA', name: 'Panvel – Roha' },
];

export default function GanttBoard({ currentPlan, onModifyClick }) {
  const [selectedDay, setSelectedDay] = useState('Tuesday');
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);

  const planItems = currentPlan?.items || [];
  const dayItems = planItems.filter(it => it.day_of_week === selectedDay);

  // Timetable blackout train windows for visualization
  const timetableBlackouts = [
    { corridor_id: 'C1', day: 'Monday', start: 360, end: 450, train: 'Vande Bharat #22436', type: 'VANDE_BHARAT' },
    { corridor_id: 'C1', day: 'Tuesday', start: 370, end: 460, train: 'Lucknow Shatabdi #12004', type: 'SHATABDI' },
    { corridor_id: 'C2', day: 'Monday', start: 990, end: 1080, train: 'Mumbai Rajdhani #12952', type: 'RAJDHANI' },
    { corridor_id: 'C3', day: 'Wednesday', start: 420, end: 510, train: 'Vande Bharat #20901', type: 'VANDE_BHARAT' },
    { corridor_id: 'C4', day: 'Thursday', start: 1000, end: 1090, train: 'Howrah Rajdhani #12301', type: 'RAJDHANI' },
    { corridor_id: 'C5', day: 'Friday', start: 330, end: 420, train: 'Vande Bharat #20607', type: 'VANDE_BHARAT' },
  ];

  const dayBlackouts = timetableBlackouts.filter(t => t.day === selectedDay);

  // Time grid hours: 00:00 to 24:00 (increments of 2 hours)
  const hourMarkers = Array.from({ length: 13 }, (_, i) => i * 2);

  const getDepartmentColor = (depId) => {
    switch (depId) {
      case 'DEP_TRACK':
        return 'bg-rose-500/20 border-rose-500 text-rose-300';
      case 'DEP_SIGNAL':
        return 'bg-blue-500/20 border-blue-500 text-blue-300';
      case 'DEP_TRD':
        return 'bg-amber-500/20 border-amber-500 text-amber-300';
      case 'DEP_BRIDGE':
        return 'bg-purple-500/20 border-purple-500 text-purple-300';
      case 'DEP_OPS':
        return 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
      default:
        return 'bg-slate-700/50 border-slate-500 text-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Day Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 text-xs font-semibold mb-1">
            <Calendar className="w-4 h-4" />
            <span>Interactive Visual Corridor Timeline</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Gantt Block Planning Board
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Corridors plotted on the vertical axis against a 24-hour daily timeline. Shows passenger train blackout zones, consolidated megablocks, and joint multi-department tasks.
          </p>
        </div>

        {/* Day Pills */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
          {DAYS.map((day) => {
            const countForDay = planItems.filter(it => it.day_of_week === day).length;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {countForDay > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-blue-200' : 'bg-slate-800 text-slate-300'}`}>
                    {countForDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gantt Timeline Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl overflow-x-auto">
        <div className="min-w-[850px]">
          {/* Hour Markers Bar */}
          <div className="grid grid-cols-12 border-b border-slate-800 pb-2 mb-3 pl-44 pr-2 text-slate-500 font-mono text-[11px]">
            {hourMarkers.slice(0, 12).map((h) => (
              <div key={h} className="text-left">
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Corridor Rows */}
          <div className="space-y-3">
            {CORRIDORS.map((corridor) => {
              const corridorTasks = dayItems.filter(it => it.corridor_id === corridor.id);
              const corridorBlackout = dayBlackouts.filter(b => b.corridor_id === corridor.id);

              return (
                <div 
                  key={corridor.id}
                  className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 relative group hover:border-slate-700 transition-colors"
                >
                  {/* Left Corridor Header */}
                  <div className="w-44 shrink-0 pr-3 border-r border-slate-800/80">
                    <div className="font-bold text-white text-xs font-mono">{corridor.code}</div>
                    <div className="text-[11px] text-slate-400 truncate">{corridor.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                      {corridorTasks.length} task{corridorTasks.length === 1 ? '' : 's'} scheduled
                    </div>
                  </div>

                  {/* 24-Hour Track Timeline Area */}
                  <div className="relative flex-1 h-16 bg-slate-900/40 rounded-lg mx-2 overflow-hidden border border-slate-800/40">
                    {/* Hour grid vertical lines */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border-r border-slate-800/30 h-full" />
                      ))}
                    </div>

                    {/* Passenger Train Blackout Strip (Timetable restriction) */}
                    {corridorBlackout.map((b, idx) => {
                      const leftPct = (b.start / 1440) * 100;
                      const widthPct = ((b.end - b.start) / 1440) * 100;
                      return (
                        <div
                          key={idx}
                          title={`Passenger Train Blackout: ${b.train}`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          className="absolute top-0 bottom-0 bg-red-950/40 border-x border-red-500/40 flex items-center justify-center overflow-hidden pointer-events-auto"
                        >
                          <div className="text-[9px] text-red-400 font-bold font-mono px-1 truncate flex items-center space-x-1">
                            <Train className="w-3 h-3 shrink-0" />
                            <span>{b.train}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Scheduled Maintenance Blocks */}
                    {corridorTasks.map((task) => {
                      const leftPct = (task.scheduled_start_minute / 1440) * 100;
                      const widthPct = (task.duration_minutes / 1440) * 100;
                      const colorClass = getDepartmentColor(task.department_id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedItemDetail(task)}
                          style={{
                            left: `${Math.max(0, leftPct)}%`,
                            width: `${Math.max(6, widthPct)}%`
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 p-1.5 flex flex-col justify-between shadow-md cursor-pointer transition-transform hover:scale-[1.02] hover:z-20 ${colorClass}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold font-mono truncate">
                              {task.start_time_formatted} - {task.end_time_formatted}
                            </span>
                            {task.is_shadow_block && (
                              <span className="text-[8px] bg-purple-500 text-white font-bold px-1 rounded">
                                JOINT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold truncate leading-tight">
                            {task.work_title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Task Detail Drawer / Modal */}
      {selectedItemDetail && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400">{selectedItemDetail.work_item_id}</span>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                Priority: {selectedItemDetail.priority_score}/100 ({selectedItemDetail.priority_tier})
              </span>
              {selectedItemDetail.is_shadow_block && (
                <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                  Multi-Department Joint Block
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-white">{selectedItemDetail.work_title}</h4>
            <div className="text-xs text-slate-400">
              {selectedItemDetail.corridor_name} • {selectedItemDetail.day_of_week} ({selectedItemDetail.start_time_formatted} - {selectedItemDetail.end_time_formatted})
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onModifyClick(selectedItemDetail);
                setSelectedItemDetail(null);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modify Slot (Human-in-the-Loop)</span>
            </button>
            <button
              onClick={() => setSelectedItemDetail(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
