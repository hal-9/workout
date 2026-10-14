import { useState } from 'react';
import { assignWeekdays, WEEKDAY_LABELS, WEEKDAYS } from '../../lib/schedule.js';
import { formatExercisePrescription } from '../../lib/planDefaults.js';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

const WEEKDAY_NAMES = {
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
  sat: 'Samstag',
  sun: 'Sonntag',
};

const dayLetter = (index) => String.fromCharCode(65 + index);

// Kleiner erhabener Kreis mit dem Tagesbuchstaben — gleiche Form wie der Haken auf „Heute".
export function DayPebble({ children, active = false }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 32,
        height: 30,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-raised)',
        color: active ? 'var(--primary)' : 'var(--text)',
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export default function PlanOverview({ plan, onEdit, onNewPlan }) {
  const [openDayKey, setOpenDayKey] = useState(plan.days[0]?.key ?? null);
  const weekdayMap = assignWeekdays(plan);
  const letterByKey = new Map(plan.days.map((d, i) => [d.key, dayLetter(i)]));

  const weekStrip = WEEKDAYS.map((wd) => {
    const day = weekdayMap.get(wd);
    return { weekday: wd, day };
  });

  // Tap auf einen Wochentag klappt die passende Tageskarte auf.
  const openDay = (key) => {
    setOpenDayKey(key);
    document.getElementById(`plan-day-${key}`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{plan.name}</h3>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          {plan.days.length} Trainingstage
        </div>
        {/* Plan und Kalender zeigen bewusst Verschiedenes — das war bisher nirgends gesagt. */}
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
          Das ist die übliche Woche. Wie diese Woche tatsächlich liegt — inklusive verschobener
          Tage — steht im Kalender.
        </div>
      </div>

      {/* Wochenstreifen: Wochentag + Buchstabe des Trainingstags; Name steht in den Karten darunter. */}
      <div
        className="neu-raised"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 4,
          padding: 6,
          borderRadius: 24,
          marginBottom: 20,
        }}
      >
        {weekStrip.map(({ weekday, day }) => {
          if (!day) {
            return (
              <div
                key={weekday}
                aria-label={`${WEEKDAY_NAMES[weekday]}: Pause`}
                role="img"
                style={{
                  minWidth: 0,
                  minHeight: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                <span>{WEEKDAY_LABELS[weekday]}</span>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--line)' }} />
              </div>
            );
          }
          const isOpen = openDayKey === day.key;
          return (
            <button
              key={weekday}
              type="button"
              onClick={() => openDay(day.key)}
              aria-label={`${WEEKDAY_NAMES[weekday]}: ${day.name}`}
              aria-pressed={isOpen}
              className="btn"
              style={{
                minWidth: 0,
                minHeight: 60,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '6px 0',
                border: 'none',
                borderRadius: 16,
                background: 'var(--bg)',
                boxShadow: isOpen ? 'var(--shadow-selected)' : 'var(--shadow-raised)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{WEEKDAY_LABELS[weekday]}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: isOpen ? 'var(--primary)' : 'var(--text)' }}>
                {letterByKey.get(day.key)}
              </span>
            </button>
          );
        })}
      </div>

      {plan.days.map((day, index) => {
        const isOpen = openDayKey === day.key;
        return (
          <details
            key={day.key}
            id={`plan-day-${day.key}`}
            open={isOpen}
            onToggle={(e) => {
              if (e.target.open) setOpenDayKey(day.key);
              else if (openDayKey === day.key) setOpenDayKey(null);
            }}
            className="neu-raised pl-day"
            style={{
              borderRadius: 20,
              padding: '0 16px',
              marginBottom: 14,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                padding: '14px 0',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <DayPebble active={isOpen}>{dayLetter(index)}</DayPebble>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{day.name}</span>
                {day.focus && (
                  <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>
                    {day.focus}
                  </span>
                )}
              </span>
              <span className="pl-chevron" style={{ display: 'flex', color: 'var(--muted)' }}>
                <Icon name="chevronRight" size={18} />
              </span>
            </summary>
            <div style={{ paddingBottom: 6 }}>
              {day.exercises.map((ex) => (
                <div
                  key={ex.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '11px 0',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, lineHeight: 1.35 }}>{ex.name}</div>
                    {ex.muscle && (
                      <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 1 }}>{ex.muscle}</div>
                    )}
                  </div>
                  <span style={{ flexShrink: 0, color: 'var(--muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
                    {formatExercisePrescription(ex)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        );
      })}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <Button onClick={onEdit} style={{ flex: 1 }}>
          Bearbeiten
        </Button>
        <Button variant="secondary" onClick={onNewPlan} style={{ flex: 1 }}>
          Neuer Plan
        </Button>
      </div>
    </div>
  );
}
