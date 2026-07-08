import { useState } from 'react';
import { assignWeekdays, WEEKDAY_LABELS, WEEKDAYS } from '../../lib/schedule.js';
import { formatExercisePrescription } from '../../lib/planDefaults.js';

const actionBtnStyle = {
  flex: 1,
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'var(--surface)',
  color: 'var(--text)',
};

export default function PlanOverview({ plan, onEdit, onNewPlan }) {
  const [openDayKey, setOpenDayKey] = useState(plan.days[0]?.key ?? null);
  const weekdayMap = assignWeekdays(plan);

  const weekStrip = WEEKDAYS.map((wd) => {
    const day = weekdayMap.get(wd);
    return { weekday: wd, day };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>{plan.name}</h3>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {plan.days.length} Trainingstage
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          marginBottom: 16,
        }}
      >
        {weekStrip.map(({ weekday, day }) => (
          <div
            key={weekday}
            style={{
              textAlign: 'center',
              padding: '8px 4px',
              borderRadius: 10,
              background: day ? 'var(--primary-dim)' : 'var(--surface2)',
              border: `1px solid ${day ? 'var(--primary)' : 'var(--line)'}`,
              fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 700, color: day ? 'var(--primary)' : 'var(--muted)' }}>
              {WEEKDAY_LABELS[weekday]}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: day ? 'var(--text)' : 'var(--muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={day?.name}
            >
              {day ? day.name.split('–')[0].trim() : '—'}
            </div>
          </div>
        ))}
      </div>

      {plan.days.map((day, index) => {
        const isOpen = openDayKey === day.key;
        return (
          <details
            key={day.key}
            open={isOpen}
            onToggle={(e) => {
              if (e.target.open) setOpenDayKey(day.key);
              else if (openDayKey === day.key) setOpenDayKey(null);
            }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '4px 15px 12px',
              marginBottom: 10,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                padding: '12px 0',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--primary)',
                    background: 'var(--primary-dim)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    marginRight: 8,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <strong>{day.name}</strong>
              </span>
              <span style={{ color: 'var(--muted)' }}>›</span>
            </summary>
            {day.focus && (
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 10px' }}>{day.focus}</p>
            )}
            {day.exercises.map((ex) => (
              <div
                key={ex.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '9px 0',
                  borderTop: '1px solid var(--line)',
                  fontSize: 13.5,
                }}
              >
                <div>
                  <div>{ex.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{ex.muscle}</div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--primary)',
                    fontSize: 12,
                  }}
                >
                  {formatExercisePrescription(ex)}
                </span>
              </div>
            ))}
          </details>
        );
      })}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="button" onClick={onEdit} style={{ ...actionBtnStyle, background: 'var(--primary-grad)', color: 'var(--on-primary)', border: 'none' }}>
          Bearbeiten
        </button>
        <button type="button" onClick={onNewPlan} style={actionBtnStyle}>
          Neuer Plan
        </button>
      </div>
    </div>
  );
}
