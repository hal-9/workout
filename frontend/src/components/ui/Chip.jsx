export default function Chip({ children, active = false, onClick, ariaLabel, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        background: active ? 'var(--primary-dim)' : 'var(--surface2)',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
        color: active ? 'var(--primary)' : 'var(--muted)',
        borderRadius: 999,
        padding: '6px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 32,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
