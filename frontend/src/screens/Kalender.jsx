import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { addDays, formatWeekLabel, localDateKey, mondayStart, parseUtc, toSqlUtc } from '../lib/dates.js';
import { formatDuration } from 'shared/duration';
import { WEEKDAYS, WEEKDAY_LABELS, assignWeekdays, projectWeek, weekProgress } from '../lib/schedule.js';
import { applyWeekOrder } from '../lib/weekOrder.js';

import Button from '../components/ui/Button.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import Icon from '../components/ui/Icon.jsx';
import '../styles/kal.css';

const pagerBtnStyle = {
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: '50%',
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

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
      <header style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Kalender</h1>
          {progress.total > 0 && (
            <div
              className="neu-inset"
              style={{
                borderRadius: 999,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                color: progress.done === progress.total ? 'var(--success)' : 'var(--text)',
                whiteSpace: 'nowrap',
              }}
            >
              {progress.done}/{progress.total}
              {isCurrentWeek ? ' diese Woche' : ''}
            </div>
          )}
        </div>
        {/* Gegenstück zum Hinweis im Plan: hier steht die angepasste Woche. */}
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' }}>
          Diese Woche nach Plan und tatsächlichem Verlauf — verpasste Tage rutschen nach hinten. Die
          übliche Wochenaufteilung steht im Plan.
        </p>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 16px' }}>
        <button
          onClick={() => setWeeksAgo((w) => w + 1)}
          aria-label="Vorherige Woche"
          className="btn btn-secondary"
          style={pagerBtnStyle}
        >
          <Icon name="chevronRight" size={20} style={{ transform: 'scaleX(-1)' }} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{formatWeekLabel(weekStart)}</div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeeksAgo(0)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '0 8px',
                minHeight: 44,
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
          className="btn btn-secondary"
          style={{ ...pagerBtnStyle, opacity: isCurrentWeek ? 0.35 : 1, cursor: isCurrentWeek ? 'not-allowed' : 'pointer' }}
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      <ul className="kal-tray" aria-label="Woche">
        {WEEKDAYS.map((wd, i) => {
          const date = addDays(weekStart, i);
          const dateKey = localDateKey(date);
          const due = isCurrentWeek ? projectedByIdx.get(i) : dueByWeekday.get(wd);
          const doneSessions = byDate.get(dateKey) ?? [];
          const isToday = isCurrentWeek && dateKey === todayKey;
          const isNext = isCurrentWeek && due && due.key === projection?.nextKey;
          return (
            <li
              key={wd}
              className={isToday ? 'kal-today' : undefined}
              aria-current={isToday ? 'date' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 60,
                padding: '8px 4px',
                ...(isToday && {
                  margin: '4px -6px',
                  padding: '8px 10px',
                  borderRadius: 16,
                  boxShadow: 'var(--shadow-inset-sm)',
                }),
              }}
            >
              <div style={{ width: 44, flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: isToday ? 'var(--primary)' : 'var(--text)' }}>
                  {WEEKDAY_LABELS[wd]}
                </div>
                <div style={{ fontSize: 13, color: isToday ? 'var(--primary)' : 'var(--muted)' }}>
                  {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {due ? (
                  <>
                    <div style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {due.name}
                    </div>
                    {isNext && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                        <span
                          aria-hidden="true"
                          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }}
                        />
                        Als Nächstes
                      </div>
                    )}
                  </>
                ) : doneSessions.length ? null : (
                  <div style={{ fontSize: 15, color: 'var(--muted)' }}>Pause</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {doneSessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => {
                      setDetail({ session_id: s.session_id, day_name: s.day_name, date });
                      setConfirmReset(false);
                    }}
                    className="btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 0',
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      maxWidth: 160,
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        minWidth: 0,
                        padding: '7px 12px 7px 9px',
                        borderRadius: 999,
                        background: 'var(--bg)',
                        boxShadow: 'var(--shadow-inset-sm)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      <Icon name="check" size={15} style={{ color: 'var(--success)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.day_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {unplacedDays.length > 0 && (
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '12px 0 0' }}>
          Passt nicht mehr diese Woche: {unplacedDays.map((d) => d.name).join(', ')}
        </p>
      )}

      {!plan && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--muted)', fontSize: 15, margin: '0 0 12px' }}>
            Kein aktiver Plan. Bitte zuerst einen Plan einrichten.
          </p>
          <Link
            to="/plan"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '12px 20px',
              borderRadius: 999,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            <span className="mesh" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            Plan einrichten
          </Link>
        </div>
      )}

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} ariaLabel={detail?.day_name}>
        {detail && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{detail.day_name}</h2>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
                  {detail.date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="Schließen"
                className="btn"
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  margin: '-8px -8px 0 0',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            {!summary && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Lädt…</p>}
            {summary?.summary?.exercises?.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Keine Sätze geloggt.</p>
            )}
            {summary?.summary?.exercises?.length > 0 && (
              <ul className="kal-tray" style={{ marginTop: 14 }}>
                {summary.summary.exercises.map((ex) => (
                  <li key={ex.exercise_id} style={{ padding: '10px 4px' }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
                    {ex.sets.map((s) => (
                      <div key={s.set_number} style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                        Satz {s.set_number}
                        {s.reps != null && ` · ${s.reps} Wdh.`}
                        {s.weight_kg != null && ` · ${s.weight_kg} kg`}
                        {s.band_count != null && ` · ${s.band_count}× Band${s.band_kg ? ` ${s.band_kg} kg` : ''}`}
                        {s.duration_s != null && ` · ${formatDuration(s.duration_s)}`}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {isCurrentWeek && !confirmReset && (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setConfirmReset(true)}
                style={{ marginTop: 18, color: 'var(--danger)' }}
              >
                Tag zurücksetzen
              </Button>
            )}
            {isCurrentWeek && confirmReset && (
              <div style={{ marginTop: 18 }}>
                <p style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--danger)', margin: '0 0 12px' }}>
                  Wirklich zurücksetzen? Der Tag gilt danach als offen. Die geloggten Werte bleiben gespeichert, werden
                  aber nicht mehr für die Vorbelegung verwendet.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="danger" onClick={resetDay} style={{ flex: 1 }}>
                    Ja, zurücksetzen
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmReset(false)} style={{ flex: 1 }}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
