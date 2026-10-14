export default function Chip({ children, active = false, onClick, ariaLabel, style }) {
  return (
    // Immer erhaben; gewählt mit Primär-Ring.
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className="btn"
      style={{
        background: 'var(--bg)',
        border: 'none',
        boxShadow: active ? 'var(--shadow-selected)' : 'var(--shadow-raised)',
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
