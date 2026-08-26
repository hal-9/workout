import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { addDays, formatWeekLabel, localDateKey, mondayStart, parseUtc, toSqlUtc } from '../lib/dates.js';
import { formatDuration } from 'shared/duration';
import { WEEKDAYS, WEEKDAY_LABELS, assignWeekdays, projectWeek, weekProgress } from '../lib/schedule.js';
import { applyWeekOrder } from '../lib/weekOrder.js';

const pagerBtnStyle = {
  width: 44,
  height: 44,
  borderRadius: 11,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 18,
  cursor: 'pointer',
};

export default function Kalender() {
  const queryClient = useQueryClient();
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [detail, setDetail] = useState(null); // { session_id, day_name, date } | null
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: plan } = useQuery({ queryKey: ['plan'], queryFn: () => api.get('/plan'), retry: false });

  const weekStart = mondayStart(weeksAgo);
  const weekEnd = addDays(weekStart, 7);
  const { data: range } = useQuery({
    queryKey: ['sessions-range', localDateKey(weekStart)],
    queryFn: () =>
      api.get(
        `/sessions?from=${encodeURIComponent(toSqlUtc(weekStart))}&to=${encodeURIComponent(toSqlUtc(weekEnd))}`
      ),
  });

  const { data: summary } = useQuery({
    queryKey: ['session-summary', detail?.session_id],
    queryFn: () => api.get(`/sessions/${detail.session_id}/summary`),
    enabled: Boolean(detail),
  });

  // Erledigte Sessions nach lokalem Datum gruppieren
  const byDate = new Map();
  const doneDates = new Map();
  for (const s of range?.sessions ?? []) {
    const finished = parseUtc(s.finished_at);
    const key = localDateKey(finished);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(s);
    if (!doneDates.has(s.day_key)) doneDates.set(s.day_key, finished);
  }

  // Aktuelle Woche zeigt die Projektion (Sequenz rutscht nach), vergangene Wochen den Ziel-Rhythmus.
  const dueByWeekday = assignWeekdays(plan);
  const isCurrentWeek = weeksAgo === 0;
  const todayKey = localDateKey(new Date());
  // Workout-Tausch aus „Heute" (weekOrder) fließt in die Projektion der aktuellen Woche ein.
  const projection = isCurrentWeek && plan ? projectWeek(applyWeekOrder(plan), doneDates) : null;
  const projectedByIdx = new Map((projection?.days ?? []).filter((e) => e.projectedIdx != null).map((e) => [e.projectedIdx, e]));
  const unplacedDays = (projection?.days ?? []).filter((e) => e.unplaced);
  const progress = plan ? weekProgress(plan, doneDates) : { done: 0, total: 0 };

  async function resetDay() {
    try {
      await api.post(`/sessions/${detail.session_id}/discard`);
    } catch {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['sessions-range'] });
    queryClient.invalidateQueries({ queryKey: ['sessions-recent'] });
    queryClient.invalidateQueries({ queryKey: ['history'] });
    setDetail(null);
    setConfirmReset(false);
  }

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, gap: 12 }}>
        <h2 style={{ margin: 0 }}>Kalender</h2>
        {progress.total > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: progress.done === progress.total ? 'var(--success)' : 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {progress.done}/{progress.total}
            {isCurrentWeek ? ' diese Woche' : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0' }}>
        <button onClick={() => setWeeksAgo((w) => w + 1)} aria-label="Vorherige Woche" style={pagerBtnStyle}>
          ‹
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{formatWeekLabel(weekStart)}</div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeeksAgo(0)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              Zur aktuellen Woche
            </button>
          )}
        </div>
        <button
          onClick={() => setWeeksAgo((w) => Math.max(0, w - 1))}
          disabled={isCurrentWeek}
          aria-label="Nächste Woche"
          style={{ ...pagerBtnStyle, opacity: isCurrentWeek ? 0.35 : 1, cursor: isCurrentWeek ? 'not-allowed' : 'pointer' }}
        >
          ›
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {WEEKDAYS.map((wd, i) => {
          const date = addDays(weekStart, i);
          const dateKey = localDateKey(date);
          const due = isCurrentWeek ? projectedByIdx.get(i) : dueByWeekday.get(wd);
          const doneSessions = byDate.get(dateKey) ?? [];
          const isToday = isCurrentWeek && dateKey === todayKey;
          const isNext = isCurrentWeek && due && due.key === projection?.nextKey;
          return (
            <div
              key={wd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: isToday ? 'var(--primary-dim)' : 'var(--surface)',
                border: `1px solid ${isToday ? 'var(--primary)' : 'var(--line)'}`,
                borderRadius: 14,
                padding: '10px 14px',
                minHeight: 56,
              }}
            >
              <div style={{ width: 44, flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: isToday ? 'var(--primary)' : 'var(--text)' }}>
                  {WEEKDAY_LABELS[wd]}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {due ? (
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {due.name}
                    {isNext && (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: '2px 6px',
                          borderRadius: 999,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          background: 'var(--primary-dim)',
                          color: 'var(--primary)',
                        }}
                      >
                        Als Nächstes
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Pause</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                {doneSessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => {
                      setDetail({ session_id: s.session_id, day_name: s.day_name, date });
                      setConfirmReset(false);
                    }}
                    style={{
                      background: 'var(--success-dim)',
                      border: '1px solid var(--success)',
                      color: 'var(--success)',
                      borderRadius: 999,
                      padding: '5px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      maxWidth: 150,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    ✓ {s.day_name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {unplacedDays.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Passt nicht mehr diese Woche: {unplacedDays.map((d) => d.name).join(', ')}
        </div>
      )}

      {!plan && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--muted)', margin: '0 0 12px' }}>Kein aktiver Plan. Bitte zuerst einen Plan einrichten.</p>
          <Link
            to="/plan"
            className="btn primary"
            style={{
              display: 'inline-block',
              padding: '12px 18px',
              borderRadius: 13,
              textDecoration: 'none',
              background: 'var(--primary-grad)',
              color: 'var(--on-primary)',
              fontWeight: 600,
            }}
          >
            Plan einrichten
          </Link>
        </div>
      )}

      {detail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(46,36,64,.3)',
            WebkitBackdropFilter: 'blur(6px)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setDetail(null)}
        >
          <div
            className="glass"
            style={{ borderRadius: 22, padding: 22, width: 'min(92vw, 400px)', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{detail.day_name}</h3>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                  {detail.date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="Schließen"
                style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {!summary && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Lädt…</p>}
            {summary?.summary?.exercises?.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Keine Sätze geloggt.</p>
            )}
            {summary?.summary?.exercises?.map((ex) => (
              <div key={ex.exercise_id} style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                {ex.sets.map((s) => (
                  <div
                    key={s.set_number}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}
                  >
                    Satz {s.set_number}
                    {s.reps != null && ` · ${s.reps} Wdh.`}
                    {s.weight_kg != null && ` · ${s.weight_kg} kg`}
                    {s.duration_s != null && ` · ${formatDuration(s.duration_s)}`}
                  </div>
                ))}
              </div>
            ))}

            {isCurrentWeek && !confirmReset && (
              <button
                onClick={() => setConfirmReset(true)}
                style={{
                  marginTop: 18,
                  width: '100%',
                  background: 'none',
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  borderRadius: 11,
                  padding: '11px 13px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Tag zurücksetzen
              </button>
            )}
            {isCurrentWeek && confirmReset && (
              <div style={{ marginTop: 18 }}>
                <p style={{ fontSize: 13, color: 'var(--danger)', margin: '0 0 8px' }}>
                  Wirklich zurücksetzen? Der Tag gilt danach als offen. Die geloggten Werte bleiben gespeichert, werden
                  aber nicht mehr für die Vorbelegung verwendet.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={resetDay}
                    style={{
                      flex: 1,
                      background: 'var(--danger)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 11,
                      padding: '11px 13px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Ja, zurücksetzen
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    style={{
                      flex: 1,
                      background: 'var(--surface2)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      borderRadius: 11,
                      padding: '11px 13px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
