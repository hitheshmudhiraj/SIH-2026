import { useNavigate } from 'react-router-dom';
import {
  Layers, Calendar, Cpu, Activity, BarChart3, RotateCcw,
  ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Train,
  Building2, Users, Database, Clock, Zap, Info, HelpCircle
} from 'lucide-react';

const features = [
  {
    id: 'block-planning',
    to: '/block-planning',
    title: 'Block Planning',
    subtitle: 'AI & CP-SAT Automated Possession Planning',
    category: 'Intelligent Scheduling Engine',
    categoryColor: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Cpu,
    iconColor: 'text-[#C2410C]',
    iconBg: 'bg-[#FFF7ED] border-[#FED7AA]',
    cardBorder: 'hover:border-[#C2410C]',
    whatItDoes: 'Employs Google OR-Tools CP-SAT constraint programming and Machine Learning to evaluate corridor train timetables, track segment availability, work urgency, and maintenance crews. It automatically recommends conflict-free track possession time slots while minimizing passenger and freight disruption.',
    whyWeUseIt: 'Manual block negotiations between operating and maintenance wings take hours and frequently cause train delays or last-minute cancellations. This engine automates slot allocation, resolves cross-departmental clashes, and protects train punctuality while guaranteeing track safety compliance.',
    highlights: ['CP-SAT Mathematical Solver', 'AI Delay & Impact Prediction', 'Multi-Slot Opportunity Ranking', 'Automatic Conflict Prevention'],
    ctaText: 'Open Block Planning Dashboard'
  },
  {
    id: 'data-integration',
    to: '/intake',
    title: 'Data Integration',
    subtitle: 'Centralised Data Repository Across All Systems',
    category: 'Unified Data Highway',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Database,
    iconColor: 'text-[#1565C0]',
    iconBg: 'bg-[#EFF6FF] border-[#BFDBFE]',
    cardBorder: 'hover:border-[#1565C0]',
    whatItDoes: 'Connects and synchronizes real-time feeds from all isolated Indian Railways source systems into a unified data hub: TMS (Track Management), SMMS (Signal & Telecom), TDMS (Traction / OHE), BDMS (Bridge Management), and COA (Control Office Application for train movements).',
    whyWeUseIt: 'Railway departments historically operate in isolated data silos, leading to blind scheduling, mismatched section IDs, and duplicated possessions. This centralized layer provides a single source of truth, standardizes asset definitions across corridors, and monitors end-to-end data health.',
    highlights: ['5 Core Railway Systems Unified', 'Automated Health & Quality Audits', 'Zero Duplicate Asset Possession', 'Real-Time Sync Engine'],
    ctaText: 'Access Centralized Data Hub'
  },
  {
    id: 'corridor-view',
    to: '/planning-board',
    title: 'Corridor View',
    subtitle: 'Unified Geographic Corridor Map & Timelines',
    category: 'Spatial & Timeline Visualizer',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Calendar,
    iconColor: 'text-[#15803D]',
    iconBg: 'bg-[#F0FDF4] border-[#BBF7D0]',
    cardBorder: 'hover:border-[#15803D]',
    whatItDoes: 'Renders an interactive geographic and section-level map of railway corridors with real-time train movement overlays, station topologies, active speed restrictions, and track possession blackout windows across divisions.',
    whyWeUseIt: 'Allows divisional controllers and section engineers to visually spot traffic congestion, identify low-density shadow windows where maintenance can safely take place, and inspect spatial dependencies across adjacent stations before authorizing work.',
    highlights: ['Interactive Corridor Topology', 'Live Train Movement Paths', 'Shadow Window Detection', 'Section Blackout Overlays'],
    ctaText: 'Launch Corridor View'
  },
  {
    id: 'department-schedule',
    to: '/department-schedule',
    title: 'Weekly & Monthly Planned Blocks',
    subtitle: 'Cross-Departmental Schedule for Other Departments to See',
    category: 'Inter-Departmental Coordination',
    categoryColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Users,
    iconColor: 'text-[#7C3AED]',
    iconBg: 'bg-[#F5F3FF] border-[#DDD6FE]',
    cardBorder: 'hover:border-[#7C3AED]',
    whatItDoes: 'Provides an open, transparent master register of all already planned and approved weekly and monthly maintenance blocks. Officers from Engineering, S&T, Traction (TRD), and Traffic can filter by department, inspect scheduled defect repairs, view joint megablocks, and review train regulations.',
    whyWeUseIt: 'Eliminates departmental friction and surprises. Operating controllers can proactively reroute freight or adjust timetables days in advance, while maintenance departments can piggyback on existing track possessions to form joint megablocks, drastically cutting total downtime.',
    highlights: ['7-Day Weekly & 30-Day Master Calendar', 'Departmental Filter Chips', 'Joint Megablock Bundling (100%)', 'Printable Coordination Bulletin'],
    ctaText: 'View Department Block Schedule'
  },
  {
    id: 'kpis',
    to: '/kpis',
    title: 'Optimization & Impact Reports',
    subtitle: 'Quantitative Before vs. After Optimization Metrics',
    category: 'Performance Intelligence',
    categoryColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: BarChart3,
    iconColor: 'text-[#0F766E]',
    iconBg: 'bg-[#ECFDF5] border-[#99F6E4]',
    cardBorder: 'hover:border-[#0F766E]',
    whatItDoes: 'Analyzes the performance shift between uncoordinated departmental baseline requests and the unified CP-SAT optimized block schedule, tracking total possession hours saved, conflict reductions, and critical defect completion rates.',
    whyWeUseIt: 'Provides divisional leadership (DRM, ADRM, Sr.DOM, Sr.DEN) with auditable proof of operational efficiency gains, demonstrating quantifiable punctuality improvements and reduced maintenance overhead.',
    highlights: ['Possession Hours Saved Tracker', 'Punctuality Impact Analytics', 'Multi-Department Bundling Rate', 'Executive Audit Graphics'],
    ctaText: 'Explore Impact Reports'
  },
  {
    id: 'audit-trail',
    to: '/audit-trail',
    title: 'Audit Trail & Governance',
    subtitle: 'Immutable Ledger of All Scheduling Decisions',
    category: 'Safety & Regulatory Compliance',
    categoryColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: RotateCcw,
    iconColor: 'text-[#B91C1C]',
    iconBg: 'bg-[#FEF2F2] border-[#FECACA]',
    cardBorder: 'hover:border-[#B91C1C]',
    whatItDoes: 'Maintains an immutable chronological log of every block request, algorithmic optimization, manual officer override, approval, and cancellation across all divisions.',
    whyWeUseIt: 'Guarantees 100% regulatory compliance with Indian Railways safety codes and provides transparent accountability during safety audits or punctuality reviews.',
    highlights: ['Immutable Action Logs', 'Officer Override Tracking', 'Timestamped Approvals', 'Exportable Compliance Reports'],
    ctaText: 'Inspect Audit Logs'
  }
];

