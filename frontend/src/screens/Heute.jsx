import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { cancelQueuedSet, enqueueDelete, enqueueFinish, enqueueSet } from '../offlineQueue.js';
import { parseUtc, mondayStart } from '../lib/dates.js';
import { compareExercise, parseTargetReps } from '../lib/exerciseCompare.js';
import { isCooldownExercise, splitPhases } from '../lib/cooldown.js';
import { bestsByExerciseId } from '../lib/records.js';
import { summarizeSession } from '../lib/completion.js';
import { deloadMessage } from '../lib/progressionView.js';
import WorkoutCompleteOverlay from '../components/WorkoutCompleteOverlay.jsx';
import ExerciseDetailSheet from '../components/ExerciseDetailSheet.jsx';
import MuscleModal from '../components/MuscleModal.jsx';
import { formatDuration, toInputValue } from 'shared/duration';
import { WEEKDAYS, WEEKDAY_LABELS, projectWeek, weekProgress, todayWeekday } from '../lib/schedule.js';
import { getAllOverrides, getOverride, setOverride } from '../lib/weightOverrides.js';
import { lightenExercise, lightWeight } from '../lib/lightMode.js';
import { buildSetPayload } from '../components/SetRow.jsx';
import ExerciseListCard, { buildCardSubline } from '../components/ExerciseListCard.jsx';
import ExerciseFocus from '../components/ExerciseFocus.jsx';
import ElapsedTimer from '../components/ElapsedTimer.jsx';
import RestTimerBar from '../components/RestTimerBar.jsx';
import ReadinessDialog, { readinessAdaptations } from '../components/ReadinessDialog.jsx';
import WrappedStory, { monthLabel } from '../components/WrappedStory.jsx';
import ProgressionProposals from '../components/ProgressionProposals.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import LoadingScreen from '../components/ui/LoadingScreen.jsx';
import {
  startRestTimer,
  remainingSeconds,
  isRestTimerActive,
  REST_DEFAULT_SECONDS,
} from '../lib/restTimer.js';
import { playRestEnd, playTick, unlockAudio } from '../lib/workoutSounds.js';
import { timerPushWanted } from '../lib/push.js';

function buildInitialSets(exercise, prefillSets, resumedSets, light = false) {
  const source = resumedSets?.length ? resumedSets : prefillSets;
  // Leichte Version: −1 Satz, −10 % Gewicht — Prefill-Länge zählt dann nicht mehr,
  // sonst würde der gestrichene Satz über die Historie wieder auftauchen.
  const applyLight = light && !isCooldownExercise(exercise);
  const baseWeight = getOverride(exercise.id) ?? exercise.default_weight_kg ?? '';
  const defaultWeight =
    applyLight && exercise.type === 'wt' && baseWeight !== '' ? lightWeight(baseWeight) : baseWeight;
  const plannedSets = applyLight ? Math.max(1, (exercise.sets ?? 1) - 1) : exercise.sets;
  const rows = [];
  const count = Math.max(plannedSets, (applyLight ? resumedSets?.length : source?.length) || 0);
  for (let i = 1; i <= count; i++) {
    const fromSource = source?.find((s) => s.set_number === i);
    const isResumed = resumedSets?.some((s) => s.set_number === i);
    let weight = fromSource?.weight_kg ?? defaultWeight;
    if (applyLight && !isResumed && exercise.type === 'wt' && fromSource?.weight_kg != null) {
      weight = lightWeight(fromSource.weight_kg);
    }
    rows.push({
      set_number: i,
      reps: fromSource?.reps ?? '',
      weight_kg: weight,
      duration: toInputValue(
        fromSource?.duration_s ?? (isCooldownExercise(exercise) ? exercise.target_seconds : null),
        exercise.type
      ),
      set_type: fromSource?.set_type ?? 'working',
      superset_group: fromSource?.superset_group ?? null,
      logged: Boolean(isResumed),
    });
  }
  return rows;
}

const RPE_VALUES = [6, 7, 8, 9, 10];

