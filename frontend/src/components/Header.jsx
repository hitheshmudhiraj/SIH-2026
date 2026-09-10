import React from 'react';
import { 
  Train, Cpu, AlertTriangle, RotateCcw, Activity, 
  Layers, CheckCircle2, Calendar, FileText, GitCompare 
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  onRunOptimizer, 
  onSimulateEmergency, 
  onResetDemo,
  isOptimizing,
  planStatus,
  planVersion
}) {
  const navItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: Activity },
    { id: 'silos', label: '5 Siloed Systems', icon: Layers },
    { id: 'priority', label: 'Priority Intelligence', icon: CheckCircle2 },
    { id: 'conflicts', label: 'Conflicts & Grouping', icon: AlertTriangle },
    { id: 'gantt', label: 'Gantt Planning Board', icon: Calendar },
    { id: 'review', label: 'Planner Review & Approval', icon: FileText },
    { id: 'replan', label: 'Dynamic Re-planning', icon: GitCompare }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Branding */}
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-amber-500 to-rose-600 p-2.5 rounded-xl shadow-lg flex items-center justify-center text-white">
            <Train className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black tracking-tight text-white m-0">Train Block System</h1>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                CP-SAT 9.15
              </span>
              {planVersion > 0 && (
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold px-2 py-0.5 rounded-md">
                  Plan V{planVersion} ({planStatus})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 m-0">
              Indian Railways Coordinated Maintenance Decision-Support • Northern & Western Zones
            </p>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onRunOptimizer}
            disabled={isOptimizing}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-md transition-all cursor-pointer"
          >
            <Cpu className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Optimizing CP-SAT...' : 'Run CP-SAT Optimizer'}</span>
          </button>

          <button
            onClick={onSimulateEmergency}
            className="flex items-center space-x-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-md transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Simulate Emergency Rail Fracture</span>
          </button>

          <button
            onClick={onResetDemo}
            title="Reset to clean baseline synthetic dataset"
            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-2 rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-950/70 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <nav className="max-w-7xl mx-auto flex space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
