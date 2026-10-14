import Card from './ui/Card.jsx';
import ProgressionProposals from './ProgressionProposals.jsx';
import { parseUtc } from '../lib/dates.js';

// Dezimalpunkt in Zahlen → deutsches Komma ("2.5 → 8.75 kg" → "2,5 → 8,75 kg").
// Nur für Werte, nicht für Datumsangaben ("12.03").
export const deNum = (value) => String(value).replace(/(\d)\.(\d)/g, '$1,$2');

const heading = { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };
const lead = { margin: '8px 0 0', fontSize: 21, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' };
const muted = { margin: '4px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' };

// Wochen als kleine Säulen: Füllhöhe = erledigt/geplant. Die laufende Woche
// ist blass — sie ist noch nicht vorbei und kein „verfehlt".
function WeekStrip({ weeks }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 4, height: 22 }}>
      {weeks.map((w, i) => (
        <span
          key={w.weekLabel}
          style={{
            width: 8,
            height: 22,
            borderRadius: 4,
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-raised)',
            display: 'flex',
            alignItems: 'flex-end',
            overflow: 'hidden',
            opacity: i === weeks.length - 1 ? 0.6 : 1,
          }}
        >
          <span
            style={{
              width: '100%',
              height: `${w.total ? Math.min(100, (w.done / w.total) * 100) : 0}%`,
              background: 'var(--primary)',
              borderRadius: 4,
            }}
          />
        </span>
      ))}
    </span>
  );
}

function Consistency({ weekRecap }) {
  const weeks = weekRecap?.weeks ?? [];
  if (!weeks.length) {
    return <p style={muted}>Mit einem Plan siehst du hier deine Trainingstage pro Woche.</p>;
  }
  const current = weeks[weeks.length - 1];
  const full = weeks.slice(0, -1);
  const met = full.filter((w) => w.total > 0 && w.done >= w.total).length;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={lead}>
          {current.done} von {current.total} Trainingstagen diese Woche
        </p>
        <WeekStrip weeks={weeks} />
      </div>
      {full.length > 0 && (
        <p style={muted}>
          In {met} der letzten {full.length} Wochen alle Trainingstage geschafft.
        </p>
      )}
    </>
  );
}

const shortDate = (ts) => parseUtc(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function Improvement({ summary, isError }) {
  if (isError) return <p style={muted}>Konnte gerade nicht geladen werden.</p>;
  if (!summary) return <p style={muted}>Lade…</p>;
  const { state, facts } = summary.improvement;
  if (state === 'no_comparison') {
    return (
      <p style={muted}>
        Noch kein Vergleich. Nach zwei Workouts mit derselben Übung siehst du hier, was sich verändert hat.
      </p>
    );
  }
  if (!facts.length) {
    return <p style={muted}>Zuletzt nicht direkt vergleichbar — andere Satzzahl oder anderes Gewicht.</p>;
  }
  return facts.map((fact) => (
    <div key={fact.exercise_id} style={{ marginTop: 8 }}>
      <p style={{ ...lead, margin: 0, fontSize: 17 }}>{fact.text}</p>
      <p style={{ ...muted, margin: '2px 0 0', fontSize: 13 }}>
        {shortDate(fact.dates[0])} → {shortDate(fact.dates[1])}
      </p>
    </div>
  ));
}

function NextStep({ proposals }) {
  if (!proposals) return <p style={muted}>Lade…</p>;
  if (!proposals.length) {
    return (
      <p style={muted}>
        Gerade keine Steigerung fällig. Beim nächsten Workout startest du mit deinen Werten vom letzten Mal.
      </p>
    );
  }
  // Nur der erste Vorschlag — ein nächster Schritt, keine Liste.
  return <ProgressionProposals proposals={proposals.slice(0, 1)} bare />;
}

// Kopf des Fortschritt-Tabs: drei Fragen, in fester Reihenfolge.
export default function ProgressSummary({ weekRecap, summary, summaryError, proposals }) {
  return (
    <>
      <Card>
        <h2 style={heading}>Bleibe ich dran?</h2>
        <Consistency weekRecap={weekRecap} />
      </Card>
      <Card>
        <h2 style={heading}>Werde ich besser?</h2>
        <Improvement summary={summary} isError={summaryError} />
      </Card>
      <Card>
        <h2 style={heading}>Was ist mein nächster Schritt?</h2>
        <NextStep proposals={proposals} />
      </Card>
    </>
  );
}
