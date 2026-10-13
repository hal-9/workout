import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { durationUnitLabel, formatDuration, fromInputValue, toInputValue } from 'shared/duration';
import { parseTargetReps } from '../lib/exerciseCompare.js';
import { sideLabel } from '../lib/setRows.js';
import {
  REST_DEFAULT_SECONDS,
  extendRestTimer,
  pauseRestTimer,
  remainingSeconds,
  resumeRestTimer,
  startRestTimer,
} from '../lib/restTimer.js';
import { equipmentLabel, splitExerciseName, stepForExercise } from '../lib/equipment.js';
import { DEFAULT_BAND_KG, bodyweightShare, effectiveLoadKg, isBandAssisted } from 'shared/bandAssist';
import { playRestEnd, playTick, unlockAudio } from '../lib/workoutSounds.js';
import { useScrollLock } from '../lib/scrollLock.js';
import '../styles/focus.css';

const HOLD_PREP_SECONDS = 3;

const DRUM_STEP_PX = 46;
const DRUM_MAX_FLICK_STEPS = 8;
const DRUM_HINT_KEY = 'focusDrumHintSeen';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Deutsche Dezimalschreibweise: 22.5 → „22,5"
const fmtNum = (v) => String(Math.round((Number(v) || 0) * 100) / 100).replace('.', ',');

const roundBtnStyle = {
  width: 44,
  height: 44,
  padding: 0,
  borderRadius: '50%',
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const pillStyle = {
  flex: 1,
  minWidth: 0,
  height: 52,
  padding: '0 16px',
  borderRadius: 26,
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const primaryBtnStyle = {
  width: '100%',
  height: 58,
  padding: '0 20px',
  borderRadius: 29,
  border: 'none',
  background: 'var(--m0)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '-0.01em',
};

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--primary)',
  fontSize: 13,
  cursor: 'pointer',
};

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, letterSpacing: '0.01em', color: 'var(--muted)' };
const hintStyle = { display: 'block', marginTop: 16, fontSize: 13, fontWeight: 500, color: 'var(--muted)', minHeight: 17 };

const ICONS = {
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.6v.2" />
    </>
  ),
  swap: <path d="M7 4.5L4 7.5l3 3M4 7.5h12.5a3.5 3.5 0 0 1 3.5 3.5M17 19.5l3-3-3-3M20 16.5H7.5A3.5 3.5 0 0 1 4 13" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  play: <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z" />,
  plus: <path d="M12 6v12M6 12h12" />,
  pause: <path d="M9 6v12M15 6v12" />,
};

function Icon({ name, size = 22, strokeWidth, style }) {
  return (
    <svg className="fx-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: size, height: size, strokeWidth, ...style }}>
      {ICONS[name]}
    </svg>
  );
}

