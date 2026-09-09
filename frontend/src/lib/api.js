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

export async function fetchInvalidRecordsQueue(params = {}) {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'ALL') q.append('status', params.status);
  if (params.department && params.department !== 'ALL') q.append('department', params.department);
  if (params.error_type && params.error_type !== 'ALL') q.append('error_type', params.error_type);
  if (params.is_defaulted !== undefined && params.is_defaulted !== '' && params.is_defaulted !== 'ALL') {
    q.append('is_defaulted', params.is_defaulted);
  }
  const qs = q.toString();
  return request(`/api/integration/review-queue${qs ? `?${qs}` : ''}`);
}

export async function submitReviewDecision(recordId, payload) {
  return request(`/api/integration/review-queue/${recordId}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// 3. Raw & Unified Data Feeds
export async function fetchAllAssets(source = '', corridor = '') {
  const params = new URLSearchParams();
  if (source) params.append('source', source);
  if (corridor) params.append('corridor', corridor);
  const q = params.toString();
  return request(`/api/assets${q ? `?${q}` : ''}`);
}

export async function fetchMaintenanceJobs(options = {}) {
  const params = new URLSearchParams();
  if (typeof options === 'string') {
    if (options) params.append('corridor', options);
  } else {
    if (options.corridor) params.append('corridor', options.corridor);
    if (options.department) params.append('department', options.department);
    if (options.departments) {
      params.append('departments', Array.isArray(options.departments) ? options.departments.join(',') : options.departments);
    }
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
  }
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
export async function fetchCorridorMapData(options = {}) {
  const params = new URLSearchParams();
  if (options.corridor) params.append('corridor', options.corridor);
  if (options.department) params.append('department', options.department);
  if (options.departments) {
    params.append('departments', Array.isArray(options.departments) ? options.departments.join(',') : options.departments);
  }
  if (options.startDate) params.append('start_date', options.startDate);
  if (options.endDate) params.append('end_date', options.endDate);
  const q = params.toString();
  return request(`/api/corridors/ap-map${q ? `?${q}` : ''}`);
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

// BDMS Pre-Submission Conflict & Overlap Check
export const checkBlockOverlap = async ({ corridor_id, km, date_start, date_end, department }) => {
  const params = new URLSearchParams();
  if (corridor_id) params.append('corridor_id', corridor_id);
  if (km !== undefined && km !== null) params.append('km', km);
  if (date_start) params.append('date_start', date_start);
  if (date_end) params.append('date_end', date_end);
  if (department) params.append('department', department);
  return request(`/api/blocks/check-overlap?${params.toString()}`);
};

export const submitBlockRequest = async (payload) => {
  return request('/api/blocks/submit-request', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};
