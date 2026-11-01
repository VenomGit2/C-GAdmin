import React, { useEffect, useRef } from 'react';
export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const element = ref.current; const previous = document.activeElement; element.showModal(); return () => { element.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title"><header className="dialog-header"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></header>{children}</dialog>;
}
