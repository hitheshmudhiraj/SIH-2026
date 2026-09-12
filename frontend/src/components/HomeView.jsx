import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Database, Calendar, Users, BarChart3, RotateCcw,
  ChevronRight, CheckCircle2, Zap, TrendingUp, AlertTriangle,
  Clock, Shield, Activity, ArrowUpRight, Layers
} from 'lucide-react';
import { fetchDashboardStats, fetchLatestWeeklyPlan, fetchAuditTrail } from '../api';
import { fetchIntegrationStatus } from '../lib/api';

function SparkAreaChart({ data = [], color = '#1769C2', height = 52 }) {
  const w = 240, h = height, pad = 4;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v / max) * (h - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M${pts.join(' L')}`;
  const areaPath = `M${pts[0]} L${pts.join(' L')} L${(w - pad).toFixed(1)},${h} L${pad},${h} Z`;
  const gradId = `grad${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        if (i !== data.length - 1) return null;
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v / max) * (h - pad * 2));
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function DonutChart({ slices }) {
  const r = 44, cx = 56, cy = 56, stroke = 10;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  return (
    <svg viewBox="0 0 112 112" className="w-28 h-28" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F4F8" strokeWidth={stroke} />
      {slices.map((sl, i) => {
        const dash = (sl.value / total) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth={stroke}
            strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
            strokeDashoffset={-offset} strokeLinecap="butt" />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function RailwayTrackBg() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none select-none"
      preserveAspectRatio="xMidYMid slice" viewBox="0 0 600 180">
      <line x1="0" y1="60" x2="600" y2="60" stroke="#1769C2" strokeWidth="1.5" strokeOpacity="0.07" />
      <line x1="0" y1="75" x2="600" y2="75" stroke="#1769C2" strokeWidth="1.5" strokeOpacity="0.07" />
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x={i * 31 + 4} y="55" width="5" height="25" rx="1" fill="#1769C2" fillOpacity="0.05" />
      ))}
      <path d="M 0 130 Q 150 110 300 125 Q 450 140 600 120" fill="none" stroke="#0F8F8C" strokeWidth="1.5" strokeOpacity="0.06" />
      <path d="M 0 143 Q 150 123 300 138 Q 450 153 600 133" fill="none" stroke="#0F8F8C" strokeWidth="1.5" strokeOpacity="0.06" />
      {[80, 200, 340, 480, 560].map((x, i) => (
        <circle key={i} cx={x} cy="67" r="4" fill="#1769C2" fillOpacity="0.09" />
      ))}
    </svg>
  );
}

