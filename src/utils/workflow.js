export const statuses = ['Pending', 'Approved', 'Rejected', 'Revoked'];
export const transitions = { Pending: ['Approved', 'Rejected'], Approved: ['Revoked'], Rejected: ['Approved'], Revoked: ['Approved'] };
export function actionLabel(from, to) { return to === 'Approved' ? (from === 'Pending' ? 'Approve' : 'Reapprove') : to === 'Rejected' ? 'Reject' : 'Revoke'; }
export function canTransition(from, to) { return transitions[from]?.includes(to) ?? false; }
