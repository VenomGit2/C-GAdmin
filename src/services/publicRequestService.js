import { apiRequest } from './apiClient.js';
export function getPublicConfig() {
  return apiRequest('/public-api/config', {}, 'Request form is unavailable. Please try again later.');
}
export function submitPublicRequest(fields) {
  return apiRequest('/public-api/requests', { method: 'POST', body: JSON.stringify(fields) }, 'Unable to submit your request. Please try again later.');
}
