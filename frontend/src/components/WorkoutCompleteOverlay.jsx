import { useEffect, useRef, useState } from 'react';
import { completionHeadline, easeOutCubic, particleLayout, shouldCountUp } from '../lib/completion.js';
import { useScrollLock } from '../lib/scrollLock.js';
import { formatRecordValue } from '../lib/records.js';
import { playWorkoutComplete } from '../lib/workoutSounds.js';
import { shareCard, shareCardColors } from '../lib/shareCard.js';
import Button from './ui/Button.jsx';
import '../styles/kal.css';

const PARTICLES = particleLayout(14);
const COUNT_UP_MS = 700;

const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const CHECK_PATH = 'M27 41 L36 50 L53 31';
const CHECK_LENGTH = 42;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

// Zahlen laufen einmal hoch — reduzierte Bewegung überspringt die Animation.
function useCountUp(target, animate) {
  const enabled = animate && shouldCountUp(target);
  const [value, setValue] = useState(enabled ? 0 : target);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = (now - start) / COUNT_UP_MS;
      if (progress >= 1) {
        setValue(target);
        return;
      }
      setValue(Math.round(target * easeOutCubic(progress)));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, enabled]);

  return value;
}

function Stat({ label, value, unit }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 62 }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}> {unit}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Rekord-Stern als Linien-Icon statt ★-Glyphe.
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

export default function WorkoutCompleteOverlay({ stats, records = [], dayName, onDone }) {
  const [reduced] = useState(prefersReducedMotion);
  useScrollLock();
  const animate = !reduced;
  const [sharing, setSharing] = useState(false);

  const sets = useCountUp(stats?.sets ?? 0, animate);
  const tonnage = useCountUp(stats?.tonnage_kg ?? 0, animate);
  const minutes = useCountUp(stats?.duration_min ?? 0, animate);

  useEffect(() => {
    playWorkoutComplete();
  }, []);

  async function handleShare(e) {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      await shareCard({
        colors: shareCardColors(),
        dayName: dayName || 'Workout',
        dateLabel: new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        stats,
        records,
      });
    } catch {
      /* Teilen ist optional */
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onDone();
      }}
      aria-label="Weiter zur Auswertung"
      className="wc-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
        cursor: 'pointer',
      }}
    >
      <div
        className="wc-card neu-raised"
        style={{
          borderRadius: 24,
          padding: '28px 20px 20px',
          width: '100%',
          maxWidth: 340,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="wc-bloom"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--primary-dim)',
              pointerEvents: 'none',
            }}
          />

          {PARTICLES.map((particle) => (
            <span
              key={particle.id}
              className="wc-particle"
              style={{
                position: 'absolute',
                width: particle.size,
                height: particle.size,
                borderRadius: '50%',
                background: particle.accent ? 'var(--accent)' : 'var(--primary)',
                opacity: 0,
                pointerEvents: 'none',
                '--dx': `${particle.dx}px`,
                '--dy': `${particle.dy}px`,
                animationDelay: `${particle.delay}ms`,
              }}
            />
          ))}

          {/* Ring zeichnet sich in einer eingelassenen Mulde: „erledigt" = eingelassen. */}
          <div
            className="neu-inset"
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              <circle
                className="wc-ring"
                cx="40"
                cy="40"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH}
                transform="rotate(-90 40 40)"
              />
              <path
                className="wc-check"
                d={CHECK_PATH}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_LENGTH}
                strokeDashoffset={CHECK_LENGTH}
              />
            </svg>
          </div>
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {completionHeadline(records)}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)' }}>
          {stats?.exercises
            ? `${stats.exercises} Übung${stats.exercises === 1 ? '' : 'en'} abgeschlossen`
            : 'Session gespeichert'}
          {stats?.cooldown_sets ? ' · Cooldown erledigt' : ''}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: records.length ? 18 : 4 }}>
          <Stat label="Sätze" value={sets} />
          {(stats?.tonnage_kg ?? 0) > 0 && <Stat label="Tonnage" value={tonnage} unit="kg" />}
          {(stats?.duration_min ?? 0) > 0 && <Stat label="Dauer" value={minutes} unit="min" />}
        </div>

        {records.length > 0 && (
          <>
            <ul className="kal-tray" style={{ padding: '2px 12px', borderRadius: 20, textAlign: 'left' }}>
              {records.slice(0, 3).map((record) => (
                <li
                  key={record.exercise_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 2px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 14 }}>
                    <span style={{ color: 'var(--primary)', display: 'flex' }}>
                      <StarIcon />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }}>
                    {formatRecordValue(record.kind, record.value)}
                  </span>
                </li>
              ))}
            </ul>
            {records.length > 3 && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>+{records.length - 3} weitere</div>
            )}
          </>
        )}

        <Button
          variant="secondary"
          fullWidth
          onClick={handleShare}
          disabled={sharing}
          style={{ marginTop: 20, fontSize: 15 }}
        >
          {sharing ? 'Bild wird erstellt…' : 'Als Bild teilen'}
        </Button>

        <Button fullWidth onClick={(e) => { e.stopPropagation(); onDone(); }} style={{ marginTop: 12, minHeight: 52 }}>
          Zur Auswertung
        </Button>
      </div>
    </div>
  );
}
