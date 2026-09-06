// Centralized API client for RailBlock AI backend

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchDashboardStats() {
  const res = await fetch(`${BASE_URL}/dashboard/stats`);
  return res.json();
}

export async function fetchWorkItems() {
  const res = await fetch(`${BASE_URL}/work-items`);
  return res.json();
}

export async function fetchWorkExplainability(workId) {
  const res = await fetch(`${BASE_URL}/work-items/${workId}/explain`);
  return res.json();
}

export async function fetchConflicts() {
  const res = await fetch(`${BASE_URL}/conflicts`);
  return res.json();
}

export async function runOptimization() {
  const res = await fetch(`${BASE_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCurrentPlan() {
  const res = await fetch(`${BASE_URL}/plans/current`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

export async function modifyPlanSchedule(payload) {
  const res = await fetch(`${BASE_URL}/plans/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function approvePlan(payload) {
  const res = await fetch(`${BASE_URL}/plans/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function triggerEmergencyReplan(payload) {
  const res = await fetch(`${BASE_URL}/replan/emergency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAuditTrail(limit = 100) {
  const res = await fetch(`${BASE_URL}/audit-trail?limit=${limit}`);
  return res.json();
}

export async function resetDemoData() {
  const res = await fetch(`${BASE_URL}/reset-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}
