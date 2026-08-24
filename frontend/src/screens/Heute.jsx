import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { cancelQueuedSet, enqueueDelete, enqueueSet } from '../offlineQueue.js';
import { parseUtc, mondayStart } from '../lib/dates.js';
import { compareExercise } from '../lib/exerciseCompare.js';
import { isCooldownExercise, splitPhases } from '../lib/cooldown.js';
import { bestsByExerciseId, formatRecordValue, livePreviewRecord } from '../lib/records.js';
import { summarizeSession } from '../lib/completion.js';
import { deloadMessage } from '../lib/progressionView.js';
import WorkoutCompleteOverlay from '../components/WorkoutCompleteOverlay.jsx';
import ExerciseDetailSheet from '../components/ExerciseDetailSheet.jsx';
import MuscleModal from '../components/MuscleModal.jsx';
import { durationUnitLabel, formatDuration, fromInputValue, toInputValue } from 'shared/duration';
import {
  WEEKDAY_LABELS,
  getMissedDays,
  missedDayKeys,
  nextDueDayKey,
  weekProgress,
} from '../lib/schedule.js';
import { getAllOverrides, getOverride } from '../lib/weightOverrides.js';
import {
  isSoundEnabled,
  playRestEnd,
  playTick,
  setSoundEnabled,
  unlockAudio,
} from '../lib/workoutSounds.js';

function loadPauseDuration() {
  const stored = localStorage.getItem('pauseDuration');
  return stored ? Number(stored) : 90;
}

function buildInitialSets(exercise, prefillSets, resumedSets) {
  const source = resumedSets?.length ? resumedSets : prefillSets;
  const defaultWeight = getOverride(exercise.id) ?? exercise.default_weight_kg ?? '';
  const rows = [];
  const count = Math.max(exercise.sets, source?.length || 0);
  for (let i = 1; i <= count; i++) {
    const fromSource = source?.find((s) => s.set_number === i);
    const isResumed = resumedSets?.some((s) => s.set_number === i);
    rows.push({
      set_number: i,
      reps: fromSource?.reps ?? '',
      weight_kg: fromSource?.weight_kg ?? defaultWeight,
      duration: toInputValue(
        // Cooldown-Stretches werden mit einem Tap abgehakt, deshalb steht die Zieldauer schon drin.
        fromSource?.duration_s ?? (isCooldownExercise(exercise) ? exercise.target_seconds : null),
        exercise.type
      ),
      logged: Boolean(isResumed),
    });
  }
  return rows;
}

function formatElapsed(ms) {
  const mins = Math.floor(ms / 60000);
  return `${mins} min`;
}

const RPE_VALUES = [6, 7, 8, 9, 10];

const TREND_LABELS = {
  up: { text: '↑ besser', color: 'var(--success)' },
  same: { text: '→ gleich', color: 'var(--muted)' },
  down: { text: '↓ weniger', color: 'var(--accent)' },
};

