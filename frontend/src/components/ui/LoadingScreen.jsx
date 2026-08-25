export default function LoadingScreen({ label = 'Lädt…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 12,
        color: 'var(--muted)',
      }}
    >
      <div
        className="skeleton-pulse"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--primary-dim)',
        }}
        aria-hidden="true"
      />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{label}</span>
    </div>
  );
}
