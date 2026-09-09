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

// SIH26027 Block Planning APIs
export async function fetchSections() {
  const res = await fetch(`${BASE_URL}/sections`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMaintenanceTasks(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/maintenance-tasks?${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCorridorAvailability(sectionId, date) {
  const q = date ? `?section_id=${sectionId}&date=${date}` : `?section_id=${sectionId}`;
  const res = await fetch(`${BASE_URL}/corridor-availability${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateWeeklyBlockPlan(startDate, endDate) {
  const res = await fetch(`${BASE_URL}/block-plan/generate-weekly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateMonthlyBlockPlan(startDate, endDate) {
  const res = await fetch(`${BASE_URL}/block-plan/generate-monthly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchBlockPlanComparison(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const res = await fetch(`${BASE_URL}/block-plan/compare?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLatestWeeklyPlan() {
  const res = await fetch(`${BASE_URL}/block-plan/latest-weekly`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLatestMonthlyPlan() {
  const res = await fetch(`${BASE_URL}/block-plan/latest-monthly`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// AI Maintenance Block Recommender APIs
export async function getAiBlockRecommendation(payload) {
  const res = await fetch(`${BASE_URL}/block-planning/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    let msg = 'Failed to generate AI block recommendation';
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.detail || msg;
    } catch {
      msg = errText || msg;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchModelMetadata() {
  const res = await fetch(`${BASE_URL}/block-planning/model-metadata`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
