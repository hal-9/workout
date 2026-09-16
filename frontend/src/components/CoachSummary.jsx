import { formatHintValue, hintKey, isApplicable, trendView } from '../lib/coachSummary.js';

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--muted)',
};

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
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
      <div style={cardStyle}>
        <div style={labelStyle}>Coach</div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.15,
            background: 'var(--primary-grad)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {headline}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }}>{verdict}</p>
        {note_reply && (
          <p
            style={{
              margin: '10px 0 0',
              paddingLeft: 10,
              borderLeft: '2px solid var(--line)',
              fontSize: 13,
              color: 'var(--muted)',
              fontStyle: 'italic',
            }}
          >
            {note_reply}
          </p>
        )}
      </div>

      {exercises.length > 0 && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Pro Übung</div>
          {exercises.map((entry) => {
            const view = trendView(entry.trend);
            return (
              <div
                key={entry.exercise_id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '9px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <span
                  aria-label={view.label}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: view.color,
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {view.symbol}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{entry.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{entry.text}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length > 0 && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Nächstes Mal</div>
          {recommendations.map((rec, index) => {
            const applicable = isApplicable(rec);
            const state = applicable ? hintStates[hintKey(rec)] : undefined;
            return (
              <div key={index} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{rec.text}</p>
                {applicable && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginTop: 8,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                      {rec.exercise_name} · {formatHintValue(rec.field, rec.value)}
                    </span>
                    {state === 'done' ? (
                      <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ Übernommen</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApply?.(rec)}
                        disabled={state === 'saving'}
                        style={{
                          border: 'none',
                          borderRadius: 10,
                          padding: '7px 11px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: state === 'saving' ? 'wait' : 'pointer',
                          background: 'var(--primary-grad)',
                          color: 'var(--on-primary)',
                          flexShrink: 0,
                        }}
                      >
                        {state === 'saving' ? 'Speichert…' : 'Für nächstes Mal übernehmen'}
                      </button>
                    )}
                  </div>
                )}
                {state === 'error' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger)' }}>
                    Konnte nicht gespeichert werden.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
