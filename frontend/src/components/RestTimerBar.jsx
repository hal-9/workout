import { extendRestTimer, pauseRestTimer, remainingSeconds, resumeRestTimer } from '../lib/restTimer.js';
import Chip from './ui/Chip.jsx';

export default function RestTimerBar({
  timerState,
  onSkip,
  onChange,
  soundOn,
  onToggleSound,
  defaultDuration,
  onChangeDefault,
}) {
  if (!timerState) return null;

  const seconds = remainingSeconds(timerState);
  const paused = Boolean(timerState.pausedAtMs);

  const handleAdd30 = () => onChange(extendRestTimer(timerState, 30));
  const handlePause = () => onChange(paused ? resumeRestTimer(timerState) : pauseRestTimer(timerState));

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Pause: ${seconds} Sekunden`}
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
        borderRadius: 14,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 22,
          color: seconds <= 5 ? 'var(--accent)' : 'var(--primary)',
          minWidth: 44,
          textAlign: 'center',
        }}
      >
        {seconds}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip onClick={handleAdd30} ariaLabel="30 Sekunden hinzufügen">+30s</Chip>
        <Chip onClick={handlePause} ariaLabel={paused ? 'Pause fortsetzen' : 'Pause anhalten'}>
          {paused ? '▶' : '⏸'}
        </Chip>
        <Chip onClick={onToggleSound} ariaLabel={soundOn ? 'Ton aus' : 'Ton an'}>
          {soundOn ? '🔊' : '🔇'}
        </Chip>
        {[60, 90, 120].map((d) => (
          <Chip
            key={d}
            active={d === defaultDuration}
            onClick={() => onChangeDefault(d)}
            ariaLabel={`Standardpause ${d} Sekunden`}
          >
            {d}s
          </Chip>
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        aria-label="Pause überspringen"
        style={{
          background: 'var(--primary-grad)',
          color: 'var(--on-primary)',
          border: 'none',
          borderRadius: 10,
          padding: '8px 12px',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          minHeight: 36,
        }}
      >
        Weiter
      </button>
    </div>
  );
}
