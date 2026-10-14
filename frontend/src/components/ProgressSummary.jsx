import Card from './ui/Card.jsx';

// Dezimalpunkt in Zahlen → deutsches Komma ("2.5 → 8.75 kg" → "2,5 → 8,75 kg").
// Nur für Werte, nicht für Datumsangaben ("12.03").
export const deNum = (value) => String(value).replace(/(\d)\.(\d)/g, '$1,$2');

// Vier Wochen als kleine Säulen neben dem Durchschnitt: Füllhöhe = erledigt/geplant.
function WeekStrip({ weeks }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 18 }}>
      {weeks.map((w) => (
        <span
          key={w.weekLabel}
          style={{
            width: 6,
            height: 18,
            borderRadius: 3,
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-raised)',
            display: 'flex',
            alignItems: 'flex-end',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              width: '100%',
              height: `${w.total ? Math.min(100, (w.done / w.total) * 100) : 0}%`,
              background: 'var(--primary)',
              borderRadius: 3,
            }}
          />
        </span>
      ))}
    </span>
  );
}

const valueStyle = {
  fontSize: 21,
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: '-0.01em',
  color: 'var(--text)',
};

// Kopf des Fortschritt-Tabs: drei ruhige Zeilen beantworten „halte ich durch",
// „werde ich stärker" und „was kommt als Nächstes" — bevor irgendein Diagramm scrollt.
export default function ProgressSummary({ items, weeks }) {
  if (!items?.length) return null;

  return (
    <Card>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Auf einen Blick</h2>
      <div className="px-rows" style={{ marginTop: 6 }}>
        {items.map((item) => {
          // Zuwachs: Prozent und absoluter Kontext gleich laut — „+250 %" allein übertreibt.
          const isStrength = item.key === 'strength';
          return (
            <div key={item.key} style={{ padding: '12px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 10px', marginTop: 2 }}>
                {isStrength && item.detail ? (
                  <>
                    <span style={valueStyle}>{deNum(item.detail.replace(': ', ' '))}</span>
                    <span style={valueStyle}>{item.value}</span>
                  </>
                ) : (
                  <span style={valueStyle}>{deNum(item.value)}</span>
                )}
                {item.key === 'consistency' && weeks?.length > 0 && <WeekStrip weeks={weeks} />}
              </div>
              {item.detail && !isStrength && (
                <div style={{ marginTop: 2, fontSize: 14, color: 'var(--muted)' }}>{deNum(item.detail)}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
