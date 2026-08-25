import { useEffect, useRef } from 'react';

export default function Dialog({ open, onClose, title, children, ariaLabel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(46,36,64,.35)',
        WebkitBackdropFilter: 'blur(6px)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="glass ed-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 20,
          padding: 20,
          width: 'min(92vw, 400px)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        {title && <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