export default function Heute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({ queryKey: ['plan'], queryFn: () => api.get('/plan'), retry: false });
  const { data: recent } = useQuery({
    queryKey: ['sessions-recent'],
    queryFn: () => api.get('/sessions/recent'),
  });
  // Bestwerte vor dieser Session — für die Rekord-Vorschau in der Übungskarte.
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats'), retry: false });
  const { data: progression } = useQuery({
    queryKey: ['progression-proposals'],
    queryFn: () => api.get('/progression/proposals'),
    retry: false,
  });

  const [dayKey, setDayKey] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const sessionPromiseRef = useRef(null);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [historyRes, setHistoryRes] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [elapsedNow, setElapsedNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const setRowRefs = useRef(new Map());
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
  const [completion, setCompletion] = useState(null);
  const [detailExercise, setDetailExercise] = useState(null);
  const [muscleExercise, setMuscleExercise] = useState(null);
  const [rpeByExercise, setRpeByExercise] = useState({});
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const noteSaveRef = useRef(null);

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
  const missedDays = getMissedDays(plan, doneThisWeek);
  const missedKeys = missedDayKeys(plan, doneThisWeek);
  const progress = weekProgress(plan, doneThisWeek);

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
      setHistoryRes(historyRes);

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
      setRpeByExercise(
        Object.fromEntries((resumed?.rpe ?? []).map((entry) => [entry.exercise_id, entry.rpe]))
      );
      setNote(resumed?.note ?? '');
      setNoteOpen(Boolean(resumed?.note));
      if (resumed?.started_at) {
        setSessionStartedAt(parseUtc(resumed.started_at).getTime());
      } else {
        setSessionStartedAt(null);
      }
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
          setSessionStartedAt(Date.now());
          return res.session_id;
        })
        .catch((err) => {
          sessionPromiseRef.current = null;
          throw err;
        });
    }
    return sessionPromiseRef.current;
  }

  const scrollToNextSet = useCallback(() => {
    if (!plan || !dayKey) return;
    const dayPlan = plan.days.find((d) => d.key === dayKey);
    if (!dayPlan) return;
    for (const ex of splitPhases(dayPlan.exercises).main) {
      const rows = setsByExercise[ex.id] ?? [];
      const nextIndex = rows.findIndex((r) => !r.logged);
      if (nextIndex >= 0) {
        const key = `${ex.id}-${nextIndex}`;
        const el = setRowRefs.current.get(key);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  }, [plan, dayKey, setsByExercise]);

  useEffect(() => {
    if (!sessionStartedAt) return;
    const id = setInterval(() => setElapsedNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, [sessionStartedAt]);

  useEffect(() => {
    if (timerSeconds === null) return;

    if (timerSeconds === 0) {
      playRestEnd();
      setTimerSeconds(null);
      scrollToNextSet();
      return;
    }

    if (timerSeconds <= 5) {
      playTick();
    }

    const id = setTimeout(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerSeconds, scrollToNextSet]);

  function handleToggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) unlockAudio();
  }

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

    const setKey = {
      exercise_id: exercise.id,
      set_number: row.set_number,
    };

    let sid;
    try {
      sid = await ensureSession();
    } catch {
      return; // Session-Start fehlgeschlagen — Haken bleibt unverändert
    }

    if (nextLogged) {
      const payload = {
        ...setKey,
        reps: exercise.type === 'bw' || exercise.type === 'wt' ? Number(row.reps) || null : null,
        weight_kg: exercise.type === 'wt' ? Number(row.weight_kg) || null : null,
        duration_s:
          exercise.type === 'time' || exercise.type === 'cardio'
            ? fromInputValue(row.duration, exercise.type)
            : null,
      };

      try {
        await api.post(`/sessions/${sid}/sets`, payload);
      } catch (err) {
        if (err.status) throw err;
        await cancelQueuedSet(sid, setKey);
        await enqueueSet(sid, payload);
      }
    } else {
      try {
        await api.delete(`/sessions/${sid}/sets`, setKey);
      } catch (err) {
        if (err.status) throw err;
        await cancelQueuedSet(sid, setKey);
        await enqueueDelete(sid, setKey);
      }
    }

    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, i) => (i === index ? { ...s, logged: nextLogged } : s)),
    }));

    if (nextLogged) {
      unlockAudio();
      if (!sessionStartedAt) setSessionStartedAt(Date.now());
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
            duration: '',
            logged: false,
          },
        ],
      };
    });
  }

  // Notiz verzögert speichern, damit ein Reload mitten im Training sie behält.
  function updateNote(value) {
    setNote(value);
    clearTimeout(noteSaveRef.current);
    if (!sessionId) return;
    noteSaveRef.current = setTimeout(() => {
      api.post(`/sessions/${sessionId}/note`, { note: value.trim() || null }).catch(() => {});
    }, 800);
  }

  // RPE ist optionale Zusatzinfo — bei Fehlern wird die Auswahl zurückgerollt.
  async function toggleRpe(exercise, value) {
    const current = rpeByExercise[exercise.id] ?? null;
    const next = current === value ? null : value;

    let sid;
    try {
      sid = await ensureSession();
    } catch {
      return;
    }

    setRpeByExercise((prev) => ({ ...prev, [exercise.id]: next }));
    try {
      await api.post(`/sessions/${sid}/rpe`, { exercise_id: exercise.id, rpe: next });
    } catch {
      setRpeByExercise((prev) => ({ ...prev, [exercise.id]: current }));
    }
  }

  async function finishWorkout() {
    const res = await api.post(`/sessions/${sessionId}/finish`, { note: note.trim() || null });
    queryClient.invalidateQueries({ queryKey: ['history'] });
    queryClient.invalidateQueries({ queryKey: ['sessions-recent'] });
    queryClient.invalidateQueries({ queryKey: ['sessions-range'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });

    // Pausen-Timer ausblenden, damit nur der Abschluss-Screen zu sehen ist.
    clearTimeout(noteSaveRef.current);
    setTimerSeconds(null);
    const dayPlan = plan?.days?.find((d) => d.key === dayKey);
    setCompletion({
      session_id: res.session_id,
      summary: res.summary,
      evaluation: res.evaluation,
      records: res.new_records ?? [],
      stats: summarizeSession(dayPlan, res.summary, sessionStartedAt ? Date.now() - sessionStartedAt : null),
    });
  }

  // Identität muss stabil bleiben, sonst startet der Auto-Weiter-Timer im Overlay neu.
  const leaveCompletion = useCallback(() => {
    if (!completion) return;
    setCompletion(null);
    navigate(`/session/${completion.session_id}/auswertung`, {
      state: { summary: completion.summary, evaluation: completion.evaluation },
    });
  }, [completion, navigate]);

  if (!plan) {
    return (
      <div className="wrap">
        <h2>Heute</h2>
        <p style={{ color: 'var(--muted)' }}>Kein aktiver Plan. Bitte zuerst einen Plan einrichten.</p>
        <Link
          to="/plan"
          className="btn primary"
          style={{
            display: 'inline-block',
            marginTop: 12,
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
    );
  }

  const day = plan.days.find((d) => d.key === dayKey);
  const dayDoneAt = dayKey ? doneThisWeek.get(dayKey) : null;
  const showRestartGate = Boolean(dayDoneAt) && !sessionId;
  const weightOverrides = getAllOverrides();

  const { main: mainExercises, cooldown: cooldownExercises } = splitPhases(day?.exercises ?? []);
  const bests = bestsByExerciseId(stats?.records);
  const deloadHint = deloadMessage(progression?.deload);

  const totalPlannedSets = mainExercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0);
  const loggedSetCount = mainExercises.reduce(
    (sum, ex) => sum + (setsByExercise[ex.id]?.filter((r) => r.logged).length ?? 0),
    0
  );
  const mainDone = mainExercises.length > 0 && loggedSetCount >= totalPlannedSets;
  const cooldownDone = cooldownExercises.filter(
    (ex) => setsByExercise[ex.id]?.some((r) => r.logged)
  ).length;
  const activeOverrides =
    day?.exercises.filter((ex) => weightOverrides[ex.id] != null && ex.type === 'wt') ?? [];

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, gap: 12 }}>
        <h2 style={{ margin: 0 }}>Heute</h2>
        {progress.total > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: progress.done === progress.total ? 'var(--success)' : 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {progress.done}/{progress.total} diese Woche
          </div>
        )}
      </div>

      {missedDays.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: '12px 14px',
            margin: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {missedDays.map((d) => (
            <div
              key={d.key}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <div style={{ fontSize: 13, color: 'var(--text)', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginRight: 6 }}>
                  {WEEKDAY_LABELS[d.weekday]}
                </span>
                <span style={{ color: 'var(--muted)' }}>{d.name}</span>
                <span style={{ color: 'var(--muted)' }}> · noch offen</span>
              </div>
              <button
                type="button"
                onClick={() => setDayKey(d.key)}
                disabled={!isOnline && dayKey !== d.key}
                style={{
                  flex: '0 0 auto',
                  background: dayKey === d.key ? 'var(--primary-dim)' : 'var(--surface2)',
                  border: `1px solid ${dayKey === d.key ? 'var(--primary)' : 'var(--line)'}`,
                  color: dayKey === d.key ? 'var(--primary)' : 'var(--text)',
                  borderRadius: 9,
                  padding: '7px 11px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  cursor: !isOnline && dayKey !== d.key ? 'not-allowed' : 'pointer',
                  opacity: !isOnline && dayKey !== d.key ? 0.5 : 1,
                }}
              >
                Nachholen
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px 0' }}>
        {plan.days.map((d) => {
          const doneAt = doneThisWeek.get(d.key);
          const isMissed = missedKeys.has(d.key);
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
                background: selected
                  ? 'var(--primary-dim)'
                  : doneAt
                    ? 'var(--success-dim)'
                    : isMissed
                      ? 'rgba(236, 72, 153, 0.08)'
                      : 'var(--surface)',
                border: `1px solid ${selected ? 'var(--primary)' : doneAt ? 'var(--success)' : isMissed ? 'var(--accent)' : 'var(--line)'}`,
                color: selected ? 'var(--primary)' : doneAt ? 'var(--success)' : isMissed ? 'var(--text)' : 'var(--muted)',
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
                {isMissed && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '2px 6px',
                      borderRadius: 999,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      background: 'rgba(236, 72, 153, 0.12)',
                      color: 'var(--accent)',
                    }}
                  >
                    Nachholbar
                  </span>
                )}
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
          {sessionId && sessionStartedAt && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--muted)',
                marginBottom: 10,
              }}
            >
              {formatElapsed(elapsedNow - sessionStartedAt)} · Satz {loggedSetCount}/{totalPlannedSets}
            </div>
          )}

          {activeOverrides.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: '10px 12px',
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              {activeOverrides.map((ex) => (
                <div key={ex.id}>
                  {ex.name}: {weightOverrides[ex.id]} kg <span style={{ color: 'var(--primary)' }}>(angepasst)</span>
                </div>
              ))}
            </div>
          )}

          {deloadHint && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--accent)',
                borderRadius: 14,
                padding: '11px 13px',
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--text)',
              }}
            >
              <strong style={{ color: 'var(--accent)' }}>Deload</strong> · {deloadHint}
            </div>
          )}

          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{day.focus}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2>{day.name}</h2>
            {plan.music_url && (
              <a
                href={plan.music_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flexShrink: 0,
                  background: 'var(--surface2)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  borderRadius: 999,
                  padding: '7px 13px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  textDecoration: 'none',
                  minHeight: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ♪ Musik
              </a>
            )}
          </div>

          {mainExercises.map((ex) => {
            const rows = setsByExercise[ex.id] || [];
            const allLogged = rows.length > 0 && rows.every((r) => r.logged);
            const prefillSets = historyRes?.prefill?.[ex.id];
            const compare = compareExercise(ex, rows, prefillSets);
            const trendMeta = compare.trend ? TREND_LABELS[compare.trend] : null;
            const liveRecord = livePreviewRecord(ex, rows, bests.get(ex.id));
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
                <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignSelf: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => setMuscleExercise(ex)}
                    aria-label={`Muskelgruppen zu ${ex.name}`}
                    style={cardLinkStyle}
                  >
                    Muskeln
                  </button>
                  <button type="button" onClick={() => setDetailExercise(ex)} style={cardLinkStyle}>
                    Details
                  </button>
                </div>
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

              {(compare.lastSummary || compare.targetLabel) && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginTop: 10,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {compare.lastSummary && <span>Letzte Session: {compare.lastSummary}</span>}
                  {compare.lastSummary && compare.targetLabel && <span>·</span>}
                  {compare.targetLabel && <span>Ziel: {compare.targetLabel}</span>}
                  {liveRecord && (
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 999,
                        fontSize: 10,
                        color: 'var(--on-primary)',
                        background: 'var(--primary-grad)',
                      }}
                    >
                      ★ Rekord {formatRecordValue(liveRecord.kind, liveRecord.value)}
                    </span>
                  )}
                  {trendMeta && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 999,
                        fontSize: 10,
                        color: trendMeta.color,
                        background: 'var(--surface2)',
                      }}
                    >
                      {trendMeta.text}
                    </span>
                  )}
                </div>
              )}

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
                  <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>
                    {durationUnitLabel(ex.type)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {rows.map((row, i) => (
                  <div
                    key={row.set_number}
                    ref={(el) => {
                      if (el) setRowRefs.current.set(`${ex.id}-${i}`, el);
                      else setRowRefs.current.delete(`${ex.id}-${i}`);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
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
                        inputMode={ex.type === 'cardio' ? 'decimal' : 'numeric'}
                        placeholder={toInputValue(ex.target_seconds, ex.type)}
                        value={row.duration}
                        onChange={(e) => updateSetField(ex.id, i, 'duration', e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>

              {allLogged && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      marginRight: 2,
                    }}
                  >
                    Anstrengung
                  </span>
                  {RPE_VALUES.map((value) => {
                    const active = rpeByExercise[ex.id] === value;
                    return (
                      <button
                        key={value}
                        onClick={() => toggleRpe(ex, value)}
                        disabled={!isOnline && !sessionId}
                        aria-pressed={active}
                        aria-label={`Anstrengung ${value} von 10`}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
                          background: active ? 'var(--primary-dim)' : 'var(--surface2)',
                          color: active ? 'var(--primary)' : 'var(--muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              )}

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

          {cooldownExercises.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
                opacity: mainDone ? 1 : 0.55,
                transition: 'opacity 240ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 2,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16 }}>Cooldown</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {cooldownDone}/{cooldownExercises.length}
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
                {mainDone ? 'Ein Tap pro Dehnung.' : 'Nach dem Hauptteil dran.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cooldownExercises.map((ex) => {
                  const rows = setsByExercise[ex.id] || [];
                  const done = rows.some((r) => r.logged);
                  return (
                    <div key={ex.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                      <button
                        onClick={() => toggleSet(ex, 0)}
                        disabled={showRestartGate || (!isOnline && !sessionId) || !rows.length}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          background: done ? 'var(--success-dim)' : 'var(--surface2)',
                          border: `1px solid ${done ? 'var(--success)' : 'var(--line)'}`,
                          borderRadius: 11,
                          padding: '10px 12px',
                          minHeight: 44,
                          cursor: 'pointer',
                          color: 'var(--text)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: done ? 'var(--success)' : 'var(--muted)',
                            }}
                          >
                            {done ? '✓' : '○'}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--muted)',
                            }}
                          >
                            {formatDuration(ex.target_seconds)}
                          </span>
                        </div>
                        {ex.cue && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{ex.cue}</div>
                        )}
                      </button>
                      <button
                        onClick={() => setDetailExercise(ex)}
                        aria-label={`Details zu ${ex.name}`}
                        style={{
                          flexShrink: 0,
                          width: 36,
                          background: 'var(--surface2)',
                          border: '1px solid var(--line)',
                          borderRadius: 11,
                          color: 'var(--muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        i
                      </button>
                      <button
                        onClick={() => {
                          unlockAudio();
                          setTimerSeconds(ex.target_seconds ?? 30);
                        }}
                        aria-label={`Halte-Timer für ${ex.name}`}
                        style={{
                          flexShrink: 0,
                          width: 44,
                          background: 'var(--surface2)',
                          border: '1px solid var(--line)',
                          borderRadius: 11,
                          color: 'var(--muted)',
                          fontSize: 15,
                          cursor: 'pointer',
                        }}
                      >
                        ⏱
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {noteOpen ? (
            <textarea
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Notiz zur Session (optional) — z. B. Schlaf, Schmerzen, Tagesform"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 14,
                resize: 'vertical',
                marginBottom: 10,
              }}
            />
          ) : (
            <button
              onClick={() => setNoteOpen(true)}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                color: 'var(--muted)',
                borderRadius: 12,
                padding: '10px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              + Notiz zur Session
            </button>
          )}

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
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 64,
                color: timerSeconds <= 5 ? 'var(--accent)' : 'var(--primary)',
              }}
            >
              {Math.max(0, timerSeconds)}
            </div>
            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={soundOn ? 'Ton aus' : 'Ton an'}
              style={{
                margin: '0 auto 12px',
                display: 'block',
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                color: 'var(--muted)',
                borderRadius: 999,
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {soundOn ? '🔊 Ton an' : '🔇 Ton aus'}
            </button>
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

      {muscleExercise && (
        <MuscleModal exercise={muscleExercise} onClose={() => setMuscleExercise(null)} />
      )}

      {detailExercise && (
        <ExerciseDetailSheet
          exercise={detailExercise}
          best={bests.get(detailExercise.id)}
          onClose={() => setDetailExercise(null)}
        />
      )}

      {completion && (
        <WorkoutCompleteOverlay
          stats={completion.stats}
          records={completion.records}
          onDone={leaveCompletion}
        />
      )}
    </div>
  );
}

const cardLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'var(--font-mono)',
  color: 'var(--primary)',
  fontSize: 12,
  cursor: 'pointer',
};

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
