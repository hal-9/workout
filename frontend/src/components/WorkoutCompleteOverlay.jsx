import { useEffect, useRef, useState } from 'react';
import { completionHeadline, easeOutCubic, particleLayout, shouldCountUp } from '../lib/completion.js';
import { useScrollLock } from '../lib/scrollLock.js';
import { formatRecordValue } from '../lib/records.js';
import { playWorkoutComplete } from '../lib/workoutSounds.js';
import { shareCard, shareCardColors } from '../lib/shareCard.js';
import Button from './ui/Button.jsx';

const PARTICLES = particleLayout(14);
const COUNT_UP_MS = 700;
// Erst wenn die Pille zum Screen aufgegangen ist, startet der Rest.
const STAGE_DELAY = 560;

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
    const start = performance.now() + STAGE_DELAY + 160;
    const tick = (now) => {
      const progress = Math.max(0, (now - start) / COUNT_UP_MS);
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
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}> {unit}</span>}
      </div>
      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{label}</div>
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
      className="stage stage-open"
      style={{
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px)',
        cursor: 'pointer',
      }}
    >
      {/* Der Hauptbutton wird zum Screen: dasselbe Mesh, nur groß. */}
      <span className="mesh mesh-stage" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>

      <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: 112,
            height: 112,
            margin: '0 auto 22px',
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
              background: 'color-mix(in srgb, var(--m-ink) 35%, transparent)',
              pointerEvents: 'none',
              animationDelay: `${STAGE_DELAY + 220}ms`,
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
                background: particle.accent ? 'var(--m-ink)' : 'var(--m4)',
                opacity: 0,
                pointerEvents: 'none',
                '--dx': `${particle.dx * 1.4}px`,
                '--dy': `${particle.dy * 1.4}px`,
                animationDelay: `${STAGE_DELAY + particle.delay}ms`,
              }}
            />
          ))}

          <svg width="112" height="112" viewBox="0 0 80 80" aria-hidden="true" style={{ position: 'relative' }}>
            <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="var(--m-ink)" strokeOpacity="0.22" strokeWidth="2.5" />
            <circle
              className="wc-ring"
              cx="40"
              cy="40"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--m-ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH}
              transform="rotate(-90 40 40)"
              style={{ animationDelay: `${STAGE_DELAY}ms` }}
            />
            <path
              className="wc-check"
              d={CHECK_PATH}
              fill="none"
              stroke="var(--m-ink)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={CHECK_LENGTH}
              strokeDashoffset={CHECK_LENGTH}
              style={{ animationDelay: `${STAGE_DELAY + 260}ms` }}
            />
          </svg>
        </div>

        <h2 className="stage-title stage-rise" style={{ fontSize: 34, marginBottom: 6, '--delay': '520ms' }}>
          {completionHeadline(records)}
        </h2>
        <p className="stage-rise" style={{ margin: '0 0 28px', fontSize: 15, color: 'color-mix(in srgb, var(--m-ink) 85%, transparent)', '--delay': '600ms' }}>
          {stats?.exercises
            ? `${stats.exercises} Übung${stats.exercises === 1 ? '' : 'en'} abgeschlossen`
            : 'Session gespeichert'}
          {stats?.cooldown_sets ? ' · Cooldown erledigt' : ''}
        </p>

        <div className="stage-rise" style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: records.length ? 22 : 8, '--delay': '680ms' }}>
          <Stat label="Sätze" value={sets} />
          {(stats?.tonnage_kg ?? 0) > 0 && <Stat label="Tonnage" value={tonnage} unit="kg" />}
          {(stats?.duration_min ?? 0) > 0 && <Stat label="Dauer" value={minutes} unit="min" />}
        </div>

        {records.length > 0 && (
          <div className="stage-rise" style={{ '--delay': '760ms' }}>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '2px 14px',
                borderRadius: 20,
                textAlign: 'left',
                background: 'color-mix(in srgb, var(--m-ink) 14%, transparent)',
              }}
            >
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
                    <StarIcon />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {formatRecordValue(record.kind, record.value)}
                  </span>
                </li>
              ))}
            </ul>
            {records.length > 3 && (
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>+{records.length - 3} weitere</div>
            )}
          </div>
        )}

        <div className="stage-rise" style={{ '--delay': '860ms' }}>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleShare}
            disabled={sharing}
            className="btn btn-veil"
            style={{ marginTop: 26, fontSize: 15 }}
          >
            {sharing ? 'Bild wird erstellt…' : 'Als Bild teilen'}
          </Button>

          <Button
            variant="secondary"
            fullWidth
            onClick={(e) => { e.stopPropagation(); onDone(); }}
            className="btn btn-ink"
            style={{ marginTop: 12, minHeight: 52 }}
          >
            Zur Auswertung
          </Button>
        </div>
      </div>
    </div>
  );
}
