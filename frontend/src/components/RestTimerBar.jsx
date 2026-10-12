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
      className="neu-raised"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--nav-h) + 8px + env(safe-area-inset-bottom))',
        left: 16,
        right: 16,
        maxWidth: 560,
        margin: '0 auto',
        zIndex: 65,
        background: 'var(--bg)',
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, margin: '0 16px', background: 'var(--line)', borderRadius: 2 }}>
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'var(--primary)',
            borderRadius: 2,
            transition: 'width 500ms linear',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ minWidth: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
            {paused ? 'Angehalten' : 'Pause'}
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 24,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: ending ? 'var(--primary)' : 'var(--text)',
            }}
          >
            {left}s
          </div>
        </div>
        <button type="button" onClick={handlePause} aria-label={paused ? 'Pause fortsetzen' : 'Pause anhalten'} className="btn btn-secondary" style={iconBtnStyle}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={paused ? 'M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z' : 'M9 6v12M15 6v12'} />
          </svg>
        </button>
        <button type="button" onClick={handleAdd30} aria-label="30 Sekunden hinzufügen" className="btn btn-secondary" style={{ ...iconBtnStyle, width: 'auto', padding: '0 14px', fontSize: 14 }}>
          +30 s
        </button>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Pause überspringen"
          className="btn btn-secondary"
          style={{ ...iconBtnStyle, width: 'auto', marginLeft: 'auto', padding: '0 18px', fontWeight: 600 }}
        >
          Weiter
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
