import { useEffect, useRef } from 'react';
import { useScrollLock } from '../../lib/scrollLock.js';

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
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
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
          maxHeight: '85dvh',
          overflow: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {title && <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
