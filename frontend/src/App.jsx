import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import SilosView from './components/SilosView';
import PriorityView from './components/PriorityView';
import ExplainabilityDrawer from './components/ExplainabilityDrawer';
import ConflictsView from './components/ConflictsView';
import GanttBoard from './components/GanttBoard';
import PlannerReviewModal from './components/PlannerReviewModal';
import ReplanningView from './components/ReplanningView';
import AuditTrailView from './components/AuditTrailView';

import {
  fetchDashboardStats,
  fetchWorkItems,
  fetchWorkExplainability,
  fetchConflicts,
  runOptimization,
  fetchCurrentPlan,
  modifyPlanSchedule,
  approvePlan,
  triggerEmergencyReplan,
  fetchAuditTrail,
  resetDemoData
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [conflictsData, setConflictsData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  // UI State
  const [explainData, setExplainData] = useState(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [modifyingItem, setModifyingItem] = useState(null);
  const [replanResult, setReplanResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);
  const [isSubmittingMod, setIsSubmittingMod] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadAllData = async () => {
    try {
      const [stats, items, confs, plan, logs] = await Promise.all([
        fetchDashboardStats().catch(() => null),
        fetchWorkItems().catch(() => []),
        fetchConflicts().catch(() => null),
        fetchCurrentPlan().catch(() => null),
        fetchAuditTrail(50).catch(() => [])
      ]);

      setDashboardStats(stats);
      setWorkItems(items);
      setConflictsData(confs);
      setCurrentPlan(plan);
      setAuditLogs(logs);

      // If no plan exists, run initial CP-SAT optimization automatically for seamless demo experience
      if (!plan && items && items.length > 0) {
        handleRunOptimizer(true);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRunOptimizer = async (silent = false) => {
    setIsOptimizing(true);
    try {
      const res = await runOptimization();
      const updatedPlan = await fetchCurrentPlan();
      const updatedLogs = await fetchAuditTrail(50);
      const updatedStats = await fetchDashboardStats();
      setCurrentPlan(updatedPlan);
      setAuditLogs(updatedLogs);
      setDashboardStats(updatedStats);
      if (!silent) {
        showNotification(`CP-SAT solved in ${res.solve_duration_ms}ms with zero conflicts! Plan V${res.version} generated.`, 'success');
      }
    } catch (err) {
      showNotification(`Optimization failed: ${err.message}`, 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSelectExplain = async (workId) => {
    try {
      const data = await fetchWorkExplainability(workId);
      setExplainData(data);
      setIsExplainOpen(true);
    } catch (err) {
      showNotification(`Failed to load explainability: ${err.message}`, 'error');
    }
  };

  const handleModifySlot = async (payload) => {
    if (payload.triggerItem) {
      setModifyingItem(payload.triggerItem);
      return;
    }

    setIsSubmittingMod(true);
    try {
      await modifyPlanSchedule(payload);
      setModifyingItem(null);
      const [updatedPlan, updatedLogs] = await Promise.all([
        fetchCurrentPlan(),
        fetchAuditTrail(50)
      ]);
      setCurrentPlan(updatedPlan);
      setAuditLogs(updatedLogs);
      showNotification('Schedule successfully modified and logged in audit trail.', 'success');
    } catch (err) {
      showNotification(`Modification error: ${err.message}`, 'error');
    } finally {
      setIsSubmittingMod(false);
    }
  };

  const handleApprovePlan = async (payload) => {
    try {
      await approvePlan(payload);
      const [updatedPlan, updatedLogs] = await Promise.all([
        fetchCurrentPlan(),
        fetchAuditTrail(50)
      ]);
      setCurrentPlan(updatedPlan);
      setAuditLogs(updatedLogs);
      showNotification(`Plan ${payload.plan_id} officially authorized by ${payload.approved_by}!`, 'success');
    } catch (err) {
      showNotification(`Approval error: ${err.message}`, 'error');
    }
  };

  const handleTriggerReplan = async () => {
    setIsReplanning(true);
    try {
      const res = await triggerEmergencyReplan({
        title: "Emergency Ultrasonic Rail Fracture Defect (USFD)",
        corridor_id: "C1",
        work_type: "USFD_EMERGENCY_REPAIR",
        duration_minutes: 180,
        requested_day: "Tuesday"
      });
      setReplanResult(res);
      const [updatedPlan, updatedItems, updatedLogs, updatedStats] = await Promise.all([
        fetchCurrentPlan(),
        fetchWorkItems(),
        fetchAuditTrail(50),
        fetchDashboardStats()
      ]);
      setCurrentPlan(updatedPlan);
      setWorkItems(updatedItems);
      setAuditLogs(updatedLogs);
      setDashboardStats(updatedStats);
      setActiveTab('replan');
      showNotification(`Dynamic Re-planning generated Plan V${res.new_version}. Emergency item scheduled.`, 'success');
    } catch (err) {
      showNotification(`Re-planning error: ${err.message}`, 'error');
    } finally {
      setIsReplanning(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset synthetic database to clean initial state?')) return;
    try {
      await resetDemoData();
      setReplanResult(null);
      await loadAllData();
      showNotification('Demo data reset to clean baseline state.', 'info');
    } catch (err) {
      showNotification(`Reset failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Global Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunOptimizer={() => handleRunOptimizer(false)}
        onSimulateEmergency={handleTriggerReplan}
        onResetDemo={handleResetDemo}
        isOptimizing={isOptimizing}
        planStatus={currentPlan?.status || 'OPTIMIZED'}
        planVersion={currentPlan?.version || 1}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center space-x-2 ${
            notification.type === 'success' 
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300' 
              : (notification.type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-blue-950 border-blue-500 text-blue-300')
          }`}>
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={dashboardStats}
            currentPlan={currentPlan}
            onRunOptimizer={() => handleRunOptimizer(false)}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'silos' && (
          <SilosView
            workItems={workItems}
            onGoToPriority={() => setActiveTab('priority')}
          />
        )}

        {activeTab === 'priority' && (
          <PriorityView
            workItems={workItems}
            onSelectExplain={handleSelectExplain}
          />
        )}

        {activeTab === 'conflicts' && (
          <ConflictsView
            conflictsData={conflictsData}
            onTriggerOptimize={() => {
              handleRunOptimizer(false);
              setActiveTab('gantt');
            }}
          />
        )}

        {activeTab === 'gantt' && (
          <GanttBoard
            currentPlan={currentPlan}
            onModifyClick={(item) => {
              setModifyingItem(item);
              setActiveTab('review');
            }}
          />
        )}

        {activeTab === 'review' && (
          <PlannerReviewModal
            currentPlan={currentPlan}
            modifyingItem={modifyingItem}
            onCloseModal={() => setModifyingItem(null)}
            onSubmitModification={handleModifySlot}
            onApprovePlan={handleApprovePlan}
            isSubmitting={isSubmittingMod}
          />
        )}

        {activeTab === 'replan' && (
          <ReplanningView
            replanResult={replanResult}
            onTriggerReplan={handleTriggerReplan}
            isReplanning={isReplanning}
            currentPlan={currentPlan}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView
            auditLogs={auditLogs}
          />
        )}
      </main>

      {/* Transparent Explainability Drawer */}
      <ExplainabilityDrawer
        data={explainData}
        isOpen={isExplainOpen}
        onClose={() => setIsExplainOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        RailBlock AI • Smart India Hackathon Prototype • Northern & Western Railway Divisions
      </footer>
    </div>
  );
}
