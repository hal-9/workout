import { formatHintValue, hintKey, isApplicable, trendView } from '../lib/coachSummary.js';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import Icon from './ui/Icon.jsx';
import '../styles/kal.css';

const sectionTitle = { margin: '28px 0 12px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };

// Trend als Linien-Icon statt Pfeil-Glyphe (Farbe/Label kommen aus trendView).
const TREND_PATH = {
  up: 'M12 19V5M6 11l6-6 6 6',
  flat: 'M5 12h14M13 6l6 6-6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  new: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
};

/**
 * Strukturierte Coach-Auswertung: Schlagzeile, Einschätzung, Trend pro Übung,
 * Empfehlungen mit „Für nächstes Mal übernehmen".
 * `hintStates`: { [exercise_id:field]: 'saving' | 'done' | 'error' }.
 */
export default function CoachSummary({ summary, hintStates = {}, onApply }) {
  if (!summary) return null;
  const { headline, verdict, exercises = [], recommendations = [], note_reply } = summary;

  return (
    <div>
      <Card style={{ marginBottom: 0, padding: 20 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          {headline}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.55, maxWidth: '65ch' }}>{verdict}</p>
        {note_reply && (
          <p
            className="neu-raised"
            style={{
              margin: '14px 0 0',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--muted)',
              fontStyle: 'italic',
            }}
          >
            {note_reply}
          </p>
        )}
      </Card>

      {exercises.length > 0 && (
        <section>
          <h2 style={sectionTitle}>Pro Übung</h2>
          <ul className="kal-tray">
            {exercises.map((entry) => {
              const view = trendView(entry.trend);
              return (
                <li
                  key={entry.exercise_id}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 4px' }}
                >
                  <span
                    role="img"
                    aria-label={view.label}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      background: 'var(--bg)',
                      boxShadow: 'var(--shadow-raised)',
                      color: view.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={16}
                      height={16}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d={TREND_PATH[entry.trend] ?? TREND_PATH.flat} />
                    </svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{entry.name}</span>
                    <span style={{ display: 'block', fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' }}>
                      {entry.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <h2 style={sectionTitle}>Nächstes Mal</h2>
          <ul className="kal-tray">
            {recommendations.map((rec, index) => {
              const applicable = isApplicable(rec);
              const state = applicable ? hintStates[hintKey(rec)] : undefined;
              return (
                <li key={index} style={{ padding: '12px 4px' }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{rec.text}</p>
                  {applicable && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                        {rec.exercise_name} · {formatHintValue(rec.field, rec.value)}
                      </span>
                      {state === 'done' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            minHeight: 44,
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--success)',
                          }}
                        >
                          <Icon name="check" size={16} />
                          Übernommen
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => onApply?.(rec)}
                          disabled={state === 'saving'}
                          style={{
                            flexShrink: 0,
                            padding: '0 16px',
                            fontSize: 14,
                            cursor: state === 'saving' ? 'wait' : 'pointer',
                          }}
                        >
                          {state === 'saving' ? 'Speichert…' : 'Für nächstes Mal übernehmen'}
                        </Button>
                      )}
                    </div>
                  )}
                  {state === 'error' && (
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--danger)' }}>
                      Konnte nicht gespeichert werden.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
