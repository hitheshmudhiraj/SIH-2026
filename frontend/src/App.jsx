import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from './components/LoginPage';

import DashboardView from './components/DashboardView';
import KpiComparisonView from './components/KpiComparisonView';
import SilosView from './components/SilosView';
import PriorityView from './components/PriorityView';
import ExplainabilityDrawer from './components/ExplainabilityDrawer';
import ConflictsView from './components/ConflictsView';
import GanttBoard from './components/GanttBoard';
import PlannerReviewModal from './components/PlannerReviewModal';
import ReplanningView from './components/ReplanningView';
import AuditTrailView from './components/AuditTrailView';
import StagePlaceholder from './components/StagePlaceholder';

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
} from './lib/api';

function AppContent({ user, onLogout }) {
  const navigate = useNavigate();

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
      navigate('/plans');
      showNotification(`Dynamic Re-planning generated Plan V${res.new_version}. Emergency item accommodated.`, 'success');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center space-x-2 ${
            notification.type === 'success' 
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300' 
              : (notification.type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-blue-950 border-blue-500 text-blue-300')
          }`}>
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Routes nested inside AppShell layout */}
      <Routes>
        <Route element={
          <AppShell
            onRunOptimizer={() => handleRunOptimizer(false)}
            onSimulateEmergency={handleTriggerReplan}
            onResetDemo={handleResetDemo}
            isOptimizing={isOptimizing}
            currentPlan={currentPlan}
            planStatus={currentPlan?.status || 'OPTIMIZED'}
            planVersion={currentPlan?.version || 1}
            user={user}
            onLogout={onLogout}
          />
        }>
          {/* 1. Dashboard */}
          <Route path="/" element={<DashboardView />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* 2. Intake: 5 Siloed Systems & Priority Intelligence */}
          <Route path="/intake" element={
            <StagePlaceholder stageNumber="2" stageTitle="Intake & Ingestion" description="TMS / SMMS / TDMS / COA / BDMS Silos Normalized">
              <div className="space-y-6">
                <SilosView
                  workItems={workItems}
                  onGoToPriority={() => {}}
                />
                <PriorityView
                  workItems={workItems}
                  onSelectExplain={handleSelectExplain}
                />
              </div>
            </StagePlaceholder>
          } />

          {/* 3. Planning Board: Interactive Gantt Corridor Board */}
          <Route path="/planning-board" element={
            <StagePlaceholder stageNumber="3" stageTitle="Planning Board" description="Visual Corridor Timeline with Train Blackouts">
              <GanttBoard
                currentPlan={currentPlan}
                onModifyClick={(item) => {
                  setModifyingItem(item);
                  navigate('/plans');
                }}
              />
            </StagePlaceholder>
          } />

          {/* 4. Optimizer: CP-SAT Optimization & Conflict Topology */}
          <Route path="/optimizer" element={
            <StagePlaceholder stageNumber="4" stageTitle="Constraint Optimizer" description="Google OR-Tools CP-SAT Formulation">
              <ConflictsView
                conflictsData={conflictsData}
                onTriggerOptimize={() => {
                  handleRunOptimizer(false);
                  navigate('/planning-board');
                }}
              />
            </StagePlaceholder>
          } />

          {/* 5. Weekly/Monthly Plans: Human Planner Review & Approval */}
          <Route path="/plans" element={
            <StagePlaceholder stageNumber="5" stageTitle="Weekly & Monthly Plans" description="Human-in-the-Loop Override & Authorizing Sign-Off">
              <PlannerReviewModal
                currentPlan={currentPlan}
                modifyingItem={modifyingItem}
                onCloseModal={() => setModifyingItem(null)}
                onSubmitModification={handleModifySlot}
                onApprovePlan={handleApprovePlan}
                isSubmitting={isSubmittingMod}
              />
            </StagePlaceholder>
          } />

          {/* 6. KPIs: Before vs After Comparison */}
          <Route path="/kpis" element={
            <StagePlaceholder stageNumber="6" stageTitle="KPI Comparison Story" description="Measurable Conflict Elimination & Block Reduction">
              <KpiComparisonView
                stats={dashboardStats}
                currentPlan={currentPlan}
                onRunOptimizer={() => handleRunOptimizer(false)}
                setActiveTab={(tab) => {
                  if (tab === 'silos') navigate('/intake');
                  else if (tab === 'conflicts') navigate('/optimizer');
                  else if (tab === 'gantt') navigate('/planning-board');
                  else if (tab === 'review') navigate('/plans');
                }}
              />
            </StagePlaceholder>
          } />

          {/* 7. Audit Trail: Immutable Decision Log */}
          <Route path="/audit-trail" element={
            <StagePlaceholder stageNumber="7" stageTitle="Audit Trail" description="Cryptographic Event Log & Accountability">
              <AuditTrailView
                auditLogs={auditLogs}
              />
            </StagePlaceholder>
          } />

          {/* Dynamic Re-planning sub-view */}
          <Route path="/replan" element={
            <StagePlaceholder stageNumber="8" stageTitle="Dynamic Re-planning" description="Real-time Defect Accommodation & Diff Tracking">
              <ReplanningView
                replanResult={replanResult}
                onTriggerReplan={handleTriggerReplan}
                isReplanning={isReplanning}
                currentPlan={currentPlan}
              />
            </StagePlaceholder>
          } />
        </Route>
      </Routes>

      {/* Transparent Explainability Drawer */}
      <ExplainabilityDrawer
        data={explainData}
        isOpen={isExplainOpen}
        onClose={() => setIsExplainOpen(false)}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('railblock_user')) || null; } catch { return null; }
  });

  const handleLogin = (userData) => {
    sessionStorage.setItem('railblock_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('railblock_user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <AppContent user={user} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
