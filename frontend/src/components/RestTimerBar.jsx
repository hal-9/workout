import { extendRestTimer, pauseRestTimer, remainingSeconds, resumeRestTimer } from '../lib/restTimer.js';

export default function RestTimerBar({ timerState, seconds, onSkip, onChange }) {
  if (!timerState) return null;

  // `seconds` kommt aus dem laufenden Tick des Screens; ohne Tick bliebe die Zahl stehen.
  const left = seconds ?? remainingSeconds(timerState);
  const total = timerState.totalSeconds || left || 1;
  const progress = Math.max(0, Math.min(1, left / total));
  const paused = Boolean(timerState.pausedAtMs);
  const ending = left <= 5;

  const handleAdd30 = () => onChange(extendRestTimer(timerState, 30));
  const handlePause = () => onChange(paused ? resumeRestTimer(timerState) : pauseRestTimer(timerState));

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Pause: ${left} Sekunden`}
      style={{
        position: 'fixed',
        bottom: 'calc(var(--nav-h) + 8px + env(safe-area-inset-bottom))',
        left: 16,
        right: 16,
        maxWidth: 560,
        margin: '0 auto',
        zIndex: 65,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ minWidth: 56 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, color: 'var(--muted)', letterSpacing: 1 }}>
            {paused ? 'ANGEHALTEN' : 'PAUSE'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 24,
              lineHeight: 1.1,
              color: ending ? 'var(--accent)' : 'var(--primary)',
            }}
          >
            {left}s
          </div>
        </div>
        <button type="button" onClick={handlePause} aria-label={paused ? 'Pause fortsetzen' : 'Pause anhalten'} style={iconBtnStyle}>
          {paused ? '▶' : '⏸'}
        </button>
        <button type="button" onClick={handleAdd30} aria-label="30 Sekunden hinzufügen" style={{ ...iconBtnStyle, width: 'auto', padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          +30s
        </button>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Pause überspringen"
          style={{
            marginLeft: 'auto',
            background: 'var(--primary-grad)',
            color: 'var(--on-primary)',
            border: 'none',
            borderRadius: 12,
            padding: '0 16px',
            height: 40,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Weiter
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
