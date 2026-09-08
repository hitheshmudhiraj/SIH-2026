// Base API Client pointing to FastAPI Backend Base URL
// File-Based Indian Railways SCoR Maintenance Block Planning Platform

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

// 1. Health Checks
export async function checkHealth() {
  return request('/health');
}

// 2. Data Integration Hub Endpoints
export async function fetchIntegrationStatus() {
  return request('/api/integration/status');
}

export async function syncAllSystems() {
  return request('/api/integration/sync', { method: 'POST' });
}

export async function fetchDataQualityReport() {
  return request('/api/integration/quality');
}

// 3. Raw & Unified Data Feeds
export async function fetchAllAssets(source = '', corridor = '') {
  const params = new URLSearchParams();
  if (source) params.append('source', source);
  if (corridor) params.append('corridor', corridor);
  const q = params.toString();
  return request(`/api/assets${q ? `?${q}` : ''}`);
}

export async function fetchMaintenanceJobs(corridor = '', department = '') {
  const params = new URLSearchParams();
  if (corridor) params.append('corridor', corridor);
  if (department) params.append('department', department);
  const q = params.toString();
  return request(`/api/maintenance${q ? `?${q}` : ''}`);
}

export async function fetchTrainMovements(corridor = '') {
  return request(`/api/trains${corridor ? `?corridor=${corridor}` : ''}`);
}

export async function fetchBlockRequests(corridor = '') {
  return request(`/api/blocks${corridor ? `?corridor=${corridor}` : ''}`);
}

// 4. Corridor Topology & AP Map
export async function fetchCorridorMapData() {
  return request('/api/corridors/ap-map');
}

// 5. Maintenance Opportunities
export async function discoverOpportunities() {
  return request('/api/opportunities/discover', { method: 'POST' });
}

// 6. Block Optimizer (OR-Tools CP-SAT)
export async function generateOptimalPlan() {
  return request('/api/optimization/generate', { method: 'POST' });
}

export async function fetchCurrentPlan() {
  try {
    return await request('/api/optimization/current-plan');
  } catch (e) {
    if (e.message && e.message.includes('404')) return null;
    throw e;
  }
}

export async function fetchWhyBlockExplanation(blockId) {
  return request(`/api/optimization/why-block/${blockId}`);
}

// 7. What-If Simulator & Emergency Defect
export async function runWhatIfSimulation(params) {
  return request('/api/simulation/what-if', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function triggerEmergencyDefect(defectData) {
  return request('/api/emergency/replan', {
    method: 'POST',
    body: JSON.stringify(defectData)
  });
}

// 8. Data Lineage Traceability
export async function fetchDataLineage(identifier) {
  return request(`/api/data-lineage/${identifier}`);
}

// 9. Plan Governance & Audit Trail
export async function approvePlanById(planId, payload) {
  return request(`/api/plan/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function modifyPlanSlot(planId, payload) {
  return request(`/api/plan/${planId}/modify`, {
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

// Legacy Aliases for Seamless Component Interoperability
export const triggerEmergencyReplan = triggerEmergencyDefect;

// SIH26027 Block Planning APIs
export const fetchSections = async () => request('/api/sections');
export const fetchMaintenanceTasks = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/maintenance-tasks?${query}`);
};
export const fetchCorridorAvailability = async (sectionId, date) => {
  const q = date ? `?section_id=${sectionId}&date=${date}` : `?section_id=${sectionId}`;
  return request(`/api/corridor-availability${q}`);
};
export const generateWeeklyBlockPlan = async (startDate, endDate) => {
  return request('/api/block-plan/generate-weekly', {
    method: 'POST',
    body: JSON.stringify({ start_date: startDate, end_date: endDate })
  });
};
export const generateMonthlyBlockPlan = async (startDate, endDate) => {
  return request('/api/block-plan/generate-monthly', {
    method: 'POST',
    body: JSON.stringify({ start_date: startDate, end_date: endDate })
  });
};
export const fetchBlockPlanComparison = async (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return request(`/api/block-plan/compare?${params.toString()}`);
};
export const fetchLatestWeeklyPlan = async () => request('/api/block-plan/latest-weekly');
export const fetchLatestMonthlyPlan = async () => request('/api/block-plan/latest-monthly');

