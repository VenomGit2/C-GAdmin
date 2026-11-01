import { apiRequest } from './apiClient.js';
export function loadDashboard() { return apiRequest('/api/requests'); }
export function loadHistory(id) { return apiRequest(`/api/requests/${encodeURIComponent(id)}/history`); }
export function updateRequest(record, status, reason, expiresAt) {
  return apiRequest(`/api/requests/${encodeURIComponent(record.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason, version: record.version, expiresAt }),
  });
}
