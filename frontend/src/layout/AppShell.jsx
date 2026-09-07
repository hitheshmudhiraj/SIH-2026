import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Layers, Calendar, Cpu, 
  FileCheck, BarChart3, RotateCcw, Train, 
  ShieldAlert, AlertTriangle, RefreshCw, LogOut
} from 'lucide-react';

export default function AppShell({ 
  onRunOptimizer, 
  onSimulateEmergency, 
  onResetDemo, 
  isOptimizing,
  currentPlan,
  planStatus,
  planVersion,
  onLogout,
  user
}) {
  const location = useLocation();

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tag: 'Stage 1' },
    { to: '/intake', label: 'Intake (5 Siloed Systems)', icon: Layers, tag: 'TMS/SMMS/TDMS' },
    { to: '/planning-board', label: 'Planning Board (Gantt)', icon: Calendar, tag: 'Corridors' },
    { to: '/optimizer', label: 'Optimizer (CP-SAT)', icon: Cpu, tag: 'Math Model' },
    { to: '/plans', label: 'Weekly/Monthly Plans', icon: FileCheck, tag: 'Human Review' },
    { to: '/kpis', label: 'KPI Comparison', icon: BarChart3, tag: 'Before vs After' },
    { to: '/audit-trail', label: 'Audit Trail', icon: RotateCcw, tag: 'Immutable Log' }
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 z-30">
        <div>
          {/* Logo & Platform Info */}
          <div className="p-4 border-b border-slate-800/80 flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-500 to-rose-600 p-2 rounded-xl shadow-lg text-white">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-tight flex items-center space-x-1.5">
                <span>Train Block System</span>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-mono px-1.5 py-0.2 rounded">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Indian Railways Decision Support
              </p>
            </div>
          </div>

          {/* Section Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
              Control-Room Sections
            </div>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || (item.to === '/dashboard' && location.pathname === '/');
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                    isActive ? 'bg-blue-800/60 text-blue-100' : 'text-slate-500'
                  }`}>
                    {item.tag}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: User & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5">
          {user && (
            <div className="px-2 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white truncate">
                  {user.username ? (user.username.charAt(0).toUpperCase() + user.username.slice(1)) : 'Officer'}
                </p>
                <p className="text-[10px] text-slate-400 truncate font-mono">
                  {user.role || user.zone || 'Indian Railways'}
                </p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Active Session" />
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/25 hover:border-rose-600 transition-all cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Safety Bar & Control Strip */}
        <header className="bg-slate-900 border-b border-slate-800 z-20 shrink-0">
          {/* Permanent Safety Badge Banner (Required on every screen) */}
          <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black tracking-wide text-amber-300 uppercase font-mono">
                PROTOTYPE — Simulated Data — Human Approval Required
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-[11px] text-slate-400">
              <span>Final block authorization remains strictly with Railway Section Controllers.</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-6 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-slate-400">Current Plan:</span>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold px-2.5 py-0.5 rounded-md font-mono">
                Plan V{planVersion || 1} ({planStatus || 'OPTIMIZED'})
              </span>
            </div>

            {/* Global Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onRunOptimizer}
                disabled={isOptimizing}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow cursor-pointer"
              >
                <Cpu className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
                <span>{isOptimizing ? 'Solving CP-SAT...' : 'Run CP-SAT Optimizer'}</span>
              </button>

              <button
                onClick={onSimulateEmergency}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Rail Fracture</span>
              </button>

              <button
                onClick={onResetDemo}
                title="Reset demo data"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </header>

        {/* 3. Page Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
