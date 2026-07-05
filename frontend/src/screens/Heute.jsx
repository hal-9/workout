import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { enqueueSet } from '../offlineQueue.js';
import { parseUtc, mondayStart } from '../lib/dates.js';
import { nextDueDayKey } from '../lib/schedule.js';

function loadPauseDuration() {
  const stored = localStorage.getItem('pauseDuration');
  return stored ? Number(stored) : 90;
}

function buildInitialSets(exercise, prefillSets, resumedSets) {
  const source = resumedSets?.length ? resumedSets : prefillSets;
  const rows = [];
  const count = Math.max(exercise.sets, source?.length || 0);
  for (let i = 1; i <= count; i++) {
    const fromSource = source?.find((s) => s.set_number === i);
    const isResumed = resumedSets?.some((s) => s.set_number === i);
    rows.push({
      set_number: i,
      reps: fromSource?.reps ?? '',
      weight_kg: fromSource?.weight_kg ?? exercise.default_weight_kg ?? '',
      duration_s: fromSource?.duration_s ?? '',
      logged: Boolean(isResumed),
    });
  }
  return rows;
}

export default function Heute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({ queryKey: ['plan'], queryFn: () => api.get('/plan'), retry: false });
  const { data: recent } = useQuery({
    queryKey: ['sessions-recent'],
    queryFn: () => api.get('/sessions/recent'),
  });

  const [dayKey, setDayKey] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const sessionPromiseRef = useRef(null);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [pauseDuration, setPauseDuration] = useState(loadPauseDuration);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  const [timerSeconds, setTimerSeconds] = useState(null);

  // Wochen-Status: jüngste finished Session je day_key innerhalb der lokalen Kalenderwoche (Mo–So)
  const weekStart = mondayStart();
  const doneThisWeek = new Map();
  for (const s of recent?.sessions ?? []) {
    const finished = parseUtc(s.finished_at);
    if (finished >= weekStart && !doneThisWeek.has(s.day_key)) {
      doneThisWeek.set(s.day_key, finished);
    }
  }
  const nextDayKey = nextDueDayKey(plan, doneThisWeek);

  function freshActiveSession() {
    const active = queryClient.getQueryData(['sessions-recent'])?.active;
    if (!active) return null;
    if (Date.now() - parseUtc(active.started_at).getTime() > 24 * 3600 * 1000) return null;
    return active;
  }

  // Vorauswahl: offene Session (<24h) gewinnt, sonst nächster offener Tag der Woche
  useEffect(() => {
    if (dayKey || !plan?.days?.length || !recent) return;
    const active = freshActiveSession();
    if (active && plan.days.some((d) => d.key === active.day_key)) {
      setDayKey(active.day_key);
    } else {
      setDayKey(nextDayKey);
    }
  }, [plan, recent, dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dayKey || !plan) return;
    let cancelled = false;

    async function load() {
      const historyRes = await api.get(`/history?day_key=${encodeURIComponent(dayKey)}`);
      if (cancelled) return;

      const active = freshActiveSession();
      const resumed = active?.day_key === dayKey ? active : null;
      setSessionId(resumed ? resumed.session_id : null);
      sessionPromiseRef.current = null;

      const resumedByExercise = {};
      for (const log of resumed?.set_logs ?? []) {
        resumedByExercise[log.exercise_id] = resumedByExercise[log.exercise_id] || [];
        resumedByExercise[log.exercise_id].push(log);
      }

      const day = plan.days.find((d) => d.key === dayKey);
      const initial = {};
      for (const ex of day.exercises) {
        initial[ex.id] = buildInitialSets(ex, historyRes.prefill[ex.id], resumedByExercise[ex.id]);
      }
      setSetsByExercise(initial);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dayKey, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy: Session entsteht erst beim ersten Satz-Haken bzw. explizit über „Nochmal starten"
  function ensureSession() {
    if (sessionId) return Promise.resolve(sessionId);
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = api
        .post('/sessions', { day_key: dayKey })
        .then((res) => {
          setSessionId(res.session_id);
          return res.session_id;
        })
        .catch((err) => {
          sessionPromiseRef.current = null;
          throw err;
        });
    }
    return sessionPromiseRef.current;
  }

  useEffect(() => {
    if (timerSeconds === null) return;
    if (timerSeconds <= 0) return;
    const id = setTimeout(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerSeconds]);

  function changePauseDuration(value) {
    setPauseDuration(value);
    localStorage.setItem('pauseDuration', String(value));
  }

  function updateSetField(exerciseId, index, field, value) {
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }

  async function toggleSet(exercise, index) {
    const row = setsByExercise[exercise.id][index];
    const nextLogged = !row.logged;

    const payload = {
      exercise_id: exercise.id,
      set_number: row.set_number,
      reps: exercise.type === 'bw' || exercise.type === 'wt' ? Number(row.reps) || null : null,
      weight_kg: exercise.type === 'wt' ? Number(row.weight_kg) || null : null,
      duration_s: exercise.type === 'time' || exercise.type === 'cardio' ? Number(row.duration_s) || null : null,
    };

    let sid;
    try {
      sid = await ensureSession();
    } catch {
      return; // Session-Start fehlgeschlagen — Haken bleibt unverändert
    }

    try {
      await api.post(`/sessions/${sid}/sets`, payload);
    } catch (err) {
      if (err.status) throw err;
      await enqueueSet(sid, payload);
    }

    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, i) => (i === index ? { ...s, logged: nextLogged } : s)),
    }));

    if (nextLogged) {
      setTimerSeconds(pauseDuration);
    }
  }

  function addExtraSet(exercise) {
    setSetsByExercise((prev) => {
      const rows = prev[exercise.id];
      const nextNumber = rows.length + 1;
      return {
        ...prev,
        [exercise.id]: [
          ...rows,
          {
            set_number: nextNumber,
            reps: '',
            weight_kg: exercise.default_weight_kg ?? '',
            duration_s: '',
            logged: false,
          },
        ],
      };
    });
  }

  async function finishWorkout() {
    const res = await api.post(`/sessions/${sessionId}/finish`);
    queryClient.invalidateQueries({ queryKey: ['history'] });
    queryClient.invalidateQueries({ queryKey: ['sessions-recent'] });
    queryClient.invalidateQueries({ queryKey: ['sessions-range'] });
    navigate(`/session/${res.session_id}/auswertung`, {
      state: { summary: res.summary, evaluation: res.evaluation },
    });
  }

  if (!plan) {
    return (
      <div className="wrap">
        <h2>Heute</h2>
        <p style={{ color: 'var(--muted)' }}>Kein aktiver Plan. Bitte zuerst einen Plan importieren.</p>
      </div>
    );
  }

  const day = plan.days.find((d) => d.key === dayKey);
  const dayDoneAt = dayKey ? doneThisWeek.get(dayKey) : null;
  const showRestartGate = Boolean(dayDoneAt) && !sessionId;

  return (
    <div className="wrap">
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px 0' }}>
        {plan.days.map((d) => {
          const doneAt = doneThisWeek.get(d.key);
          const isNext = !doneAt && d.key === nextDayKey;
          const selected = d.key === dayKey;
          return (
            <button
              key={d.key}
              onClick={() => setDayKey(d.key)}
              disabled={!isOnline && !selected}
              style={{
                flex: '0 0 auto',
                textAlign: 'left',
                background: selected ? 'var(--primary-dim)' : doneAt ? 'var(--success-dim)' : 'var(--surface)',
                border: `1px solid ${selected ? 'var(--primary)' : doneAt ? 'var(--success)' : 'var(--line)'}`,
                color: selected ? 'var(--primary)' : doneAt ? 'var(--success)' : 'var(--muted)',
                borderRadius: 11,
                padding: '9px 13px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: !isOnline && !selected ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: !isOnline && !selected ? 0.5 : 1,
              }}
            >
              <span>
                {doneAt ? '✓ ' : ''}
                {d.name}
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
              </span>
              {doneAt && (
                <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>
                  Erledigt ({doneAt.toLocaleDateString('de-DE', { weekday: 'short' })})
                </div>
              )}
            </button>
          );
        })}
      </div>

      {showRestartGate && (
        <div
          style={{
            background: 'var(--success-dim)',
            border: '1px solid var(--success)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ color: 'var(--success)', fontSize: 13 }}>
            ✓ Diese Woche erledigt ({dayDoneAt.toLocaleDateString('de-DE', { weekday: 'short' })}).
          </div>
          <button
            onClick={() => ensureSession().catch(() => {})}
            disabled={!isOnline}
            style={{
              flex: '0 0 auto',
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              borderRadius: 9,
              padding: '7px 11px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: isOnline ? 'pointer' : 'not-allowed',
            }}
          >
            Nochmal starten
          </button>
        </div>
      )}

      {day && (
        <>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{day.focus}</div>
          <h2>{day.name}</h2>

          {day.exercises.map((ex) => {
            const rows = setsByExercise[ex.id] || [];
            const allLogged = rows.length > 0 && rows.every((r) => r.logged);
            return (
            <div
              key={ex.id}
              style={{
                background: allLogged ? 'var(--success-dim)' : 'var(--surface)',
                border: `1px solid ${allLogged ? 'var(--success)' : 'var(--line)'}`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3>
                    {allLogged && <span style={{ color: 'var(--success)' }}>✓ </span>}
                    {ex.name}
                  </h3>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                    {ex.muscle}
                  </div>
                </div>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video_query)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontSize: 12 }}
                >
                  Technik
                </a>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--muted)',
                  margin: '10px 0 0',
                  paddingLeft: 11,
                  borderLeft: '2px solid var(--line)',
                }}
              >
                {ex.cue}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 13,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>Satz</div>
                {(ex.type === 'bw' || ex.type === 'wt') && (
                  <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>Wdh.</div>
                )}
                {ex.type === 'wt' && <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>kg</div>}
                {(ex.type === 'time' || ex.type === 'cardio') && (
                  <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>Sek.</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {rows.map((row, i) => (
                  <div key={row.set_number} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => toggleSet(ex, i)}
                      disabled={showRestartGate || (!isOnline && !sessionId)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 9,
                        border: '1px solid var(--line)',
                        background: row.logged ? 'var(--success-dim)' : 'var(--surface2)',
                        color: row.logged ? 'var(--success)' : 'var(--muted)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {row.logged ? '✓' : row.set_number}
                    </button>

                    {(ex.type === 'bw' || ex.type === 'wt') && (
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={ex.target_reps}
                        value={row.reps}
                        onChange={(e) => updateSetField(ex.id, i, 'reps', e.target.value)}
                        style={inputStyle}
                      />
                    )}
                    {ex.type === 'wt' && (
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="kg"
                        value={row.weight_kg}
                        onChange={(e) => updateSetField(ex.id, i, 'weight_kg', e.target.value)}
                        style={inputStyle}
                      />
                    )}
                    {(ex.type === 'time' || ex.type === 'cardio') && (
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={String(ex.target_seconds ?? '')}
                        value={row.duration_s}
                        onChange={(e) => updateSetField(ex.id, i, 'duration_s', e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => addExtraSet(ex)}
                style={{
                  marginTop: 10,
                  background: 'var(--surface2)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  borderRadius: 9,
                  padding: '7px 11px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                + Satz
              </button>
            </div>
            );
          })}

          <button
            onClick={finishWorkout}
            disabled={!isOnline || !sessionId}
            className="btn primary"
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 13,
              padding: 15,
              fontWeight: 600,
              fontSize: 15,
              cursor: isOnline && sessionId ? 'pointer' : 'not-allowed',
              background: isOnline && sessionId ? 'var(--primary-grad)' : 'var(--surface2)',
              color: isOnline && sessionId ? 'var(--on-primary)' : 'var(--muted)',
              margin: '6px 0 4px',
            }}
          >
            Workout abschließen
          </button>
          {!isOnline && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, margin: '0 0 20px' }}>
              Offline — {sessionId ? 'Abschließen erfordert Verbindung.' : 'Session-Start erfordert Verbindung.'}
            </p>
          )}
        </>
      )}

      {timerSeconds !== null && (
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
          }}
        >
          <div
            className="glass"
            style={{
              borderRadius: 22,
              padding: 30,
              width: 'min(86vw,330px)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Pause</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 64, color: 'var(--primary)' }}>
              {Math.max(0, timerSeconds)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '18px 0' }}>
              {[60, 90, 120].map((d) => (
                <button
                  key={d}
                  onClick={() => changePauseDuration(d)}
                  style={{
                    background: d === pauseDuration ? 'var(--primary-dim)' : 'var(--surface2)',
                    border: '1px solid var(--line)',
                    color: d === pauseDuration ? 'var(--primary)' : 'var(--text)',
                    borderRadius: 10,
                    padding: '9px 13px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
            <button
              onClick={() => setTimerSeconds(null)}
              className="btn primary"
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 13,
                padding: 15,
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                background: 'var(--primary-grad)',
                color: 'var(--on-primary)',
              }}
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: 72,
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '7px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  textAlign: 'center',
};
