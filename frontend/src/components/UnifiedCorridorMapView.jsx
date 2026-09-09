import { useState, useEffect, useMemo } from 'react';
import {
  Train, MapPin, AlertCircle, Compass,
  Layers, ChevronRight, Eye, Wrench, Radio, Zap,
  Calendar, Filter, ShieldAlert, CheckCircle2, Clock, AlertTriangle, X, Sparkles
} from 'lucide-react';
import { fetchCorridorMapData } from '../lib/api';
import BdmsRequestModal from './BdmsRequestModal';

export default function UnifiedCorridorMapView({ onSelectOpportunity, onSelectBlock }) {
  const [mapData, setMapData] = useState(null);
  const [selectedCorridor, setSelectedCorridor] = useState('ALL');
  const [activeOverlay, setActiveOverlay] = useState('ALL');
  const [isBdmsModalOpen, setIsBdmsModalOpen] = useState(false);
  
  // Cross-Department Filter State: default to ALL departments
  const [selectedDepartments, setSelectedDepartments] = useState(['Engineering', 'S&T', 'Traction']);
  
  // Date Range Picker State: default next 14 days
  const [startDate, setStartDate] = useState('2026-09-08');
  const [endDate, setEndDate] = useState('2026-09-22');
  
  // Interactive UI states
  const [hoveredStation, setHoveredStation] = useState(null);
  const [hoveredJob, setHoveredJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    fetchCorridorMapData({
      corridor: selectedCorridor !== 'ALL' ? selectedCorridor : undefined,
      departments: selectedDepartments,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })
      .then(data => setMapData(data))
      .catch(console.error);
  }, [selectedCorridor, selectedDepartments, startDate, endDate]);

  const corridorsMeta = [
    { id: 'C01', name: 'Vijayawada – Gudur Main Line', color: '#DC2626', division: 'Vijayawada' },
    { id: 'C02', name: 'Visakhapatnam – Vijayawada Trunk', color: '#0369A1', division: 'Visakhapatnam & BZA' },
    { id: 'C03', name: 'Guntur – Nandyal Section', color: '#7C3AED', division: 'Guntur' },
    { id: 'C04', name: 'Guntakal – Renigunta Grand Trunk', color: '#15803D', division: 'Guntakal' }
  ];

  const DEPT_CONFIG = {
    Engineering: {
      name: 'Engineering (TMS)',
      system: 'TMS (P-Way)',
      color: '#D97706',
      bgLight: '#FEF3C7',
      border: '#F59E0B',
      icon: Wrench,
      symbol: 'ENG'
    },
    'S&T': {
      name: 'S&T (SMMS)',
      system: 'SMMS (Signals)',
      color: '#7C3AED',
      bgLight: '#EDE9FE',
      border: '#8B5CF6',
      icon: Radio,
      symbol: 'S&T'
    },
    Traction: {
      name: 'Traction (TDMS)',
      system: 'TDMS (25kV OHE)',
      color: '#0284C7',
      bgLight: '#E0F2FE',
      border: '#0EA5E9',
      icon: Zap,
      symbol: 'TRD'
    }
  };

  const projectCoords = (lat, lon) => {
    const minLon = 76.8, maxLon = 83.8;
    const minLat = 13.3, maxLat = 18.2;
    const x = ((lon - minLon) / (maxLon - minLon)) * 740 + 30;
    const y = 460 - ((lat - minLat) / (maxLat - minLat)) * 420;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const stations = mapData?.stations || [];
  const rawJobs = mapData?.maintenance_jobs || [];
  const trains = mapData?.train_movements || [];
  const blocks = mapData?.active_blocks || [];

  const stationsMap = useMemo(() => {
    const map = {};
    for (const s of stations) {
      map[s.code] = s;
    }
    return map;
  }, [stations]);

  // Filter stations based on selected corridor
  const filteredStations = useMemo(() => {
    return stations.filter(s =>
      selectedCorridor === 'ALL' || (s.corridors && s.corridors.includes(selectedCorridor))
    );
  }, [stations, selectedCorridor]);

  // Filter jobs based on corridor, departments, and date range
  const filteredJobs = useMemo(() => {
    return rawJobs.filter(job => {
      // Corridor filter
      if (selectedCorridor !== 'ALL' && job.corridor_id !== selectedCorridor) {
        return false;
      }
      // Department filter
      if (!selectedDepartments.includes(job.department)) {
        return false;
      }
      // Date range filter
      const jobDate = (job.due_date || '').slice(0, 10);
      if (startDate && jobDate && jobDate < startDate) {
        return false;
      }
      if (endDate && jobDate && jobDate > endDate) {
        return false;
      }
      return true;
    });
  }, [rawJobs, selectedCorridor, selectedDepartments, startDate, endDate]);

  // Compute station coordinates with radial fanning for multiple co-located jobs
  const positionedJobs = useMemo(() => {
    const stationJobCounters = {};
    return filteredJobs.map((job) => {
      const stn = stationsMap[job.station] || stations[0];
      const baseCoords = stn ? projectCoords(stn.latitude, stn.longitude) : { x: 400, y: 240 };

      const count = stationJobCounters[job.station] || 0;
      stationJobCounters[job.station] = count + 1;

      // Deterministic radial fanning offset around station node
      const angle = (count % 6) * ((2 * Math.PI) / 6) + 0.3;
      const radius = 14 + Math.floor(count / 6) * 10;
      const x = Math.round(baseCoords.x + Math.cos(angle) * radius);
      const y = Math.round(baseCoords.y + Math.sin(angle) * radius);

      const hasConflict = Boolean(
        job.data_quality_issues &&
        job.data_quality_issues.length > 0 &&
        job.data_quality_issues.some(issue => issue.includes('mismatch') || issue.includes('duplicate'))
      );

      return {
        ...job,
        mapX: x,
        mapY: y,
        hasConflict
      };
    });
  }, [filteredJobs, stationsMap, stations]);

  // Department multi-select toggle handlers
  const handleToggleDepartment = (deptKey) => {
    setSelectedDepartments(prev => {
      if (prev.includes(deptKey)) {
        // Do not allow deselecting all: keep at least one or toggle
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== deptKey);
      } else {
        return [...prev, deptKey];
      }
    });
  };

  const handleSelectAllDepartments = () => {
    setSelectedDepartments(['Engineering', 'S&T', 'Traction']);
  };

  const allSelected = selectedDepartments.length === 3;

  // Preset Date Handlers
  const setPresetNext7Days = () => {
    setStartDate('2026-09-08');
    setEndDate('2026-09-15');
  };

  const setPresetNext14Days = () => {
    setStartDate('2026-09-08');
    setEndDate('2026-09-22');
  };

  const setPresetAllDates = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
      {/* Map Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
            <Compass className="w-4 h-4" />
            <span>SOUTH COAST RAILWAY NETWORK • CROSS-DEPARTMENT CORRIDOR MAP</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#172033] tracking-tight">
            Andhra Pradesh Unified Corridor Topology
          </h2>
          <p className="text-xs text-[#7A8494] mt-0.5">
            Cross-department synchronized maintenance possession map showing TMS, SMMS, and TDMS work items.
          </p>
        </div>

        {/* Corridor Selector */}
        <div className="flex items-center flex-wrap gap-1.5 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0] text-xs">
          <button
            onClick={() => setSelectedCorridor('ALL')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedCorridor === 'ALL' ? 'bg-[#1565C0] text-white shadow-sm' : 'text-[#7A8494] hover:text-[#172033] hover:bg-white'
            }`}
          >
            All SCoR
          </button>
          {corridorsMeta.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCorridor(c.id)}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                selectedCorridor === c.id ? 'bg-white text-[#172033] shadow-sm border border-[#E2E8F0]' : 'text-[#7A8494] hover:text-[#172033]'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cross-Department Controls & Date Filter Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
        {/* Requirement 1: Multi-Select Department Filter Control */}
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#172033] mr-1">
            <Filter className="w-3.5 h-3.5 text-[#1565C0]" />
            <span>Departments:</span>
          </div>

          <button
            onClick={handleSelectAllDepartments}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              allSelected
                ? 'bg-[#1565C0] text-white border-[#1565C0] shadow-sm'
                : 'bg-white text-[#5B6575] border-[#CBD5E1] hover:text-[#172033]'
            }`}
          >
            All Departments
          </button>

          {Object.entries(DEPT_CONFIG).map(([deptKey, cfg]) => {
            const isSelected = selectedDepartments.includes(deptKey);
            const Icon = cfg.icon;
            const deptJobCount = rawJobs.filter(j => j.department === deptKey).length;

            return (
              <button
                key={deptKey}
                onClick={() => handleToggleDepartment(deptKey)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? 'shadow-sm text-white'
                    : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                }`}
                style={isSelected ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cfg.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-[#E2E8F0] text-[#475569]'
                  }`}
                >
                  {deptJobCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Requirement 4: Simple Date-Range Picker */}
        <div className="lg:col-span-5 flex flex-wrap items-center justify-start lg:justify-end gap-2">
          <div className="flex items-center space-x-1 text-xs font-bold text-[#172033]">
            <Calendar className="w-3.5 h-3.5 text-[#1565C0]" />
            <span>Window:</span>
          </div>

          <div className="flex items-center space-x-1 bg-white border border-[#CBD5E1] rounded-lg px-2 py-0.5 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="outline-none text-xs text-[#172033] font-medium bg-transparent cursor-pointer"
            />
            <span className="text-[#94A3B8]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="outline-none text-xs text-[#172033] font-medium bg-transparent cursor-pointer"
            />
          </div>

          {/* Quick presets */}
          <div className="flex items-center space-x-1">
            <button
              onClick={setPresetNext7Days}
              className="px-2 py-1 bg-white border border-[#CBD5E1] rounded-md text-[10px] font-bold text-[#475569] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
            >
              7d
            </button>
            <button
              onClick={setPresetNext14Days}
              className="px-2 py-1 bg-white border border-[#CBD5E1] rounded-md text-[10px] font-bold text-[#475569] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
            >
              14d
            </button>
            <button
              onClick={setPresetAllDates}
              className="px-2 py-1 bg-white border border-[#CBD5E1] rounded-md text-[10px] font-bold text-[#475569] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
            >
              All
            </button>

            <button
              onClick={() => setIsBdmsModalOpen(true)}
              className="ml-2 px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-md text-[10px] font-bold flex items-center space-x-1 shadow-sm cursor-pointer"
              title="Open BDMS Block Demand Request with Pre-Submission Overlap Check"
            >
              <Sparkles className="w-3 h-3" />
              <span>+ Request Block (BDMS)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Layer Filters & Department Color Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-[#7A8494] font-semibold text-[11px]">Map Layers:</span>
          {['ALL', 'JOBS', 'BLOCKS', 'TRAINS'].map(layer => (
            <button
              key={layer}
              onClick={() => setActiveOverlay(layer)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                activeOverlay === layer ? 'bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#7A8494] hover:text-[#172033] border border-[#E2E8F0]'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>

        {/* Legend showing visually distinguished departments & conflict badges */}
        <div className="flex items-center flex-wrap gap-3 text-[11px] text-[#475569]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
            <span className="font-semibold">Engineering (TMS)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" />
            <span className="font-semibold">S&T (SMMS)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0284C7]" />
            <span className="font-semibold">Traction (TDMS)</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FECACA] text-[#DC2626] font-bold">
            <AlertTriangle className="w-3 h-3 text-[#DC2626]" />
            <span>Data Conflict Flag</span>
          </div>
        </div>
      </div>

      {/* Railway Map Canvas */}
      <div className="relative bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden min-h-[440px] flex items-center justify-center">
        <svg viewBox="0 0 800 480" className="w-full h-auto max-h-[500px] select-none">
          <defs>
            {/* Light Grid Pattern */}
            <pattern id="grid-light" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
            </pattern>
            {/* Drop shadow for markers */}
            <filter id="drop-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="0" dy="1" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.25"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Pulsing ring for critical defects */}
            <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D97706" floodOpacity="0.6"/>
            </filter>
            <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7C3AED" floodOpacity="0.6"/>
            </filter>
            <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0284C7" floodOpacity="0.6"/>
            </filter>
          </defs>

          {/* Map canvas background */}
          <rect width="800" height="480" fill="#FAFBFC" />
          <rect width="800" height="480" fill="url(#grid-light)" opacity="0.5" />

          {/* SCoR Corridor Route Lines */}
          {/* C02: Visakhapatnam to Vijayawada */}
          <path
            d="M 680,80 L 610,130 L 530,175 L 470,200 L 400,240"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C02' ? '#0369A1' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C02' ? '4.5' : '2.5'}
            strokeDasharray={selectedCorridor === 'C02' ? 'none' : '4,2'}
          />

          {/* C01: Vijayawada to Gudur */}
          <path
            d="M 400,240 L 390,280 L 370,330 L 360,380 L 350,430"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C01' ? '#DC2626' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C01' ? '4.5' : '2.5'}
          />

          {/* C03: Guntur to Nandyal */}
          <path
            d="M 380,260 L 310,290 L 250,310 L 170,330 L 120,335"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C03' ? '#7C3AED' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C03' ? '4.5' : '2.5'}
          />

          {/* C04: Guntakal to Renigunta */}
          <path
            d="M 70,300 L 110,320 L 180,360 L 250,395 L 330,440"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C04' ? '#15803D' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C04' ? '4.5' : '2.5'}
          />

          {/* Station Nodes */}
          {filteredStations.map((stn) => {
            const pos = projectCoords(stn.latitude, stn.longitude);
            const isHovered = hoveredStation?.code === stn.code;
            const isJunction = stn.junction;

            return (
              <g
                key={stn.code}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredStation(stn)}
                onMouseLeave={() => setHoveredStation(null)}
                onClick={() => setSelectedPin({ type: 'STATION', data: stn })}
              >
                <circle
                  r={isJunction ? 6 : 4}
                  fill={isJunction ? '#1565C0' : '#FFFFFF'}
                  stroke={isJunction ? '#1565C0' : '#64748B'}
                  strokeWidth="2"
                  filter="url(#drop-shadow)"
                  className="transition-all duration-200 group-hover:scale-125"
                />
                {isJunction && (
                  <circle r="9" fill="none" stroke="#1565C0" strokeWidth="1" opacity="0.3" />
                )}
                <text
                  x={8}
                  y={4}
                  fill={isHovered ? '#172033' : '#64748B'}
                  fontSize={isJunction ? '11' : '9'}
                  fontWeight={isJunction ? 'bold' : 'normal'}
                  fontFamily="sans-serif"
                >
                  {stn.name.split(' ')[0]} ({stn.code})
                </text>
              </g>
            );
          })}

          {/* Planned Block Indicators */}
          {(activeOverlay === 'ALL' || activeOverlay === 'BLOCKS') && (
            <g transform="translate(365, 330)" className="cursor-pointer">
              <rect x="-16" y="-9" width="32" height="18" rx="4" fill="#1565C0" stroke="#0D47A1" strokeWidth="1" filter="url(#drop-shadow)" />
              <text x="0" y="3" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                B-017
              </text>
            </g>
          )}

          {/* Train Movement Indicators */}
          {(activeOverlay === 'ALL' || activeOverlay === 'TRAINS') && (
            <>
              <g transform="translate(500, 185)" className="cursor-pointer">
                <circle r="6" fill="#B45309" filter="url(#drop-shadow)" />
                <text x="8" y="3" fill="#B45309" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
                  20833 Vande Bharat
                </text>
              </g>
              <g transform="translate(365, 360)" className="cursor-pointer">
                <circle r="5" fill="#B45309" opacity="0.8" filter="url(#drop-shadow)" />
                <text x="8" y="3" fill="#92400E" fontSize="8" fontFamily="sans-serif">
                  FRT-8014 Coal BoxN
                </text>
              </g>
            </>
          )}

          {/* Requirement 2: Visually Distinguish Jobs by Department with Conflict Badges */}
          {(activeOverlay === 'ALL' || activeOverlay === 'JOBS') && (
            positionedJobs.map((job) => {
              const dept = job.department || 'Engineering';
              const isEng = dept === 'Engineering';
              const isST = dept === 'S&T';
              const isTrac = dept === 'Traction';

              const pinColor = isEng ? '#D97706' : (isST ? '#7C3AED' : '#0284C7');
              const pinFilter = isEng ? 'url(#glow-amber)' : (isST ? 'url(#glow-purple)' : 'url(#glow-blue)');
              const isCritical = job.severity === 'CRITICAL' || job.priority_tier === 'CRITICAL';
              const isHovered = hoveredJob?.job_id === job.job_id;

              return (
                <g
                  key={job.job_id}
                  transform={`translate(${job.mapX}, ${job.mapY})`}
                  className="cursor-pointer transition-transform duration-150 hover:scale-125"
                  onMouseEnter={() => setHoveredJob(job)}
                  onMouseLeave={() => setHoveredJob(null)}
                  onClick={() => setSelectedJob(job)}
                >
                  {/* Critical urgency pulse halo */}
                  {isCritical && (
                    <circle
                      r="11"
                      fill={pinColor}
                      fillOpacity="0.25"
                      stroke={pinColor}
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                  )}

                  {/* Distinct Shape & Glyphs per Department */}
                  {isEng && (
                    // Engineering: Rounded Square / Diamond with Wrench
                    <g filter={pinFilter}>
                      <rect
                        x="-7"
                        y="-7"
                        width="14"
                        height="14"
                        rx="3"
                        fill="#D97706"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {/* Tool glyph */}
                      <path
                        d="M -3 -3 L 3 3 M 3 -3 L -3 3"
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {isST && (
                    // S&T: Diamond with Radio signal dot
                    <g filter={pinFilter} transform="rotate(45)">
                      <rect
                        x="-6"
                        y="-6"
                        width="12"
                        height="12"
                        rx="2"
                        fill="#7C3AED"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
                    </g>
                  )}

                  {isTrac && (
                    // Traction: Circle with lightning notch
                    <g filter={pinFilter}>
                      <circle
                        r="7"
                        fill="#0284C7"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {/* Zap glyph */}
                      <path
                        d="M 0 -4 L -2 0 L 1 0 L 0 4 L 3 -1 L 0 -1 Z"
                        fill="#FFFFFF"
                      />
                    </g>
                  )}

                  {/* Requirement 3: Surface Data Conflict Flag (⚠️) on the Pin */}
                  {job.hasConflict && (
                    <g transform="translate(6, -7)">
                      <circle r="4.5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="3" fill="#FFFFFF" fontSize="6" fontWeight="bold" textAnchor="middle">
                        !
                      </text>
                    </g>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {/* Hover Tooltip for Maintenance Jobs */}
        {hoveredJob && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur border border-[#CBD5E1] p-3 rounded-xl shadow-xl pointer-events-none text-xs space-y-1.5 z-30 max-w-xs animate-in fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-1.5">
              <span className="font-mono font-bold text-[#1565C0] text-xs">
                {hoveredJob.job_id}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: DEPT_CONFIG[hoveredJob.department]?.color || '#475569' }}
              >
                {hoveredJob.department} ({hoveredJob.source_system})
              </span>
            </div>

            <div className="font-bold text-[#172033] text-xs leading-tight">
              {hoveredJob.job_type?.replace(/_/g, ' ')}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#5B6575] pt-1">
              <div>
                Location: <span className="font-bold text-[#172033]">{hoveredJob.station} (KM {hoveredJob.km})</span>
              </div>
              <div>
                Priority: <span className={`font-bold ${hoveredJob.priority_score >= 80 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                  {hoveredJob.priority_tier} ({hoveredJob.priority_score}/100)
                </span>
              </div>
              <div>
                Due Date: <span className="font-bold text-[#172033]">{hoveredJob.due_date}</span>
              </div>
              <div>
                Duration: <span className="font-bold text-[#172033]">{hoveredJob.estimated_duration_min} min</span>
              </div>
            </div>

            {/* Requirement 3: Surface conflict flag on hover */}
            {hoveredJob.hasConflict && (
              <div className="mt-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-2 flex items-start space-x-1.5 text-[10px] text-[#B91C1C]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Unresolved Data Conflict Flagged</div>
                  <div className="font-mono text-[9px] mt-0.5 opacity-90">
                    {hoveredJob.data_quality_issues?.find(i => i.includes('mismatch')) || 'Cross-department data mismatch'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Station Hover Tooltip */}
        {hoveredStation && !hoveredJob && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur border border-[#E2E8F0] p-3 rounded-lg shadow-lg pointer-events-none text-xs space-y-1 z-20">
            <div className="font-bold text-[#172033] flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1565C0]" />
              <span>{hoveredStation.name} ({hoveredStation.code})</span>
            </div>
            <div className="text-[#7A8494] text-[11px]">
              Division: <span className="text-[#172033] font-semibold">{hoveredStation.division}</span> | Zone: SCoR
            </div>
            <div className="text-[#7A8494] text-[11px]">
              Corridors: <span className="text-[#1565C0] font-mono">{hoveredStation.corridors?.join(', ')}</span>
            </div>
            {hoveredStation.junction && (
              <span className="inline-block bg-[#EFF6FF] text-[#1565C0] text-[9px] px-1.5 py-0.5 rounded font-bold mt-1 border border-[#BFDBFE]">
                MAJOR JUNCTION
              </span>
            )}
          </div>
        )}
      </div>

      {/* Requirement 3: Detailed Job Inspection Modal on Click */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-base text-[#1565C0]">
                    {selectedJob.job_id}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: DEPT_CONFIG[selectedJob.department]?.color || '#475569' }}
                  >
                    {selectedJob.department} ({selectedJob.source_system})
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#172033] mt-1">
                  {selectedJob.job_type?.replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conflict Warning Card */}
            {selectedJob.hasConflict && (
              <div className="bg-[#FEF2F2] border-2 border-[#F87171] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-[#991B1B] font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  <span>Unresolved Cross-Department Data Conflict Detected</span>
                </div>
                <p className="text-[11px] text-[#7F1D1D] leading-relaxed">
                  Different departments have reported contradictory facts for this physical asset location.
                  Provisional resolution applied (most recently synced source wins) pending human officer review.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedJob.data_quality_issues?.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-white font-mono text-[10px] font-bold text-[#991B1B] border border-[#FECACA]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Job Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
              <div>
                <span className="text-[#64748B] text-[11px]">Corridor & Station:</span>
                <p className="font-bold text-[#172033]">{selectedJob.corridor_id} • {selectedJob.station}</p>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px]">KM Location:</span>
                <p className="font-bold text-[#172033]">{selectedJob.km} KM</p>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px]">Due Date:</span>
                <p className="font-bold text-[#172033]">{selectedJob.due_date}</p>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px]">Duration Required:</span>
                <p className="font-bold text-[#172033]">{selectedJob.estimated_duration_min} mins</p>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px]">Priority Tier & Score:</span>
                <p className={`font-bold ${selectedJob.priority_score >= 80 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                  {selectedJob.priority_tier} ({selectedJob.priority_score}/100)
                </p>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px]">Canonical Asset ID:</span>
                <p className="font-mono font-bold text-[#172033] truncate">{selectedJob.canonical_asset_id || selectedJob.asset_id}</p>
              </div>
            </div>

            {/* Crew & Equipment */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Crew Allocation:</span>
                <span className="font-bold text-[#172033]">{selectedJob.crew_required || 'Standard Crew'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Special Equipment:</span>
                <span className="font-bold text-[#172033]">{selectedJob.equipment_required || 'Standard Tools'}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1565C0] text-white hover:bg-[#0D47A1] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corridor Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
        {corridorsMeta.map(c => {
          const corridorJobCount = rawJobs.filter(j => j.corridor_id === c.id).length;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCorridor(c.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedCorridor === c.id
                  ? 'bg-white border-[#1565C0] shadow-sm ring-1 ring-[#1565C0]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#172033]">{c.id}</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              </div>
              <p className="text-[11px] text-[#7A8494] truncate mt-1">{c.name}</p>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#E2E8F0] text-[10px]">
                <span className="text-[#7A8494]">{c.division} Div</span>
                <span className="font-bold text-[#1565C0]">{corridorJobCount} Jobs</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* BDMS Block Request Modal with Pre-Submission Conflict Guard */}
      <BdmsRequestModal
        isOpen={isBdmsModalOpen}
        onClose={() => setIsBdmsModalOpen(false)}
        initialCorridor={selectedCorridor !== 'ALL' ? selectedCorridor : 'C01'}
        initialKm={124.4}
      />
    </div>
  );
}
