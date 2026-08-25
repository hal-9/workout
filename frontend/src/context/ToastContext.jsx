import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, variant = 'default') => {
    setToast({ message, variant, key: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))',
            left: 16,
            right: 16,
            maxWidth: 560,
            margin: '0 auto',
            zIndex: 80,
            background: toast.variant === 'error' ? 'var(--danger)' : 'var(--surface)',
            color: toast.variant === 'error' ? 'var(--on-primary)' : 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 14,
            boxShadow: 'var(--shadow-card)',
            textAlign: 'center',
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}