export default function HomeView() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Welcome & Overview Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#1565C0] text-xs font-bold border border-[#BFDBFE] mb-3">
              <Train className="w-3.5 h-3.5" />
              <span>Ministry of Railways • South Coast Railway Zone</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight">
              Train Block Planning & Coordination Platform
            </h1>
            <p className="text-sm sm:text-base text-[#5B6575] mt-2 leading-relaxed">
              Unified operational control for intelligent maintenance block scheduling, cross-system data integration, corridor visibility, and cross-departmental coordination across Engineering, S&T, Traction, and Traffic.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:border-l lg:border-[#E2E8F0] lg:pl-6 shrink-0">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#1565C0]">5</div>
              <div className="text-[11px] font-semibold text-[#64748B]">Systems Unified</div>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#15803D]">4</div>
              <div className="text-[11px] font-semibold text-[#64748B]">Trunk Corridors</div>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#7C3AED]">93</div>
              <div className="text-[11px] font-semibold text-[#64748B]">Megablocks</div>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#C2410C]">100%</div>
              <div className="text-[11px] font-semibold text-[#64748B]">Joint Bundling</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Subtitle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#172033]">Core Platform Capabilities</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Explore each feature below to understand what it does and why we use it in railway operations.</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
          6 Active Modules
        </span>
      </div>

      {/* Cards One by One with Description & Why We Use Them */}
      <div className="space-y-5">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.id}
              onClick={() => navigate(feature.to)}
              className={`group bg-white border border-[#E2E8F0] ${feature.cardBorder} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden`}
            >
              <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-6">
                {/* Left side: Icon, Category, Title, and Description Sections */}
                <div className="flex-1 space-y-4">
                  {/* Top Bar inside card */}
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl border ${feature.iconBg} shadow-xs shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${feature.categoryColor}`}>
                          {feature.category}
                        </span>
                        <span className="text-xs text-[#94A3B8] font-mono">Module 0{idx + 1}</span>
                      </div>
                      <h3 className="text-xl font-bold text-[#172033] group-hover:text-[#1565C0] transition-colors mt-0.5">
                        {feature.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-[#475569] italic">
                    {feature.subtitle}
                  </p>

                  {/* Two Column Layout for: WHAT IT DOES & WHY WE USE IT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* What It Does */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1E293B] mb-2 uppercase tracking-wide">
                          <HelpCircle className="w-4 h-4 text-[#1565C0]" />
                          <span>What It Does</span>
                        </div>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          {feature.whatItDoes}
                        </p>
                      </div>
                    </div>

                    {/* Why We Use It */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1E293B] mb-2 uppercase tracking-wide">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>Why We Use It</span>
                        </div>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          {feature.whyWeUseIt}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Highlights Tags */}
                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    {feature.highlights.map((tag, tidx) => (
                      <span
                        key={tidx}
                        className="text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md"
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right side: Action CTA Button */}
                <div className="lg:w-56 flex flex-col justify-end lg:border-l lg:border-[#F1F5F9] lg:pl-6 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-[#F1F5F9]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(feature.to);
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-bold text-xs bg-[#1565C0] text-white hover:bg-[#0D47A1] shadow-sm transition-all group-hover:shadow-md cursor-pointer"
                  >
                    <span>{feature.ctaText}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-[11px] text-center text-[#94A3B8] mt-2">
                    Click card to redirect
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
