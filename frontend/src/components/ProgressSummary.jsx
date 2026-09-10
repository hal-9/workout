// Kopf des Fortschritt-Tabs: drei Zahlen, die die Fragen „halte ich durch",
// „werde ich stärker" und „was kommt als Nächstes" beantworten — bevor
// irgendein Diagramm scrollt.
export default function ProgressSummary({ items }) {
  if (!items?.length) return null;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <h3 style={{ margin: '0 0 12px' }}>Auf einen Blick</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((item) => (
          <div key={item.key}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 26,
                lineHeight: 1.1,
                background: 'var(--primary-grad)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {item.value}
            </div>
            {item.detail && (
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>{item.detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
