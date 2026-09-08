import { useNavigate } from 'react-router-dom';
import {
  Layers, Calendar, Cpu, Activity, BarChart3, RotateCcw
} from 'lucide-react';

const features = [
  {
    to: '/intake',
    label: 'Data Integration',
    icon: Layers,
    description: 'Ingest and unify data from all railway source systems.',
    color: 'bg-[#EFF6FF] text-[#1565C0] border-[#BFDBFE]',
    iconColor: 'text-[#1565C0]',
  },
  {
    to: '/planning-board',
    label: 'Corridor View',
    icon: Calendar,
    description: 'Visualise corridor timelines and train blackout windows.',
    color: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
    iconColor: 'text-[#15803D]',
  },
  {
    to: '/optimizer',
    label: 'Block Planning',
    icon: Cpu,
    description: 'Run CP-SAT constraint optimisation across all corridors.',
    color: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
    iconColor: 'text-[#C2410C]',
  },
  {
    to: '/plans',
    label: 'Optimization',
    icon: Activity,
    description: 'Review weekly and monthly plans with human-in-the-loop approval.',
    color: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
    iconColor: 'text-[#7C3AED]',
  },
  {
    to: '/kpis',
    label: 'Reports',
    icon: BarChart3,
    description: 'Track KPIs and measure before vs after optimisation impact.',
    color: 'bg-[#ECFDF5] text-[#0F766E] border-[#99F6E4]',
    iconColor: 'text-[#0F766E]',
  },
  {
    to: '/audit-trail',
    label: 'Audit Trail',
    icon: RotateCcw,
    description: 'Immutable log of every decision, override, and approval.',
    color: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
    iconColor: 'text-[#B91C1C]',
  },
];

export default function HomeView() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-[#172033]">Welcome to Train Block System</h1>
        <p className="text-sm text-[#5B6575] mt-1">Select a feature below to get started.</p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map(({ to, label, icon: Icon, description, color, iconColor }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`text-left w-full border rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${color}`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <span className="text-base font-bold">{label}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-80">{description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
