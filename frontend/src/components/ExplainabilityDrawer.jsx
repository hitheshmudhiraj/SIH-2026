import { X, HelpCircle, Shield, CheckCircle2, TrendingUp } from 'lucide-react';

export default function ExplainabilityDrawer({ data, isOpen, onClose }) {
  if (!isOpen || !data) return null;

  const {
    work_id,
    title,
    department,
    corridor,
    asset_name,
    priority_score,
    priority_tier,
    factors,
    justification,
    ml_confidence,
    recommended_action
  } = data;

  const factorItems = [
    { label: 'Safety Risk', val: factors?.safety_risk ?? 0, max: 25, color: 'bg-[#DC2626]', desc: 'Risk to train derailment or structural track collapse' },
    { label: 'Asset Criticality', val: factors?.asset_criticality ?? 0, max: 20, color: 'bg-[#B45309]', desc: 'Location on high-speed junction or primary trunk route' },
    { label: 'Overdue Days', val: factors?.overdue_days ?? 0, max: 15, color: 'bg-[#EA580C]', desc: 'Days exceeded beyond IR statutory manual limits' },
    { label: 'Failure History', val: factors?.failure_history ?? 0, max: 15, color: 'bg-[#CA8A04]', desc: 'Repeated defects in last 12 months' },
    { label: 'ML Failure Probability', val: factors?.failure_probability ?? 0, max: 15, color: 'bg-[#7C3AED]', desc: 'Logistic regression on axle-load and asset age' },
    { label: 'Traffic Density', val: factors?.traffic_density ?? 0, max: 10, color: 'bg-[#1565C0]', desc: 'Annual Gross Million Tonnes' },
    { label: 'Deferral Consequence', val: factors?.deferral_consequence ?? 0, max: 10, color: 'bg-[#15803D]', desc: 'Speed restrictions if postponed' },
  ];

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
      case 'HIGH':
        return 'bg-[#FFFBEB] text-[#B45309] border-[#FED7AA]';
      case 'MEDIUM':
        return 'bg-[#EFF6FF] text-[#1565C0] border-[#BFDBFE]';
      default:
        return 'bg-[#F8FAFC] text-[#7A8494] border-[#E2E8F0]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-white border-l border-[#E2E8F0] h-full overflow-y-auto p-6 shadow-lg flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-4">
            <div>
              <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-1">
                <HelpCircle className="w-4 h-4" />
                <span>AI EXPLAINABILITY</span>
              </div>
              <h3 className="text-xl font-bold text-[#172033]">Why This Priority Score?</h3>
              <p className="text-xs text-[#7A8494] mt-1">Transparent 7-factor weighted scoring model</p>
            </div>
            <button
              onClick={onClose}
              className="text-[#7A8494] hover:text-[#172033] p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Work Item Info */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#7A8494]">Work Item</span>
              <span className={`px-2 py-1 rounded text-xs font-bold border ${getTierBadge(priority_tier)}`}>
                {priority_tier}
              </span>
            </div>
            <h4 className="font-bold text-[#172033] mb-1">{work_id}</h4>
            <p className="text-sm text-[#5B6575]">{title}</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <span className="text-[#7A8494]">Department:</span>
                <span className="text-[#172033] font-medium ml-1">{department}</span>
              </div>
              <div>
                <span className="text-[#7A8494]">Corridor:</span>
                <span className="text-[#172033] font-medium ml-1">{corridor}</span>
              </div>
            </div>
          </div>

          {/* Priority Score */}
          <div className="bg-gradient-to-r from-[#EFF6FF] to-white border border-[#BFDBFE] rounded-xl p-4 text-center">
            <div className="text-xs text-[#7A8494] mb-1">FINAL PRIORITY SCORE</div>
            <div className="text-4xl font-black text-[#1565C0]">{priority_score}</div>
            <div className="text-xs text-[#7A8494] mt-1">out of 100</div>
          </div>

          {/* Factor Breakdown */}
          <div>
            <h4 className="text-sm font-bold text-[#172033] mb-3 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#1565C0]" />
              <span>7-Factor Breakdown</span>
            </h4>
            <div className="space-y-3">
              {factorItems.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-medium text-[#172033]">{item.label}</span>
                    <span className="font-bold text-[#1565C0]">{item.val}/{item.max}</span>
                  </div>
                  <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${(item.val / item.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#7A8494] mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Justification */}
          {justification && (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
              <h4 className="text-sm font-bold text-[#15803D] mb-2 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>AI Justification</span>
              </h4>
              <p className="text-xs text-[#166534] leading-relaxed">{justification}</p>
            </div>
          )}

          {/* ML Confidence */}
          {ml_confidence && (
            <div className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <span className="text-xs text-[#7A8494]">ML Model Confidence</span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#1565C0]" />
                <span className="text-sm font-bold text-[#1565C0]">{ml_confidence}%</span>
              </div>
            </div>
          )}

          {/* Recommended Action */}
          {recommended_action && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
              <h4 className="text-sm font-bold text-[#1565C0] mb-2">Recommended Action</h4>
              <p className="text-xs text-[#1E40AF]">{recommended_action}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] pt-4 mt-6">
          <button
            onClick={onClose}
            className="w-full bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold py-3 rounded-lg transition-colors"
          >
            Close Explainability View
          </button>
        </div>
      </div>
    </div>
  );
}
