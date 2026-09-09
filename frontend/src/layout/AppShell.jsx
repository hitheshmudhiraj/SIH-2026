import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Layers, Calendar,
  BarChart3, RotateCcw, Train,
  LogOut, Cpu, Users
} from 'lucide-react';

export default function AppShell({
  onRunOptimizer,
  onSimulateEmergency,
  onResetDemo,
  isOptimizing,
  planStatus,
  planVersion,
  onLogout,
  user
}) {
  const location = useLocation();

  const navLinks = [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/block-planning', label: 'Block Planning', icon: Cpu },
    { to: '/intake', label: 'Data Integration', icon: Layers },
    { to: '/planning-board', label: 'Corridor View', icon: Calendar },
    { to: '/department-schedule', label: 'Department Schedule', icon: Users },
    { to: '/kpis', label: 'Reports', icon: BarChart3 },
    { to: '/audit-trail', label: 'Audit Trail', icon: RotateCcw }
  ];

  return (
    <div className="flex h-screen bg-[#F5F7FA] text-[#172033] overflow-hidden font-sans">
      {/* LEFT SIDEBAR - Clean White Professional */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between shrink-0 z-30 shadow-sm">
        <div>
          {/* Logo & Platform Info */}
          <div className="p-5 border-b border-[#E2E8F0]">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-gradient-to-br from-[#1565C0] to-[#0F766E] p-2 rounded-lg shadow-sm">
                <Train className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-[#172033] tracking-tight">
                  Train Block System
                </div>
              </div>
            </div>
          </div>

          {/* Section Navigation Links */}
          <nav className="p-3 space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to ||
                (item.to === '/dashboard' && location.pathname === '/') ||
                (item.to === '/block-planning' && location.pathname === '/optimizer') ||
                (item.to === '/department-schedule' && (location.pathname === '/plans' || location.pathname === '/weekly-monthly-plans'));
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#1565C0] border-l-3 border-[#1565C0] shadow-sm'
                      : 'text-[#5B6575] hover:text-[#172033] hover:bg-[#F8FAFC]'
                  }`}
                  style={isActive ? { borderLeft: '3px solid #1565C0' } : {}}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1565C0]' : 'text-[#7A8494]'}`} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: System Status & User */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
          {/* System Status */}
          <div className="px-3 py-2 bg-white rounded-lg border border-[#E2E8F0] text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
              <span className="text-[#5B6575] font-medium">All systems operational</span>
            </div>
          </div>

          {/* User Info */}
          {user && (
            <div className="px-3 py-2 bg-white rounded-lg border border-[#E2E8F0] flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-[#172033] truncate">
                  {user.username ? (user.username.charAt(0).toUpperCase() + user.username.slice(1)) : 'Officer'}
                </p>
                <p className="text-[10px] text-[#7A8494] truncate">
                  {user.role || user.zone || 'Indian Railways'}
                </p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#15803D] shrink-0" title="Active Session" />
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#B91C1C] hover:text-white bg-[#FEF2F2] hover:bg-[#B91C1C] border border-[#FECACA] hover:border-[#B91C1C] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
