import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from './components/LoginPage';
import HomeView from './components/HomeView';
import DataIntegrationHubView from './components/DataIntegrationHubView';
import UnifiedCorridorMapView from './components/UnifiedCorridorMapView';
import BlockPlanningView from './components/BlockPlanningView';
import KpiComparisonView from './components/KpiComparisonView';
import AuditTrailView from './components/AuditTrailView';
import ReplanningView from './components/ReplanningView';
import DepartmentBlockScheduleView from './components/DepartmentBlockScheduleView';

function AppContent({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172033] flex flex-col font-sans">
      <Routes>
        <Route element={<AppShell user={user} onLogout={onLogout} />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/block-planning" element={<BlockPlanningView />} />
          <Route path="/optimizer" element={<BlockPlanningView />} />
          <Route path="/intake" element={<DataIntegrationHubView />} />
          <Route path="/planning-board" element={<UnifiedCorridorMapView />} />
          <Route path="/department-schedule" element={<DepartmentBlockScheduleView />} />
          <Route path="/weekly-monthly-plans" element={<DepartmentBlockScheduleView />} />
          <Route path="/plans" element={<DepartmentBlockScheduleView />} />
          <Route path="/kpis" element={<KpiComparisonView />} />
          <Route path="/audit-trail" element={<AuditTrailView />} />
          <Route path="/replan" element={<ReplanningView />} />
        </Route>
      </Routes>
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
