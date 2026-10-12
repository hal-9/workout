export default function Chip({ children, active = false, onClick, ariaLabel, style }) {
  return (
    // Gewählt = eingedrückt (Wert), sonst erhaben (drückbar).
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className="btn"
      style={{
        background: 'var(--bg)',
        border: 'none',
        boxShadow: active ? 'var(--shadow-inset-sm)' : 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)',
        color: active ? 'var(--primary)' : 'var(--text)',
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 44,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
