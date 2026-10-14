import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRecordValue } from '../lib/records.js';
import { hasTonnage, recordList, tonnageByWeek, topMuscles } from '../lib/statsView.js';
import Card from './ui/Card.jsx';
import { deNum } from './ProgressSummary.jsx';
import { axisProps, chartWellStyle, tooltipProps } from './ExerciseChart.jsx';

// Tonnage geht schnell in die Tausende — Achse kompakt halten, sonst wird sie abgeschnitten.
const formatKg = (value) => (value >= 1000 ? `${deNum(Math.round(value / 100) / 10)}k` : String(value));

const headingStyle = { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };
const contextStyle = { margin: '4px 0 12px', fontSize: 14, color: 'var(--muted)' };
const mutedSmall = { fontSize: 13, color: 'var(--muted)' };

export default function StatsSection({ stats }) {
  if (!stats) return null;

  const weeks = tonnageByWeek(stats.sessions, 12);
  const muscles = topMuscles(stats.volume_by_muscle, 6);
  const records = recordList(stats.records, 8);
  const showTonnage = hasTonnage(weeks);

  if (!showTonnage && !muscles.length && !records.length) return null;

  return (
    <>
      {showTonnage && (
        <Card>
          <h3 style={headingStyle}>Tonnage</h3>
          <p style={contextStyle}>
            Bewegtes Gewicht pro Woche (Wiederholungen × kg), letzte 12 Wochen.
          </p>
          <div style={chartWellStyle}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeks} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={formatKg} />
                <Tooltip
                  {...tooltipProps}
                  cursor={{ fill: 'var(--line)' }}
                  formatter={(value) => [`${value.toLocaleString('de-DE')} kg`, 'Tonnage']}
                  labelFormatter={(label) => `Woche ab ${label}`}
                />
                <Bar dataKey="tonnage_kg" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {muscles.length > 0 && (
        <Card>
          <h3 style={headingStyle}>Volumen pro Muskelgruppe</h3>
          <p style={contextStyle}>Sätze der letzten {stats.muscle_window_days} Tage</p>
          <div>
            {muscles.map((entry) => (
              <div
                key={entry.muscle}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
              >
                <div style={{ width: 104, fontSize: 14 }}>{entry.muscle}</div>
                <div
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 5,
                    background: 'var(--bg)',
                    boxShadow: 'var(--shadow-raised)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(entry.share * 100)}%`,
                      height: '100%',
                      borderRadius: 5,
                      background: 'var(--primary)',
                    }}
                  />
                </div>
                <div style={{ ...mutedSmall, width: 56, textAlign: 'right' }}>
                  {entry.sets} {entry.sets === 1 ? 'Satz' : 'Sätze'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {records.length > 0 && (
        <Card>
          <h3 style={headingStyle}>Bestwerte</h3>
          <p style={{ ...contextStyle, marginBottom: 4 }}>Über alle Zeiten</p>
          <div className="px-rows">
            {records.map((record) => (
              <div
                key={record.exercise_id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>{record.name}</div>
                  <div style={mutedSmall}>
                    {record.muscle} · {record.sessions_count}×
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {deNum(formatRecordValue(record.kind, record.value))}
                  </div>
                  {record.e1rm != null && (
                    <div style={mutedSmall}>≈ {deNum(formatRecordValue('e1rm', record.e1rm))} 1RM</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
