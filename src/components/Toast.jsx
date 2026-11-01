import React, { useEffect, useState } from 'react';

export default function Toast({ notice, onDismiss }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!notice || hovered || focused) return;
    const timeout = setTimeout(() => onDismiss(null), 7000);
    return () => clearTimeout(timeout);
  }, [notice, onDismiss, hovered, focused]);

  return <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
    {notice && <div className="toast" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <span className="toast-icon" aria-hidden="true">✓</span>
      <div className="toast-copy"><strong>{notice.title}</strong><p>{notice.message}</p></div>
      <button type="button" className="icon-button toast-close" aria-label="Dismiss notification" onClick={() => { setHovered(false); setFocused(false); onDismiss(null); }}>×</button>
    </div>}
  </div>;
}
