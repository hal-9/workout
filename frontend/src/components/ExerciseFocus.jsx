import { useEffect, useRef, useState } from 'react';
import { durationUnitLabel, formatDuration, fromInputValue, toInputValue } from 'shared/duration';
import { parseTargetReps } from '../lib/exerciseCompare.js';
import {
  REST_DEFAULT_SECONDS,
  extendRestTimer,
  pauseRestTimer,
  remainingSeconds,
  resumeRestTimer,
  startRestTimer,
} from '../lib/restTimer.js';
import { equipmentLabel, stepForExercise } from '../lib/equipment.js';
import { playRestEnd, playTick, unlockAudio } from '../lib/workoutSounds.js';
import { useScrollLock } from '../lib/scrollLock.js';

const HOLD_PREP_SECONDS = 3;

const CURRENT_ACCENT = 'var(--accent)';

const secondaryBtnStyle = {
  flex: 1,
  height: 44,
  borderRadius: 14,
  border: 'none',
  background: 'var(--surface2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'var(--font-mono)',
  color: 'var(--accent)',
  fontSize: 11,
  cursor: 'pointer',
};

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
  onAddExtraSet,
  onStartRestTimer,
  onOpenMuscle,
  onOpenDetail,
  onSwap,
  onNext,
  onPrev,
}) {
  const [phase, setPhase] = useState('entering');
  useScrollLock();
  const [editing, setEditing] = useState(null); // null | 'big' | 'kg'
  // Nachträglich einen erledigten Satz ansehen/ändern: null = aktueller offener Satz.
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [justLogged, setJustLogged] = useState(false);
  const [holdPhase, setHoldPhase] = useState(null); // null | 'prep' | 'hold'
  const [holdTimerState, setHoldTimerState] = useState(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const closeTimeoutRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const editAreaRef = useRef(null);
  const touchStartRef = useRef(null);
  const wakeLockRef = useRef(null);
  // Dauer des laufenden Halte-Timers — vom aktuellen Satz (bearbeitete große
  // Zahl), nicht vom Plan-Ziel, sonst zählt der Timer die alte Dauer.
  const holdSecondsRef = useRef(0);

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
        setEditing(null);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [editing]);

  if (!viewRow) return null;

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
  const unitLabel = isDurationType ? durationUnitLabel(exercise.type) : 'Wdh.';
  const bigUnit = unitLabel.replace('.', '').toUpperCase();
  const kgValue = kgValueFor(viewRow);
  const holdSeconds = isDurationType ? fromInputValue(bigValue, exercise.type) ?? 0 : 0;
  const canHoldTimer = holdSeconds > 0;
  const weightStep = stepForExercise(exercise);
  // Lange Namen drückten bisher alles nach unten — kleinere Stufe statt Umbruch auf drei Zeilen.
  const nameFontSize = exercise.name.length > 34 ? 24 : exercise.name.length > 22 ? 28 : 32;
  const targetLabel = isDurationType
    ? exercise.target_seconds
      ? `${exercise.sets} × ${toInputValue(exercise.target_seconds, exercise.type)} ${unitLabel}`
      : null
    : exercise.target_reps
      ? `${exercise.sets} × ${exercise.target_reps}`
      : null;
  const setupLabel = [equipmentLabel(exercise), targetLabel].filter(Boolean).join(' · ') || null;
  // Viele Sätze: Trefferfläche schrumpft auf 26px (WCAG 2.5.8 will 24), erst
  // danach bricht die Reihe um.
  const dotWidth = rows.length > 7 ? 26 : 32;
  const nextRow = rows[activeIndex];
  const nextSetPreview = nextRow
    ? [`${bigValueFor(nextRow)} ${unitLabel}`, isWeighted && kgValueFor(nextRow) !== '' ? `${kgValueFor(nextRow)} kg` : null]
        .filter(Boolean)
        .join(' × ')
    : '';
  const ctaMuted = restTimerActive || holdPhase;

  function selectDot(i) {
    if (rows[i].logged) {
      setEditing(null);
      setSelectedIndex(i);
    } else if (i === activeIndex) {
      setEditing(null);
      setSelectedIndex(null);
    }
  }

  return (
    <div
      className={phase === 'closing' ? 'fx-exit' : 'fx-enter'}
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        zIndex: 60,
        background: 'var(--focus-bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Fokus schließen"
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 10px',
            margin: '-4px -10px',
            borderRadius: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--muted)',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          ✕
        </button>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {segments.map((status, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 5,
                borderRadius: 999,
                background: status === 'done' ? 'var(--success)' : status === 'current' ? CURRENT_ACCENT : 'var(--line)',
              }}
            />
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>
          {elapsedLabel}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase' }}>
          ÜBUNG {index + 1}/{total} · {exercise.muscle}
        </div>
        <div style={{ marginTop: 10, maxWidth: 320, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: nameFontSize, lineHeight: 1.1, letterSpacing: -0.5, textWrap: 'balance' }}>
          {exercise.name}
        </div>
        {setupLabel && (
          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>
            {setupLabel}
          </div>
        )}
        {replacedFrom && (
          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            ⇄ statt {replacedFrom}
          </div>
        )}
        {compare.lastSummary && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Letzte: {compare.lastSummary}</div>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
          <button type="button" onClick={onOpenMuscle} style={{ ...linkStyle, fontSize: 15, fontWeight: 600 }}>Muskeln</button>
          <button type="button" onClick={onOpenDetail} style={{ ...linkStyle, fontSize: 15, fontWeight: 600 }}>Details</button>
          {onSwap && (
            <button type="button" onClick={onSwap} style={{ ...linkStyle, fontSize: 15, fontWeight: 600 }}>Tauschen</button>
          )}
        </div>

        <div ref={editAreaRef} style={{ marginTop: 32, display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {holdPhase ? (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 92, lineHeight: 1, minWidth: 100 }}>
                {holdPhase === 'prep' ? holdSecondsLeft : formatDuration(holdSecondsLeft)}
              </div>
            ) : editing === 'big' ? (
              <NumberEditor
                value={bigValue}
                fontSize={92}
                minWidth={100}
                step={1}
                ariaLabel={isDurationType ? 'Dauer' : 'Wiederholungen'}
                onStep={(delta) => onAdjustBigNumber(delta, viewIndex)}
                onCommit={(next) => onSetBigNumber(next, viewIndex)}
                onDone={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing('big')}
                style={{
                  background: reviewing ? 'none' : 'var(--primary-grad)',
                  WebkitBackgroundClip: reviewing ? undefined : 'text',
                  backgroundClip: reviewing ? undefined : 'text',
                  color: reviewing ? 'var(--success)' : 'transparent',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 92,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                {bigValue}
              </button>
            )}
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: reviewing ? 'var(--success)' : 'var(--muted)' }}>
              {holdPhase === 'prep'
                ? 'GLEICH GEHT’S LOS'
                : holdPhase === 'hold'
                  ? 'HALTEN'
                  : reviewing
                    ? `SATZ ${viewRow.set_number} ERLEDIGT · TIPPEN ZUM ÄNDERN`
                    : `${bigUnit} · TIPPEN ZUM ÄNDERN`}
            </div>
          </div>

          {isWeighted && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, color: 'var(--line)' }}>×</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {editing === 'kg' ? (
                  <NumberEditor
                    value={kgValue}
                    fontSize={44}
                    minWidth={64}
                    step={weightStep}
                    ariaLabel="Gewicht in Kilogramm"
                    onStep={(delta) => onAdjustWeight(delta, viewIndex)}
                    onCommit={(next) => onSetWeight(next, viewIndex)}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing('kg')}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, lineHeight: 1, color: 'var(--text)', cursor: 'pointer' }}
                  >
                    {kgValue}
                  </button>
                )}
                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}>
                  {editing === 'kg' ? `KG · ±${weightStep}` : 'KG'}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, alignItems: 'center' }}>
          {rows.map((row, i) => {
            const state = row.logged ? 'logged' : i === activeIndex ? 'current' : 'upcoming';
            const selectable = row.logged || i === activeIndex;
            const isViewed = i === viewIndex;
            return (
              // Der Punkt bleibt klein, die Trefferfläche ist 32×44 — mit
              // Schweiß an den Fingern ist 11px zu wenig.
              <button
                key={row.set_number}
                type="button"
                onClick={selectable ? () => selectDot(i) : undefined}
                disabled={!selectable}
                aria-label={`Satz ${row.set_number}${row.logged ? ' — erledigt, antippen zum Ansehen' : ''}`}
                aria-pressed={isViewed}
                style={{
                  width: dotWidth,
                  height: 44,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: selectable ? 'pointer' : 'default',
                }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    boxSizing: 'border-box',
                    background: state === 'logged' ? 'var(--success)' : 'transparent',
                    border: `2px solid ${state === 'logged' ? 'var(--success)' : state === 'current' ? CURRENT_ACCENT : 'var(--line)'}`,
                    // Angesehener Satz bekommt einen Ring, damit klar ist, welcher Wert oben steht.
                    boxShadow: isViewed && rows.length > 1 ? '0 0 0 3px var(--focus-bg), 0 0 0 4px var(--muted)' : 'none',
                    transition: 'background 200ms, border-color 200ms, box-shadow 150ms',
                  }}
                />
              </button>
            );
          })}
          <div style={{ marginLeft: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              SATZ {viewIndex + 1}/{rows.length}
            </span>
            <button type="button" onClick={onAddExtraSet} style={{ ...linkStyle, fontSize: 10 }}>+ Satz</button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '0 20px calc(26px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {restTimerActive ? (
          <RestPanel
            timerState={restTimerState}
            seconds={restSeconds}
            nextLabel={allLogged ? 'Übung erledigt' : `Danach: Satz ${nextRow.set_number} · ${nextSetPreview}`}
            onChange={onRestChange}
            onSkip={onRestSkip}
          />
        ) : reviewing ? (
          // Erledigten Satz ansehen: zurück zum offenen Satz bzw. Übung abschließen.
          <button
            type="button"
            onClick={allLogged ? requestClose : () => setSelectedIndex(null)}
            style={{
              height: 58,
              borderRadius: 18,
              border: '1px solid var(--primary)',
              background: 'var(--primary-dim)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 17,
              color: 'var(--primary)',
              cursor: 'pointer',
            }}
          >
            {allLogged ? 'Alle Sätze erledigt · Fertig ›' : `Weiter mit Satz ${activeIndex + 1} ›`}
          </button>
        ) : (
          <button
            type="button"
            onClick={canHoldTimer && !holdPhase ? () => handleStartHold(holdSeconds) : handleLogSet}
            disabled={disabled || restTimerActive || !!holdPhase}
            className={justLogged ? 'set-logged-pulse' : undefined}
            style={{
              height: 58,
              borderRadius: 18,
              border: 'none',
              background: justLogged ? 'var(--success)' : ctaMuted ? 'var(--surface2)' : 'var(--primary-grad)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 17,
              color: justLogged ? '#fff' : ctaMuted ? 'var(--muted)' : '#fff',
              boxShadow: justLogged
                ? '0 8px 30px rgba(52,211,153,.35)'
                : ctaMuted
                  ? 'none'
                  : '0 8px 30px rgba(236,72,153,.28)',
              cursor: disabled || ctaMuted ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              transition: 'background 250ms ease, box-shadow 250ms ease, color 250ms ease',
            }}
          >
            {justLogged
              ? 'Satz geschafft ✓'
              : holdPhase
                ? '⏱ Timer läuft …'
                : restTimerActive
                  ? '⏱ Pause läuft …'
                  : canHoldTimer
                    ? '▶ Start'
                    : 'Satz geschafft ✓'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {restTimerActive ? null : reviewing ? (
            <button
              type="button"
              onClick={() => onRemoveSet(viewIndex)}
              disabled={disabled}
              style={{ ...secondaryBtnStyle, color: 'var(--danger)', cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              Satz {viewRow.set_number} entfernen
            </button>
          ) : holdPhase ? (
            <button type="button" onClick={stopHold} style={{ ...secondaryBtnStyle, color: 'var(--muted)' }}>
              ✕ Abbrechen
            </button>
          ) : (
            <button type="button" onClick={onStartRestTimer} style={{ ...secondaryBtnStyle, color: 'var(--primary)' }}>
              ⏱ Pause {REST_DEFAULT_SECONDS}s
            </button>
          )}
          <button type="button" onClick={requestClose} style={{ ...secondaryBtnStyle, color: 'var(--muted)' }}>
            {reviewing ? 'Schließen' : 'Überspringen ›'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pause im Aktionsbereich statt als schwebende Leiste über dem Button: der
// Countdown ist hier das, was gerade zählt, samt Vorschau auf den nächsten Satz.
function RestPanel({ timerState, seconds, nextLabel, onChange, onSkip }) {
  const left = seconds ?? remainingSeconds(timerState);
  const total = timerState?.totalSeconds || left || 1;
  const progress = Math.max(0, Math.min(1, left / total));
  const paused = Boolean(timerState?.pausedAtMs);
  const ending = left <= 5;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Pause: ${left} Sekunden`}
      style={{
        borderRadius: 18,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, background: 'var(--surface2)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'var(--primary-grad)',
            transition: 'width 500ms linear',
          }}
        />
      </div>
      <div style={{ padding: '12px 16px 14px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: 2, color: 'var(--muted)' }}>
          {paused ? 'ANGEHALTEN' : 'PAUSE'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 52,
            lineHeight: 1.1,
            color: ending ? 'var(--accent)' : 'var(--primary)',
          }}
        >
          {left}s
        </div>
        <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{nextLabel}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => onChange(paused ? resumeRestTimer(timerState) : pauseRestTimer(timerState))}
            style={{ ...secondaryBtnStyle, color: 'var(--text)' }}
          >
            {paused ? '▶ Weiterlaufen' : '⏸ Anhalten'}
          </button>
          <button
            type="button"
            onClick={() => onChange(extendRestTimer(timerState, 30))}
            style={{ ...secondaryBtnStyle, color: 'var(--text)' }}
          >
            +30s
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{ ...secondaryBtnStyle, background: 'var(--primary-grad)', color: 'var(--on-primary)', fontWeight: 600 }}
          >
            Weiter ›
          </button>
        </div>
      </div>
    </div>
  );
}

// Direkte Eingabe statt nur Stepper: der Entwurf lebt lokal, damit halb
// getippte Werte ("1" auf dem Weg zu "12") nicht sofort in den Satz wandern.
function NumberEditor({ value, fontSize, minWidth, step, ariaLabel, onStep, onCommit, onDone }) {
  // Leerer Entwurf + Platzhalter statt Select-All: Tippen ersetzt den Wert,
  // ohne dass iOS eine Textmarkierung mit Griffen über die Zahl legt.
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const lastValue = useRef(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Nur eine echte Wertänderung (Stepper) schreibt in den Entwurf — sonst wäre
  // der leere Startzustand nach dem ersten Effect-Lauf wieder überschrieben.
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

  const shown = draft === '' ? String(value ?? '') : draft;
  const width = Math.max(minWidth, Math.ceil(shown.length * fontSize * 0.62));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <button type="button" aria-label={`${ariaLabel} verringern`} onClick={() => onStep(-step)} style={stepperStyle}>
        −
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={draft}
        placeholder={String(value ?? '')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="number-editor-input"
        style={{
          width,
          background: 'none',
          border: 'none',
          borderBottom: '2px solid var(--primary)',
          borderRadius: 0,
          padding: 0,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize,
          lineHeight: 1,
          color: 'var(--text)',
          caretColor: 'var(--primary)',
          outline: 'none',
        }}
      />
      <button type="button" aria-label={`${ariaLabel} erhöhen`} onClick={() => onStep(step)} style={stepperStyle}>
        +
      </button>
    </div>
  );
}

const stepperStyle = {
  width: 52,
  height: 52,
  borderRadius: 16,
  border: 'none',
  background: 'var(--surface2)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 24,
  color: 'var(--primary)',
  cursor: 'pointer',
};
