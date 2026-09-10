import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from './components/LoginPage';
import HomeView from './components/HomeView';
import DataIntegrationHubView from './components/DataIntegrationHubView';
import UnifiedCorridorMapView from './components/UnifiedCorridorMapView';
import BlockPlanningView from './components/BlockPlanningView';
import KpiComparisonView from './components/KpiComparisonView';
import ReplanningView from './components/ReplanningView';
import DepartmentBlockScheduleView from './components/DepartmentBlockScheduleView';
import ProfileView from './components/ProfileView';

function AppContent({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172033] flex flex-col font-sans">
      <Routes>
        <Route element={<AppShell user={user} onLogout={onLogout} />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/block-planning" element={<BlockPlanningView />} />
          <Route path="/optimizer" element={<BlockPlanningView />} />
          <Route path="/intake" element={<DataIntegrationHubView />} />
          <Route path="/planning-board" element={<UnifiedCorridorMapView />} />
          <Route path="/department-schedule" element={<DepartmentBlockScheduleView />} />
          <Route path="/weekly-monthly-plans" element={<DepartmentBlockScheduleView />} />
          <Route path="/plans" element={<DepartmentBlockScheduleView />} />
          <Route path="/kpis" element={<KpiComparisonView />} />
          <Route path="/replan" element={<ReplanningView />} />
          <Route path="/profile" element={<ProfileView user={user} onLogout={onLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('railblock_user')) || null; } catch { return null; }
  });

  const handleLogin = (userData) => {
    sessionStorage.setItem('railblock_user', JSON.stringify(userData));
    sessionStorage.removeItem('railblock_last_route');
    localStorage.removeItem('railblock_last_route');
    // Always navigate to Home ('/') on every login
    navigate('/', { replace: true });
    window.history.replaceState(null, '', '/');
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('railblock_user');
    sessionStorage.removeItem('railblock_last_route');
    localStorage.removeItem('railblock_last_route');
    // Always reset route to Home ('/') on logout
    navigate('/', { replace: true });
    window.history.replaceState(null, '', '/');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <AppContent user={user} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}


