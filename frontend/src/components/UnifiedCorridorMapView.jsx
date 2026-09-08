import { useState, useEffect } from 'react';
import {
  Train, MapPin, AlertCircle, Compass,
  Layers, ChevronRight, Eye
} from 'lucide-react';
import { fetchCorridorMapData } from '../lib/api';

export default function UnifiedCorridorMapView({ onSelectOpportunity, onSelectBlock }) {
  const [mapData, setMapData] = useState(null);
  const [selectedCorridor, setSelectedCorridor] = useState('ALL');
  const [activeOverlay, setActiveOverlay] = useState('ALL');
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    fetchCorridorMapData().then(data => setMapData(data)).catch(console.error);
  }, []);

  const corridorsMeta = [
    { id: 'C01', name: 'Vijayawada – Gudur Main Line', color: '#DC2626', division: 'Vijayawada' },
    { id: 'C02', name: 'Visakhapatnam – Vijayawada Trunk', color: '#0369A1', division: 'Visakhapatnam & BZA' },
    { id: 'C03', name: 'Guntur – Nandyal Section', color: '#7C3AED', division: 'Guntur' },
    { id: 'C04', name: 'Guntakal – Renigunta Grand Trunk', color: '#15803D', division: 'Guntakal' }
  ];

  const projectCoords = (lat, lon) => {
    const minLon = 76.8, maxLon = 83.8;
    const minLat = 13.3, maxLat = 18.2;
    const x = ((lon - minLon) / (maxLon - minLon)) * 740 + 30;
    const y = 460 - ((lat - minLat) / (maxLat - minLat)) * 420;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const stations = mapData?.stations || [];
  const jobs = mapData?.maintenance_jobs || [];
  const trains = mapData?.train_movements || [];
  const blocks = mapData?.active_blocks || [];

  const filteredStations = stations.filter(s =>
    selectedCorridor === 'ALL' || (s.corridors && s.corridors.includes(selectedCorridor))
  );

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
      {/* Map Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
            <Compass className="w-4 h-4" />
            <span>SOUTH COAST RAILWAY NETWORK</span>
          </div>
          <h2 className="text-lg font-bold text-[#172033] tracking-tight">
            Andhra Pradesh Unified Corridor Map
          </h2>
        </div>

        {/* Corridor Selector */}
        <div className="flex items-center flex-wrap gap-2 bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E8F0] text-xs">
          <button
            onClick={() => setSelectedCorridor('ALL')}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              selectedCorridor === 'ALL' ? 'bg-[#1565C0] text-white shadow-sm' : 'text-[#7A8494] hover:text-[#172033] hover:bg-white'
            }`}
          >
            All SCoR
          </button>
          {corridorsMeta.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCorridor(c.id)}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center space-x-1.5 transition-all ${
                selectedCorridor === c.id ? 'bg-white text-[#172033] shadow-sm border border-[#E2E8F0]' : 'text-[#7A8494] hover:text-[#172033]'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Layer Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-[#7A8494] font-semibold text-[11px]">Map Layers:</span>
          {['ALL', 'DEFECTS', 'TRAINS', 'BLOCKS'].map(layer => (
            <button
              key={layer}
              onClick={() => setActiveOverlay(layer)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeOverlay === layer ? 'bg-[#EFF6FF] text-[#1565C0] border border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#7A8494] hover:text-[#172033] border border-[#E2E8F0]'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-4 text-[11px] text-[#7A8494]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <span>Critical Defect</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
            <span>Train Movement</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#1565C0]" />
            <span>Planned Block</span>
          </div>
        </div>
      </div>

      {/* Railway Map Canvas - LIGHT BACKGROUND */}
      <div className="relative bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden min-h-[380px] flex items-center justify-center">
        <svg viewBox="0 0 800 480" className="w-full h-auto max-h-[440px] select-none">
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
                <feFuncA type="linear" slope="0.2"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Light background */}
          <rect width="800" height="480" fill="#FAFBFC" />
          <rect width="800" height="480" fill="url(#grid-light)" opacity="0.5" />

          {/* SCoR Corridor Route Lines */}
          {/* C02: Visakhapatnam to Vijayawada */}
          <path
            d="M 680,80 L 610,130 L 530,175 L 470,200 L 400,240"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C02' ? '#0369A1' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C02' ? '4' : '2.5'}
            strokeDasharray={selectedCorridor === 'C02' ? 'none' : '4,2'}
          />

          {/* C01: Vijayawada to Gudur */}
          <path
            d="M 400,240 L 390,280 L 370,330 L 360,380 L 350,430"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C01' ? '#DC2626' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C01' ? '4' : '2.5'}
          />

          {/* C03: Guntur to Nandyal */}
          <path
            d="M 380,260 L 310,290 L 250,310 L 170,330 L 120,335"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C03' ? '#7C3AED' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C03' ? '4' : '2.5'}
          />

          {/* C04: Guntakal to Renigunta */}
          <path
            d="M 70,300 L 110,320 L 180,360 L 250,395 L 330,440"
            fill="none"
            stroke={selectedCorridor === 'ALL' || selectedCorridor === 'C04' ? '#15803D' : '#CBD5E1'}
            strokeWidth={selectedCorridor === 'C04' ? '4' : '2.5'}
          />

          {/* Opportunity Cluster Indicator */}
          <circle cx="370" cy="330" r="28" fill="#DC2626" fillOpacity="0.08" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="3,3" />
          <text x="375" y="322" fill="#DC2626" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
            OPP-007 (KM 124.4)
          </text>

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
                {/* Station circle */}
                <circle
                  r={isJunction ? 6 : 4}
                  fill={isJunction ? '#1565C0' : '#FFFFFF'}
                  stroke={isJunction ? '#1565C0' : '#64748B'}
                  strokeWidth="2"
                  filter="url(#drop-shadow)"
                  className="transition-all duration-200 group-hover:scale-150"
                />
                {isJunction && (
                  <circle r="9" fill="none" stroke="#1565C0" strokeWidth="1" opacity="0.4" />
                )}

                {/* Station Label */}
                <text
                  x={8}
                  y={4}
                  fill={isHovered ? '#172033' : '#5B6575'}
                  fontSize={isJunction ? '11' : '9'}
                  fontWeight={isJunction ? 'bold' : 'normal'}
                  fontFamily="sans-serif"
                >
                  {stn.name.split(' ')[0]} ({stn.code})
                </text>
              </g>
            );
          })}

          {/* Train Positions */}
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

          {/* Planned Block Indicators */}
          {(activeOverlay === 'ALL' || activeOverlay === 'BLOCKS') && (
            <g transform="translate(365, 330)">
              <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#1565C0" stroke="#0D47A1" strokeWidth="1" filter="url(#drop-shadow)" />
              <text x="0" y="3" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                B-017
              </text>
            </g>
          )}
        </svg>

        {/* Station Hover Tooltip */}
        {hoveredStation && (
          <div className="absolute top-4 left-4 bg-white border border-[#E2E8F0] p-3 rounded-lg shadow-lg pointer-events-none text-xs space-y-1 z-20">
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

      {/* Corridor Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
        {corridorsMeta.map(c => (
          <div
            key={c.id}
            onClick={() => setSelectedCorridor(c.id)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedCorridor === c.id
                ? 'bg-white border-[#1565C0] shadow-sm'
                : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#172033]">{c.id}</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
            </div>
            <p className="text-[11px] text-[#7A8494] truncate mt-1">{c.name}</p>
            <p className="text-[10px] text-[#7A8494] mt-0.5">{c.division} Div</p>
          </div>
        ))}
      </div>
    </div>
  );
}
