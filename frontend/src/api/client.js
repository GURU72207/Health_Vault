import { handleMockRequest } from './mockEngine';

const API_BASE = '/api';

const isStaticHosted = typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' && 
  window.location.hostname !== '127.0.0.1';

/**
 * Fetch wrapper with automatic fallback for GitHub Pages live preview.
 */
export async function apiRequest(endpoint, options = {}) {
  // If hosted on GitHub Pages or static web without local Node server, use mock engine
  if (isStaticHosted) {
    return handleMockRequest(endpoint, options);
  }

  const token = localStorage.getItem('phr_token');
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
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
  } catch (err) {
    // If local backend is down or unreachable, seamlessly fallback so UI never breaks
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      console.warn('[FALLBACK] Express backend unreachable, falling back to client-side engine.');
      return handleMockRequest(endpoint, options);
    }
    throw err;
  }
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
  acknowledgeDocument: (id) => apiRequest(`/documents/${id}/acknowledge`, { method: 'POST' }),
  getDocumentDownloadUrl: (id) => {
    const token = localStorage.getItem('phr_token');
    return `${API_BASE}/documents/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  downloadDocument: async (id, filename) => {
    if (isStaticHosted) {
      // Create mock download for static environment
      const blob = new Blob([`Synthetic Health Document - URAN 2026 HT-05\nID: ${id}\nFilename: ${filename}`], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return;
    }

    const token = localStorage.getItem('phr_token');
    const response = await fetch(`${API_BASE}/documents/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      let errorMsg = 'Failed to download document';
      try {
        const errJson = await response.json();
        errorMsg = errJson.error || errorMsg;
      } catch (_) {}
      const err = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

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
