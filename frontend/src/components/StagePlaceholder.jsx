import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function StagePlaceholder({ stageNumber, stageTitle, description, children }) {
  return (
    <div className="space-y-4">
      {/* Foundation & Stage Indicator Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-xs">
          <span className="bg-blue-500/20 text-blue-400 font-mono font-bold px-2 py-0.5 rounded border border-blue-500/30">
            STAGE {stageNumber}
          </span>
          <span className="font-bold text-white">{stageTitle}</span>
          <span className="text-slate-400 hidden sm:inline">• {description}</span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Interactive Prototype Layer Active</span>
        </div>
      </div>

      {/* Render children component */}
      {children}
    </div>
  );
}
