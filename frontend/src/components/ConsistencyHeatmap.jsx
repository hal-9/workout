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

export default function ConsistencyHeatmap({ data }) {
  if (!data?.weeks?.length) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
        {data.weeks.map((w) => (
          <div
            key={w.weekLabel}
            title={`${w.weekLabel}: ${w.done}/${w.total}`}
            style={{
              flex: 1,
              height: `${Math.max(8, (w.pct / 100) * 48)}px`,
              background: w.pct >= 75 ? 'var(--success)' : w.pct >= 50 ? 'var(--primary)' : 'var(--line)',
              borderRadius: 4,
              minWidth: 6,
            }}
            aria-label={`${w.weekLabel}: ${w.done} von ${w.total} Trainingstagen`}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--muted)',
          marginTop: 6,
        }}
      >
        <span>{data.weeks[0]?.weekLabel}</span>
        <span>12 Wochen</span>
        <span>{data.weeks[data.weeks.length - 1]?.weekLabel}</span>
      </div>
    </div>
  );
}
