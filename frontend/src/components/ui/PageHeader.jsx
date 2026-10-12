export default function PageHeader({ title, subtitle, action }) {
  return (
    <header style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
        {action}
      </div>
      {subtitle && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
      )}
    </header>
  );
}
