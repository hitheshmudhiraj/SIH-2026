import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, ShieldCheck, CheckCircle2, Clock, Calendar, 
  Building2, Layers, Train, MapPin, Bell, LogOut, 
  Edit3, ExternalLink, ChevronRight, Check, X,
  Shield, KeyRound, Monitor, FileText, Activity,
  Sparkles, AlertTriangle, ArrowRight, RefreshCw
} from 'lucide-react';

export default function ProfileView({ user: propUser, onLogout }) {
  const navigate = useNavigate();

  // Load authenticated user from props or sessionStorage safely
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('railblock_user');
      return saved ? JSON.parse(saved) : propUser || null;
    } catch {
      return propUser || null;
    }
  });

  // Keep state in sync with sessionStorage
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = sessionStorage.getItem('railblock_user');
        if (saved) setUser(JSON.parse(saved));
      } catch (err) {
        console.warn('Error reading sessionStorage:', err);
      }
    };
    window.addEventListener('railblock_user_updated', handleStorageChange);
    return () => window.removeEventListener('railblock_user_updated', handleStorageChange);
  }, []);

  // Check if session exists
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Load latest plan from localStorage if available
  const [latestPlan, setLatestPlan] = useState(() => {
    try {
      const saved = localStorage.getItem('railblock_latest_generated_plan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Modal / Drawer state for Edit Profile
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Editable Profile Form State
  const [editForm, setEditForm] = useState({
    displayName: user?.displayName || (user?.username ? user.username.toUpperCase() : 'ADMINISTRATOR'),
    designation: user?.role || 'Senior Planning Officer',
    zone: user?.zone || 'Central Railway',
    divisions: user?.divisions || ['Vijayawada', 'Guntur', 'Visakhapatnam'],
    notifications: user?.notifications || {
      planGenerated: true,
      optCompleted: true,
      conflictDetected: true,
      approvalRequired: true,
      scheduleUpdated: false
    }
  });

  // Sync edit form when user changes
  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.displayName || (user.username ? user.username.toUpperCase() : 'ADMINISTRATOR'),
        designation: user.role || 'Senior Planning Officer',
        zone: user.zone || 'Central Railway',
        divisions: user.divisions || ['Vijayawada', 'Guntur', 'Visakhapatnam'],
        notifications: user.notifications || {
          planGenerated: true,
          optCompleted: true,
          conflictDetected: true,
          approvalRequired: true,
          scheduleUpdated: false
        }
      });
    }
  }, [user]);

  if (!user) {
    return null;
  }

  // Derive Officer Initials (AD, PL, etc.)
  const getInitials = (name, username) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (username) return username.slice(0, 2).toUpperCase();
    return 'IR';
  };

  const usernameLower = (user.username || 'admin').toLowerCase();
  const isAdmin = usernameLower === 'admin' || user.role?.toLowerCase().includes('senior') || user.role?.toLowerCase().includes('officer');
  const isPlanner = usernameLower === 'planner' || user.role?.toLowerCase().includes('engineer');

  const displayName = user.displayName || (user.username ? user.username.toUpperCase() : 'ADMIN');
  const initials = getInitials(displayName, user.username);

  // Departments Configuration
  const departments = [
    {
      code: 'TMS',
      name: 'Track / Civil Engineering',
      desc: 'Permanent Way, Points, Crossings & Track Assets',
      accent: 'border-l-[#1565C0] text-[#1565C0] bg-blue-50/50',
      iconBg: 'bg-blue-100 text-[#1565C0]',
      access: 'Full Coordination',
      icon: Train
    },
    {
      code: 'SMMS',
      name: 'Signals & Telecom',
      desc: 'Interlocking, Axle Counters, Point Machines & Signals',
      accent: 'border-l-[#4F46E5] text-[#4F46E5] bg-indigo-50/50',
      iconBg: 'bg-indigo-100 text-[#4F46E5]',
      access: 'Full Coordination',
      icon: Layers
    },
    {
      code: 'TDMS',
      name: 'Electrical / OHE',
      desc: '25kV Traction Power, Catenary, Cantilever & Towers',
      accent: 'border-l-[#7C3AED] text-[#7C3AED] bg-purple-50/50',
      iconBg: 'bg-purple-100 text-[#7C3AED]',
      access: 'Full Coordination',
      icon: Building2
    },
    {
      code: 'COA',
      name: 'Traffic / Operating',
      desc: 'Section Capacity, Timetable Paths & Train Regulation',
      accent: 'border-l-[#059669] text-[#059669] bg-emerald-50/50',
      iconBg: 'bg-emerald-100 text-[#059669]',
      access: 'Full Coordination',
      icon: Clock
    },
    {
      code: 'BDMS',
      name: 'Bridges Management',
      desc: 'Girder Renewals, Substructure & Bearing Overhaul',
      accent: 'border-l-[#D97706] text-[#D97706] bg-amber-50/50',
      iconBg: 'bg-amber-100 text-[#D97706]',
      access: 'Full Coordination',
      icon: Shield
    }
  ];

  // Role-Based Permissions Matrix
  const permissionsList = [
    { name: 'View Department Schedules', allowed: true, desc: 'Access TMS, TDMS, SMMS, COA, BDMS schedule logs' },
    { name: 'Generate Block Plan', allowed: true, desc: 'Submit and trigger single/multi-department plan proposals' },
    { name: 'Run AI Optimization', allowed: true, desc: 'Execute OR-Tools CP-SAT multi-corridor solver' },
    { name: 'Resolve Planning Conflicts', allowed: true, desc: 'Approve joint bundling, shadow blocks, and time-shifts' },
    { name: 'Approve Block Plan', allowed: isAdmin, desc: 'Sr. DOM / CPTM administrative clearance rights' },
    { name: 'View Corridor Planning', allowed: true, desc: 'Inspect live corridor diagrams, speed limits & track slots' },
    { name: 'Export Planning Reports', allowed: true, desc: 'Generate CSV / PDF reports and dispatch schedules' },
    { name: 'Print Block Notice', allowed: true, desc: 'Generate printable official Section Maintenance Circular' },
    { name: 'Manage Department Assignments', allowed: isAdmin, desc: 'Assign gang capacities and divisional asset zones' },
    { name: 'Manage User Accounts', allowed: isAdmin, desc: 'Application role allocation and authorization config' }
  ];

  // Assigned Divisions
  const divisions = user.divisions || ['Vijayawada', 'Guntur', 'Visakhapatnam'];

  // Handle saving profile changes
  const handleSaveProfile = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      displayName: editForm.displayName.trim(),
      role: editForm.designation.trim(),
      zone: editForm.zone.trim(),
      divisions: editForm.divisions,
      notifications: editForm.notifications
    };

    try {
      sessionStorage.setItem('railblock_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      window.dispatchEvent(new CustomEvent('railblock_user_updated', { detail: updatedUser }));
      setIsEditModalOpen(false);
      setSaveSuccessMsg('Profile updated successfully.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving profile to sessionStorage:', err);
    }
  };

  // Toggle notification preference
  const toggleNotification = (key) => {
    const newPrefs = {
      ...editForm.notifications,
      [key]: !editForm.notifications[key]
    };
    const updatedUser = {
      ...user,
      notifications: newPrefs
    };
    setEditForm({ ...editForm, notifications: newPrefs });
    try {
      sessionStorage.setItem('railblock_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      window.dispatchEvent(new CustomEvent('railblock_user_updated', { detail: updatedUser }));
    } catch (err) {
      console.warn('Error saving notifications:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-14 font-sans">
      {/* ===================================================================
          BREADCRUMB & HEADER
          =================================================================== */}
      <div>
        <nav className="flex items-center space-x-2 text-xs text-[#64748B] mb-2 font-medium">
          <Link to="/" className="hover:text-[#1565C0] transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>Administration</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span className="text-[#172033] font-semibold">Profile</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#172033] tracking-tight">
              Officer Profile
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 leading-relaxed">
              Manage your official identity, planning authority, department assignments and system activity.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#1565C0] bg-white hover:bg-blue-50/50 border border-[#CBD5E1] hover:border-[#1565C0] transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        {saveSuccessMsg && (
          <div className="mt-3 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center space-x-2 text-xs text-[#15803D] font-semibold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ===================================================================
          MAIN PROFILE IDENTITY CARD
          =================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            {/* Circular Initials Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1565C0] to-[#0F766E] text-white flex items-center justify-center font-black text-xl tracking-wider shadow-sm shrink-0 select-none">
              {initials}
            </div>

            {/* Identity Info */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-[#172033] tracking-tight truncate">
                  {displayName}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5 animate-pulse" />
                  Active Session
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                  {isAdmin ? 'ADMINISTRATOR' : 'PLANNER'}
                </span>
              </div>

              <div className="text-sm font-semibold text-[#334155]">
                {user.role || 'Senior Planning Officer'}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mt-1">
                <span>{user.zone || 'Central Railway'}</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-[#475569]">User ID: @{user.username || 'admin'}</span>
                <span>•</span>
                <span>Division: <strong className="text-[#334155]">{divisions[0] || 'Vijayawada'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Account Status Summary Metrics */}
          <div className="flex items-center gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#F1F5F9]">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-center min-w-[75px]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Role</span>
              <span className="text-xs font-bold text-[#172033] mt-0.5 block">{isAdmin ? 'Admin' : 'Planner'}</span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-center min-w-[75px]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Depts</span>
              <span className="text-xs font-bold text-[#1565C0] mt-0.5 block">5 Active</span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-center min-w-[75px]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Divisions</span>
              <span className="text-xs font-bold text-[#172033] mt-0.5 block">{divisions.length} Assigned</span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-center min-w-[75px]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Access</span>
              <span className="text-xs font-bold text-[#15803D] mt-0.5 block">Level {isAdmin ? '3' : '2'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          OFFICIAL INFORMATION & PLANNING AUTHORITY
          =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card (7/12): Official Information */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#1565C0]" />
              <span>Official Information</span>
            </h3>
            <span className="text-[11px] font-medium text-[#64748B]">
              Application Profile Record
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Officer Name</span>
              <p className="font-semibold text-[#172033] text-sm">{displayName}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Username</span>
              <p className="font-mono text-sm font-semibold text-[#172033]">@{user.username || 'admin'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Designation / Role</span>
              <p className="font-semibold text-[#172033]">{user.role || 'Senior Planning Officer'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Railway Zone</span>
              <p className="font-semibold text-[#172033]">{user.zone || 'Central Railway'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Employee / Officer ID</span>
              <p className="font-medium text-[#64748B]">Not configured</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Account Type</span>
              <p className="font-semibold text-[#172033]">{isAdmin ? 'System Administrator' : 'Operations Planner'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Account Status</span>
              <p className="inline-flex items-center text-[#15803D] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5" />
                Active & Verified
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[#64748B] font-medium">Last Login</span>
              <p className="font-medium text-[#334155]">Today • 09 Sep 2026, 05:42 PM</p>
            </div>
          </div>
        </div>

        {/* Right Card (5/12): Planning Authority Level */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#1565C0]" />
              <span>Planning Authority</span>
            </h3>
            <span className="text-[10px] font-bold text-[#1D4ED8] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
              Level {isAdmin ? '3' : '2'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#64748B] font-medium block mb-0.5">Authority Classification</span>
              <p className="font-bold text-[#172033]">
                {isAdmin ? 'Level 3 — Administrative Planning & Coordination' : 'Level 2 — Engineering Block Planner'}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Application-level role authorization. Controls decision-support and solver clearances.
              </p>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9]">
              <span className="text-[#64748B] font-medium block mb-0.5">Approval Rights</span>
              <div className="flex items-center space-x-1.5 text-[#15803D] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>{isAdmin ? 'Block Plan Approval & Dispatch Authorization' : 'Plan Formulation & Submission'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9]">
              <span className="text-[#64748B] font-medium block mb-0.5">Planning Scope</span>
              <p className="font-semibold text-[#334155]">
                {isAdmin ? 'Cross-Department Corridor Megablock Synchronization' : 'Divisional Department Schedule Coordination'}
              </p>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9]">
              <span className="text-[10px] text-[#64748B] italic">
                * Note: Internal application role; operational railway block dispatches remain subject to official Divisional Operating Manager (Sr. DOM) sign-off.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          RAILWAY ASSIGNMENT & ASSIGNED DIVISIONS
          =================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
          <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#1565C0]" />
            <span>Railway Assignment & Operational Scope</span>
          </h3>
          <span className="text-xs text-[#64748B]">
            Railway Zone: <strong className="text-[#172033]">{user.zone || 'Central Railway'}</strong>
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-[#475569] block">
            Assigned Operating Divisions ({divisions.length}):
          </span>

          {divisions.length === 0 ? (
            <p className="text-xs text-[#64748B] italic">No divisions assigned.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {divisions.map((divName, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1565C0] bg-[#EFF6FF] border border-[#BFDBFE] shadow-2xs"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>{divName} Division</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" title="Active Corridor Monitoring" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          DEPARTMENT ACCESS
          =================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
          <div>
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#1565C0]" />
              <span>Department Access</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Coordinated departments under this officer's administrative planning mandate
            </p>
          </div>
          <span className="text-xs font-bold text-[#1565C0] bg-[#EFF6FF] px-2.5 py-1 rounded-lg border border-[#BFDBFE]">
            5 Departments Coordinated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <div
                key={dept.code}
                className={`p-3.5 rounded-xl border border-[#E2E8F0] border-l-4 ${dept.accent.split(' ')[0]} bg-white hover:bg-[#F8FAFC] transition-all space-y-2 shadow-2xs`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dept.iconBg} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-xs text-[#0F172A]">{dept.code}</span>
                      <span className="text-[11px] text-[#64748B] block font-medium truncate max-w-[140px]">{dept.name}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#BBF7D0]">
                    Full
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                  {dept.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          AUTHORIZATION & ACCESS CONTROL (Structured Table)
          =================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
          <div>
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-[#1565C0]" />
              <span>Authorization & Access Control</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Functional permissions granted to this account
            </p>
          </div>
          <span className="text-xs text-[#64748B]">
            {permissionsList.filter(p => p.allowed).length} of {permissionsList.length} permissions active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] uppercase font-bold text-[#64748B]">
                <th className="pb-2.5 font-bold">Permission / Functional Capability</th>
                <th className="pb-2.5 font-bold hidden sm:table-cell">Description</th>
                <th className="pb-2.5 font-bold text-right pr-2">Access Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {permissionsList.map((perm, idx) => (
                <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-2.5 font-semibold text-[#172033]">
                    {perm.name}
                  </td>
                  <td className="py-2.5 text-[#64748B] hidden sm:table-cell">
                    {perm.desc}
                  </td>
                  <td className="py-2.5 text-right pr-2">
                    {perm.allowed ? (
                      <span className="inline-flex items-center text-[#15803D] font-bold bg-[#F0FDF4] px-2.5 py-0.5 rounded-md border border-[#BBF7D0]">
                        <Check className="w-3 h-3 mr-1 text-[#16A34A]" />
                        Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[#94A3B8] font-medium bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                        — Restricted
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================
          RECENT ACTIVITY & RECENT PLANS (2 Columns)
          =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6/12): Recent Activity Timeline */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#1565C0]" />
              <span>Recent Activity</span>
            </h3>
            <span className="text-[11px] font-medium text-[#64748B]">
              Operational Log
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Timeline Item 1 */}
            <div className="flex space-x-3">
              <div className="relative flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1565C0] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="w-0.5 h-full bg-[#E2E8F0] my-1" />
              </div>
              <div className="pt-0.5 pb-2 min-w-0">
                <p className="font-semibold text-[#172033]">
                  Generated AI-recommended block plan
                </p>
                <p className="text-[#64748B] text-[11px] mt-0.5">
                  Today • 09 Sep 2026, 05:42 PM
                </p>
                <span className="inline-block mt-1 font-mono text-[10px] text-[#2563EB] bg-[#EFF6FF] px-2 py-0.2 rounded border border-[#BFDBFE]">
                  Vijayawada – Tenali Corridor
                </span>
              </div>
            </div>

            {/* Timeline Item 2 */}
            <div className="flex space-x-3">
              <div className="relative flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-[#7C3AED] flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="w-0.5 h-full bg-[#E2E8F0] my-1" />
              </div>
              <div className="pt-0.5 pb-2 min-w-0">
                <p className="font-semibold text-[#172033]">
                  Reviewed Vijayawada–Tenali Megablock Schedule
                </p>
                <p className="text-[#64748B] text-[11px] mt-0.5">
                  Today • 09 Sep 2026, 04:18 PM
                </p>
                <span className="inline-block mt-1 text-[10px] text-[#7C3AED] bg-[#FAF5FF] px-2 py-0.2 rounded border border-[#E9D5FF]">
                  TMS + TDMS + SMMS
                </span>
              </div>
            </div>

            {/* Timeline Item 3 */}
            <div className="flex space-x-3">
              <div className="relative flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#059669] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="w-0.5 h-full bg-[#E2E8F0] my-1" />
              </div>
              <div className="pt-0.5 pb-2 min-w-0">
                <p className="font-semibold text-[#172033]">
                  Authorized Coordinated Maintenance Plan
                </p>
                <p className="text-[#64748B] text-[11px] mt-0.5">
                  Yesterday • 08 Sep 2026, 03:44 PM
                </p>
              </div>
            </div>

            {/* Timeline Item 4 */}
            <div className="flex space-x-3">
              <div className="relative flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-slate-100 text-[#475569] flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="pt-0.5 min-w-0">
                <p className="font-semibold text-[#172033]">
                  Exported Monthly Block Planning Report
                </p>
                <p className="text-[#64748B] text-[11px] mt-0.5">
                  Yesterday • 08 Sep 2026, 06:10 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (6/12): Recent Plans */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#1565C0]" />
              <span>Recent Plans</span>
            </h3>
            <button
              type="button"
              onClick={() => navigate('/kpis')}
              className="text-xs font-semibold text-[#1565C0] hover:underline flex items-center"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Plan 1: Active Latest Plan */}
            <div className="p-3.5 bg-[#F8FAFF] border border-[#BFDBFE] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#172033] truncate">
                    {latestPlan?.section_name || 'AI Optimized Weekly Block Plan'}
                  </span>
                  <span className="px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#2563EB] text-white">
                    CURRENT PLAN
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kpis', { state: { highlightNewPlan: true } })}
                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1565C0] hover:bg-[#0D47A1] rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                >
                  <span>View Plan</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                <span className="font-mono text-[#475569]">{latestPlan?.block_id || 'PLAN-WK-20260909'}</span>
                <span>•</span>
                <span>Generated: {latestPlan?.generated_at || '09 Sep 2026'}</span>
                <span>•</span>
                <span className="text-[#15803D] font-semibold">Status: Optimized</span>
              </div>
            </div>

            {/* Plan 2: SCoR Monthly Master */}
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 hover:border-[#CBD5E1] transition-all">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172033]">
                  SCoR Corridor Monthly Maintenance Schedule
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/department-schedule')}
                  className="px-2 py-1 text-[11px] font-semibold text-[#1565C0] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                >
                  View Schedule
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                <span className="font-mono text-[#475569]">PLAN-MO-20260901</span>
                <span>•</span>
                <span>Period: Sep 2026 (30 Days)</span>
                <span>•</span>
                <span className="text-[#15803D] font-semibold">Approved</span>
              </div>
            </div>

            {/* Plan 3: Rolling Megablock Baseline */}
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 hover:border-[#CBD5E1] transition-all">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172033]">
                  Tenali – Vijayawada Joint Track & OHE Overhaul
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/kpis')}
                  className="px-2 py-1 text-[11px] font-semibold text-[#1565C0] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                >
                  View Report
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                <span className="font-mono text-[#475569]">BLK-OPT-SEC_C01_01</span>
                <span>•</span>
                <span>09 Sep 2026 • 01:00 - 04:00</span>
                <span>•</span>
                <span className="text-[#15803D] font-semibold">Synchronized</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          NOTIFICATION PREFERENCES & SESSION / SECURITY
          =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Notification Preferences (6/12) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <Bell className="w-4 h-4 text-[#1565C0]" />
              <span>Notification Preferences</span>
            </h3>
            <span className="text-[11px] font-medium text-[#64748B]">
              Application Alerts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="font-semibold text-[#172033] block">Block Plan Generated</span>
                <span className="text-[11px] text-[#64748B]">Alert when a new recommendation is formulated</span>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification('planGenerated')}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  editForm.notifications.planGenerated ? 'bg-[#1565C0]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  editForm.notifications.planGenerated ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <div>
                <span className="font-semibold text-[#172033] block">Optimization Completed</span>
                <span className="text-[11px] text-[#64748B]">Notify on CP-SAT 9.15 solver solution completion</span>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification('optCompleted')}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  editForm.notifications.optCompleted ? 'bg-[#1565C0]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  editForm.notifications.optCompleted ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <div>
                <span className="font-semibold text-[#172033] block">Planning Conflict Detected</span>
                <span className="text-[11px] text-[#64748B]">Immediate flag for train slot or corridor clashes</span>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification('conflictDetected')}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  editForm.notifications.conflictDetected ? 'bg-[#1565C0]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  editForm.notifications.conflictDetected ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <div>
                <span className="font-semibold text-[#172033] block">Approval Required</span>
                <span className="text-[11px] text-[#64748B]">Alert when a plan awaits Sr. DOM clearance</span>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification('approvalRequired')}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  editForm.notifications.approvalRequired ? 'bg-[#1565C0]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  editForm.notifications.approvalRequired ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <div>
                <span className="font-semibold text-[#172033] block">Schedule Updated</span>
                <span className="text-[11px] text-[#64748B]">Daily timetable refresh notification</span>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification('scheduleUpdated')}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  editForm.notifications.scheduleUpdated ? 'bg-[#1565C0]' : 'bg-[#CBD5E1]'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  editForm.notifications.scheduleUpdated ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Session & Security (6/12) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#172033] flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#1565C0]" />
              <span>Session & Security</span>
            </h3>
            <span className="text-[10px] font-bold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#BBF7D0]">
              Encrypted Session
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-[#64748B]">Current Session</span>
              <span className="inline-flex items-center text-[#15803D] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5 animate-pulse" />
                Active & Authenticated
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <span className="text-[#64748B]">Authentication Mechanism</span>
              <span className="font-medium text-[#334155]">Role-Based Local Credentials</span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <span className="text-[#64748B]">Session State Storage</span>
              <span className="font-mono text-[11px] text-[#475569]">SessionStorage (Client Safe)</span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <span className="text-[#64748B]">Session Authority Scope</span>
              <span className="font-medium text-[#172033]">
                {isAdmin ? 'Administrative (Level 3)' : 'Planning Engineer (Level 2)'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#F1F5F9] flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#172033] transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex-1 py-2 px-3 bg-[#FEF2F2] hover:bg-[#B91C1C] border border-[#FECACA] hover:border-[#B91C1C] rounded-xl text-xs font-semibold text-[#B91C1C] hover:text-white transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================
          EDIT PROFILE MODAL
          =================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <h3 className="text-base font-bold text-[#172033]">Edit Officer Profile</h3>
                <p className="text-xs text-[#64748B] mt-0.5">Update your display information and division assignments</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 flex items-center justify-center text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Display / Officer Name
                </label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  required
                  placeholder="e.g. Admin or Officer Name"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0] rounded-xl px-3 py-2 text-xs font-medium text-[#172033] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  required
                  placeholder="e.g. Senior Planning Officer"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0] rounded-xl px-3 py-2 text-xs font-medium text-[#172033] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Railway Zone
                </label>
                <input
                  type="text"
                  value={editForm.zone}
                  onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                  required
                  placeholder="e.g. Central Railway or South Coast Railway"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0] rounded-xl px-3 py-2 text-xs font-medium text-[#172033] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Assigned Operating Divisions (comma separated)
                </label>
                <input
                  type="text"
                  value={editForm.divisions.join(', ')}
                  onChange={(e) => {
                    const divs = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setEditForm({ ...editForm, divisions: divs });
                  }}
                  placeholder="e.g. Vijayawada, Guntur, Visakhapatnam"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0] rounded-xl px-3 py-2 text-xs font-medium text-[#172033] outline-none"
                />
                <span className="text-[11px] text-[#64748B] mt-1 block">
                  Enter divisions separated by commas.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] hover:bg-slate-50 text-[#475569] font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1565C0] hover:bg-[#0D47A1] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
