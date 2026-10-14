import { addDays, mondayStart } from '../lib/dates.js';

/** 12-week consistency heatmap from finished sessions. */
export function buildConsistencyHeatmap(plan, sessions = [], weeks = 12) {
  if (!plan?.days?.length) return null;

  const plannedPerWeek = plan.days.length;
  const start = mondayStart(weeks - 1);
  const weeksData = [];

  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(start, w * 7);
    const weekEnd = addDays(weekStart, 7);
    const done = new Set();

    for (const s of sessions) {
      const finished = new Date(s.finished_at.replace(' ', 'T') + 'Z');
      if (finished >= weekStart && finished < weekEnd) {
        done.add(s.day_key);
      }
    }

    weeksData.push({
      weekLabel: weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      done: done.size,
      total: plannedPerWeek,
      pct: plannedPerWeek ? Math.round((done.size / plannedPerWeek) * 100) : 0,
    });
  }

  return { weeks: weeksData, plannedPerWeek };
}

// Eine Mulde pro Woche, Füllhöhe = erledigte Trainingstage; grün erst, wenn das
// Wochenziel (≥ 75 %) erreicht ist.
export default function ConsistencyHeatmap({ data }) {
  if (!data?.weeks?.length) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, height: 48 }}>
        {data.weeks.map((w) => (
          <div
            key={w.weekLabel}
            title={`${w.weekLabel}: ${w.done}/${w.total}`}
            aria-label={`${w.weekLabel}: ${w.done} von ${w.total} Trainingstagen`}
            style={{
              flex: 1,
              minWidth: 6,
              borderRadius: 6,
              background: 'var(--bg)',
              boxShadow: 'var(--shadow-raised)',
              display: 'flex',
              alignItems: 'flex-end',
              overflow: 'hidden',
            }}
          >
            {w.pct > 0 && (
              <div
                style={{
                  width: '100%',
                  height: `${Math.min(100, w.pct)}%`,
                  borderRadius: 6,
                  background: w.pct >= 75 ? 'var(--success)' : 'var(--primary)',
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--muted)',
          marginTop: 8,
        }}
      >
        <span>{data.weeks[0]?.weekLabel}</span>
        <span>{data.weeks[data.weeks.length - 1]?.weekLabel}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)' }} />
          Wochenziel erreicht
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)' }} />
          Teilweise
        </span>
      </div>
    </div>
  );
}
