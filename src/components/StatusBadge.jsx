import React from 'react';
export default function StatusBadge({ status }) { return <span className={`badge badge--${status.toLowerCase()}`}><span aria-hidden="true">●</span>{status}</span>; }
