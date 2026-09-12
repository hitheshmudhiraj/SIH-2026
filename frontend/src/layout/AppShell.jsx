import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Layers, Calendar,
  BarChart3, Train,
  LogOut, Cpu, Users, ChevronRight, Bell, User, Settings
} from 'lucide-react';
import {
  fetchNotifications,
  checkReminders,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../api';
import NotificationPanel from '../components/NotificationPanel';

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  // Load and refresh notifications, checking due reminders
  const loadNotifications = useCallback(async (checkRemindersFirst = true) => {
    try {
      setIsLoadingNotifications(true);
      if (checkRemindersFirst) {
        await checkReminders().catch(() => null);
      }
      const res = await fetchNotifications(100).catch(() => null);
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      console.warn('Could not load notifications:', e);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    // Initial load on mount
    loadNotifications(true);

    // Periodic lightweight check every 60 seconds (no heavy polling)
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 60000);

    // Check when active plan changes or route updates
    const handlePlanUpdated = () => {
      loadNotifications(true);
    };
    window.addEventListener('railblock_active_plan_updated', handlePlanUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('railblock_active_plan_updated', handlePlanUpdated);
    };
  }, [loadNotifications]);

  const handleMarkSingleRead = async (notifId) => {
    try {
      await markNotificationAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/block-planning', label: 'Block Planning', icon: Cpu },
    { to: '/intake', label: 'Data Integration', icon: Layers },
    { to: '/planning-board', label: 'Corridor View', icon: Calendar },
    { to: '/department-schedule', label: 'Department Schedule', icon: Users },
    { to: '/kpis', label: 'Reports', icon: BarChart3 }
  ];

  return (
    <div className="flex h-screen bg-[#F5F8FC] text-[#16243A] overflow-hidden font-sans">
      {/* LEFT SIDEBAR - Clean White Professional with Collapse Capability */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-[#DCE5EF] flex flex-col justify-between shrink-0 z-30 transition-all duration-250 ease-in-out shadow-[0_2px_12px_rgba(30,60,90,0.04)]`}
      >
        <div>
          {/* Logo & Platform Info with Collapse Button */}
          <div className={`p-4 border-b border-[#E2E8F0] flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center space-x-3 min-w-0">
              <div className="bg-gradient-to-br from-[#1565C0] to-[#0F766E] p-2.5 rounded-xl shadow-xs shrink-0">
                <Train className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#16243A] tracking-tight truncate">
                    Train Block System
                  </div>
                  <div className="text-[10px] font-semibold text-[#66758A] uppercase tracking-wider">
                    SCoR Operations
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse Sidebar"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1565C0] hover:bg-[#EFF6FF] transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
          </div>

          {/* Expand toggle when collapsed */}
          {sidebarCollapsed && (
            <div className="flex justify-center py-2 border-b border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand Sidebar"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1565C0] hover:bg-[#EFF6FF] transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Section Navigation Links */}
          <nav className="p-3 space-y-1.5">
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
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-3.5 py-2.5'
                  } rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#1565C0] shadow-xs'
                      : 'text-[#64748B] hover:text-[#16243A] hover:bg-[#F8FAFC]'
                  }`}
                  style={isActive && !sidebarCollapsed ? { borderLeft: '3px solid #1565C0' } : {}}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1565C0]' : 'text-[#7A8494]'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: System Status & User */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-2">
          {/* System Status */}
          {!sidebarCollapsed ? (
            <div className="px-3 py-2 bg-white rounded-xl border border-[#E2E8F0] text-xs shadow-2xs">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse shrink-0" />
                <span className="text-[#5B6575] font-medium text-[11px] truncate">All systems operational</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-1" title="All systems operational">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-pulse" />
            </div>
          )}

          {/* User Profile — Click to open popover menu */}
          {user && (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(prev => !prev)}
                title={sidebarCollapsed ? `${user.displayName || user.username || 'User'} (${user.role || 'Planning Officer'})` : "Profile & Account Options"}
                className={`w-full rounded-xl border transition-all flex items-center group cursor-pointer ${
                  sidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2 justify-between'
                } ${
                  profileMenuOpen || location.pathname === '/profile'
                    ? 'bg-[#EFF6FF] border-[#1565C0] ring-1 ring-[#1565C0]/20'
                    : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-slate-50'
                }`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-2.5 min-w-0 pr-1'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${
                    profileMenuOpen || location.pathname === '/profile'
                      ? 'bg-[#1565C0] text-white'
                      : 'bg-blue-100 text-[#1565C0] group-hover:bg-[#1565C0] group-hover:text-white'
                  }`}>
                    {(user.displayName || user.username || 'AD').slice(0, 2).toUpperCase()}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 text-left">
                      <p className={`text-xs font-bold truncate ${
                        profileMenuOpen || location.pathname === '/profile' ? 'text-[#1565C0]' : 'text-[#16243A]'
                      }`}>
                        {user.displayName || (user.username ? (user.username.charAt(0).toUpperCase() + user.username.slice(1)) : 'Officer')}
                      </p>
                      <p className="text-[10px] text-[#7A8494] truncate">
                        {user.role || 'Senior Planning Officer'}
                      </p>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" title="Active Session" />
                    <ChevronRight className={`w-3.5 h-3.5 transition-all ${profileMenuOpen ? 'rotate-90 text-[#1565C0]' : 'text-[#94A3B8] group-hover:text-[#1565C0]'}`} />
                  </div>
                )}
              </button>

              {/* Profile Popover Menu */}
              {profileMenuOpen && (
                <div
                  className={`absolute bottom-full ${sidebarCollapsed ? 'left-0 w-56' : 'left-0 right-0'} mb-2 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 overflow-hidden`}
                  style={{ boxShadow: '0 8px 32px rgba(22,36,58,0.12)' }}
                >
                  {/* User header */}
                  <div className="px-4 py-3 border-b border-[#F1F5F9]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#1565C0] text-white flex items-center justify-center text-xs font-black shrink-0">
                        {(user.displayName || user.username || 'AD').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#16243A] truncate">
                          {user.displayName || (user.username ? (user.username.charAt(0).toUpperCase() + user.username.slice(1)) : 'Admin')}
                        </p>
                        <p className="text-[10px] text-[#7A8494] truncate">{user.role || 'Senior Planning Officer'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#16243A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#16243A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Account Settings</span>
                    </Link>
                  </div>
                  {/* Divider + Sign Out (Exclusively inside the menu) */}
                  <div className="border-t border-[#F1F5F9] py-1">
                    <button
                      onClick={() => { setProfileMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="h-14 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-[#1565C0] uppercase tracking-wider bg-[#EFF6FF] px-2.5 py-1 rounded border border-[#DBEAFE]">
              Centralized Block Planning
            </span>
            <span className="hidden sm:inline text-xs text-[#64748B]">
              South Coast Railway (SCoR) • Decision Support
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* 🔔 Notifications Toggle with Badge */}
            <button
              id="notifications-toggle-btn"
              onClick={() => setIsNotificationPanelOpen((prev) => !prev)}
              className={`relative flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isNotificationPanelOpen
                  ? 'bg-[#EFF6FF] text-[#1565C0] border-[#1565C0] shadow-2xs'
                  : 'bg-white text-[#5B6575] hover:text-[#172033] border-[#E2E8F0] hover:bg-[#F8FAFC]'
              }`}
              title="In-App Notifications & Reminders"
            >
              <div className="relative flex items-center justify-center">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    id="notifications-badge"
                    className="absolute -top-2 -right-2.5 bg-[#DC2626] text-white text-[9px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold hidden sm:inline">
                Notifications
              </span>
            </button>
          </div>
        </header>

        {/* Page Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA]">
          <Outlet />
        </main>
      </div>

      {/* In-App Notification Slide-over Panel */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={handleMarkSingleRead}
        onMarkAllAsRead={handleMarkAllRead}
        onRefresh={() => loadNotifications(true)}
        isLoading={isLoadingNotifications}
      />
    </div>
  );
}

