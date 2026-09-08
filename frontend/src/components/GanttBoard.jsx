import { useState } from 'react';
import { Calendar, Clock, Train, Edit3, X } from 'lucide-react';

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

  const timetableBlackouts = [
    { corridor_id: 'C1', day: 'Monday', start: 360, end: 450, train: 'Vande Bharat #22436', type: 'VANDE_BHARAT' },
    { corridor_id: 'C1', day: 'Tuesday', start: 370, end: 460, train: 'Lucknow Shatabdi #12004', type: 'SHATABDI' },
    { corridor_id: 'C2', day: 'Monday', start: 990, end: 1080, train: 'Mumbai Rajdhani #12952', type: 'RAJDHANI' },
    { corridor_id: 'C3', day: 'Wednesday', start: 420, end: 510, train: 'Vande Bharat #20901', type: 'VANDE_BHARAT' },
    { corridor_id: 'C4', day: 'Thursday', start: 1000, end: 1090, train: 'Howrah Rajdhani #12301', type: 'RAJDHANI' },
    { corridor_id: 'C5', day: 'Friday', start: 330, end: 420, train: 'Vande Bharat #20607', type: 'VANDE_BHARAT' },
  ];

  const dayBlackouts = timetableBlackouts.filter(t => t.day === selectedDay);
  const hourMarkers = Array.from({ length: 13 }, (_, i) => i * 2);

  const getDepartmentColor = (depId) => {
    switch (depId) {
      case 'DEP_TRACK':
        return 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]';
      case 'DEP_SIGNAL':
        return 'bg-[#EFF6FF] border-[#1565C0] text-[#1E40AF]';
      case 'DEP_TRD':
        return 'bg-[#FFFBEB] border-[#CA8A04] text-[#854D0E]';
      case 'DEP_BRIDGE':
        return 'bg-[#F5F3FF] border-[#7C3AED] text-[#6B21A8]';
      case 'DEP_OPS':
        return 'bg-[#F0FDF4] border-[#15803D] text-[#14532D]';
      default:
        return 'bg-[#F8FAFC] border-[#64748B] text-[#334155]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
            <Calendar className="w-4 h-4" />
            <span>AUTOMATIC BLOCK PLANNING</span>
          </div>
          <h3 className="text-xl font-bold text-[#172033]">
            Corridor Timeline Planning Board
          </h3>
          <p className="text-xs text-[#7A8494] max-w-2xl mt-1">
            Visual planning interface showing maintenance blocks across corridors with train movement constraints
          </p>
        </div>

        {/* Day Selector */}
        <div className="flex bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0] overflow-x-auto">
          {DAYS.map((day) => {
            const countForDay = planItems.filter(it => it.day_of_week === day).length;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[#1565C0] text-white shadow-sm'
                    : 'text-[#7A8494] hover:text-[#172033] hover:bg-white'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {countForDay > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#0D47A1] text-white' : 'bg-white text-[#7A8494] border border-[#E2E8F0]'}`}>
                    {countForDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gantt Timeline */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm overflow-x-auto">
        <div className="min-w-[850px]">
          {/* Hour Markers */}
          <div className="grid grid-cols-12 border-b border-[#E2E8F0] pb-2 mb-3 pl-44 pr-2 text-[#7A8494] text-[11px] font-semibold">
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
                  className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 relative group hover:border-[#CBD5E1] transition-colors"
                >
                  {/* Corridor Label */}
                  <div className="w-44 shrink-0 pr-3 border-r border-[#E2E8F0]">
                    <div className="font-bold text-[#172033] text-xs">{corridor.code}</div>
                    <div className="text-[11px] text-[#7A8494] truncate">{corridor.name}</div>
                    <div className="text-[10px] text-[#7A8494] mt-0.5">
                      {corridorTasks.length} task{corridorTasks.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  {/* Timeline Area */}
                  <div className="relative flex-1 h-16 bg-white rounded-lg mx-2 overflow-hidden border border-[#E2E8F0]">
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border-r border-[#F1F5F9] h-full" />
                      ))}
                    </div>

                    {/* Train Blackout Windows */}
                    {corridorBlackout.map((b, idx) => {
                      const leftPct = (b.start / 1440) * 100;
                      const widthPct = ((b.end - b.start) / 1440) * 100;
                      return (
                        <div
                          key={idx}
                          title={`Passenger Train: ${b.train}`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          className="absolute top-0 bottom-0 bg-[#FFFBEB] border-x border-[#FED7AA] flex items-center justify-center overflow-hidden pointer-events-auto"
                        >
                          <div className="text-[9px] text-[#B45309] font-bold px-1 truncate flex items-center space-x-1">
                            <Train className="w-3 h-3 shrink-0" />
                            <span>{b.train}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Maintenance Blocks */}
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
                          className={`absolute top-1.5 bottom-1.5 rounded-md border-2 p-1.5 flex flex-col justify-between shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:z-20 ${colorClass}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold truncate">
                              {task.start_time_formatted} - {task.end_time_formatted}
                            </span>
                            {task.is_shadow_block && (
                              <span className="text-[8px] bg-[#7C3AED] text-white font-bold px-1 rounded">
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

      {/* Selected Task Detail Panel */}
      {selectedItemDetail && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#7A8494]">{selectedItemDetail.work_item_id}</span>
              <span className="text-xs font-bold text-[#B45309] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FED7AA]">
                Priority: {selectedItemDetail.priority_score}/100 ({selectedItemDetail.priority_tier})
              </span>
              {selectedItemDetail.is_shadow_block && (
                <span className="text-xs font-bold text-[#7C3AED] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#DDD6FE]">
                  Multi-Department Joint Block
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-[#172033]">{selectedItemDetail.work_title}</h4>
            <div className="text-xs text-[#7A8494]">
              {selectedItemDetail.corridor_name} • {selectedItemDetail.day_of_week} ({selectedItemDetail.start_time_formatted} - {selectedItemDetail.end_time_formatted})
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onModifyClick(selectedItemDetail);
                setSelectedItemDetail(null);
              }}
              className="bg-[#1565C0] hover:bg-[#0D47A1] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modify Schedule</span>
            </button>
            <button
              onClick={() => setSelectedItemDetail(null)}
              className="bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#5B6575] text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer border border-[#E2E8F0]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
