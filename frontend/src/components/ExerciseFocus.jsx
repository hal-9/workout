import { useEffect, useRef, useState } from 'react';
import { durationUnitLabel, formatDuration, toInputValue } from 'shared/duration';
import { parseTargetReps } from '../lib/exerciseCompare.js';
import { REST_DEFAULT_SECONDS, remainingSeconds, startRestTimer } from '../lib/restTimer.js';
import { playRestEnd, playTick, unlockAudio } from '../lib/workoutSounds.js';

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
  onClose,
  onLogCurrentSet,
  onToggleDot,
  onAdjustBigNumber,
  onAdjustWeight,
  onAddExtraSet,
  onStartRestTimer,
  onOpenMuscle,
  onOpenDetail,
  onNext,
  onPrev,
}) {
  const [phase, setPhase] = useState('entering');
  const [editing, setEditing] = useState(null); // null | 'big' | 'kg'
  const [justLogged, setJustLogged] = useState(false);
  const [holdPhase, setHoldPhase] = useState(null); // null | 'prep' | 'hold'
  const [holdTimerState, setHoldTimerState] = useState(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const closeTimeoutRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const editAreaRef = useRef(null);
  const touchStartRef = useRef(null);
  const wakeLockRef = useRef(null);

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
        setHoldTimerState(startRestTimer(exercise.target_seconds));
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

  function handleStartHold() {
    if (disabled || restTimerActive || holdPhase) return;
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
  const activeRow = rows[activeIndex];

  useEffect(() => {
    setEditing(null);
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

  if (!activeRow) return null;

  const targetParsed = parseTargetReps(exercise.target_reps);
  const bigValue = isDurationType
    ? activeRow.duration !== '' && activeRow.duration != null
      ? activeRow.duration
      : toInputValue(exercise.target_seconds, exercise.type)
    : activeRow.reps !== '' && activeRow.reps != null
      ? activeRow.reps
      : targetParsed?.min ?? '';
  const bigUnit = isDurationType
    ? durationUnitLabel(exercise.type).replace('.', '').toUpperCase()
    : 'WDH';
  const kgValue = activeRow.weight_kg !== '' && activeRow.weight_kg != null ? activeRow.weight_kg : exercise.default_weight_kg ?? '';

  return (
    <div
      className={phase === 'closing' ? 'fx-exit' : 'fx-enter'}
      style={{
        position: 'fixed',
        inset: 0,
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
        <div style={{ marginTop: 10, maxWidth: 300, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, lineHeight: 1.1, letterSpacing: -0.5, textWrap: 'balance' }}>
          {exercise.name}
        </div>
        {compare.lastSummary && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Letzte: {compare.lastSummary}</div>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
          <button type="button" onClick={onOpenMuscle} style={{ ...linkStyle, fontSize: 15, fontWeight: 600 }}>Muskeln</button>
          <button type="button" onClick={onOpenDetail} style={{ ...linkStyle, fontSize: 15, fontWeight: 600 }}>Details</button>
        </div>

        <div ref={editAreaRef} style={{ marginTop: 32, display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {holdPhase ? (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 92, lineHeight: 1, minWidth: 100 }}>
                {holdPhase === 'prep' ? holdSecondsLeft : formatDuration(holdSecondsLeft)}
              </div>
            ) : editing === 'big' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button type="button" onClick={() => onAdjustBigNumber(-1)} style={stepperStyle}>−</button>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 92, lineHeight: 1, minWidth: 100 }}>{bigValue}</div>
                <button type="button" onClick={() => onAdjustBigNumber(1)} style={stepperStyle}>+</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('big')}
                style={{
                  background: 'var(--primary-grad)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
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
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}>
              {holdPhase === 'prep' ? 'GLEICH GEHT’S LOS' : holdPhase === 'hold' ? 'HALTEN' : `${bigUnit} · TIPPEN ZUM ÄNDERN`}
            </div>
          </div>

          {isWeighted && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, color: 'var(--line)' }}>×</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {editing === 'kg' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button type="button" onClick={() => onAdjustWeight(-2.5)} style={stepperStyle}>−</button>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, lineHeight: 1, minWidth: 60 }}>{kgValue}</div>
                    <button type="button" onClick={() => onAdjustWeight(2.5)} style={stepperStyle}>+</button>
                  </div>
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
                  KG
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 26, display: 'flex', gap: 8, alignItems: 'center' }}>
          {rows.map((row, i) => {
            const state = row.logged ? 'logged' : i === activeIndex ? 'current' : 'upcoming';
            return (
              <button
                key={row.set_number}
                type="button"
                onClick={row.logged ? () => onToggleDot(i) : undefined}
                disabled={!row.logged}
                aria-label={`Satz ${row.set_number}${row.logged ? ' — antippen zum Entfernen' : ''}`}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  padding: 0,
                  boxSizing: 'border-box',
                  background: state === 'logged' ? 'var(--success)' : 'transparent',
                  border: `2px solid ${state === 'logged' ? 'var(--success)' : state === 'current' ? CURRENT_ACCENT : 'var(--line)'}`,
                  cursor: row.logged ? 'pointer' : 'default',
                  transition: 'background 200ms, border-color 200ms',
                }}
              />
            );
          })}
          <div style={{ marginLeft: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              SATZ {Math.min(activeIndex + 1, rows.length)}/{rows.length}
            </span>
            <button type="button" onClick={onAddExtraSet} style={{ ...linkStyle, fontSize: 10 }}>+ Satz</button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: restTimerActive
            ? '0 20px calc(170px + env(safe-area-inset-bottom))'
            : '0 20px calc(26px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          transition: 'padding-bottom 150ms ease',
        }}
      >
        <button
          type="button"
          onClick={handleLogSet}
          disabled={disabled || restTimerActive || !!holdPhase}
          className={justLogged ? 'set-logged-pulse' : undefined}
          style={{
            height: 58,
            borderRadius: 18,
            border: 'none',
            background: justLogged
              ? 'var(--success)'
              : restTimerActive || holdPhase
                ? 'var(--surface2)'
                : 'var(--primary-grad)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 17,
            color: justLogged ? '#fff' : restTimerActive || holdPhase ? 'var(--muted)' : '#fff',
            boxShadow: justLogged
              ? '0 8px 30px rgba(52,211,153,.35)'
              : restTimerActive || holdPhase
                ? 'none'
                : '0 8px 30px rgba(236,72,153,.28)',
            cursor: disabled || restTimerActive || holdPhase ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            transition: 'background 250ms ease, box-shadow 250ms ease, color 250ms ease',
          }}
        >
          {!justLogged && restTimerActive
            ? '⏱ Pause läuft …'
            : !justLogged && holdPhase
              ? '⏱ Timer läuft …'
              : 'Satz geschafft ✓'}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {isDurationType && exercise.target_seconds > 0 && (
            <button
              type="button"
              onClick={holdPhase ? stopHold : handleStartHold}
              disabled={disabled || restTimerActive}
              style={{ ...secondaryBtnStyle, color: holdPhase ? 'var(--muted)' : 'var(--primary)' }}
            >
              {holdPhase ? '✕ Abbrechen' : '▶ Start'}
            </button>
          )}
          <button type="button" onClick={onStartRestTimer} disabled={!!holdPhase} style={{ ...secondaryBtnStyle, color: 'var(--primary)' }}>
            ⏱ Pause {REST_DEFAULT_SECONDS}s
          </button>
          <button type="button" onClick={requestClose} style={{ ...secondaryBtnStyle, color: 'var(--muted)' }}>
            Überspringen ›
          </button>
        </div>
      </div>
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
