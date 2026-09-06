import React from 'react';
import { Layers, Database, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SilosView({ workItems, onGoToPriority }) {
  const siloSystems = [
    {
      code: 'TDMS',
      name: 'Track Department Maintenance System',
      department: 'Civil Engineering (P-Way / Track)',
      color: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      badgeColor: 'bg-rose-500/20 text-rose-300',
      description: 'Generates rail defect notices, deep screening schedules (BCM), ultrasonic rail flaw logs (USFD), and machine tamping requests (CSM 09-32).',
      domain: 'Track Stability & Rail Integrity'
    },
    {
      code: 'SMMS',
      name: 'Signal & Maintenance Management System',
      department: 'S&T and Electrical Traction (TRD / OHE)',
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      badgeColor: 'bg-blue-500/20 text-blue-300',
      description: 'Manages point machine motors, track circuit impedance bonds, electronic interlockings, and 25kV OHE catenary power isolation blocks.',
      domain: 'Signaling, Telecom & 25kV Catenary'
    },
    {
      code: 'TMS',
      name: 'Train Management System',
      department: 'Train Operations & Punctuality',
      color: 'border-pink-500/30 bg-pink-500/10 text-pink-400',
      badgeColor: 'bg-pink-500/20 text-pink-300',
      description: 'Tracks real-time passenger train paths, Vande Bharat & Rajdhani high-speed slots, and imposes rigid punctuality preservation windows.',
      domain: 'Passenger Timetable & Punctuality'
    },
    {
      code: 'COA',
      name: 'Control / Operations Application',
      department: 'Freight Operations & Line Capacity',
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
      description: 'Forecasts freight rake movements (coal rakes, container trains, cement paths), yard loop line requirements, and temporary speed restrictions.',
      domain: 'Freight Throughput & Corridor Capacity'
    },
    {
      code: 'BDMS',
      name: 'Bridge Database Management System',
      department: 'Bridges & Structures Engineering',
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      badgeColor: 'bg-purple-500/20 text-purple-300',
      description: 'Schedules major steel girder inspections, elastomeric bearing replacements, and underwater pier scour ultrasonic soundings.',
      domain: 'Bridges, Flyovers & Viaducts'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Intro Context */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold mb-2">
          <Database className="w-4 h-4" />
          <span>Step 1: Overcoming Railway System Silos</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Fragmented Railway Data Sources Ingested & Unified
        </h3>
        <p className="text-sm text-slate-300 max-w-4xl leading-relaxed">
          In standard railway divisions, these 5 critical software systems operate in isolation. Department heads submit separate, uncoordinated block demands to Section Controllers. <strong>RailBlock AI</strong> continuously aggregates these heterogeneous requests into a standardized, unified work item schema ready for multi-factor priority scoring.
        </p>
      </div>

      {/* Silo System Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {siloSystems.map((silo) => {
          const itemsFromSilo = workItems.filter(w => w.source_system === silo.code);
          return (
            <div 
              key={silo.code}
              className={`border rounded-xl p-5 bg-slate-900/90 shadow-lg flex flex-col justify-between ${silo.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${silo.badgeColor}`}>
                    {silo.code}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {itemsFromSilo.length} Ingested Requests
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mb-1">{silo.name}</h4>
                <div className="text-xs font-semibold text-slate-300 mb-2">{silo.department}</div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">{silo.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                  Sample Requests
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {itemsFromSilo.length > 0 ? (
                    itemsFromSilo.map(it => (
                      <div key={it.id} className="text-xs bg-slate-950/60 p-2 rounded border border-slate-800 text-slate-300 flex items-center justify-between">
                        <span className="truncate pr-2">{it.title}</span>
                        <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">
                          {it.requested_day?.slice(0, 3)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">No pending requests</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Unified Schema Banner */}
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-5 shadow-lg flex flex-col justify-between text-emerald-400">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Unified Intelligence Layer</span>
            </div>
            <h4 className="text-base font-bold text-white mb-2">
              Harmonized Maintenance Data Model
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              All disparate records are normalized with safety ratings, asset coordinates, historical failure records, and ML-derived failure probabilities.
            </p>
          </div>
          <button
            onClick={onGoToPriority}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>Proceed to Priority Intelligence</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
