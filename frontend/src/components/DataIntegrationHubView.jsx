import { useState, useEffect } from 'react';
import {
  Layers, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet,
  Database, ArrowRight, X, Clock, TrendingUp, UserCheck
} from 'lucide-react';
import { fetchIntegrationStatus, syncAllSystems, fetchDataQualityReport, fetchAllAssets, fetchMaintenanceJobs, fetchInvalidRecordsQueue } from '../lib/api';
import ReviewQueuePanel from './ReviewQueuePanel';

export default function DataIntegrationHubView({ onGoToCorridorView }) {
  const [statusData, setStatusData] = useState(null);
  const [qualityReport, setQualityReport] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const loadStatus = async () => {
    try {
      const [st, qr, rq] = await Promise.all([
        fetchIntegrationStatus(),
        fetchDataQualityReport(),
        fetchInvalidRecordsQueue().catch(() => null)
      ]);
      setStatusData(st);
      setQualityReport(qr);
      if (rq) {
        setPendingCount(rq.pending_count || 0);
      }
    } catch (err) {
      console.error('Error loading integration status:', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllSystems();
      setSyncResult(res);
      await loadStatus();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePreview = async (sourceSystem) => {
    setPreviewFile(sourceSystem);
    setIsLoadingPreview(true);
    try {
      if (['TMS', 'SMMS', 'TDMS'].includes(sourceSystem)) {
        const jobs = await fetchMaintenanceJobs('', sourceSystem === 'TMS' ? 'Engineering' : (sourceSystem === 'TDMS' ? 'Traction' : 'S&T'));
        setPreviewData(jobs.slice(0, 15));
      } else {
        const assets = await fetchAllAssets();
        setPreviewData(assets.slice(0, 15));
      }
    } catch (e) {
      console.error('Error previewing data:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-2 text-[#1565C0] text-xs font-bold mb-2">
              <Database className="w-4 h-4" />
              <span>RAILWAY DATA INTEGRATION HUB</span>
            </div>
            <h1 className="text-2xl font-bold text-[#172033] tracking-tight">
              Unified Railway Data Integration Layer
            </h1>
            <p className="text-sm text-[#5B6575] mt-2 leading-relaxed">
              Integrating maintenance records across <strong>TMS</strong> (Track), <strong>SMMS</strong> (Signal & Telecom),
              <strong> TDMS</strong> (Traction OHE), <strong>COA</strong> (Control Office), and <strong>BDMS</strong> (Block Demands)
              for Indian Railways operations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-bold text-sm shadow-sm transition-all ${
                isSyncing
                  ? 'bg-[#F1F5F9] text-[#7A8494] cursor-not-allowed'
                  : 'bg-[#1565C0] hover:bg-[#0D47A1] text-white'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'SYNCING...' : 'SYNC ALL SYSTEMS'}</span>
            </button>

            {onGoToCorridorView && (
              <button
                onClick={onGoToCorridorView}
                className="flex items-center justify-center space-x-2 px-5 py-3 rounded-lg font-bold text-sm bg-white hover:bg-[#F8FAFC] text-[#172033] border border-[#E2E8F0] transition-all"
              >
                <span>Corridor View</span>
                <ArrowRight className="w-4 h-4 text-[#1565C0]" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Success Alert */}
        {syncResult && (
          <div className="mt-5 p-4 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
              <div>
                <span className="font-bold text-sm text-[#166534]">Synchronization Complete:</span>
                <span className="text-xs text-[#15803D] ml-2">
                  {syncResult.records_received} received • {syncResult.records_normalized} normalized • {syncResult.duplicates_detected} duplicates resolved
                </span>
              </div>
            </div>
            <div className="text-xs font-bold bg-[#15803D] text-white px-3 py-1 rounded-md">
              Quality: {syncResult.data_quality_score}%
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#E2E8F0] pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg transition-all ${
            activeTab === 'overview' ? 'bg-white text-[#1565C0] shadow-sm border border-[#E2E8F0]' : 'text-[#7A8494] hover:text-[#172033]'
          }`}
        >
          5 Source Systems
        </button>
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
            activeTab === 'anomalies' ? 'bg-white text-[#1565C0] shadow-sm border border-[#E2E8F0]' : 'text-[#7A8494] hover:text-[#172033]'
          }`}
        >
          <span>Data Quality</span>
          <span className="bg-[#F0FDF4] text-[#15803D] text-[10px] px-2 py-0.5 rounded font-bold">
            {qualityReport?.data_quality_score || 99.7}%
          </span>
        </button>
        <button
          onClick={() => setActiveTab('review-queue')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
            activeTab === 'review-queue' ? 'bg-white text-[#1565C0] shadow-sm border border-[#E2E8F0]' : 'text-[#7A8494] hover:text-[#172033]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Human Review Queue</span>
          {pendingCount > 0 ? (
            <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[10px] px-2 py-0.5 rounded-full font-bold">
              {pendingCount} Actionable
            </span>
          ) : (
            <span className="bg-[#F1F5F9] text-[#5B6575] text-[10px] px-1.5 py-0.5 rounded font-medium">
              0
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SOURCE SYSTEM CARDS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statusData?.systems?.map((sys) => {
            const isTMS = sys.source_system === 'TMS';
            const isTDMS = sys.source_system === 'TDMS';
            const isSMMS = sys.source_system === 'SMMS';
            const isCOA = sys.source_system === 'COA';

            const badgeColor = isTMS
              ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
              : isTDMS
              ? 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]'
              : isSMMS
              ? 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'
              : isCOA
              ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
              : 'bg-[#FFFBEB] text-[#B45309] border-[#FED7AA]';

            return (
              <div
                key={sys.source_system}
                className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${badgeColor}`}>
                      {sys.source_system}
                    </span>
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                      <span>{sys.status}</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-[#172033] text-sm leading-tight">
                    {sys.full_name}
                  </h3>
                  <p className="text-[11px] text-[#7A8494] mt-0.5">
                    {sys.department}
                  </p>

                  {/* Metrics */}
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A8494] text-[11px]">Total Records</span>
                      <span className="font-bold text-[#172033]">{sys.total_records}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A8494] text-[11px]">Valid Records</span>
                      <span className="font-bold text-[#15803D]">{sys.valid_records}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A8494] text-[11px]">Validation Rate</span>
                      <span className="font-bold text-[#1565C0]">{sys.validation_rate_pct}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                  <button
                    onClick={() => handlePreview(sys.source_system)}
                    className="text-[11px] font-semibold text-[#1565C0] hover:text-[#0D47A1] flex items-center space-x-1"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>View Data</span>
                  </button>
                  <span className="text-[9px] text-[#7A8494]">
                    CSV
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: DATA QUALITY */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <span className="text-xs text-[#7A8494] font-medium">Data Quality Score</span>
              <div className="text-2xl font-black text-[#15803D] mt-1">
                {qualityReport?.data_quality_score || 99.7}%
              </div>
              <p className="text-[11px] text-[#7A8494] mt-1 flex items-center space-x-1">
                <TrendingUp className="w-3 h-3" />
                <span>8 validation checks</span>
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <span className="text-xs text-[#7A8494] font-medium">Total Records</span>
              <div className="text-2xl font-black text-[#172033] mt-1">
                {qualityReport?.total_records || 140}
              </div>
              <p className="text-[11px] text-[#7A8494] mt-1">All 5 sources</p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <span className="text-xs text-[#7A8494] font-medium">Duplicates Detected</span>
              <div className="text-2xl font-black text-[#1565C0] mt-1">
                {qualityReport?.duplicates_detected || 0}
              </div>
              <p className="text-[11px] text-[#7A8494] mt-1">Auto-deduplicated</p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <span className="text-xs text-[#7A8494] font-medium">Flagged Anomalies</span>
              <div className="text-2xl font-black text-[#B45309] mt-1">
                {qualityReport?.invalid_records_count || 1}
              </div>
              <p className="text-[11px] text-[#7A8494] mt-1">Preserved with tags</p>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#172033] mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
              <span>Data Quality Anomalies</span>
            </h3>
            {qualityReport?.invalid_records && qualityReport.invalid_records.length > 0 ? (
              <div className="divide-y divide-[#F1F5F9]">
                {qualityReport.invalid_records.map((rec, idx) => (
                  <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#B45309]">{rec.job_id}</span>
                        <span className="text-[10px] bg-[#F8FAFC] text-[#5B6575] px-2 py-0.5 rounded border border-[#E2E8F0]">
                          {rec.source_system}
                        </span>
                      </div>
                      <div className="text-[#7A8494] text-[11px] mt-1">
                        Issues: <span className="text-[#B91C1C] font-medium">{rec.issues.join(', ')}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#5B6575] bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
                      Station: {rec.raw_data?.station || 'OGL'} • KM: {rec.raw_data?.km || '124.9'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#7A8494]">No critical validation anomalies detected.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HUMAN REVIEW QUEUE */}
      {activeTab === 'review-queue' && (
        <ReviewQueuePanel onRecordUpdated={loadStatus} />
      )}

      {/* DATA PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-[#1565C0]" />
                <h3 className="font-bold text-sm text-[#172033]">
                  Data Inspector: {previewFile}
                </h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-[#7A8494] hover:text-[#172033] p-1 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 text-xs">
              {isLoadingPreview ? (
                <div className="text-center py-12 text-[#7A8494]">Loading...</div>
              ) : previewData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#7A8494] text-[11px]">
                      <th className="pb-2 font-semibold">Job ID</th>
                      <th className="pb-2 font-semibold">Type</th>
                      <th className="pb-2 font-semibold">Corridor</th>
                      <th className="pb-2 font-semibold">Station</th>
                      <th className="pb-2 font-semibold">KM</th>
                      <th className="pb-2 font-semibold">Severity</th>
                      <th className="pb-2 font-semibold">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-[#172033]">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 text-[#1565C0] font-bold">{row.job_id || row.asset_id}</td>
                        <td className="py-2 truncate max-w-[200px]">{row.job_type || row.asset_type}</td>
                        <td className="py-2">{row.corridor_id}</td>
                        <td className="py-2">{row.station}</td>
                        <td className="py-2">{row.km}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.severity === 'CRITICAL' ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]' : 'bg-[#FFFBEB] text-[#B45309] border border-[#FED7AA]'
                          }`}>
                            {row.severity || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="py-2 font-bold text-[#15803D]">{row.priority_score || 85}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[#7A8494] text-center py-8">No records found.</p>
              )}
            </div>

            <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] text-[11px] text-[#7A8494] flex justify-between items-center">
              <span>Showing sample records from file repository</span>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-3 py-1.5 bg-white hover:bg-[#F1F5F9] text-[#172033] rounded-lg font-bold border border-[#E2E8F0]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