export default function ExerciseFocus({
  exercise,
  index,
  total,
  rows,
  compare,
  segments,
  disabled,
  elapsedLabel,
  restTimerActive,
  restTimerState,
  restSeconds,
  onRestChange,
  onRestSkip,
  replacedFrom,
  onClose,
  onLogCurrentSet,
  onRemoveSet,
  onAdjustBigNumber,
  onAdjustWeight,
  onSetBigNumber,
  onSetWeight,
  onAdjustBand,
  onSetBand,
  onSetBandKg,
  bodyweightKg,
  onSaveBodyweight,
  onAddExtraSet,
  onDeleteSet,
  onStartRestTimer,
  onOpenDetail,
  onSwap,
  onNext,
  onPrev,
}) {
  const [phase, setPhase] = useState('entering');
  useScrollLock();
  const [editing, setEditing] = useState(null); // null | 'big' | 'kg' | 'band' | 'bandkg'
  // Nachträglich einen erledigten Satz ansehen/ändern: null = aktueller offener Satz.
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [justLogged, setJustLogged] = useState(false);
  const [holdPhase, setHoldPhase] = useState(null); // null | 'prep' | 'hold'
  const [holdTimerState, setHoldTimerState] = useState(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const closeTimeoutRef = useRef(null);
  // Lange auf einen offenen Satz drücken → „Satz löschen"-Tooltip darüber.
  const [setMenu, setSetMenu] = useState(null); // null | { index, x }
  const pressRef = useRef(null);
  const pebRowRef = useRef(null);
  // Gerade erledigte Sätze: Rand zeichnet sich, dann füllt das Mesh (focus.css .is-fresh).
  const [freshSets, setFreshSets] = useState([]);
  const loggedRef = useRef(null);
  const loggedKey = rows.map((r) => (r.logged ? r.set_number : '')).join(',');
  useEffect(() => {
    const logged = rows.filter((r) => r.logged).map((r) => r.set_number);
    const prev = loggedRef.current;
    loggedRef.current = { id: exercise.id, logged };
    if (prev?.id !== exercise.id) return;
    const added = logged.filter((n) => !prev.logged.includes(n));
    if (!added.length) return;
    setFreshSets((f) => [...f, ...added]);
    setTimeout(() => setFreshSets((f) => f.filter((n) => !added.includes(n))), 1300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedKey, exercise.id]);
  const pulseTimeoutRef = useRef(null);
  const editAreaRef = useRef(null);
  const touchStartRef = useRef(null);
  const wakeLockRef = useRef(null);
  // Dauer des laufenden Halte-Timers — vom aktuellen Satz (bearbeitete große
  // Zahl), nicht vom Plan-Ziel, sonst zählt der Timer die alte Dauer.
  const holdSecondsRef = useRef(0);
  // Einmal pro Gerät: die Trommeln wackeln kurz, damit klar ist, dass man sie ziehen kann.
  const [drumHint, setDrumHint] = useState(() => {
    try {
      return !localStorage.getItem(DRUM_HINT_KEY) && !prefersReducedMotion();
    } catch {
      return false; // privater Modus o. ä. — kein Hinweis
    }
  });

  useEffect(() => {
    if (!drumHint) return undefined;
    try {
      localStorage.setItem(DRUM_HINT_KEY, '1');
    } catch {
      /* egal — dann eben beim nächsten Mal wieder */
    }
    const id = setTimeout(() => setDrumHint(false), 1000);
    return () => clearTimeout(id);
  }, [drumHint]);

  function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock
      .request('screen')
      .then((lock) => {
        wakeLockRef.current = lock;
      })
      .catch(() => {});
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
  }

  function stopHold() {
    releaseWakeLock();
    setHoldPhase(null);
    setHoldTimerState(null);
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(closeTimeoutRef.current);
      clearTimeout(pulseTimeoutRef.current);
      releaseWakeLock();
    },
    []
  );

  useEffect(() => {
    if (!holdTimerState) return;

    const tick = () => {
      const left = remainingSeconds(holdTimerState);
      setHoldSecondsLeft(left);
      if (left > 0) {
        if (holdPhase === 'prep' || left <= 3) playTick();
        return;
      }
      if (holdPhase === 'prep') {
        setHoldPhase('hold');
        setHoldTimerState(startRestTimer(holdSecondsRef.current));
        return;
      }
      playRestEnd();
      stopHold();
      doLog();
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdTimerState, holdPhase]);

  useEffect(() => {
    if (!holdPhase) return;
    function onVisibility() {
      if (document.visibilityState === 'visible') acquireWakeLock();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [holdPhase]);

  function handleStartHold(seconds) {
    if (disabled || restTimerActive || holdPhase) return;
    holdSecondsRef.current = seconds;
    unlockAudio();
    acquireWakeLock();
    setHoldPhase('prep');
    setHoldTimerState(startRestTimer(HOLD_PREP_SECONDS));
  }

  // Satz geloggt: kurz grün pulsieren, danach bleibt der Button bis zum Ende
  // der Pause (Ablauf oder „Weiter") gesperrt.
  function doLog() {
    setJustLogged(true);
    clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => setJustLogged(false), 650);
    onLogCurrentSet();
  }

  function handleLogSet() {
    if (disabled || restTimerActive || holdPhase) return;
    doLog();
  }

  // Lange Timer (20 min Laufband): fertig melden, ohne den Ablauf abzuwarten —
  // geloggt wird die eingestellte Dauer.
  function handleFinishHold() {
    if (disabled || holdPhase !== 'hold') return;
    stopHold();
    doLog();
  }

  function requestClose() {
    stopHold();
    setPhase('closing');
    closeTimeoutRef.current = setTimeout(onClose, 150);
  }

  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNext?.();
    else onPrev?.();
  }

  const isDurationType = exercise.type === 'time' || exercise.type === 'cardio';
  const isWeighted = exercise.type === 'wt';
  const isBanded = isBandAssisted(exercise);

  const firstOpenIndex = rows.findIndex((r) => !r.logged);
  const activeIndex = firstOpenIndex === -1 ? rows.length - 1 : firstOpenIndex;
  const allLogged = firstOpenIndex === -1 && rows.length > 0;
  // Angezeigter Satz: ausgewählter erledigter Satz, sonst der aktuelle offene.
  const viewIndex = selectedIndex != null && selectedIndex < rows.length ? selectedIndex : activeIndex;
  const viewRow = rows[viewIndex];
  const reviewing = Boolean(viewRow?.logged);

  // Neuer aktueller Satz (geloggt/entfernt) oder andere Übung: Auswahl und
  // Editor zurücksetzen — sonst zeigt die große Zahl einen fremden Satz.
  useEffect(() => {
    setEditing(null);
    setSelectedIndex(null);
    stopHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, exercise.id]);

  useEffect(() => {
    if (!editing) return;
    function handlePointerDown(e) {
      if (editAreaRef.current && !editAreaRef.current.contains(e.target)) {
        // iOS nimmt dem Input beim Tippen auf einen Button den Fokus nicht weg,
        // und beim Unmount feuert kein blur — der getippte Wert wäre verloren
        // (Timer lief mit der alten Dauer). Explizit committen, dann schließen.
        editAreaRef.current.querySelector('input')?.blur();
        setEditing(null);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [editing]);

  useEffect(() => {
    if (!setMenu) return;
    function handlePointerDown(e) {
      if (!e.target.closest('.fx-setmenu')) setSetMenu(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [setMenu]);

  if (!viewRow) return null;

  const canRemove = (i) => rows.length > 1 && rows.slice(i).every((r) => !r.logged);

  function pressStart(e, i) {
    if (!canRemove(i)) return;
    const peb = e.currentTarget;
    clearTimeout(pressRef.current?.timer);
    pressRef.current = {
      fired: false,
      timer: setTimeout(() => {
        pressRef.current.fired = true;
        navigator.vibrate?.(10);
        setSetMenu({ index: i, x: peb.offsetLeft + peb.offsetWidth / 2 });
      }, 450),
    };
  }

  function pressEnd() {
    clearTimeout(pressRef.current?.timer);
  }

  function deleteSet(i) {
    setSetMenu(null);
    onDeleteSet(i);
  }

  const targetParsed = parseTargetReps(exercise.target_reps);

  function bigValueFor(row) {
    if (isDurationType) {
      return row.duration !== '' && row.duration != null ? row.duration : toInputValue(exercise.target_seconds, exercise.type);
    }
    return row.reps !== '' && row.reps != null ? row.reps : targetParsed?.min ?? '';
  }

  function kgValueFor(row) {
    return row.weight_kg !== '' && row.weight_kg != null ? row.weight_kg : exercise.default_weight_kg ?? '';
  }

  const bigValue = bigValueFor(viewRow);
  const bandCount = Number(viewRow.band_count) || 0;
  const bandKg = Number(viewRow.band_kg) || DEFAULT_BAND_KG;
  const effectiveKg = isBanded ? effectiveLoadKg(bodyweightKg, bandCount, bandKg) : null;
  const bwShare = isBanded && !isDurationType ? bodyweightShare(bodyweightKg, Number(bigValue), bandCount, bandKg) : null;
  const viewSide = sideLabel(exercise, viewRow.set_number);
  const unitLabel = isDurationType ? durationUnitLabel(exercise.type) : 'Wdh.';
  // Kurze Einheit für Kiesel und Trommel: „40 s", „20 min"
  const durUnit = exercise.type === 'cardio' ? 'min' : 's';
  const kgValue = kgValueFor(viewRow);
  const holdSeconds = isDurationType ? fromInputValue(bigValue, exercise.type) ?? 0 : 0;
  const canHoldTimer = holdSeconds > 0;
  const weightStep = stepForExercise(exercise);
  // Lange Namen: eine Stufe kleiner statt Umbruch auf drei Zeilen.
  const { base: nameBase, variant: nameVariant } = splitExerciseName(exercise.name);
  const subtitle = nameVariant || equipmentLabel(exercise) || exercise.muscle || null;
  const nameFontSize = nameBase.length > 34 ? 24 : 28;
  const sideSuffix = (setNumber) => (exercise.unilateral ? ` · ${sideLabel(exercise, setNumber)}` : '');
  const perSide = exercise.unilateral ? ' pro Seite' : '';

  // Ziel aus dem Plan, „zuletzt" aus der Historie — beides in der Liste unter den Werten.
  const targetValue = isDurationType
    ? exercise.target_seconds
      ? `${toInputValue(exercise.target_seconds, exercise.type)} ${durUnit}${perSide}`
      : null
    : targetParsed
      ? `${targetParsed.min === targetParsed.max ? targetParsed.min : `${targetParsed.min}–${targetParsed.max}`} Wdh.${perSide}`
      : null;
  const lastSets = compare.lastSets ?? [];
  const lastWeight = lastSets[viewIndex]?.weight_kg ?? lastSets.find((s) => s.weight_kg != null)?.weight_kg;
  // Letzte Leistung für Satz i (Kiesel + Untertitel), sonst null.
  function lastValueFor(i) {
    const s = lastSets[i];
    if (!s) return null;
    if (isDurationType) return s.duration_s != null ? `${fmtNum(toInputValue(s.duration_s, exercise.type))} ${durUnit}` : null;
    return s.reps != null ? String(s.reps) : null;
  }
  function doneLabelFor(row) {
    if (isDurationType) return `${fmtNum(bigValueFor(row))} ${durUnit}`;
    if (isWeighted && kgValueFor(row) !== '') return `${row.reps} × ${fmtNum(kgValueFor(row))}`;
    return String(row.reps);
  }
  const viewLast = lastValueFor(viewIndex);
  // Mulde zeigt nur die Zahlen — Satz, Ziel und Verlauf stehen als Liste darunter.
  const lastLabel = viewLast
    ? `${viewLast}${isDurationType ? '' : ' Wdh.'}${isWeighted && lastWeight != null ? ` × ${fmtNum(lastWeight)} kg` : ''}`
    : null;
  const infoRows = [
    ['Satz', `${viewIndex + 1} von ${rows.length}${reviewing ? ' · erledigt' : ''}`],
    targetValue && ['Ziel', targetValue],
    lastLabel && ['Letztes Mal', lastLabel],
  ].filter(Boolean);
  // Viele Sätze: Kiesel werden schmaler, erledigte zeigen nur noch die Wdh.
  const crowded = rows.length >= 5;

  const nextRow = rows[activeIndex];
  const nextSetPreview = nextRow
    ? [
        `${fmtNum(bigValueFor(nextRow))} ${unitLabel}`,
        isWeighted && kgValueFor(nextRow) !== '' ? `${fmtNum(kgValueFor(nextRow))} kg` : null,
        isBanded ? `${Number(nextRow.band_count) || 0} ${Number(nextRow.band_count) === 1 ? 'Band' : 'Bänder'}` : null,
      ]
        .filter(Boolean)
        .join(' × ')
    : '';
  const ctaMuted = restTimerActive || holdPhase === 'prep';

  function selectDot(i) {
    if (rows[i].logged) {
      setEditing(null);
      setSelectedIndex(i);
    } else if (i === activeIndex) {
      setEditing(null);
      setSelectedIndex(null);
    }
  }

  // Zweite Spalte der Wertemulde: Gewicht oder Bänder (oder keine).
  const bigCell = holdPhase ? (
    <div>
      <div className="fx-num" style={{ marginTop: 34, marginBottom: 35, fontSize: 60 }} role="timer" aria-live="off">
        {holdPhase === 'prep' ? holdSecondsLeft : formatDuration(holdSecondsLeft)}
      </div>
      <span style={hintStyle}>{holdPhase === 'prep' ? 'Gleich geht’s los' : 'Halten'}</span>
    </div>
  ) : (
    // Gleiche Höhe wie die Bänder-Spalte (Trommel + „kg pro Band"), sonst sitzen die Zahlen versetzt.
    <div style={isBanded ? { paddingBottom: 32 } : undefined}>
      <Drum
        value={Number(bigValue) || 0}
        step={1}
        min={1}
        unit={isDurationType ? durUnit : 'Wdh.'}
        ariaUnit={isDurationType ? (exercise.type === 'cardio' ? 'Minuten' : 'Sekunden') : 'Wiederholungen'}
        ariaLabel={isDurationType ? 'Dauer' : 'Wiederholungen'}
        nudge={drumHint}
        onChange={(delta) => onAdjustBigNumber(delta, viewIndex)}
        onEdit={() => setEditing('big')}
        editor={
          editing === 'big' ? (
            <NumberEditor
              value={bigValue}
              ariaLabel={isDurationType ? 'Dauer' : 'Wiederholungen'}
              onCommit={(next) => onSetBigNumber(next, viewIndex)}
              onDone={() => setEditing(null)}
            />
          ) : null
        }
      />
    </div>
  );

  const sideCell = isWeighted ? (
    <div>
      <Drum
        value={Number(kgValue) || 0}
        step={weightStep}
        min={0}
        unit="kg"
        ariaUnit="Kilogramm"
        ariaLabel="Gewicht"
        nudge={drumHint}
        onChange={(delta) => onAdjustWeight(delta, viewIndex)}
        onEdit={() => setEditing('kg')}
        editor={
          editing === 'kg' ? (
            <NumberEditor
              value={kgValue}
              ariaLabel="Gewicht in Kilogramm"
              onCommit={(next) => onSetWeight(next, viewIndex)}
              onDone={() => setEditing(null)}
            />
          ) : null
        }
      />
    </div>
  ) : isBanded ? (
    <div>
      {editing === 'bandkg' && <span style={labelStyle}>kg pro Band</span>}
      <Drum
        value={bandCount}
        step={1}
        min={0}
        unit={bandCount === 1 ? 'Band' : 'Bänder'}
        ariaUnit={bandCount === 1 ? 'Band' : 'Bänder'}
        ariaLabel="Anzahl Bänder"
        nudge={drumHint}
        onChange={(delta) => onAdjustBand(delta, viewIndex)}
        onEdit={() => setEditing('band')}
        editor={
          editing === 'band' ? (
            <NumberEditor
              value={bandCount}
              ariaLabel="Anzahl Bänder"
              onCommit={(next) => onSetBand(next, viewIndex)}
              onDone={() => setEditing(null)}
            />
          ) : editing === 'bandkg' ? (
            <NumberEditor
              value={bandKg}
              ariaLabel="Nennwert pro Band in Kilogramm"
              onCommit={(next) => onSetBandKg(next, viewIndex)}
              onDone={() => setEditing(null)}
            />
          ) : null
        }
      />
      {/* Der Nennwert ist selten zu ändern — deshalb nur als Hinweis antippbar. */}
      <button
        type="button"
        onClick={() => setEditing(editing === 'bandkg' ? null : 'bandkg')}
        aria-label="Nennwert pro Band ändern"
        style={{ ...linkStyle, ...hintStyle, height: 32, marginTop: 0, display: 'inline-block' }}
      >
        {bandKg} kg pro Band
      </button>
    </div>
  ) : null;

  return (
    <div
      className={phase === 'closing' ? 'fx-exit' : 'fx-enter'}
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        zIndex: 60,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ padding: '6px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', height: 56 }}>
          <button type="button" onClick={requestClose} aria-label="Fokus schließen" className="btn btn-secondary" style={roundBtnStyle}>
            <Icon name="close" />
          </button>
          <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{elapsedLabel}</div>
          <div aria-label={`Übung ${index + 1} von ${total}`} style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
            {index + 1}/{total}
          </div>
        </div>
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(segments.length, 1)}, 1fr)`,
            gap: 6,
            padding: 5,
            marginTop: 6,
            borderRadius: 8,
            boxShadow: 'var(--shadow-inset-sm)',
          }}
        >
          {segments.map((status, i) => (
            <span
              key={i}
              className={`fx-seg${status === 'done' ? ' is-done' : status === 'current' ? ' is-cur' : ''}`}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 20px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 22 }}>
          <button
            type="button"
            onClick={onOpenDetail}
            className="fx-title"
            aria-label={`${exercise.name}${subtitle ? ` (${subtitle})` : ''} — Details und Muskeln öffnen`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
              minWidth: 0,
              minHeight: 44,
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--text)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: nameFontSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' }}>
              {nameBase}
              <Icon name="info" size={20} strokeWidth={1.9} style={{ marginLeft: 8, verticalAlign: '-0.12em', color: 'var(--muted)' }} />
            </span>
            {subtitle && <span style={{ fontSize: 15, lineHeight: 1.3, color: 'var(--muted)' }}>{subtitle}</span>}
            {replacedFrom && <span style={{ fontSize: 13, color: 'var(--muted)' }}>statt {replacedFrom}</span>}
          </button>
          {onSwap && (
            <button
              type="button"
              onClick={onSwap}
              aria-label="Übung tauschen"
              className="btn btn-secondary"
              style={{ ...roundBtnStyle, width: 48, height: 48 }}
            >
              <Icon name="swap" />
            </button>
          )}
        </div>

        <div
          ref={pebRowRef}
          role="group"
          aria-label="Sätze"
          style={{ position: 'relative', display: 'flex', gap: crowded ? 8 : 12, marginTop: 22 }}
        >
          {rows.map((row, i) => {
            const state = row.logged ? 'done' : i === activeIndex ? 'cur' : 'open';
            const selectable = row.logged || i === activeIndex;
            const last = lastValueFor(i);
            const cls = [
              'fx-peb',
              state === 'done' ? 'is-done' : 'is-ghost',
              state === 'cur' ? 'is-cur' : '',
              row.logged && i === viewIndex && reviewing ? 'is-viewed' : '',
              row.logged && freshSets.includes(row.set_number) ? 'is-fresh' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={row.set_number}
                type="button"
                className={cls}
                style={{ flex: '1 1 0', fontSize: crowded ? 13 : undefined }}
                onClick={() => {
                  // Klick nach dem Langdruck schluckt das Loslassen.
                  if (pressRef.current?.fired) pressRef.current = null;
                  else if (selectable) selectDot(i);
                }}
                onPointerDown={(e) => pressStart(e, i)}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                onContextMenu={(e) => e.preventDefault()}
                aria-disabled={!selectable && !canRemove(i)}
                aria-pressed={i === viewIndex}
                aria-label={`Satz ${row.set_number}${sideSuffix(row.set_number)}: ${
                  row.logged
                    ? `erledigt, ${doneLabelFor(row)} — antippen zum Ansehen`
                    : `${state === 'cur' ? 'aktuell' : 'offen'}${last ? `, letztes Mal ${last}` : ''}`
                }`}
              >
                {row.logged && (
                  <>
                    <span className="mesh" aria-hidden="true"><i /><i /><i /><i /></span>
                    <span className="fx-peb-ring" aria-hidden="true" />
                  </>
                )}
                {row.logged ? (crowded && !isDurationType ? row.reps : doneLabelFor(row)) : last ?? row.set_number}
              </button>
            );
          })}
          {/* Gleiche Form wie die Sätze: ein weiterer Kiesel, nur mit Plus. */}
          <button
            type="button"
            className="fx-peb fx-peb-add"
            style={{ flex: '1 1 0' }}
            onClick={onAddExtraSet}
            aria-label="Satz hinzufügen"
          >
            <Icon name="plus" size={18} />
          </button>
          {setMenu && (
            <button
              type="button"
              className="fx-setmenu"
              style={{ left: setMenu.x }}
              onClick={() => deleteSet(setMenu.index)}
            >
              Satz {rows[setMenu.index]?.set_number} löschen
            </button>
          )}
        </div>
        {viewSide && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <span
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                boxShadow: 'var(--shadow-inset-sm)',
                fontSize: 14,
                fontWeight: 600,
                color: reviewing ? 'var(--success)' : 'var(--primary)',
              }}
            >
              {viewSide === 'links' ? 'Linke Seite' : 'Rechte Seite'}
            </span>
          </div>
        )}

        <div
          ref={editAreaRef}
          className="neu-inset fx-well"
          style={{
            // Wächst in den freien Platz bis zu den Buttons, Zahlen bleiben mittig.
            flex: '1 1 auto',
            minHeight: 168,
            maxHeight: 340,
            display: 'grid',
            gridTemplateColumns: sideCell ? '1fr 1fr' : '1fr',
            alignItems: 'center',
            marginTop: 16,
            borderRadius: 26,
            padding: '18px 0',
            textAlign: 'center',
          }}
        >
          {bigCell}
          {sideCell && <div style={{ borderLeft: '1px solid var(--line)' }}>{sideCell}</div>}
        </div>

        <dl aria-live="polite" className="fx-info">
          {infoRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {isBanded && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center', minHeight: 18 }}>
            {bodyweightKg ? (
              bandCount === 0
                ? `Ohne Band · volles Körpergewicht (${fmtNum(bodyweightKg)} kg)`
                : `≈ ${fmtNum(effectiveKg)} kg Eigenlast${bwShare != null ? ` · ${bwShare} % KG` : ''}`
            ) : (
              <BodyweightPrompt onSave={onSaveBodyweight} />
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {restTimerActive ? (
          <RestPanel
            timerState={restTimerState}
            seconds={restSeconds}
            nextLabel={allLogged ? 'Übung erledigt' : `Danach: Satz ${nextRow.set_number}${sideSuffix(nextRow.set_number)} · ${nextSetPreview}`}
            onChange={onRestChange}
            onSkip={onRestSkip}
          />
        ) : reviewing ? (
          // Erledigten Satz ansehen: zurück zum offenen Satz bzw. Übung abschließen.
          <button
            type="button"
            onClick={allLogged ? requestClose : () => setSelectedIndex(null)}
            className="btn btn-primary"
            style={{ ...primaryBtnStyle, cursor: 'pointer' }}
          >
            <span className="mesh" aria-hidden="true"><i /><i /><i /><i /></span>
            {allLogged ? 'Alle Sätze erledigt · Fertig' : `Weiter mit Satz ${activeIndex + 1}${sideSuffix(rows[activeIndex].set_number)}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={holdPhase ? handleFinishHold : canHoldTimer ? () => handleStartHold(holdSeconds) : handleLogSet}
            disabled={disabled || restTimerActive || holdPhase === 'prep'}
            className={`btn btn-primary${justLogged ? ' set-logged-pulse' : ''}`}
            style={{
              ...primaryBtnStyle,
              cursor: disabled || ctaMuted ? 'not-allowed' : 'pointer',
              opacity: disabled || ctaMuted ? 0.55 : 1,
            }}
          >
            <span className="mesh" aria-hidden="true"><i /><i /><i /><i /></span>
            {justLogged || holdPhase === 'hold' || !canHoldTimer ? (
              <>
                <Icon name="check" size={20} strokeWidth={2.2} />
                Satz geschafft
              </>
            ) : holdPhase === 'prep' ? (
              'Timer läuft …'
            ) : (
              <>
                <Icon name="play" size={18} />
                Start
              </>
            )}
          </button>
        )}
        {!restTimerActive && (
          <div style={{ display: 'flex', gap: 14 }}>
            {reviewing ? (
              <button
                type="button"
                onClick={() => onRemoveSet(viewIndex)}
                disabled={disabled}
                className="btn btn-secondary"
                style={{ ...pillStyle, color: 'var(--danger)', cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                Satz {viewRow.set_number} entfernen
              </button>
            ) : holdPhase ? (
              <button type="button" onClick={stopHold} className="btn btn-secondary" style={pillStyle}>
                Abbrechen
              </button>
            ) : (
              <button type="button" onClick={onStartRestTimer} className="btn btn-secondary" style={pillStyle}>
                Pause {REST_DEFAULT_SECONDS} s
              </button>
            )}
            <button type="button" onClick={requestClose} className="btn btn-secondary" style={pillStyle}>
              {reviewing ? 'Schließen' : 'Überspringen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Ohne Körpergewicht lässt sich die effektive Last nicht rechnen — einmalig
// hier abfragen statt auf den Fortschritt-Tab zu verweisen.
function BodyweightPrompt({ onSave }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const kg = Number(String(draft).replace(',', '.'));

  async function save() {
    if (!Number.isFinite(kg) || kg <= 0 || saving) return;
    setSaving(true);
    try {
      await onSave(kg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      <span>Körpergewicht?</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Körpergewicht in Kilogramm"
        placeholder="kg"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        style={{ width: 64, padding: '8px 10px', borderRadius: 12, border: 'none', background: 'var(--bg)', boxShadow: 'var(--shadow-inset-sm)', color: 'var(--text)', fontSize: 15, textAlign: 'center' }}
      />
      <button type="button" onClick={save} disabled={!(kg > 0) || saving} style={{ ...linkStyle, minHeight: 44, fontWeight: 600 }}>
        Speichern
      </button>
    </div>
  );
}

// Pause als Becken: eingelassene Mulde, der Ring läuft ab. Antippen hält an
// bzw. setzt fort; daneben +15 s und Weiter.
function RestPanel({ timerState, seconds, nextLabel, onChange, onSkip }) {
  const left = seconds ?? remainingSeconds(timerState);
  const total = timerState?.totalSeconds || left || 1;
  const progress = Math.max(0, Math.min(1, left / total));
  const paused = Boolean(timerState?.pausedAtMs);
  const ending = left <= 5;

  return (
    <div role="timer" aria-live="off" aria-label={`Pause: ${left} Sekunden`} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <button
        type="button"
        className="fx-basin"
        onClick={() => onChange(paused ? resumeRestTimer(timerState) : pauseRestTimer(timerState))}
        aria-label={paused ? 'Pause fortsetzen' : 'Pause anhalten'}
      >
        <span className="fx-ring" style={{ '--p': progress, opacity: paused ? 0.5 : 1 }} />
        <span style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', color: ending ? 'var(--primary)' : 'var(--text)' }}>
          <RollingValue text={String(left)} />
          <small style={{ marginLeft: 2, fontSize: 15, fontWeight: 500, letterSpacing: 0, color: 'var(--muted)' }}>s</small>
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--muted)' }}>{paused ? 'Angehalten' : 'Pause'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{nextLabel}</p>
        </div>
        <button type="button" onClick={() => onChange(extendRestTimer(timerState, 15))} className="btn btn-secondary" style={{ ...pillStyle, flex: 'none', height: 48 }}>
          +15 s
        </button>
        <button type="button" onClick={onSkip} className="btn btn-secondary" style={{ ...pillStyle, flex: 'none', height: 48 }}>
          Weiter
        </button>
      </div>
    </div>
  );
}

// Rollende Ziffern: geänderte Stellen gleiten raus/rein, Richtung nach +/−.
// Der Ref merkt sich den Vorwert; unveränderte Stellen bleiben stehen.
function RollingValue({ text, animate = true }) {
  const ref = useRef({ text, old: text, dir: 0, gen: 0 });
  if (ref.current.text !== text) {
    const a = Number(String(ref.current.text).replace(',', '.'));
    const b = Number(String(text).replace(',', '.'));
    ref.current = { text, old: ref.current.text, dir: b >= a ? 1 : -1, gen: ref.current.gen + 1 };
  }
  const { old, dir, gen } = ref.current;
  const n = Math.max(text.length, old.length);
  const prev = old.padStart(n);
  const next = text.padStart(n);
  const roll = animate && gen > 0;
  return (
    <span aria-hidden="true">
      {[...next].map((ch, i) => {
        if (ch === ' ') return null;
        const changed = roll && prev[i] !== ch;
        return (
          <span key={`${i}-${changed ? gen : 0}`} className={`fx-cell${changed ? (dir > 0 ? ' is-up' : ' is-dn') : ''}`}>
            <span className="fx-new">{ch}</span>
            {changed && prev[i] !== ' ' && <span className="fx-old">{prev[i]}</span>}
          </span>
        );
      })}
    </span>
  );
}

function rubberBand(overshoot, dim) {
  const c = 0.55;
  const abs = Math.abs(overshoot);
  return Math.sign(overshoot) * ((abs * dim * c) / (dim + c * abs));
}

function stepFeedback() {
  playTick();
  try {
    navigator.vibrate?.(4);
  } catch {
    /* nicht unterstützt */
  }
}

// Trommel wie ein iOS-Picker: kleiner oben, größer unten. Die Zahlen folgen dem
// Finger 1:1 (ein Schritt = DRUM_STEP_PX) und werden zum Rand hin kleiner und
// blasser. Schwung wird hochgerechnet, Loslassen rastet weich ein. Antippen
// eines Nachbarn rollt zu ihm, Antippen der Mitte öffnet die direkte Eingabe.
const DRUM_SLOTS = [-2, -1, 0, 1, 2];

function Drum({ value, step, min, unit, ariaUnit, ariaLabel, nudge, editor, onChange, onEdit }) {
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const dragRef = useRef(null);
  const offsetRef = useRef(0);
  const pendingRef = useRef(null);
  const rafRef = useRef(0);
  const suppressClickUntil = useRef(0);
  // Wert, den die DOM-Zahlen gerade zeigen, vs. den wir schon gemeldet haben.
  // Beim Ziehen kommt das Re-Render einen Frame zu spät — ohne Ausgleich sprang
  // die alte Zahl kurz an die neue Stelle (Zahl „zuckt" hin und her).
  const shownRef = useRef(value);
  const sentRef = useRef(value);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const display = fmtNum(value);
  const numSize = display.length > 4 ? 40 : display.length > 3 ? 48 : 60;

  // Position, Größe und Deckkraft jeder Zahl aus ihrem Abstand zur Mitte.
  function setOffset(px) {
    offsetRef.current = px;
    const lag = ((sentRef.current - shownRef.current) / step) * DRUM_STEP_PX;
    DRUM_SLOTS.forEach((k, i) => {
      const el = itemRefs.current[i];
      if (!el) return;
      const y = k * DRUM_STEP_PX + px - lag;
      const d = Math.abs(y) / DRUM_STEP_PX;
      const scale = 1 - 0.58 * Math.min(d, 1);
      const opacity = d < 1 ? 1 - 0.8 * d : Math.max(0, 0.2 * (1.6 - d) / 0.6);
      el.style.transform = `translateY(calc(-50% + ${y}px)) scale(${scale})`;
      el.style.opacity = opacity;
      // Einheit nur an der Mitte; blendet aus, bevor die Nachbarzahl übernimmt.
      el.lastChild.style.opacity = Math.max(0, 1 - 2 * d);
    });
  }

  // Nach jedem Render neu anlegen; nach Tippen/Taste vom alten Platz aus einrollen.
  useLayoutEffect(() => {
    shownRef.current = value;
    sentRef.current = value;
    if (pendingRef.current != null) {
      const from = pendingRef.current;
      pendingRef.current = null;
      setOffset(from);
      settle();
    } else {
      setOffset(offsetRef.current);
    }
  });

  // Kritisch gedämpft zurück auf 0, vom aktuellen Stand aus (unterbrechbar).
  function settle() {
    cancelAnimationFrame(rafRef.current);
    const from = offsetRef.current;
    if (!from || prefersReducedMotion()) {
      setOffset(0);
      return;
    }
    const t0 = performance.now();
    const omega = 22; // nach ~380 ms in Ruhe
    const frame = (now) => {
      const t = (now - t0) / 1000;
      if (t >= 0.38) {
        setOffset(0);
        return;
      }
      setOffset(from * (1 + omega * t) * Math.exp(-omega * t));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  // Einzelschritt (Tippen, Tastatur) mit Untergrenze — rollt sichtbar dorthin.
  function bump(delta) {
    const next = delta < 0 ? Math.max(Math.min(value, min), value + delta) : value + delta;
    if (next === value) return;
    cancelAnimationFrame(rafRef.current);
    pendingRef.current = offsetRef.current + ((next - value) / step) * DRUM_STEP_PX;
    sentRef.current = next;
    onChange(next - value);
  }

  // Ziehen: Schritte relativ zum Start, nach oben geht nur die Differenz.
  function applySteps(d, steps) {
    const diff = steps - d.applied;
    if (!diff) return;
    d.applied = steps;
    sentRef.current += diff * step;
    onChange(diff * step);
    stepFeedback();
  }

  function handlePointerDown(e) {
    if (editor || e.button !== 0) return;
    cancelAnimationFrame(rafRef.current);
    pendingRef.current = null;
    const startOffset = offsetRef.current;
    dragRef.current = {
      id: e.pointerId,
      yStart: e.clientY,
      y0: e.clientY - startOffset,
      // Nicht unter die Untergrenze; liegt der Wert schon darunter, nicht hochzwingen.
      minSteps: Math.min(0, Math.ceil((min - value) / step - 1e-9)),
      applied: 0,
      active: false,
      samples: [{ y: e.clientY, t: e.timeStamp }],
    };
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      // Erst ab ~8px ist es ein Ziehen — sonst bleibt es ein Tippen.
      if (Math.abs(e.clientY - d.yStart) < 8) return;
      d.active = true;
      // Kann werfen, wenn iOS den Touch schon abgebrochen hat — dann ohne Capture weiter.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* Pointer nicht mehr aktiv */
      }
    }
    const dy = e.clientY - d.y0;
    const raw = Math.round(-dy / DRUM_STEP_PX);
    const steps = Math.max(d.minSteps, raw);
    applySteps(d, steps);
    if (!prefersReducedMotion()) {
      const rest = dy + steps * DRUM_STEP_PX;
      setOffset(raw < d.minSteps ? rubberBand(rest, DRUM_STEP_PX * 2) : rest);
    }
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  }

  function handlePointerEnd(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    if (!d.active) return;
    if (e.type === 'pointerup') {
      // Schwung hochrechnen (Apples Formel, Verzögerung 0.998), gedeckelt.
      const recent = d.samples.filter((s) => e.timeStamp - s.t < 100);
      const first = recent[0] ?? d.samples[0];
      const dt = e.timeStamp - first.t;
      const v = dt > 0 ? ((e.clientY - first.y) / dt) * 1000 : 0; // px/s
      const projected = ((v / 1000) * 0.998) / (1 - 0.998);
      const flick = Math.max(-DRUM_MAX_FLICK_STEPS, Math.min(DRUM_MAX_FLICK_STEPS, Math.round(-projected / DRUM_STEP_PX)));
      if (Math.abs(v) > 300 && flick) {
        const before = d.applied;
        applySteps(d, Math.max(d.minSteps, d.applied + flick));
        // Die letzten Schritte sichtbar auslaufen lassen (max. zwei Zeilen).
        const moved = Math.max(-2, Math.min(2, d.applied - before));
        if (moved) pendingRef.current = offsetRef.current + moved * DRUM_STEP_PX;
      }
    }
    suppressClickUntil.current = performance.now() + 400;
    if (pendingRef.current == null) settle();
  }

  // Tippen: obere/untere Zeile rollt einen Schritt, Mitte öffnet die Eingabe.
  function handleClick(e) {
    if (editor || performance.now() < suppressClickUntil.current) return;
    const box = rootRef.current.getBoundingClientRect();
    const y = e.clientY - (box.top + box.height / 2);
    if (y < -DRUM_STEP_PX / 2) bump(-step);
    else if (y > DRUM_STEP_PX / 2) bump(step);
    else onEdit();
  }

  function handleKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    const map = { ArrowUp: step, ArrowDown: -step, PageUp: step * 5, PageDown: -step * 5 };
    if (map[e.key] != null) {
      e.preventDefault();
      bump(map[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit();
    }
  }

  return (
    <div
      ref={rootRef}
      className={`fx-drum${nudge ? ' is-nudge' : ''}`}
      role="spinbutton"
      tabIndex={editor ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuetext={`${display} ${ariaUnit}`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
    >
      {editor ? (
        <div className="fx-edit">{editor}</div>
      ) : (
        <div className="fx-strip" aria-hidden="true">
          {DRUM_SLOTS.map((k, i) => {
            const v = value + k * step;
            return (
              <span key={k} ref={(el) => (itemRefs.current[i] = el)} className="fx-num" style={{ fontSize: numSize }}>
                {v >= min - 1e-9 ? fmtNum(v) : ''}
                <span className="fx-unit">{unit}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Direkte Eingabe: der Entwurf lebt lokal, damit halb getippte Werte
// ("1" auf dem Weg zu "12") nicht sofort in den Satz wandern.
function NumberEditor({ value, ariaLabel, onCommit, onDone }) {
  // Leerer Entwurf + Platzhalter statt Select-All: Tippen ersetzt den Wert,
  // ohne dass iOS eine Textmarkierung mit Griffen über die Zahl legt.
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const lastValue = useRef(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Nur eine echte Wertänderung schreibt in den Entwurf — sonst wäre der
  // leere Startzustand nach dem ersten Effect-Lauf wieder überschrieben.
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    setDraft(String(value ?? ''));
  }, [value]);

  function commit() {
    const parsed = Number(String(draft).replace(',', '.'));
    if (Number.isFinite(parsed) && String(draft).trim() !== '') onCommit(parsed);
    else setDraft('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      commit();
      onDone();
    } else if (e.key === 'Escape') {
      setDraft('');
      onDone();
    }
  }

  const placeholder = fmtNum(value);
  const shown = draft === '' ? placeholder : draft;
  const fontSize = shown.length > 4 ? 40 : shown.length > 3 ? 48 : 60;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="number-editor-input"
      style={{
        width: Math.max(72, Math.ceil(shown.length * fontSize * 0.62)),
        maxWidth: '100%',
        height: 63,
        background: 'none',
        border: 'none',
        borderBottom: '2px solid var(--primary)',
        borderRadius: 0,
        padding: 0,
        textAlign: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize,
        lineHeight: 1.05,
        letterSpacing: '-0.02em',
        color: 'var(--text)',
        caretColor: 'var(--primary)',
        outline: 'none',
      }}
    />
  );
}
