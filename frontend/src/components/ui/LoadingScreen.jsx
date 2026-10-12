import Logo from '../Logo.jsx';

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
        gap: 14,
        color: 'var(--muted)',
      }}
    >
      <div
        className="skeleton-pulse neu-raised"
        aria-hidden="true"
        style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center' }}
      >
        <Logo size={34} />
      </div>
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}
