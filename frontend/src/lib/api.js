// Base API Client pointing to FastAPI Backend Base URL
// Human-in-the-Loop Decision Support System

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {}
      throw new Error(errorJson?.detail || errorJson?.message || `HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, err);
    throw err;
  }
}

// 1. Health Checks (Prompt 1/10)
export async function checkHealth() {
  return request('/health');
}

export async function checkDbHealth() {
  return request('/health/db');
}

// 2. Operational API Endpoints
export async function fetchDashboardStats() {
  return request('/api/dashboard/stats');
}

export async function fetchWorkItems() {
  return request('/api/work-items');
}

export async function fetchWorkExplainability(workId) {
  return request(`/api/work-items/${workId}/explain`);
}

export async function fetchConflicts() {
  return request('/api/conflicts');
}

export async function runOptimization() {
  return request('/api/optimize', { method: 'POST' });
}

export async function fetchCurrentPlan() {
  try {
    return await request('/api/plans/current');
  } catch (e) {
    if (e.message && e.message.includes('404')) return null;
    throw e;
  }
}

export async function modifyPlanSchedule(payload) {
  return request('/api/plans/modify', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function approvePlan(payload) {
  return request('/api/plans/approve', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function triggerEmergencyReplan(payload) {
  return request('/api/replan/emergency', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchAuditTrail(limit = 100) {
  return request(`/api/audit-trail?limit=${limit}`);
}

export async function resetDemoData() {
  return request('/api/reset-demo', { method: 'POST' });
}