export default function Heute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan, isLoading: planLoading, isError: planError, refetch: refetchPlan } = useQuery({ queryKey: ['plan'], queryFn: () => api.get('/plan'), retry: false });
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
  const { data: wrappedLatest } = useQuery({
    queryKey: ['wrapped-latest'],
    queryFn: () => api.get('/wrapped/latest'),
    retry: false,
  });
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const [dayKey, setDayKey] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const sessionPromiseRef = useRef(null);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [historyRes, setHistoryRes] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
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
  const [restTimerState, setRestTimerState] = useState(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [focusExerciseId, setFocusExerciseId] = useState(null);
  const [finishPending, setFinishPending] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [finishError, setFinishError] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [readinessHints, setReadinessHints] = useState(null);
  const [lightMode, setLightMode] = useState(false);
  const [lightOffer, setLightOffer] = useState(false);
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
  const projection = plan ? projectWeek(plan, doneThisWeek) : { days: [], nextKey: null, todayEntry: null, trainedToday: false };
  const nextDayKey = projection.nextKey;
  const projectionByKey = new Map(projection.days.map((e) => [e.key, e]));
  const progress = plan ? weekProgress(plan, doneThisWeek) : { done: 0, total: 0 };
  // Pausentag: heute ist kein Workout projiziert, aber es steht noch eines an.
  const nextOpenEntry = projection.days.find((e) => e.projectedIdx != null);
  const isRestToday = !projection.todayEntry && !projection.trainedToday && Boolean(nextOpenEntry);

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

      const light = Boolean(resumed?.adaptations?.light);
      setLightMode(light);
      setLightOffer(false);
      setReadinessHints(resumed?.readiness ? readinessAdaptations(resumed.readiness) : null);

      const day = plan.days.find((d) => d.key === dayKey);
      const initial = {};
      for (const ex of day.exercises) {
        initial[ex.id] = buildInitialSets(ex, historyRes.prefill[ex.id], resumedByExercise[ex.id], light);
      }
      setSetsByExercise(initial);
      setRpeByExercise(
        Object.fromEntries((resumed?.rpe ?? []).map((entry) => [entry.exercise_id, entry.rpe]))
      );
      setNote(resumed?.note ?? '');
      setNoteOpen(Boolean(resumed?.note));
      setSessionStartedAt(resumed?.first_set_at ? parseUtc(resumed.first_set_at).getTime() : null);
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
    if (!restTimerState || restTimerState.pausedAtMs) return;

    const tick = () => {
      const left = remainingSeconds(restTimerState);
      setRestSeconds(left);
      if (left <= 0) {
        playRestEnd();
        setRestTimerState(null);
        return;
      }
      if (left <= 5) playTick();
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [restTimerState]);

  // Pausen-Timer-Push: nur planen, wenn die App in den Hintergrund geht
  // (Bildschirm sperren o. Ä.) — im Vordergrund übernimmt der lokale Ton.
  useEffect(() => {
    if (!timerPushWanted()) return undefined;
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        const left = restTimerState && !restTimerState.pausedAtMs ? remainingSeconds(restTimerState) : 0;
        if (left >= 5) api.post('/push/timer', { seconds: left }).catch(() => {});
      } else {
        api.delete('/push/timer').catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [restTimerState]);

  // Fokus-Ansicht zeigt eine vorausgefüllte Zahl an — der State muss diesen Wert
  // tatsächlich tragen, sonst postet "Satz geschafft" einen leeren Wert.
  useEffect(() => {
    if (!focusExerciseId) return;
    const rows = setsByExercise[focusExerciseId];
    if (!rows) return;
    let exercise = plan?.days?.flatMap((d) => d.exercises ?? []).find((e) => e.id === focusExerciseId);
    if (!exercise) return;
    if (lightMode) exercise = lightenExercise(exercise);
    const idx = rows.findIndex((r) => !r.logged);
    const targetIndex = idx === -1 ? rows.length - 1 : idx;
    const row = rows[targetIndex];
    if (!row) return;

    const isDurationType = exercise.type === 'time' || exercise.type === 'cardio';
    const updates = {};
    if (isDurationType) {
      if (row.duration === '' || row.duration == null) {
        const fallback = toInputValue(exercise.target_seconds, exercise.type);
        if (fallback !== '') updates.duration = fallback;
      }
    } else if (row.reps === '' || row.reps == null) {
      const parsed = parseTargetReps(exercise.target_reps);
      if (parsed?.min != null) updates.reps = String(parsed.min);
    }
    if (exercise.type === 'wt' && (row.weight_kg === '' || row.weight_kg == null) && exercise.default_weight_kg != null) {
      updates.weight_kg = exercise.default_weight_kg;
    }

    if (Object.keys(updates).length) {
      setSetsByExercise((prev) => ({
        ...prev,
        [focusExerciseId]: prev[focusExerciseId].map((r, i) => (i === targetIndex ? { ...r, ...updates } : r)),
      }));
    }
  }, [focusExerciseId, setsByExercise, plan, lightMode]);

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
      const payload = buildSetPayload(exercise, row);

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
      setRestTimerState(startRestTimer(REST_DEFAULT_SECONDS));
      setUndoStack((prev) => [...prev, { exerciseId: exercise.id, index }]);
    } else {
      const stillLogged = Object.entries(setsByExercise).some(([exId, rows]) =>
        rows.some((s, i) => s.logged && !(exId === exercise.id && i === index))
      );
      if (!stillLogged) setSessionStartedAt(null);
    }
  }

  // Laufende Session komplett verwerfen — set_logs bleiben in der DB, zaehlen aber nirgends mehr.
  async function discardSession() {
    if (!sessionId) return;
    try {
      await api.post(`/sessions/${sessionId}/discard`);
    } catch {
      return;
    }
    setDiscardConfirm(false);
    setSessionId(null);
    setSessionStartedAt(null);
    sessionPromiseRef.current = null;
    setRestTimerState(null);
    setUndoStack([]);
    setRpeByExercise({});
    setReadinessHints(null);
    setLightMode(false);
    setLightOffer(false);
    setNote('');
    setNoteOpen(false);
    setFocusExerciseId(null);
    setSetsByExercise((prev) => {
      if (!lightMode) {
        return Object.fromEntries(
          Object.entries(prev).map(([exId, rows]) => [exId, rows.map((r) => ({ ...r, logged: false }))])
        );
      }
      // Leichte Version war aktiv — Rows zurück auf Planwerte.
      const dayPlan = plan?.days?.find((d) => d.key === dayKey);
      return Object.fromEntries(
        (dayPlan?.exercises ?? []).map((ex) => [ex.id, buildInitialSets(ex, historyRes?.prefill?.[ex.id], null, false)])
      );
    });
    queryClient.invalidateQueries({ queryKey: ['sessions-recent'] });
  }

  function adjustWeight(exercise, index, delta) {
    const rows = setsByExercise[exercise.id];
    const current = Number(rows[index]?.weight_kg) || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, i) => (i === index ? { ...s, weight_kg: next } : s)),
    }));
    if (exercise.type === 'wt' && next && next !== Number(exercise.default_weight_kg)) {
      setOverride(exercise.id, next);
    }
  }

  function adjustBigNumber(exercise, index, delta) {
    setSetsByExercise((prev) => {
      const rows = prev[exercise.id];
      const isDurationType = exercise.type === 'time' || exercise.type === 'cardio';
      const field = isDurationType ? 'duration' : 'reps';
      return {
        ...prev,
        [exercise.id]: rows.map((s, i) => {
          if (i !== index) return s;
          const current = Number(s[field]) || 0;
          return { ...s, [field]: String(Math.max(0, current + delta)) };
        }),
      };
    });
  }

  function currentSetIndexFor(exerciseId) {
    const rows = setsByExercise[exerciseId] ?? [];
    const idx = rows.findIndex((r) => !r.logged);
    return idx === -1 ? rows.length - 1 : idx;
  }

  async function handleLogFocusSet(exercise) {
    const rows = setsByExercise[exercise.id] ?? [];
    const targetIndex = currentSetIndexFor(exercise.id);
    const isLast = targetIndex === rows.length - 1;
    await toggleSet(exercise, targetIndex);
    if (isLast) {
      setTimeout(() => setFocusExerciseId(null), 350);
    }
  }

  async function undoLastSet() {
    const last = undoStack[undoStack.length - 1];
    if (!last || !plan) return;
    let exercise = null;
    for (const d of plan.days ?? []) {
      exercise = d.exercises?.find((e) => e.id === last.exerciseId);
      if (exercise) break;
    }
    if (!exercise) return;
    setUndoStack((prev) => prev.slice(0, -1));
    await toggleSet(exercise, last.index);
  }

  async function handleReadiness(readiness) {
    let sid = sessionId;
    if (!sid) {
      try {
        sid = await ensureSession();
      } catch {
        return;
      }
    }
    try {
      await api.post(`/sessions/${sid}/readiness`, readiness);
      setReadinessHints(readinessAdaptations(readiness));
      if (readiness.energy <= 2 && !lightMode) setLightOffer(true);
    } catch {
      /* optional */
    }
  }

  // Leichte Version an/aus: ungeloggte Rows werden neu aus dem (ggf. reduzierten) Plan
  // aufgebaut, geloggte Sätze bleiben unangetastet. Persistenz best effort.
  async function applyLightMode(next) {
    setLightMode(next);
    setLightOffer(false);
    const dayPlan = plan?.days?.find((d) => d.key === dayKey);
    setSetsByExercise((prev) => {
      const out = {};
      for (const ex of dayPlan?.exercises ?? []) {
        const fresh = buildInitialSets(ex, historyRes?.prefill?.[ex.id], null, next);
        const byNumber = new Map(fresh.map((r) => [r.set_number, r]));
        for (const r of prev[ex.id] ?? []) {
          if (r.logged) byNumber.set(r.set_number, r);
        }
        out[ex.id] = [...byNumber.values()].sort((a, b) => a.set_number - b.set_number);
      }
      return out;
    });
    try {
      const sid = await ensureSession();
      await api.post(`/sessions/${sid}/adaptations`, { light: next });
    } catch {
      /* optional — lokal bereits aktiv */
    }
  }

  async function finishWorkout() {
    if (finishPending) return;
    setFinishPending(true);
    setFinishError(null);
    try {
      const res = await api.post(`/sessions/${sessionId}/finish`, { note: note.trim() || null });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['sessions-recent'] });
      queryClient.invalidateQueries({ queryKey: ['sessions-range'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });

      clearTimeout(noteSaveRef.current);
      setRestTimerState(null);
      const dayPlan = plan?.days?.find((d) => d.key === dayKey);
      setCompletion({
        session_id: res.session_id,
        summary: res.summary,
        evaluation: res.evaluation,
        records: res.new_records ?? [],
        day_name: dayPlan?.name ?? 'Workout',
        stats: summarizeSession(dayPlan, res.summary, sessionStartedAt ? Date.now() - sessionStartedAt : null),
      });
    } catch (err) {
      if (!err.status && sessionId) {
        try {
          await enqueueFinish(sessionId, { note: note.trim() || null });
          setFinishError('Offline gespeichert — Sync beim nächsten Online-Status.');
        } catch {
          setFinishError('Abschließen fehlgeschlagen. Bitte erneut versuchen.');
        }
      } else {
        setFinishError('Abschließen fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setFinishPending(false);
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
            set_type: 'working',
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

  // Identität muss stabil bleiben, sonst startet der Auto-Weiter-Timer im Overlay neu.
  const leaveCompletion = useCallback(() => {
    if (!completion) return;
    setCompletion(null);
    navigate(`/session/${completion.session_id}/auswertung`, {
      state: {
        summary: completion.summary,
        evaluation: completion.evaluation,
        // Für die Share-Card direkt nach dem Finish — Rekorde gibt es nur hier.
        records: completion.records,
        stats: completion.stats,
        day_name: completion.day_name,
      },
    });
  }, [completion, navigate]);

  if (planLoading) {
    return (
      <div className="wrap">
        <LoadingScreen label="Plan wird geladen…" />
      </div>
    );
  }

  if (planError) {
    return (
      <div className="wrap">
        <PageHeader title="Heute" />
        <p style={{ color: 'var(--danger)' }}>Plan konnte nicht geladen werden.</p>
        <Button onClick={() => refetchPlan()}>Erneut versuchen</Button>
      </div>
    );
  }

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

  const planDay = plan.days.find((d) => d.key === dayKey);
  // Leichte Version: abgeleitete Übungsobjekte, damit Karten, Fokus-Ansicht und
  // Fortschrittszähler denselben reduzierten Plan sehen.
  const day = planDay && lightMode ? { ...planDay, exercises: planDay.exercises.map(lightenExercise) } : planDay;
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

  const focusDisabled = showRestartGate || (!isOnline && !sessionId);
  const focusExercise = focusExerciseId ? mainExercises.find((ex) => ex.id === focusExerciseId) ?? null : null;
  const focusIndex = focusExercise ? mainExercises.findIndex((ex) => ex.id === focusExerciseId) : -1;
  const focusRows = focusExercise ? setsByExercise[focusExercise.id] ?? [] : [];
  const focusCompare = focusExercise
    ? compareExercise(focusExercise, focusRows, historyRes?.prefill?.[focusExercise.id])
    : null;
  const segments = mainExercises.map((ex) => {
    const rows = setsByExercise[ex.id] ?? [];
    if (rows.length > 0 && rows.every((r) => r.logged)) return 'done';
    if (ex.id === focusExerciseId) return 'current';
    return 'rest';
  });
  const doneExerciseCount = mainExercises.filter((ex) => {
    const rows = setsByExercise[ex.id] ?? [];
    return rows.length > 0 && rows.every((r) => r.logged);
  }).length;
  const anyExerciseLogged = mainExercises.some((ex) => (setsByExercise[ex.id] ?? []).some((r) => r.logged));

  return (
    <div className="wrap">
      <PageHeader
        title="Heute"
        action={
          progress.total > 0 ? (
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
          ) : null
        }
      />

      {wrappedLatest?.available && !wrappedLatest.seen && !wrappedOpen && (
        <button
          type="button"
          onClick={() => setWrappedOpen(true)}
          style={{
            width: '100%',
            background: 'var(--primary-grad)',
            border: 'none',
            borderRadius: 14,
            padding: '13px 16px',
            marginBottom: 12,
            color: 'var(--on-primary)',
            fontWeight: 600,
            fontSize: 14,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>🎁 Dein Rückblick für {monthLabel(wrappedLatest.month)} ist da</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.9 }}>Ansehen →</span>
        </button>
      )}

      {sessionId && !readinessHints && (
        <Button variant="secondary" onClick={() => setReadinessOpen(true)} style={{ marginBottom: 12, fontSize: 13, minHeight: 40 }}>
          Tagesform checken
        </Button>
      )}

      {readinessHints && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13 }}>
          <strong>Hinweise:</strong> {readinessHints.join(' · ')}
        </div>
      )}

      {lightOffer && !lightMode && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--primary)',
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <strong>Wenig Energie?</strong> Leichte Version: −10 % Gewicht, −1 Satz pro Übung — zählt ganz
            normal.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => applyLightMode(true)} style={{ fontSize: 13, minHeight: 40 }}>
              Leicht trainieren
            </Button>
            <Button variant="secondary" onClick={() => setLightOffer(false)} style={{ fontSize: 13, minHeight: 40 }}>
              Nein, normal
            </Button>
          </div>
        </div>
      )}

      {lightMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: 'var(--primary-dim)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            borderRadius: 12,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <span>
            <strong>Leichte Version aktiv</strong> · −10 % Gewicht, −1 Satz
          </span>
          <button
            onClick={() => applyLightMode(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Zurücksetzen
          </button>
        </div>
      )}

      {progression?.proposals?.length > 0 && (
        <ProgressionProposals proposals={progression.proposals.slice(0, 2)} deload={progression.deload} />
      )}

      {sessionId && undoStack.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={undoLastSet} style={{ fontSize: 12, minHeight: 36, padding: '8px 12px' }}>
            ↶ Rückgängig
          </Button>
        </div>
      )}

      {isRestToday && (
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0 0' }}>
          Heute Pause · {nextOpenEntry.name} geplant für{' '}
          {WEEKDAY_LABELS[WEEKDAYS[nextOpenEntry.projectedIdx]]}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px 0' }}>
        {plan.days.map((d) => {
          const doneAt = doneThisWeek.get(d.key);
          const entry = projectionByKey.get(d.key);
          const isNext = !doneAt && d.key === nextDayKey;
          const selected = d.key === dayKey;
          return (
            <button
              key={d.key}
              onClick={() => {
                setDayKey(d.key);
                setFocusExerciseId(null);
              }}
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
              {doneAt ? (
                <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>
                  Erledigt ({doneAt.toLocaleDateString('de-DE', { weekday: 'short' })})
                </div>
              ) : entry?.projectedIdx != null ? (
                <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>
                  {WEEKDAY_LABELS[WEEKDAYS[entry.projectedIdx]]}
                </div>
              ) : (
                <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>diese Woche nicht mehr</div>
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
          {sessionId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--muted)',
                marginBottom: 10,
              }}
            >
              <span>
                {sessionStartedAt && (
                  <>
                    <ElapsedTimer startedAt={sessionStartedAt} variant="minutes" /> ·{' '}
                  </>
                )}
                Satz {loggedSetCount}/{totalPlannedSets}
              </span>
              <button
                onClick={() => (discardConfirm ? discardSession() : setDiscardConfirm(true))}
                onBlur={() => setDiscardConfirm(false)}
                disabled={!isOnline}
                style={{
                  flex: '0 0 auto',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  color: discardConfirm ? 'var(--danger)' : 'var(--muted)',
                  textDecoration: 'underline',
                  cursor: isOnline ? 'pointer' : 'not-allowed',
                }}
              >
                {discardConfirm ? 'Wirklich verwerfen?' : 'Session verwerfen'}
              </button>
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

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {day.focus}
            </div>
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
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1.05,
              letterSpacing: -0.5,
            }}
          >
            {day.name}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11, color: 'var(--muted)' }}>
              HEUTE · {WEEKDAY_LABELS[todayWeekday()].toUpperCase()}
            </span>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${mainExercises.length ? (doneExerciseCount / mainExercises.length) * 100 : 0}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--primary-grad)',
                }}
              />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {doneExerciseCount}/{mainExercises.length} ÜBUNGEN
            </div>
          </div>
          {!anyExerciseLogged && (
            <div style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--muted)' }}>
              Übung antippen, um Sätze zu loggen
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mainExercises.map((ex) => {
              const rows = setsByExercise[ex.id] || [];
              const allLogged = rows.length > 0 && rows.every((r) => r.logged);
              const prefillSets = historyRes?.prefill?.[ex.id];
              const compare = compareExercise(ex, rows, prefillSets);
              const subline = buildCardSubline(ex, rows, compare);
              return (
                <div key={ex.id}>
                  <ExerciseListCard
                    exercise={ex}
                    rows={rows}
                    subline={subline}
                    onOpen={() => setFocusExerciseId(ex.id)}
                  />
                  {allLogged && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
                </div>
              );
            })}
          </div>

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
                          setRestTimerState(startRestTimer(ex.target_seconds ?? 30));
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
                marginTop: 20,
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
                marginTop: 20,
                marginBottom: 10,
              }}
            >
              + Notiz zur Session
            </button>
          )}

          <Button
            onClick={finishWorkout}
            disabled={finishPending || !sessionId}
            fullWidth
            style={{ margin: '6px 0 4px' }}
          >
            {finishPending ? 'Wird abgeschlossen…' : 'Workout abschließen'}
          </Button>
          {finishError && (
            <p style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 12, margin: '0 0 8px' }}>
              {finishError}
            </p>
          )}
          {!isOnline && !finishError && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, margin: '0 0 20px' }}>
              Offline — Sätze werden lokal gespeichert.
            </p>
          )}
        </>
      )}

      {focusExercise && focusCompare && (
        <ExerciseFocus
          exercise={focusExercise}
          index={focusIndex}
          total={mainExercises.length}
          rows={focusRows}
          compare={focusCompare}
          segments={segments}
          disabled={focusDisabled}
          elapsedLabel={<ElapsedTimer startedAt={sessionStartedAt} />}
          restTimerActive={isRestTimerActive(restTimerState)}
          onClose={() => setFocusExerciseId(null)}
          onLogCurrentSet={() => handleLogFocusSet(focusExercise)}
          onToggleDot={(i) => toggleSet(focusExercise, i)}
          onAdjustBigNumber={(delta) => adjustBigNumber(focusExercise, currentSetIndexFor(focusExercise.id), delta)}
          onAdjustWeight={(delta) => adjustWeight(focusExercise, currentSetIndexFor(focusExercise.id), delta)}
          onAddExtraSet={() => addExtraSet(focusExercise)}
          onStartRestTimer={() => {
            unlockAudio();
            setRestTimerState(startRestTimer(REST_DEFAULT_SECONDS));
          }}
          onOpenMuscle={() => setMuscleExercise(focusExercise)}
          onOpenDetail={() => setDetailExercise(focusExercise)}
          onNext={() => {
            const next = mainExercises[focusIndex + 1];
            if (next) setFocusExerciseId(next.id);
          }}
          onPrev={() => {
            const prev = mainExercises[focusIndex - 1];
            if (prev) setFocusExerciseId(prev.id);
          }}
        />
      )}

      {isRestTimerActive(restTimerState) && (
        <RestTimerBar
          timerState={restTimerState}
          seconds={restSeconds}
          onSkip={() => setRestTimerState(null)}
          onChange={setRestTimerState}
        />
      )}

      <ReadinessDialog
        open={readinessOpen}
        onClose={() => setReadinessOpen(false)}
        onSubmit={handleReadiness}
      />
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

      {wrappedOpen && wrappedLatest?.month && (
        <WrappedStory month={wrappedLatest.month} onClose={() => setWrappedOpen(false)} />
      )}

      {completion && (
        <WorkoutCompleteOverlay
          stats={completion.stats}
          records={completion.records}
          dayName={completion.day_name}
          onDone={leaveCompletion}
        />
      )}
    </div>
  );
}
