import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRecordValue } from '../lib/records.js';
import { hasTonnage, recordList, tonnageByWeek, topMuscles } from '../lib/statsView.js';

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
};

// Tonnage geht schnell in die Tausende — Achse kompakt halten, sonst wird sie abgeschnitten.
const formatKg = (value) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value));

const monoMuted = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--muted)',
};

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
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Tonnage</h3>
            <span style={monoMuted}>12 Wochen · kg</span>
          </div>
          <p style={{ ...monoMuted, margin: '4px 0 10px' }}>
            Bewegtes Gewicht pro Woche (Wiederholungen × kg).
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeks} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={10} interval="preserveStartEnd" />
              <YAxis stroke="var(--muted)" fontSize={10} width={44} tickFormatter={formatKg} />
              <Tooltip
                formatter={(value) => [`${value} kg`, 'Tonnage']}
                labelFormatter={(label) => `Woche ab ${label}`}
              />
              <Bar dataKey="tonnage_kg" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {muscles.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Volumen pro Muskelgruppe</h3>
            <span style={monoMuted}>{stats.muscle_window_days} Tage</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {muscles.map((entry) => (
              <div
                key={entry.muscle}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
              >
                <div style={{ width: 96, fontSize: 12, color: 'var(--muted)' }}>{entry.muscle}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--line)' }}>
                  <div
                    style={{
                      width: `${Math.round(entry.share * 100)}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: 'var(--primary)',
                    }}
                  />
                </div>
                <div style={{ ...monoMuted, width: 52, textAlign: 'right' }}>
                  {entry.sets} {entry.sets === 1 ? 'Satz' : 'Sätze'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Bestwerte</h3>
            <span style={monoMuted}>Alle Zeiten</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {records.map((record) => (
              <div
                key={record.exercise_id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '7px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{record.name}</div>
                  <div style={monoMuted}>
                    {record.muscle} · {record.sessions_count}×
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 14,
                      color: 'var(--primary)',
                    }}
                  >
                    {formatRecordValue(record.kind, record.value)}
                  </div>
                  {record.e1rm != null && (
                    <div style={monoMuted}>≈ {formatRecordValue('e1rm', record.e1rm)} 1RM</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
