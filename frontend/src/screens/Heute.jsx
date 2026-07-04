import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

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

  const [dayKey, setDayKey] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [pauseDuration, setPauseDuration] = useState(loadPauseDuration);
  const [timerSeconds, setTimerSeconds] = useState(null);

  useEffect(() => {
    if (!dayKey && plan?.days?.length) {
      setDayKey(plan.days[0].key);
    }
  }, [plan, dayKey]);

  useEffect(() => {
    if (!dayKey) return;
    let cancelled = false;

    async function start() {
      const [sessionRes, historyRes] = await Promise.all([
        api.post('/sessions', { day_key: dayKey }),
        api.get(`/history?day_key=${encodeURIComponent(dayKey)}`),
      ]);
      if (cancelled) return;

      setSessionId(sessionRes.session_id);
      const day = plan.days.find((d) => d.key === dayKey);
      const resumedByExercise = {};
      for (const log of sessionRes.set_logs) {
        resumedByExercise[log.exercise_id] = resumedByExercise[log.exercise_id] || [];
        resumedByExercise[log.exercise_id].push(log);
      }

      const initial = {};
      for (const ex of day.exercises) {
        initial[ex.id] = buildInitialSets(ex, historyRes.prefill[ex.id], resumedByExercise[ex.id]);
      }
      setSetsByExercise(initial);
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [dayKey, plan]);

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

    await api.post(`/sessions/${sessionId}/sets`, {
      exercise_id: exercise.id,
      set_number: row.set_number,
      reps: exercise.type === 'bw' || exercise.type === 'wt' ? Number(row.reps) || null : null,
      weight_kg: exercise.type === 'wt' ? Number(row.weight_kg) || null : null,
      duration_s: exercise.type === 'time' || exercise.type === 'cardio' ? Number(row.duration_s) || null : null,
    });

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

  return (
    <div className="wrap">
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px 0' }}>
        {plan.days.map((d) => (
          <button
            key={d.key}
            onClick={() => setDayKey(d.key)}
            style={{
              flex: '0 0 auto',
              background: d.key === dayKey ? 'var(--ember-dim)' : 'var(--surface)',
              border: `1px solid ${d.key === dayKey ? 'var(--ember)' : 'var(--line)'}`,
              color: d.key === dayKey ? 'var(--ember)' : 'var(--muted)',
              borderRadius: 11,
              padding: '9px 13px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {day && (
        <>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{day.focus}</div>
          <h2>{day.name}</h2>

          {day.exercises.map((ex) => (
            <div
              key={ex.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3>{ex.name}</h3>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                    {ex.muscle}
                  </div>
                </div>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video_query)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--ember)', fontSize: 12 }}
                >
                  Video
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 13 }}>
                {(setsByExercise[ex.id] || []).map((row, i) => (
                  <div key={row.set_number} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => toggleSet(ex, i)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        border: '1px solid var(--line)',
                        background: row.logged ? 'var(--sage-dim)' : 'var(--surface2)',
                        color: row.logged ? 'var(--sage)' : 'var(--muted)',
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
          ))}

          <button
            onClick={finishWorkout}
            className="btn primary"
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 13,
              padding: 15,
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              background: 'var(--ember)',
              color: '#160a04',
              margin: '6px 0 20px',
            }}
          >
            Workout abschließen
          </button>
        </>
      )}

      {timerSeconds !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(8,9,11,.82)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 22,
              padding: 30,
              width: 'min(86vw,330px)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Pause</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 64, color: 'var(--ember)' }}>
              {Math.max(0, timerSeconds)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '18px 0' }}>
              {[60, 90, 120].map((d) => (
                <button
                  key={d}
                  onClick={() => changePauseDuration(d)}
                  style={{
                    background: d === pauseDuration ? 'var(--ember-dim)' : 'var(--surface2)',
                    border: '1px solid var(--line)',
                    color: d === pauseDuration ? 'var(--ember)' : 'var(--text)',
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
                background: 'var(--ember)',
                color: '#160a04',
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
  width: 70,
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '7px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
  textAlign: 'center',
};