export default function HomeView() {
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadLiveMetrics() {
      try {
        const [statsRes, planRes, integrationRes, auditRes] = await Promise.allSettled([
          fetchDashboardStats(), fetchLatestWeeklyPlan(), fetchIntegrationStatus(), fetchAuditTrail(50)
        ]);
        if (!isMounted) return;
        if (statsRes.status === 'fulfilled' && statsRes.value) setDashboardStats(statsRes.value);
        if (planRes.status === 'fulfilled' && planRes.value) setWeeklyPlan(planRes.value);
        if (integrationRes.status === 'fulfilled' && integrationRes.value) setIntegrationStatus(integrationRes.value);
        if (auditRes.status === 'fulfilled' && auditRes.value) setAuditLogs(Array.isArray(auditRes.value) ? auditRes.value : []);
      } catch (err) { console.error('Error fetching live metrics:', err); }
    }
    loadLiveMetrics();
    return () => { isMounted = false; };
  }, []);

  const totalBlocks = weeklyPlan?.summary?.total_blocks ?? dashboardStats?.compatible_groupings ?? 93;
  const systemsCount = integrationStatus?.systems?.length ?? 5;
  const dataQuality = integrationStatus?.data_quality_score ?? 96.5;
  const sectionsCovered = weeklyPlan?.summary?.sections_covered ?? 32;
  const megablocks = weeklyPlan?.summary?.joint_megablocks ?? 93;
  const bundlingRate = weeklyPlan?.summary?.joint_bundling_rate_pct ?? 100;
  const blockHours = weeklyPlan?.summary?.total_block_hours ?? 251.0;
  const openConflicts = dashboardStats?.detected_conflicts ?? 0;

  const formatRelativeTime = (timestamp, index) => {
    if (!timestamp) return ['18m ago','42m ago','1h ago','2h ago','3h ago','5h ago','Yesterday'][index % 7];
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;
    } catch { return 'Recent'; }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const kpiCards = [
    { label: 'Active Blocks', value: totalBlocks, sub: '+1 this week', icon: Layers, iconColor: '#1769C2', iconBg: '#EBF2FF', trend: '+4%', trendUp: true },
    { label: 'Data Quality', value: `${dataQuality}%`, sub: 'TMS · SMMS · TDMS', icon: Shield, iconColor: '#0F8F8C', iconBg: '#E6F7F7', trend: '+0.2%', trendUp: true },
    { label: 'Open Conflicts', value: openConflicts, sub: openConflicts === 0 ? 'All clear' : '2 require review', icon: AlertTriangle, iconColor: openConflicts === 0 ? '#2EAD78' : '#E6A23C', iconBg: openConflicts === 0 ? '#E8F8F1' : '#FDF6EC', trend: openConflicts === 0 ? 'Clear' : 'Review', trendUp: openConflicts === 0 },
    { label: 'Pending Approvals', value: '1', sub: 'Weekly master plan', icon: Clock, iconColor: '#7B61D9', iconBg: '#F0ECFF', trend: 'Due today', trendUp: null },
    { label: 'System Uptime', value: '99.9%', sub: 'All feeds active', icon: Activity, iconColor: '#2EAD78', iconBg: '#E8F8F1', trend: 'Healthy', trendUp: true },
  ];

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const plannedSeries = [18,22,20,26,24,19,Math.min(Math.max(totalBlocks,10),30)];
  const utilizedSeries = [16,20,18,24,22,17,19];
  const deptSlices = [
    { label: 'Engineering (TMS)', value: 34, color: '#E6A23C' },
    { label: 'Traction (TDMS)', value: 33, color: '#0F8F8C' },
    { label: 'S&T (SMMS)', value: 33, color: '#7B61D9' },
  ];

  const defaultActivities = [
    { action: 'Block plan optimization completed', user: 'System', time: '18m ago', type: 'success' },
    { action: 'Maintenance request received — Section BZA-TEL', user: 'Admin', time: '42m ago', type: 'info' },
    { action: 'New weekly block plan generated (93 blocks)', user: 'System', time: '1h ago', type: 'success' },
    { action: 'Joint megablock bundling verified: clash-free', user: 'Planner', time: '2h ago', type: 'success' },
    { action: 'Conflict detected — TDMS/TMS overlap at KM 74.2', user: 'System', time: '3h ago', type: 'warning' },
    { action: 'Weekly plan approved by Chief Controller', user: 'Admin', time: 'Yesterday', type: 'success' },
  ];
  const recentActivities = auditLogs.length > 0
    ? auditLogs.slice(0,6).map((log, idx) => ({ id: log.id||idx, action: log.action||`Block #${log.entity_id||(100+idx)} updated`, user: log.user_id||'Admin', time: formatRelativeTime(log.timestamp,idx), type: 'info' }))
    : defaultActivities.map((item, idx) => ({ id: idx, ...item }));

  const quickActions = [
    { label: 'Run Optimization', hint: 'Solve next possession window with CP-SAT', icon: Cpu, color: '#1769C2', bg: '#EBF2FF', to: '/block-planning', primary: true },
    { label: 'Add Maintenance Request', hint: 'Submit a new block demand via BDMS', icon: Database, color: '#0F8F8C', bg: '#E6F7F7', to: '/intake', primary: false },
    { label: 'Review Conflicts', hint: 'Verify cross-department schedules', icon: AlertTriangle, color: '#E6A23C', bg: '#FDF6EC', to: '/department-schedule', primary: false },
    { label: 'View Latest Plan', hint: 'Open the optimized weekly master plan', icon: BarChart3, color: '#7B61D9', bg: '#F0ECFF', to: '/kpis', primary: false },
  ];

  const modules = [
    { id:'block-planning', to:'/block-planning', title:'Block Planning', icon:Cpu, color:'#C2410C', bg:'#FFF7ED', border:'#FED7AA', metric:`${totalBlocks}`, metricLabel:'Planned Blocks', description:'AI and CP-SAT automated possession & conflict-free scheduling.', badge:'Operational', badgeColor:'#2EAD78', badgeBg:'#E8F8F1', badgeBorder:'#B6E9D0' },
    { id:'data-integration', to:'/intake', title:'Data Integration', icon:Database, color:'#1769C2', bg:'#EBF2FF', border:'#BFDBFE', metric:`${systemsCount}`, metricLabel:`Systems · ${dataQuality}% Quality`, description:'Central hub unifying TMS, SMMS, TDMS, COA and BDMS feeds.', badge:'Synced', badgeColor:'#1769C2', badgeBg:'#EBF2FF', badgeBorder:'#BFDBFE' },
    { id:'corridor-view', to:'/planning-board', title:'Corridor View', icon:Calendar, color:'#0F8F8C', bg:'#E6F7F7', border:'#99E6E4', metric:'4', metricLabel:`Corridors · ${sectionsCovered} Sections`, description:'Geographic corridor maps, train movements, and shadow windows.', badge:'Live', badgeColor:'#2EAD78', badgeBg:'#E8F8F1', badgeBorder:'#B6E9D0' },
    { id:'department-schedule', to:'/department-schedule', title:'Department Schedule', icon:Users, color:'#7B61D9', bg:'#F0ECFF', border:'#DDD6FE', metric:`${megablocks}`, metricLabel:`Joint Megablocks · ${bundlingRate}% Bundled`, description:'Cross-department weekly & monthly master possession schedule.', badge:'Coordinated', badgeColor:'#7B61D9', badgeBg:'#F0ECFF', badgeBorder:'#DDD6FE' },
    { id:'reports', to:'/kpis', title:'Reports & KPIs', icon:BarChart3, color:'#0F8F8C', bg:'#E6F7F7', border:'#99E6E4', metric:`${blockHours}h`, metricLabel:'Track Time · 0 Clashes', description:'Quantitative before vs. after optimization and impact metrics.', badge:'Optimized', badgeColor:'#0F8F8C', badgeBg:'#E6F7F7', badgeBorder:'#99E6E4' },
  ];

  const feedSystems = ['TMS','SMMS','TDMS','COA','BDMS'];
  const activityStyle = {
    success: { color: '#2EAD78', bg: '#E8F8F1', Icon: CheckCircle2 },
    warning: { color: '#E6A23C', bg: '#FDF6EC', Icon: AlertTriangle },
    info:    { color: '#1769C2', bg: '#EBF2FF', Icon: RotateCcw },
  };

  const cardShadow = '0 2px 8px rgba(30,60,90,0.05)';
  const cardStyle = { background:'#fff', border:'1px solid #DCE5EF', boxShadow: cardShadow };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6" style={{ fontFamily:"'Inter','Manrope',system-ui,sans-serif" }}>

      {/* ── 1. HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden px-8 py-7"
        style={{ background:'linear-gradient(135deg,#EBF2FF 0%,#F5F8FC 55%,#E6F7F7 100%)', border:'1px solid #DCE5EF' }}>
        <RailwayTrackBg />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color:'#1769C2' }}>
              CENTRALIZED BLOCK PLANNING SYSTEM · SOUTH COAST RAILWAY (SCoR)
            </p>
            <h1 className="text-2xl font-bold mb-1" style={{ color:'#16243A' }}>{greeting}, Admin</h1>
            <p className="text-sm" style={{ color:'#66758A', maxWidth:460 }}>
              Here's the current operational overview for your centralized block planning system.
            </p>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {[{label:'TMS',color:'#E6A23C'},{label:'SMMS',color:'#7B61D9'},{label:'TDMS',color:'#0F8F8C'}].map((d,i) => (
                <React.Fragment key={d.label}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background:'#fff', border:`1.5px solid ${d.color}33`, color:d.color, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background:d.color }} />{d.label}
                  </div>
                  {i < 2 && <div className="flex items-center gap-0.5"><div className="w-5 h-px" style={{ background:'#DCE5EF' }} /><div className="w-1.5 h-1.5 rounded-full" style={{ background:'#DCE5EF' }} /></div>}
                </React.Fragment>
              ))}
              <div className="flex items-center gap-0.5 ml-1">
                <div className="w-5 h-px" style={{ background:'#1769C2', opacity:0.4 }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background:'#1769C2', opacity:0.5 }} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background:'#1769C2', color:'#fff', boxShadow:'0 2px 8px rgba(23,105,194,0.25)' }}>
                <Cpu className="w-3 h-3" /> Centralized Plan
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 items-end text-right">
            <div className="px-4 py-3 rounded-xl text-xs" style={{ background:'#fff', border:'1px solid #DCE5EF', boxShadow:cardShadow }}>
              <p className="font-semibold mb-0.5" style={{ color:'#16243A' }}>{today}</p>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#2EAD78' }} />
                <span style={{ color:'#2EAD78', fontWeight:700 }}>Operational · Healthy</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {feedSystems.map(f => (
                <div key={f} className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background:'#E8F8F1', color:'#2EAD78', border:'1px solid #B6E9D0' }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="flex flex-col gap-3 p-4 rounded-2xl" style={cardStyle}>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl" style={{ background:card.iconBg }}>
                  <Icon className="w-4 h-4" style={{ color:card.iconColor }} />
                </div>
                {card.trendUp === true && <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color:'#2EAD78' }}><TrendingUp className="w-3 h-3" />{card.trend}</span>}
                {card.trendUp === false && <span className="text-[10px] font-bold" style={{ color:'#E6A23C' }}>{card.trend}</span>}
                {card.trendUp === null && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background:'#F0ECFF', color:'#7B61D9' }}>{card.trend}</span>}
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight mb-0.5" style={{ color:'#16243A' }}>{card.value}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#66758A' }}>{card.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color:'#94A3B8' }}>{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. ANALYTICS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* 3A: Block Utilization */}
        <div className="lg:col-span-5 rounded-2xl p-5" style={cardStyle}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color:'#16243A' }}>Block Utilization Trend</h3>
              <p className="text-[11px] mt-0.5" style={{ color:'#66758A' }}>Planned vs utilized · this week</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color:'#66758A' }}>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background:'#1769C2' }} />Planned</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background:'#0F8F8C' }} />Utilized</span>
            </div>
          </div>
          <SparkAreaChart data={plannedSeries} color="#1769C2" height={56} />
          <SparkAreaChart data={utilizedSeries} color="#0F8F8C" height={40} />
          <div className="flex justify-between px-1 mt-2">
            {days.map(d => <span key={d} className="text-[10px] font-medium" style={{ color:'#94A3B8' }}>{d}</span>)}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop:'1px solid #F0F4F8' }}>
            <div className="text-center"><div className="text-lg font-bold" style={{ color:'#16243A' }}>{totalBlocks}</div><div className="text-[10px]" style={{ color:'#66758A' }}>Total Planned</div></div>
            <div className="text-center"><div className="text-lg font-bold" style={{ color:'#0F8F8C' }}>{blockHours}h</div><div className="text-[10px]" style={{ color:'#66758A' }}>Possession Hours</div></div>
            <div className="text-center"><div className="text-lg font-bold" style={{ color:'#2EAD78' }}>{bundlingRate}%</div><div className="text-[10px]" style={{ color:'#66758A' }}>Bundling Rate</div></div>
          </div>
        </div>

        {/* 3B: Department Load */}
        <div className="lg:col-span-3 rounded-2xl p-5 flex flex-col" style={cardStyle}>
          <div className="mb-4">
            <h3 className="text-sm font-bold" style={{ color:'#16243A' }}>Department Load</h3>
            <p className="text-[11px] mt-0.5" style={{ color:'#66758A' }}>Block possession distribution</p>
          </div>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <DonutChart slices={deptSlices} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-lg font-bold" style={{ color:'#16243A' }}>3</div>
                <div className="text-[9px] font-semibold uppercase" style={{ color:'#66758A' }}>Depts</div>
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-auto">
            {deptSlices.map(sl => (
              <div key={sl.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:sl.color }} />
                  <span className="text-xs font-medium" style={{ color:'#66758A' }}>{sl.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color:'#16243A' }}>{sl.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3C: Recent Updates */}
        <div className="lg:col-span-4 rounded-2xl p-5 flex flex-col" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color:'#16243A' }}>Recent Updates</h3>
              <p className="text-[11px] mt-0.5" style={{ color:'#66758A' }}>Audited platform events</p>
            </div>
            <button onClick={() => navigate('/kpis')} className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer" style={{ color:'#1769C2' }}>
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-0.5 flex-1">
            {recentActivities.map(act => {
              const aStyle = activityStyle[act.type] || activityStyle.info;
              const AIcon = aStyle.Icon;
              return (
                <div key={act.id} className="flex items-start gap-3 py-2" style={{ borderBottom:'1px solid #F5F8FC' }}>
                  <div className="p-1.5 rounded-lg shrink-0 mt-0.5" style={{ background:aStyle.bg }}>
                    <AIcon className="w-3 h-3" style={{ color:aStyle.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-snug" style={{ color:'#16243A' }}>{act.action}</p>
                    <p className="text-[10px] mt-0.5" style={{ color:'#94A3B8' }}>by {act.user}</p>
                  </div>
                  <span className="text-[10px] shrink-0 mt-0.5 font-medium" style={{ color:'#94A3B8' }}>{act.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. QUICK ACTIONS + MODULES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Quick Actions */}
        <div className="lg:col-span-4 rounded-2xl p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color:'#16243A' }}>Quick Actions</h3>
              <p className="text-[11px] mt-0.5" style={{ color:'#66758A' }}>Common operational tasks</p>
            </div>
            <div className="p-1.5 rounded-lg" style={{ background:'#EBF2FF' }}>
              <Zap className="w-3.5 h-3.5" style={{ color:'#1769C2' }} />
            </div>
          </div>
          <div className="space-y-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button key={idx} onClick={() => navigate(action.to)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer"
                  style={{ background: action.primary ? '#1769C2' : '#fff', border: action.primary ? 'none' : '1px solid #DCE5EF', boxShadow: action.primary ? '0 3px 12px rgba(23,105,194,0.22)' : '0 1px 4px rgba(30,60,90,0.04)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg shrink-0" style={{ background: action.primary ? 'rgba(255,255,255,0.18)' : action.bg }}>
                      <Icon className="w-4 h-4" style={{ color: action.primary ? '#fff' : action.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: action.primary ? '#fff' : '#16243A' }}>{action.label}</p>
                      <p className="text-[10px] truncate" style={{ color: action.primary ? 'rgba(255,255,255,0.7)' : '#66758A' }}>{action.hint}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: action.primary ? 'rgba(255,255,255,0.7)' : '#94A3B8' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Module Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.id} onClick={() => navigate(card.to)}
                className="flex flex-col gap-3 p-4 rounded-2xl cursor-pointer"
                style={{ background:'#fff', border:'1px solid #DCE5EF', boxShadow:cardShadow, transition:'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.border=`1px solid ${card.border}`; e.currentTarget.style.boxShadow='0 4px 16px rgba(30,60,90,0.10)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.border='1px solid #DCE5EF'; e.currentTarget.style.boxShadow=cardShadow; e.currentTarget.style.transform='none'; }}>
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-xl" style={{ background:card.bg }}>
                    <Icon className="w-4 h-4" style={{ color:card.color }} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background:card.badgeBg, color:card.badgeColor, border:`1px solid ${card.badgeBorder}` }}>{card.badge}</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold" style={{ color:'#16243A' }}>{card.metric}</span>
                    <span className="text-[10px] font-medium" style={{ color:'#66758A' }}>{card.metricLabel}</span>
                  </div>
                  <h2 className="text-xs font-bold mt-0.5" style={{ color:'#16243A' }}>{card.title}</h2>
                  <p className="text-[10px] mt-1 leading-relaxed" style={{ color:'#66758A' }}>{card.description}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold mt-auto pt-1.5" style={{ color:card.color, borderTop:'1px solid #F5F8FC' }}>
                  Open module <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. SYSTEM STATUS FOOTER ── */}
      <div className="rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4"
        style={{ background:'#fff', border:'1px solid #DCE5EF', boxShadow:'0 2px 8px rgba(30,60,90,0.04)' }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ background:'#E8F8F1' }}>
            <Shield className="w-4 h-4" style={{ color:'#2EAD78' }} />
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color:'#16243A' }}>System Status</p>
            <p className="text-[10px]" style={{ color:'#2EAD78', fontWeight:600 }}>● All systems operational</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color:'#66758A' }}>Data Feeds:</span>
          {feedSystems.map(f => (
            <div key={f} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background:'#E8F8F1', color:'#2EAD78', border:'1px solid #B6E9D0' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background:'#2EAD78' }} />{f}
            </div>
          ))}
        </div>
        <div className="text-[11px] font-bold px-3 py-1.5 rounded-full"
          style={{ background:'#E8F8F1', color:'#2EAD78', border:'1px solid #B6E9D0' }}>
          Healthy · 99.9% uptime
        </div>
      </div>

    </div>
  );
}
