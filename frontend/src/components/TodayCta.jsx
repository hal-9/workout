import Button from './ui/Button.jsx';

// Eine klare nächste Aktion auf „Heute" — welche, entscheidet der Zustand des
// Tages (noch nichts geloggt, Session läuft, alles erledigt, Pausentag).
export default function TodayCta({ label, sublabel, variant = 'primary', disabled = false, onClick }) {
  return (
    <div style={{ marginTop: 18 }}>
      <Button onClick={onClick} disabled={disabled} variant={variant} fullWidth style={{ fontSize: 16, minHeight: 52 }}>
        {/* Lange Übungsnamen sollen den Button nicht auf drei Zeilen sprengen. */}
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </Button>
      {sublabel && (
        <div
          style={{
            marginTop: 8,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}
