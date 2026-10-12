import { useEffect, useRef } from 'react';
import { useScrollLock } from '../../lib/scrollLock.js';
import '../../styles/ui.css';

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Dialog({ open, onClose, title, children, ariaLabel }) {
  const ref = useRef(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, [open]);

  // Escape schließt, Tab bleibt im Dialog (WAI-ARIA Dialog Pattern).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [...(ref.current?.querySelectorAll(FOCUSABLE) ?? [])].filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
      if (!focusable.length) {
        e.preventDefault();
        ref.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!ref.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
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
      className="ui-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        zIndex: 70,
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
        className="ui-rise"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 24,
          padding: 20,
          width: 'min(92vw, 400px)',
          maxHeight: '85dvh',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          outline: 'none',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', minWidth: 0 }}>{title}</h2>
            <CloseButton onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Runder, erhabener Schließen-Knopf — auch von MuscleModal und Tausch-Sheet genutzt.
export function CloseButton({ onClick, label = 'Schließen' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-secondary"
      aria-label={label}
      style={{
        background: 'var(--bg)',
        border: 'none',
        borderRadius: '50%',
        width: 44,
        height: 44,
        padding: 0,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--text)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
      </svg>
    </button>
  );
}
