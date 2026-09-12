import { useState, useEffect, useMemo } from 'react';
import {
  Train, MapPin, AlertCircle, Compass,
  Layers, ChevronRight, Eye, Wrench, Radio, Zap,
  Calendar, Filter, ShieldAlert, CheckCircle2, Clock, AlertTriangle, X, Sparkles,
  RotateCcw
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

  // Prompt 3 Feature A: Planned Block Details Drawer/Modal
  const [selectedPlannedBlock, setSelectedPlannedBlock] = useState(null);

  // Prompt 3 Feature B: Simple Map Filters (Show Checklist & Department Filter)
  const [showChecklist, setShowChecklist] = useState({
    blocks: true,
    requests: true,
    stations: true
  });
  const [deptFilter, setDeptFilter] = useState('ALL'); // 'ALL' | 'Engineering' | 'S&T' | 'TRD'

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

  // Geographic Bounding Box and Projection for South Coast Railway / Andhra Pradesh
  // Longitude: 76.6° E to 84.0° E, Latitude: 13.2° N to 18.2° N
  const projectCoords = (lat, lon) => {
    const minLon = 76.6, maxLon = 84.0;
    const minLat = 13.2, maxLat = 18.2;
    const width = 900, height = 560;
    const paddingX = 45, paddingY = 40;
    const x = paddingX + ((lon - minLon) / (maxLon - minLon)) * (width - 2 * paddingX);
    const y = height - paddingY - ((lat - minLat) / (maxLat - minLat)) * (height - 2 * paddingY);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  const stations = mapData?.stations || [];
  const rawJobs = mapData?.maintenance_jobs || [];
  const trains = mapData?.train_movements || [];
  const rawBlocks = mapData?.active_blocks || [];

  // Pan and Zoom State for map canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Selected element for detailed inspection popup
  const [selectedMapItem, setSelectedMapItem] = useState(null);

  const handleMouseDown = (e) => {
    // Only drag with left click on SVG canvas
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(3.0, Math.round((z + 0.35) * 100) / 100));
  const handleZoomOut = () => setZoom(z => Math.max(1.0, Math.round((z - 0.35) * 100) / 100));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const stationsMap = useMemo(() => {
    const map = {};
    for (const s of stations) {
      map[s.code] = s;
    }
    return map;
  }, [stations]);

  // Filter stations based on selected corridor and showChecklist
  const filteredStations = useMemo(() => {
    if (!showChecklist.stations) return [];
    return stations.filter(s =>
      selectedCorridor === 'ALL' || (s.corridors && s.corridors.includes(selectedCorridor))
    );
  }, [stations, showChecklist.stations, selectedCorridor]);

  // Filter jobs based on corridor, departments, deptFilter, showChecklist, and date range
  const filteredJobs = useMemo(() => {
    if (!showChecklist.requests) return [];
    return rawJobs.filter(job => {
      if (selectedCorridor !== 'ALL' && job.corridor_id !== selectedCorridor) {
        return false;
      }
      if (deptFilter !== 'ALL') {
        if (deptFilter === 'Engineering' && job.department !== 'Engineering') return false;
        if (deptFilter === 'S&T' && job.department !== 'S&T') return false;
        if (deptFilter === 'TRD' && job.department !== 'Traction' && job.department !== 'TRD') return false;
      } else if (!selectedDepartments.includes(job.department)) {
        return false;
      }
      const jobDate = (job.due_date || '').slice(0, 10);
      if (startDate && jobDate && jobDate < startDate) {
        return false;
      }
      if (endDate && jobDate && jobDate > endDate) {
        return false;
      }
      return true;
    });
  }, [rawJobs, showChecklist.requests, selectedCorridor, deptFilter, selectedDepartments, startDate, endDate]);

  // Ordered Stations per Corridor for realistic continuous railway track curves
  const corridorStationSequences = useMemo(() => ({
    C01: ['BZA', 'TEL', 'BPP', 'CLX', 'OGL', 'SKM', 'KVZ', 'NLR', 'GDR'],
    C02: ['VSKP', 'DVD', 'AKP', 'TUNI', 'ANV', 'SLO', 'RJY', 'NDD', 'TDD', 'EE', 'BZA'],
    C03: ['BZA', 'TEL', 'GNT', 'NRT', 'VKN', 'DKD', 'MRK', 'GID', 'NDL'],
    C04: ['GTL', 'GY', 'TU', 'KDP', 'YA', 'HX', 'RJP', 'KOU', 'RU', 'TPTY']
  }), []);

  // Catmull-Rom to Cubic Bezier smooth spline generator for continuous track alignment
  const generateSplinePath = (coordsList) => {
    if (!coordsList || coordsList.length === 0) return '';
    if (coordsList.length === 1) return `M ${coordsList[0].x} ${coordsList[0].y}`;
    if (coordsList.length === 2) return `M ${coordsList[0].x} ${coordsList[0].y} L ${coordsList[1].x} ${coordsList[1].y}`;

    let d = `M ${coordsList[0].x} ${coordsList[0].y}`;
    for (let i = 0; i < coordsList.length - 1; i++) {
      const p0 = i === 0 ? coordsList[0] : coordsList[i - 1];
      const p1 = coordsList[i];
      const p2 = coordsList[i + 1];
      const p3 = i + 2 >= coordsList.length ? coordsList[coordsList.length - 1] : coordsList[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Precompute smooth track paths for each corridor
  const corridorPaths = useMemo(() => {
    const paths = {};
    Object.entries(corridorStationSequences).forEach(([cId, codes]) => {
      const coords = codes
        .map(code => stationsMap[code])
        .filter(Boolean)
        .map(stn => projectCoords(stn.latitude, stn.longitude));
      paths[cId] = generateSplinePath(coords);
    });
    return paths;
  }, [corridorStationSequences, stationsMap]);

  // Group Jobs by Station for intelligent decluttering and zoom-based clustering
  const stationJobsCluster = useMemo(() => {
    const clusters = {};
    filteredJobs.forEach(job => {
      const stnCode = job.station;
      if (!clusters[stnCode]) {
        clusters[stnCode] = [];
      }
      const hasConflict = Boolean(
        job.data_quality_issues &&
        job.data_quality_issues.length > 0 &&
        job.data_quality_issues.some(i => i.includes('mismatch') || i.includes('duplicate'))
      );
      clusters[stnCode].push({ ...job, hasConflict });
    });
    return clusters;
  }, [filteredJobs]);

  // Active maintenance blocks on the tracks
  const activeBlocksList = useMemo(() => {
    const defaultBlocks = [
      {
        block_id: 'BLK-017',
        corridor_id: 'C01',
        section_id: 'SEC_C01_01',
        section_name: 'Vijayawada – Tenali',
        from_stn: 'BZA',
        to_stn: 'TEL',
        location: 'SEC_C01_01 • KM 0.0 – 31.5 (BZA – TEL)',
        date: '2026-09-17',
        start_time: '01:00',
        end_time: '04:00',
        time_window: '01:00 – 04:00',
        duration_min: 180,
        duration_hours: 3.0,
        departments: ['Engineering'],
        department: 'Engineering',
        window_name: 'Night Rolling Megablock',
        status: 'Active Track Possession',
        train_conflicts: '0 Scheduled Train Clashes (Clear Headway)',
        resources: 'Plasser CSM 09-32 Tamping Machine, CREW-ENG-BZA-02',
        is_joint_block: false,
        is_joint_megablock: false,
        work_summary: 'Heavy rail tamping with Plasser CSM 09-32'
      },
      {
        block_id: 'BLK-042',
        corridor_id: 'C02',
        section_id: 'SEC_C02_06',
        section_name: 'Samalkot – Rajahmundry',
        from_stn: 'SLO',
        to_stn: 'RJY',
        location: 'SEC_C02_06 • KM 150.0 – 200.2 (SLO – RJY)',
        date: '2026-09-17',
        start_time: '01:30',
        end_time: '04:30',
        time_window: '01:30 – 04:30',
        duration_min: 180,
        duration_hours: 3.0,
        departments: ['Traction'],
        department: 'Traction',
        window_name: 'Night Power Isolation',
        status: 'Active Track Possession',
        train_conflicts: '0 Scheduled Train Clashes (Clear Headway)',
        resources: 'Tower Wagon Crew (CREW-TRD-BZA-01)',
        is_joint_block: false,
        is_joint_megablock: false,
        work_summary: '25kV OHE catenary replacement and bracket overhaul'
      },
      {
        block_id: 'BLK-089',
        corridor_id: 'C03',
        section_id: 'SEC_C03_01',
        section_name: 'Guntur – Narasaraopet',
        from_stn: 'GNT',
        to_stn: 'NRT',
        location: 'SEC_C03_01 • KM 0.0 – 45.4 (GNT – NRT)',
        date: '2026-09-18',
        start_time: '11:30',
        end_time: '14:00',
        time_window: '11:30 – 14:00',
        duration_min: 150,
        duration_hours: 2.5,
        departments: ['S&T'],
        department: 'S&T',
        window_name: 'Mid-Day Shadow Window',
        status: 'Scheduled Possession',
        train_conflicts: '0 Scheduled Train Clashes (Clear Headway)',
        resources: 'Point Machine Maintenance Team (RES-SNT-GANG-03)',
        is_joint_block: false,
        is_joint_megablock: false,
        work_summary: 'Electronic interlocking and point machine renewal'
      },
      {
        block_id: 'BLK-104',
        corridor_id: 'C04',
        section_id: 'SEC_C04_06',
        section_name: 'Kadapa – Razampeta',
        from_stn: 'HX',
        to_stn: 'RJP',
        location: 'SEC_C04_06 • KM 187.0 – 237.8 (HX – RJP)',
        date: '2026-09-18',
        start_time: '02:00',
        end_time: '05:00',
        time_window: '02:00 – 05:00',
        duration_min: 180,
        duration_hours: 3.0,
        departments: ['Engineering', 'Traction'],
        department: 'Joint',
        window_name: 'Joint Megablock Window',
        status: 'Bundled Multi-Dept Possession',
        train_conflicts: '0 Scheduled Train Clashes (Clear Headway)',
        resources: 'Joint P-Way BCM Team + TRD Mast Bonding Gang',
        is_joint_block: true,
        is_joint_megablock: true,
        work_summary: 'Joint P-Way deep screening + TRD mast bonding'
      },
      {
        block_id: 'BLK-112',
        corridor_id: 'C01',
        section_id: 'SEC_C01_05',
        section_name: 'Ongole – Singarayakonda',
        from_stn: 'OGL',
        to_stn: 'SKM',
        location: 'SEC_C01_05 • KM 124.6 – 152.4 (OGL – SKM)',
        date: '2026-09-19',
        start_time: '04:30',
        end_time: '07:00',
        time_window: '04:30 – 07:00',
        duration_min: 150,
        duration_hours: 2.5,
        departments: ['Engineering'],
        department: 'Engineering',
        window_name: 'Early Morning Off-Peak',
        status: 'Scheduled Possession',
        train_conflicts: '0 Scheduled Train Clashes (Clear Headway)',
        resources: 'Hydraulic Rail Tensor & Flash Butt Welding Team',
        is_joint_block: false,
        is_joint_megablock: false,
        work_summary: 'Continuous welded rail destressing and neutral temperature test'
      }
    ];

    if (rawBlocks.length > 0) {
      return rawBlocks.map((b, idx) => {
        const depts = b.departments || (b.department ? [b.department] : ['Engineering']);
        const isJoint = Boolean(b.is_joint_block || b.is_joint_megablock || depts.length > 1);
        const durMin = b.duration_min || b.duration_minutes || (b.duration_hours ? Math.round(b.duration_hours * 60) : 180);
        const durHrs = b.duration_hours || (durMin / 60).toFixed(1);
        const startT = b.start_time || '01:00';
        const endT = b.end_time || '04:00';
        const fromStn = b.from_stn || b.from_station || 'BZA';
        const toStn = b.to_stn || b.to_station || 'TEL';

        return {
          block_id: b.block_id || `BLK-${idx + 100}`,
          corridor_id: b.corridor_id || 'C01',
          section_id: b.section_id || 'SEC_C01_01',
          section_name: b.section_name || 'Corridor Section',
          from_stn: fromStn,
          to_stn: toStn,
          location: b.location || b.section_name || `${fromStn} – ${toStn}`,
          date: b.date || '2026-09-17',
          start_time: startT,
          end_time: endT,
          time_window: b.time_window || `${startT} – ${endT}`,
          duration_min: durMin,
          duration_hours: durHrs,
          departments: depts,
          department: b.department || (depts.length > 1 ? 'Joint' : depts[0]),
          window_name: b.window_name || 'Maintenance Window',
          status: b.status || 'Active Track Possession',
          train_conflicts: b.train_conflicts || '0 Scheduled Train Clashes (Clear Headway)',
          resources: b.resources || 'Allocated Maintenance Gang & Machinery',
          is_joint_block: isJoint,
          is_joint_megablock: isJoint,
          work_summary: b.work_summary || b.notes || 'Scheduled possession window'
        };
      });
    }
    return defaultBlocks;
  }, [rawBlocks]);

  // Feature B: Filtered Active Blocks based on Show Checklist, Corridor, and Department
  const filteredActiveBlocks = useMemo(() => {
    if (!showChecklist.blocks) return [];
    return activeBlocksList.filter(blk => {
      // Corridor filter
      if (selectedCorridor !== 'ALL' && blk.corridor_id !== selectedCorridor) {
        return false;
      }
      // Department filter (All / Engineering / S&T / TRD)
      if (deptFilter !== 'ALL') {
        const blkDepts = blk.departments || [blk.department];
        const matchEng = deptFilter === 'Engineering' && (blkDepts.includes('Engineering') || blk.department === 'Engineering');
        const matchST = deptFilter === 'S&T' && (blkDepts.includes('S&T') || blk.department === 'S&T');
        const matchTRD = (deptFilter === 'TRD' || deptFilter === 'Traction') && (
          blkDepts.includes('Traction') || blkDepts.includes('TRD') || blk.department === 'Traction' || blk.department === 'TRD'
        );
        if (!matchEng && !matchST && !matchTRD) return false;
      }
      return true;
    });
  }, [activeBlocksList, showChecklist.blocks, selectedCorridor, deptFilter]);

  // Live Train Movements with realistic directional coordinates along the tracks
  const liveTrainsList = useMemo(() => [
    {
      train_number: '20833',
      train_name: 'Vande Bharat Express',
      type: 'VIP',
      corridor_id: 'C02',
      from_stn: 'TUNI',
      to_stn: 'ANV',
      speed_kmph: 130,
      direction: 'DN',
      status: 'On Time',
      occupancy: 'Clear Headway'
    },
    {
      train_number: '12727',
      train_name: 'Godavari Superfast',
      type: 'SUPERFAST',
      corridor_id: 'C01',
      from_stn: 'TEL',
      to_stn: 'BPP',
      speed_kmph: 110,
      direction: 'UP',
      status: '+4 min',
      occupancy: 'Approaching Block Zone'
    },
    {
      train_number: 'FRT-8014',
      train_name: 'Coal BoxN Freight',
      type: 'FREIGHT',
      corridor_id: 'C04',
      from_stn: 'YA',
      to_stn: 'HX',
      speed_kmph: 65,
      direction: 'DN',
      status: 'Regulated',
      occupancy: 'Freight Loop Wait'
    },
    {
      train_number: '17226',
      train_name: 'Amaravati Express',
      type: 'EXPRESS',
      corridor_id: 'C03',
      from_stn: 'VKN',
      to_stn: 'DKD',
      speed_kmph: 85,
      direction: 'UP',
      status: 'On Time',
      occupancy: 'Single Line Token Clear'
    },
    {
      train_number: '12861',
      train_name: 'Link SF Express',
      type: 'SUPERFAST',
      corridor_id: 'C02',
      from_stn: 'RJY',
      to_stn: 'NDD',
      speed_kmph: 105,
      direction: 'DN',
      status: 'On Time',
      occupancy: 'Godavari Arch Bridge Transit'
    }
  ], []);

  // Known Data Conflicts with exact geographic locations
  const conflictLocations = useMemo(() => [
    {
      id: 'CONF-01',
      corridor_id: 'C01',
      station_code: 'BPP',
      km: 74.2,
      departments: ['Engineering (TMS)', 'Traction (TDMS)'],
      description: 'Location Mismatch: TMS records KM 74.2 whereas TDMS reports OHE mast at KM 74.8 (delta > 50m).',
      resolution: 'Provisional: TMS recency precedence applied pending PWI site verification.'
    },
    {
      id: 'CONF-02',
      corridor_id: 'C02',
      station_code: 'RJY',
      km: 201.5,
      departments: ['S&T (SMMS)', 'Engineering (TMS)'],
      description: 'Condition Score Mismatch: SMMS rates turnout at 52/100 whereas TMS rates track segment at 78/100.',
      resolution: 'Flagged for Divisional Safety Officer joint inspection.'
    }
  ], []);


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

      {/* Feature B — Map Filter Panel: Show Checklist + Department Quick Filter */}
      <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-[#F0F4FF] to-[#F8FAFC] border border-[#DBEAFE] rounded-xl px-4 py-2.5 text-xs">
        {/* Show checklist */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#172033] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#1565C0]" />
            Show:
          </span>
          {[
            { key: 'blocks',   label: 'Planned Blocks',       color: '#0F766E' },
            { key: 'requests', label: 'Maintenance Requests',  color: '#D97706' },
            { key: 'stations', label: 'Stations',              color: '#1565C0' }
          ].map(({ key, label, color }) => (
            <label
              key={key}
              className="flex items-center gap-1.5 cursor-pointer select-none group"
            >
              <span
                onClick={() => setShowChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                  showChecklist[key]
                    ? 'border-transparent'
                    : 'border-[#CBD5E1] bg-white'
                }`}
                style={showChecklist[key] ? { backgroundColor: color, borderColor: color } : {}}
              >
                {showChecklist[key] && (
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span
                className={`font-semibold transition-colors ${
                  showChecklist[key] ? 'text-[#172033]' : 'text-[#94A3B8] line-through'
                }`}
              >
                {label}
              </span>
            </label>
          ))}
        </div>

        {/* Vertical divider */}
        <div className="hidden sm:block w-px h-5 bg-[#CBD5E1]" />

        {/* Department quick filter */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#172033] flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#1565C0]" />
            Department:
          </span>
          {[
            { value: 'ALL',         label: 'All',         bg: '#1565C0' },
            { value: 'Engineering', label: 'Engineering',  bg: '#D97706' },
            { value: 'S&T',         label: 'S&T',          bg: '#7C3AED' },
            { value: 'TRD',         label: 'Traction/TRD', bg: '#0284C7' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDeptFilter(opt.value)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer border text-[11px] ${
                deptFilter === opt.value
                  ? 'text-white border-transparent shadow-sm'
                  : 'text-[#64748B] border-[#CBD5E1] bg-white hover:bg-[#F1F5F9]'
              }`}
              style={deptFilter === opt.value ? { backgroundColor: opt.bg, borderColor: opt.bg } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Active filter summary chip */}
        {(deptFilter !== 'ALL' || !showChecklist.blocks || !showChecklist.requests || !showChecklist.stations) && (
          <button
            onClick={() => {
              setDeptFilter('ALL');
              setShowChecklist({ blocks: true, requests: true, stations: true });
            }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[11px] font-bold hover:bg-[#FFEDD5] cursor-pointer transition-all"
          >
            <X className="w-3 h-3" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Realistic Geographic Railway Map Canvas with Pan & Zoom */}
      <div
        className="relative bg-[#F4F7FA] border border-[#CBD5E1] rounded-2xl overflow-hidden min-h-[540px] select-none shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Floating Pan/Zoom Controls */}
        <div className="absolute top-4 left-4 z-30 flex items-center space-x-1.5 bg-white/95 backdrop-blur-md border border-[#CBD5E1] rounded-xl p-1.5 shadow-md">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#1E293B] hover:text-[#1565C0] font-bold transition-all cursor-pointer"
            title="Zoom In (+)"
          >
            <span className="text-base leading-none font-black">+</span>
          </button>
          <div className="px-2 py-0.5 text-[11px] font-mono font-bold text-[#475569] border-x border-[#E2E8F0]">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#1E293B] hover:text-[#1565C0] font-bold transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <span className="text-base leading-none font-black">−</span>
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#1565C0] text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Map Header Overlay Pill */}
        <div className="absolute top-4 right-4 z-20 hidden md:flex items-center space-x-2 bg-white/90 backdrop-blur-md border border-[#E2E8F0] px-3 py-1.5 rounded-xl shadow-xs text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-[#172033]">SCoR Live Geographic Topology</span>
          <span className="text-[#64748B] text-[11px]">| EPSG:4326 Lat/Lon Projected</span>
        </div>

        {/* SVG Railway Geographic Canvas */}
        <svg
          viewBox="0 0 900 560"
          className="w-full h-full min-h-[540px]"
        >
          <defs>
            {/* Soft Ocean Grid */}
            <pattern id="ocean-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#BAE6FD" strokeWidth="0.4" strokeDasharray="2,2" />
            </pattern>

            {/* Shaded Relief Gradient for Landmass */}
            <linearGradient id="land-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="60%" stopColor="#F1F5F9" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            {/* Bay of Bengal Ocean Gradient */}
            <linearGradient id="ocean-gradient" x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.95" />
            </linearGradient>

            {/* Drop Shadows */}
            <filter id="geo-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.15" />
            </filter>
            <filter id="badge-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.2" />
            </filter>

            {/* Glowing Block Line Filters */}
            <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D97706" floodOpacity="0.8" />
            </filter>
            <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7C3AED" floodOpacity="0.8" />
            </filter>
            <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0284C7" floodOpacity="0.8" />
            </filter>
            <filter id="glow-teal" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#0F766E" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* Transformable Canvas Group for Pan & Zoom */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: '450px 280px', transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
          >
            {/* 1. Base Landmass (Andhra Pradesh & Rayalaseema Region) */}
            <rect width="900" height="560" fill="url(#land-gradient)" />

            {/* Eastern Ghats & Nallamala Hills Topographic Shading */}
            <path
              d="M 170,280 Q 240,320 280,360 Q 320,400 350,460 Q 330,480 300,430 Q 250,370 200,320 Z"
              fill="#E2E8F0"
              opacity="0.6"
            />
            <path
              d="M 450,120 Q 520,160 560,190 Q 530,220 480,180 Z"
              fill="#E2E8F0"
              opacity="0.5"
            />

            {/* Major AP Rivers (Krishna & Godavari River Systems) */}
            {/* Godavari River passing Rajahmundry */}
            <path
              d="M 520,60 Q 560,95 615,142 Q 640,175 665,195"
              fill="none"
              stroke="#93C5FD"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.75"
            />
            <text x="560" y="115" fill="#60A5FA" fontSize="8" fontStyle="italic" fontWeight="600" opacity="0.8">
              Godavari River
            </text>

            {/* Krishna River passing Vijayawada */}
            <path
              d="M 330,170 Q 410,185 486,201 Q 530,230 550,265"
              fill="none"
              stroke="#93C5FD"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.75"
            />
            <text x="390" y="175" fill="#60A5FA" fontSize="8" fontStyle="italic" fontWeight="600" opacity="0.8">
              Krishna River
            </text>

            {/* Penna River near Nellore */}
            <path
              d="M 310,380 Q 360,395 425,414"
              fill="none"
              stroke="#93C5FD"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.7"
            />

            {/* 2. Bay of Bengal (Realistic Coastline Polygon from Visakhapatnam to Pulicat/Gudur) */}
            <path
              d="M 870,20 Q 820,55 782,86 Q 740,110 705,126 Q 675,145 665,160 Q 645,185 628,213 Q 580,245 520,268 Q 470,285 448,295 Q 430,312 425,330 Q 420,360 422,380 Q 425,405 433,425 Q 438,455 440,480 Q 445,510 450,560 L 900,560 L 900,20 Z"
              fill="url(#ocean-gradient)"
              stroke="#93C5FD"
              strokeWidth="1.5"
            />
            {/* Ocean Texture Grid */}
            <path
              d="M 870,20 Q 820,55 782,86 Q 740,110 705,126 Q 675,145 665,160 Q 645,185 628,213 Q 580,245 520,268 Q 470,285 448,295 Q 430,312 425,330 Q 420,360 422,380 Q 425,405 433,425 Q 438,455 440,480 Q 445,510 450,560 L 900,560 L 900,20 Z"
              fill="url(#ocean-grid)"
            />

            {/* Bay of Bengal Geographic Label */}
            <text
              x="720"
              y="320"
              fill="#0284C7"
              opacity="0.35"
              fontSize="22"
              fontWeight="900"
              letterSpacing="6"
              fontFamily="sans-serif"
              transform="rotate(25, 720, 320)"
            >
              BAY OF BENGAL
            </text>

            {/* Regional Land Labels */}
            <text x="140" y="240" fill="#94A3B8" opacity="0.45" fontSize="13" fontWeight="800" letterSpacing="3">
              RAYALASEEMA REGION
            </text>
            <text x="440" y="80" fill="#94A3B8" opacity="0.45" fontSize="13" fontWeight="800" letterSpacing="3">
              COASTAL ANDHRA
            </text>

            {/* 3. Continuous Curved Railway Track Alignments (Catmull-Rom Smooth Splines) */}
            {/* Casing / Track Foundation for All Tracks */}
            {Object.entries(corridorPaths).map(([cId, pathD]) => {
              const isSelected = selectedCorridor === 'ALL' || selectedCorridor === cId;
              return (
                <g key={`track-casing-${cId}`}>
                  {/* Railway Bed Outer Casing */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth={isSelected ? (selectedCorridor === cId ? 5.5 : 4) : 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected ? 0.85 : 0.25}
                  />
                  {/* Railway Dual-Track Center Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={corridorsMeta.find(c => c.id === cId)?.color || '#1565C0'}
                    strokeWidth={isSelected ? (selectedCorridor === cId ? 3 : 2) : 1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected ? 1 : 0.4}
                  />
                  {/* Railway Sleeper Tick Marks (visible when zoomed in) */}
                  {zoom >= 1.4 && isSelected && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.2"
                      strokeDasharray="2,6"
                      opacity="0.8"
                    />
                  )}
                </g>
              );
            })}

            {/* 4. BLOCKS LAYER: Active Maintenance Blocks Highlighted Directly on Track Segments */}
            {(activeOverlay === 'ALL' || activeOverlay === 'BLOCKS') && (
              filteredActiveBlocks.map((blk) => {
                const p1 = stationsMap[blk.from_stn] ? projectCoords(stationsMap[blk.from_stn].latitude, stationsMap[blk.from_stn].longitude) : null;
                const p2 = stationsMap[blk.to_stn] ? projectCoords(stationsMap[blk.to_stn].latitude, stationsMap[blk.to_stn].longitude) : null;
                if (!p1 || !p2) return null;

                const isSelectedCorridor = selectedCorridor === 'ALL' || selectedCorridor === blk.corridor_id;
                if (!isSelectedCorridor) return null;

                // Segment color based on department matching filter chips
                const deptColor = blk.department === 'Engineering'
                  ? '#D97706'
                  : blk.department === 'S&T'
                  ? '#7C3AED'
                  : blk.department === 'Traction'
                  ? '#0284C7'
                  : '#0F766E'; // Joint / Multi-Department
                
                const filterGlow = blk.department === 'Engineering'
                  ? 'url(#glow-orange)'
                  : blk.department === 'S&T'
                  ? 'url(#glow-purple)'
                  : blk.department === 'Traction'
                  ? 'url(#glow-blue)'
                  : 'url(#glow-teal)';

                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <g
                    key={blk.block_id}
                    className="cursor-pointer group"
                    onClick={() => setSelectedMapItem({ type: 'BLOCK', data: blk })}
                  >
                    {/* Glowing Track Segment for the Block Window */}
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={deptColor}
                      strokeWidth="6"
                      strokeLinecap="round"
                      filter={filterGlow}
                      className="transition-all duration-200 group-hover:stroke-width-8"
                    />
                    {/* Inner high-contrast dashed center line */}
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeDasharray="4,3"
                    />
                    {/* Clean Floating Badge directly on the track block */}
                    <g transform={`translate(${midX}, ${midY - 8})`}>
                      <rect
                        x="-24"
                        y="-8"
                        width="48"
                        height="16"
                        rx="4"
                        fill={deptColor}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        filter="url(#badge-shadow)"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#FFFFFF"
                        fontSize="8.5"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                      >
                        {blk.block_id}
                      </text>
                    </g>
                  </g>
                );
              })
            )}

            {/* 5. TRAINS LAYER: Live Directional Train Markers Moving Along Tracks */}
            {(activeOverlay === 'ALL' || activeOverlay === 'TRAINS') && (
              liveTrainsList.map((trn) => {
                const p1 = stationsMap[trn.from_stn] ? projectCoords(stationsMap[trn.from_stn].latitude, stationsMap[trn.from_stn].longitude) : null;
                const p2 = stationsMap[trn.to_stn] ? projectCoords(stationsMap[trn.to_stn].latitude, stationsMap[trn.to_stn].longitude) : null;
                if (!p1 || !p2) return null;

                const isSelectedCorridor = selectedCorridor === 'ALL' || selectedCorridor === trn.corridor_id;
                if (!isSelectedCorridor) return null;

                // Interpolate train position along section (~60% along segment)
                const t = 0.58;
                const trnX = p1.x + (p2.x - p1.x) * t;
                const trnY = p1.y + (p2.y - p1.y) * t;

                // Compute heading angle for directional chevron
                const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const angleDeg = (angleRad * 180) / Math.PI;

                const trainColor = trn.type === 'VIP' ? '#0284C7' : (trn.type === 'SUPERFAST' ? '#15803D' : '#B45309');

                return (
                  <g
                    key={trn.train_number}
                    transform={`translate(${trnX}, ${trnY})`}
                    className="cursor-pointer group"
                    onClick={() => setSelectedMapItem({ type: 'TRAIN', data: trn })}
                  >
                    {/* Directional Train Icon */}
                    <g transform={`rotate(${angleDeg})`}>
                      <path
                        d="M -9 -5 L 9 0 L -9 5 L -6 0 Z"
                        fill={trainColor}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        filter="url(#badge-shadow)"
                      />
                    </g>
                    {/* Train Tag Label */}
                    <g transform="translate(12, -4)">
                      <rect
                        x="-2"
                        y="-8"
                        width={trn.train_number.length * 6 + 28}
                        height="14"
                        rx="3"
                        fill="#FFFFFF"
                        stroke={trainColor}
                        strokeWidth="1"
                        filter="url(#geo-shadow)"
                      />
                      <text
                        x="3"
                        y="2.5"
                        fill="#0F172A"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {trn.train_number} ({trn.speed_kmph}k)
                      </text>
                    </g>
                  </g>
                );
              })
            )}

            {/* 6. STATIONS LAYER: Fixed Point Markers (Junctions vs Halts) */}
            {filteredStations.map((stn) => {
              const pos = projectCoords(stn.latitude, stn.longitude);
              const isJunction = Boolean(stn.junction);
              const isHovered = hoveredStation?.code === stn.code;
              const hasJobs = Boolean(stationJobsCluster[stn.code] && stationJobsCluster[stn.code].length > 0);

              // Declutter rule: Show station name only for major hubs by default, or when hovered/zoomed in
              const isMajorHub = ['BZA', 'VSKP', 'TEL', 'GDR', 'SLO', 'GNT', 'GTL', 'RU', 'TPTY', 'NDL'].includes(stn.code);
              const showLabel = isHovered || isMajorHub || zoom >= 1.6;

              return (
                <g
                  key={stn.code}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredStation(stn)}
                  onMouseLeave={() => setHoveredStation(null)}
                  onClick={() => setSelectedMapItem({ type: 'STATION', data: stn, jobs: stationJobsCluster[stn.code] || [] })}
                >
                  {/* Concentric rings for Major Junctions */}
                  {isJunction ? (
                    <>
                      <circle
                        r={zoom >= 1.5 ? 8 : 6.5}
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeWidth="2.5"
                        filter="url(#geo-shadow)"
                      />
                      <circle
                        r={zoom >= 1.5 ? 4.5 : 3.5}
                        fill="#1565C0"
                      />
                      <circle
                        r={zoom >= 1.5 ? 12 : 10}
                        fill="none"
                        stroke="#1565C0"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.5"
                      />
                    </>
                  ) : (
                    /* Regular Halt */
                    <circle
                      r={zoom >= 1.5 ? 4.5 : 3.5}
                      fill="#FFFFFF"
                      stroke="#475569"
                      strokeWidth="1.8"
                      filter="url(#geo-shadow)"
                    />
                  )}

                  {/* Selective Station Labels with Anti-Collision Offsets */}
                  {showLabel && (
                    <text
                      x={stn.code === 'GNT' ? -78 : (isJunction ? 10 : 7)}
                      y={stn.code === 'TEL' ? 15 : (stn.code === 'BZA' ? -9 : (stn.code === 'GTL' ? -7 : 3))}
                      fill={isHovered ? '#1E293B' : (isJunction ? '#0F172A' : '#475569')}
                      fontSize={isJunction ? (zoom >= 1.4 ? 11 : 9.5) : (zoom >= 1.4 ? 9.5 : 8)}
                      fontWeight={isJunction ? '800' : '600'}
                      fontFamily="sans-serif"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {stn.name.split(' ')[0]} ({stn.code})
                    </text>
                  )}
                </g>
              );
            })}

            {/* 7. JOBS LAYER: Smart Clustering (Clustered Badges vs Fanned Individual Icons) */}
            {(activeOverlay === 'ALL' || activeOverlay === 'JOBS') && (
              Object.entries(stationJobsCluster).map(([stnCode, jobsList]) => {
                const stn = stationsMap[stnCode];
                if (!stn || jobsList.length === 0) return null;
                const pos = projectCoords(stn.latitude, stn.longitude);

                // Check if any job at this station has a conflict
                const hasAnyConflict = jobsList.some(j => j.hasConflict);

                // Department counts
                const engCount = jobsList.filter(j => j.department === 'Engineering').length;
                const stCount = jobsList.filter(j => j.department === 'S&T').length;
                const tracCount = jobsList.filter(j => j.department === 'Traction').length;

                // Decluttering Rule:
                // When zoomed out (zoom <= 1.4) or in 'ALL' overlay: Show aggregated numbered cluster
                // When zoomed in (zoom > 1.4) and 'JOBS' overlay: Expand up to 3-4 individual icons, then cluster
                const shouldExpand = zoom > 1.4 && activeOverlay === 'JOBS' && jobsList.length <= 4;

                if (!shouldExpand) {
                  // Clustered Numbered Pill / Circle
                  return (
                    <g
                      key={`cluster-${stnCode}`}
                      transform={`translate(${pos.x - 14}, ${pos.y - 14})`}
                      className="cursor-pointer group"
                      onClick={() => setSelectedMapItem({ type: 'JOB_CLUSTER', station: stn, jobs: jobsList })}
                    >
                      {/* Outer Ring showing Department Color Composition */}
                      <circle
                        cx="0"
                        cy="0"
                        r={jobsList.length > 9 ? 11 : 9.5}
                        fill="#FFFFFF"
                        stroke="#1565C0"
                        strokeWidth="2"
                        filter="url(#badge-shadow)"
                        className="transition-transform group-hover:scale-125"
                      />
                      {/* Department Dot Indicators if mixed */}
                      {engCount > 0 && <circle cx="-4" cy="-5" r="1.8" fill="#D97706" />}
                      {stCount > 0 && <circle cx="4" cy="-5" r="1.8" fill="#7C3AED" />}
                      {tracCount > 0 && <circle cx="0" cy="5" r="1.8" fill="#0284C7" />}

                      {/* Job Count Number */}
                      <text
                        x="0"
                        y="3.5"
                        fill="#0F172A"
                        fontSize={jobsList.length > 9 ? "9.5" : "9"}
                        fontWeight="900"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                      >
                        {jobsList.length}
                      </text>
                    </g>
                  );
                } else {
                  // Expanded Individual Job Icons (Fanned Radially, max 4)
                  return (
                    <g key={`expanded-${stnCode}`}>
                      {jobsList.slice(0, 4).map((job, idx) => {
                        const angle = (idx * (2 * Math.PI)) / Math.min(jobsList.length, 4) - Math.PI / 2;
                        const radius = 18;
                        const jx = pos.x + Math.cos(angle) * radius;
                        const jy = pos.y + Math.sin(angle) * radius;

                        const dept = job.department || 'Engineering';
                        const pinColor = dept === 'Engineering' ? '#D97706' : (dept === 'S&T' ? '#7C3AED' : '#0284C7');

                        return (
                          <g
                            key={job.job_id}
                            transform={`translate(${jx}, ${jy})`}
                            className="cursor-pointer group transition-transform hover:scale-125"
                            onClick={() => setSelectedJob(job)}
                          >
                            <circle
                              r="7"
                              fill="#FFFFFF"
                              stroke={pinColor}
                              strokeWidth="2"
                              filter="url(#geo-shadow)"
                            />
                            {/* Inner glyph depending on department */}
                            {dept === 'Engineering' && (
                              <circle r="3" fill="#D97706" />
                            )}
                            {dept === 'S&T' && (
                              <rect x="-2.5" y="-2.5" width="5" height="5" fill="#7C3AED" transform="rotate(45)" />
                            )}
                            {dept === 'Traction' && (
                              <path d="M 0 -3 L -2 0 L 1 0 L 0 3 L 2 -1 Z" fill="#0284C7" />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                }
              })
            )}

            {/* 8. DATA CONFLICT FLAG: Distinct Red Badge Always Visible at Exact Location */}
            {conflictLocations.map((conf) => {
              const stn = stationsMap[conf.station_code];
              if (!stn) return null;
              const pos = projectCoords(stn.latitude, stn.longitude);

              const isSelectedCorridor = selectedCorridor === 'ALL' || selectedCorridor === conf.corridor_id;
              if (!isSelectedCorridor) return null;

              return (
                <g
                  key={conf.id}
                  transform={`translate(${pos.x + 8}, ${pos.y - 12})`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedMapItem({ type: 'CONFLICT', data: conf })}
                >
                  {/* Pulsing Red Warning Halo */}
                  <circle
                    cx="0"
                    cy="0"
                    r="9"
                    fill="#DC2626"
                    opacity="0.2"
                    className="animate-ping"
                  />
                  {/* Red Warning Shield Badge */}
                  <polygon
                    points="0,-8 8,6 -8,6"
                    fill="#DC2626"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    filter="url(#badge-shadow)"
                    className="transition-transform group-hover:scale-125"
                  />
                  <text
                    x="0"
                    y="4.5"
                    fill="#FFFFFF"
                    fontSize="7"
                    fontWeight="900"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                  >
                    !
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Compact Floating Legend (Bottom-Left Corner) */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-[#CBD5E1] p-3 rounded-xl shadow-lg text-xs space-y-2 max-w-[260px]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <span className="font-extrabold text-[#172033] text-[11px] uppercase tracking-wider">
              Map Topology Legend
            </span>
            <span className="text-[10px] font-mono text-[#64748B]">SCoR 2026</span>
          </div>

          {/* Department Track Highlight Legend */}
          <div className="space-y-1 text-[10px] text-[#475569]">
            <div className="font-bold text-[#1E293B]">Active Track Block Segments:</div>
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1.5 rounded-full bg-[#D97706]" />
                <span>TMS (Eng)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1.5 rounded-full bg-[#7C3AED]" />
                <span>SMMS (S&T)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1.5 rounded-full bg-[#0284C7]" />
                <span>TDMS (Traction)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1.5 rounded-full bg-[#0F766E]" />
                <span>Joint Megablock</span>
              </div>
            </div>
          </div>

          {/* Symbols Legend */}
          <div className="border-t border-[#E2E8F0] pt-1.5 grid grid-cols-2 gap-1.5 text-[10px] text-[#475569]">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-[#1565C0] flex items-center justify-center font-bold text-[7px] text-[#1565C0]">
                8
              </span>
              <span>Clustered Jobs</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-white border-2 border-[#0F172A] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1565C0]" />
              </span>
              <span>Major Junction</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[#0284C7] font-bold">▶</span>
              <span>Live Train Path</span>
            </div>
            <div className="flex items-center space-x-1.5 text-[#DC2626] font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>Data Conflict</span>
            </div>
          </div>
        </div>

        {/* Floating Detail Popup on Element Click */}
        {selectedMapItem && (
          <div className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-md border border-[#CBD5E1] p-4 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 text-xs space-y-3">
            <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  {selectedMapItem.type === 'BLOCK' ? 'Active Track Possession' :
                   selectedMapItem.type === 'TRAIN' ? 'Live Train Movement' :
                   selectedMapItem.type === 'CONFLICT' ? 'Cross-Department Conflict' :
                   selectedMapItem.type === 'JOB_CLUSTER' ? 'Station Work Cluster' : 'Station Topology'}
                </span>
                <h4 className="text-sm font-black text-[#172033] mt-0.5">
                  {selectedMapItem.type === 'BLOCK' ? `${selectedMapItem.data.block_id} • ${selectedMapItem.data.section_name}` :
                   selectedMapItem.type === 'TRAIN' ? `${selectedMapItem.data.train_number} ${selectedMapItem.data.train_name}` :
                   selectedMapItem.type === 'CONFLICT' ? `${selectedMapItem.data.id} • ${selectedMapItem.data.station_code}` :
                   selectedMapItem.type === 'JOB_CLUSTER' ? `${selectedMapItem.station.name} (${selectedMapItem.jobs.length} Jobs)` :
                   `${selectedMapItem.data.name} (${selectedMapItem.data.code})`}
                </h4>
              </div>
              <button
                onClick={() => setSelectedMapItem(null)}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172033] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content for Block Item — Full Detail (Feature A) */}
            {selectedMapItem.type === 'BLOCK' && (() => {
              const blk = selectedMapItem.data;
              const deptColor = blk.department === 'Engineering' ? '#D97706'
                : blk.department === 'S&T' ? '#7C3AED'
                : blk.department === 'Traction' ? '#0284C7'
                : '#0F766E';
              return (
                <div className="space-y-3">
                  {/* Joint Block Banner */}
                  {blk.is_joint_block && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5] border border-[#6EE7B7] rounded-lg px-3 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold text-[11px]">Joint Multi-Department Megablock</span>
                    </div>
                  )}

                  {/* Status + Dept row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: deptColor }}
                    >
                      {blk.department}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {blk.status}
                    </span>
                  </div>

                  {/* Core metadata grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] text-[11px]">
                    <div>
                      <span className="text-[#64748B]">Block ID</span>
                      <p className="font-mono font-black text-[#1565C0]">{blk.block_id}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Section</span>
                      <p className="font-bold text-[#172033]">{blk.section_name}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#64748B]">Location</span>
                      <p className="font-semibold text-[#172033] text-[10px]">{blk.location}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Date</span>
                      <p className="font-bold text-[#172033]">{blk.date}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Time Window</span>
                      <p className="font-bold text-[#1565C0]">{blk.time_window}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Duration</span>
                      <p className="font-bold text-[#172033]">{blk.duration_min} min ({blk.duration_hours}h)</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Joint Block</span>
                      <p className={`font-bold ${blk.is_joint_block ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                        {blk.is_joint_block ? '✓ Yes — Megablock' : 'No'}
                      </p>
                    </div>
                  </div>

                  {/* Departments chips */}
                  {blk.departments && blk.departments.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#64748B] text-[10px] font-semibold">Departments:</span>
                      {blk.departments.map(d => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded text-[9px] font-bold text-white"
                          style={{ backgroundColor: DEPT_CONFIG[d]?.color || '#475569' }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Train conflicts */}
                  <div className="flex items-start gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700">Train Conflicts</span>
                      <p className="text-[11px] text-emerald-800">{blk.train_conflicts}</p>
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="flex items-start gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
                    <Wrench className="w-3.5 h-3.5 text-[#64748B] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B]">Resources</span>
                      <p className="text-[11px] text-[#172033]">{blk.resources}</p>
                    </div>
                  </div>

                  {/* Work summary */}
                  <p className="text-[#475569] text-[11px] leading-relaxed italic border-t border-[#F1F5F9] pt-2">
                    {blk.work_summary}
                  </p>
                </div>
              );
            })()}

            {/* Content for Train Item */}
            {selectedMapItem.type === 'TRAIN' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                  <div>
                    <span className="text-[#64748B] text-[10px]">Current Speed:</span>
                    <p className="font-bold text-[#1565C0]">{selectedMapItem.data.speed_kmph} km/h</p>
                  </div>
                  <div>
                    <span className="text-[#64748B] text-[10px]">Status:</span>
                    <p className="font-bold text-emerald-700">{selectedMapItem.data.status}</p>
                  </div>
                  <div>
                    <span className="text-[#64748B] text-[10px]">Headway:</span>
                    <p className="font-bold text-[#172033]">{selectedMapItem.data.occupancy}</p>
                  </div>
                  <div>
                    <span className="text-[#64748B] text-[10px]">Corridor:</span>
                    <p className="font-bold text-[#172033]">{selectedMapItem.data.corridor_id} ({selectedMapItem.data.direction})</p>
                  </div>
                </div>
              </div>
            )}

            {/* Content for Conflict Item */}
            {selectedMapItem.type === 'CONFLICT' && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 space-y-2 text-[#991B1B]">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  <span>Unresolved Location/Condition Discrepancy</span>
                </div>
                <p className="text-[11px] text-[#7F1D1D] leading-relaxed">
                  {selectedMapItem.data.description}
                </p>
                <div className="text-[10px] font-mono bg-white p-2 rounded border border-[#FECACA]">
                  {selectedMapItem.data.resolution}
                </div>
              </div>
            )}

            {/* Content for Job Cluster */}
            {selectedMapItem.type === 'JOB_CLUSTER' && (
              <div className="space-y-2">
                <p className="text-[#64748B] text-[11px]">
                  {selectedMapItem.jobs.length} maintenance tasks scheduled at this station node:
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#F1F5F9]">
                  {selectedMapItem.jobs.map(j => (
                    <div
                      key={j.job_id}
                      onClick={() => setSelectedJob(j)}
                      className="pt-1.5 flex items-center justify-between cursor-pointer hover:bg-[#F8FAFC] p-1 rounded"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#1565C0]">{j.job_id}</span>
                        <p className="text-[10px] text-[#475569]">{j.job_type?.replace(/_/g, ' ')}</p>
                      </div>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: DEPT_CONFIG[j.department]?.color || '#475569' }}
                      >
                        {j.department}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close / Action Button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedMapItem(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1565C0] text-white hover:bg-[#0D47A1] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Station Hover Tooltip */}
        {hoveredStation && !selectedMapItem && (
          <div className="absolute top-16 left-4 bg-white/95 backdrop-blur border border-[#E2E8F0] p-2.5 rounded-xl shadow-lg pointer-events-none text-xs space-y-1 z-20">
            <div className="font-bold text-[#172033] flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1565C0]" />
              <span>{hoveredStation.name} ({hoveredStation.code})</span>
            </div>
            <div className="text-[#7A8494] text-[11px]">
              Division: <span className="text-[#172033] font-semibold">{hoveredStation.division}</span> | SCoR
            </div>
            <div className="text-[#7A8494] text-[11px]">
              Corridors: <span className="text-[#1565C0] font-mono">{hoveredStation.corridors?.join(', ')}</span>
            </div>
            {hoveredStation.junction && (
              <span className="inline-block bg-[#EFF6FF] text-[#1565C0] text-[9px] px-1.5 py-0.5 rounded font-bold border border-[#BFDBFE]">
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
