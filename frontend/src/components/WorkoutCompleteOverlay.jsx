import { useEffect, useRef, useState } from 'react';
import { completionHeadline, easeOutCubic, particleLayout, shouldCountUp } from '../lib/completion.js';
import { formatRecordValue } from '../lib/records.js';
import { playWorkoutComplete } from '../lib/workoutSounds.js';

const PARTICLES = particleLayout(14);
const COUNT_UP_MS = 700;
const HOLD_MS = 1400;
const HOLD_WITH_RECORDS_MS = 2400;

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
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--text)' }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: 'var(--muted)' }}> {unit}</span>}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function WorkoutCompleteOverlay({ stats, records = [], onDone }) {
  const [reduced] = useState(prefersReducedMotion);
  const animate = !reduced;

  const sets = useCountUp(stats?.sets ?? 0, animate);
  const tonnage = useCountUp(stats?.tonnage_kg ?? 0, animate);
  const minutes = useCountUp(stats?.duration_min ?? 0, animate);

  useEffect(() => {
    playWorkoutComplete();
  }, []);

  useEffect(() => {
    const hold = records.length ? HOLD_WITH_RECORDS_MS : HOLD_MS;
    const timer = setTimeout(onDone, reduced ? 700 : hold);
    return () => clearTimeout(timer);
  }, [onDone, records.length, reduced]);

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
        background: 'rgba(246, 242, 251, 0.72)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        cursor: 'pointer',
      }}
    >
      <div
        className="wc-card glass"
        style={{
          borderRadius: 24,
          padding: '28px 24px 24px',
          width: '100%',
          maxWidth: 340,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 88,
            height: 88,
            margin: '0 auto 14px',
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
              background:
                'radial-gradient(circle, rgba(139, 92, 246, 0.45), rgba(236, 72, 153, 0.18) 55%, transparent 72%)',
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

          <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'relative' }}>
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

        <h2 style={{ margin: '0 0 4px', fontSize: 21 }}>{completionHeadline(records)}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>
          {stats?.exercises
            ? `${stats.exercises} Übung${stats.exercises === 1 ? '' : 'en'} abgeschlossen`
            : 'Session gespeichert'}
          {stats?.cooldown_sets ? ' · Cooldown erledigt' : ''}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: records.length ? 18 : 4 }}>
          <Stat label="Sätze" value={sets} />
          {(stats?.tonnage_kg ?? 0) > 0 && <Stat label="Tonnage" value={tonnage} unit="kg" />}
          {(stats?.duration_min ?? 0) > 0 && <Stat label="Dauer" value={minutes} unit="min" />}
        </div>

        {records.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.slice(0, 3).map((record) => (
              <div
                key={record.exercise_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'var(--primary-dim)',
                  borderRadius: 11,
                  padding: '8px 11px',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ★ {record.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  {formatRecordValue(record.kind, record.value)}
                </span>
              </div>
            ))}
            {records.length > 3 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                +{records.length - 3} weitere
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
