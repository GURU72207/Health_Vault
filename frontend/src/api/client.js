const API_BASE = '/api';

/**
 * Fetch wrapper with automatic JWT token attachment and error extraction.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('phr_token');
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || response.statusText || 'API Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  signup: (userData) => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => apiRequest('/auth/me'),

  // Patients
  getPatients: () => apiRequest('/patients'),
  getPatient: (id) => apiRequest(`/patients/${id}`),
  updatePatient: (id, data) => apiRequest(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Visits
  getVisits: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/visits${query ? `?${query}` : ''}`);
  },
  createVisit: (visitData) => apiRequest('/visits', { method: 'POST', body: JSON.stringify(visitData) }),
  getVisit: (id) => apiRequest(`/visits/${id}`),

  // Documents
  getDocuments: (patientId) => apiRequest(`/documents${patientId ? `?patient_id=${patientId}` : ''}`),
  uploadDocument: (formData) => apiRequest('/documents', { method: 'POST', body: formData }),
  getDocumentDownloadUrl: (id) => `${API_BASE}/documents/${id}/download`,

  // Access & Consent
  getGrants: () => apiRequest('/access/grants'),
  grantAccess: (providerId) => apiRequest('/access/grant', { method: 'POST', body: JSON.stringify({ provider_id: providerId }) }),
  revokeAccess: (providerId) => apiRequest('/access/revoke', { method: 'POST', body: JSON.stringify({ provider_id: providerId }) }),
  getProviders: () => apiRequest('/access/providers'),

  // Follow-ups
  getUpcomingFollowups: () => apiRequest('/followups/upcoming'),

  // Audit Logs
  getAuditLog: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/audit-log${query ? `?${query}` : ''}`);
  },

  // Demo Controls
  getPersonas: () => apiRequest('/demo/personas'),
  resetDemoData: () => apiRequest('/demo/reset', { method: 'POST' }),
  getDemoStatus: () => apiRequest('/demo/status')
};
