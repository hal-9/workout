import { formatTargetLabel } from '../lib/exerciseCompare.js';
import { demoSearchUrl } from '../lib/exerciseLibrary.js';
import { formatRecordValue, primaryBest } from '../lib/records.js';

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '9px 0',
  borderTop: '1px solid var(--line)',
  fontSize: 13,
};

const labelStyle = { color: 'var(--muted)' };
const valueStyle = { fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' };

export default function ExerciseDetailSheet({ exercise, best, onClose }) {
  if (!exercise) return null;

  const target = formatTargetLabel(exercise);
  const bestValue = primaryBest(best);

  return (
    <div
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose();
      }}
      aria-label="Details schließen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(46, 36, 64, 0.28)',
        WebkitBackdropFilter: 'blur(6px)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ed-sheet glass"
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          borderRadius: '20px 20px 0 0',
          padding: '18px 18px calc(18px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>{exercise.name}</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {exercise.muscle}
              {exercise.phase === 'cooldown' && ' · Cooldown'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              width: 32,
              height: 32,
              color: 'var(--muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {exercise.cue && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text)',
              margin: '12px 0 4px',
              paddingLeft: 11,
              borderLeft: '2px solid var(--primary)',
            }}
          >
            {exercise.cue}
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          {target && (
            <div style={rowStyle}>
              <span style={labelStyle}>Ziel</span>
              <span style={valueStyle}>{target}</span>
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle}>Geplante Sätze</span>
            <span style={valueStyle}>{exercise.sets}</span>
          </div>
          {bestValue && (
            <div style={rowStyle}>
              <span style={labelStyle}>Bestwert</span>
              <span style={{ ...valueStyle, color: 'var(--primary)' }}>
                {formatRecordValue(bestValue.kind, bestValue.value)}
                {best?.sessions_count ? ` · ${best.sessions_count}×` : ''}
              </span>
            </div>
          )}
          {best?.max_e1rm != null && exercise.type === 'wt' && (
            <div style={rowStyle}>
              <span style={labelStyle}>Geschätztes 1RM</span>
              <span style={valueStyle}>{formatRecordValue('e1rm', best.max_e1rm)}</span>
            </div>
          )}
        </div>

        <a
          href={demoSearchUrl(exercise)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 16,
            background: 'var(--surface2)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          Video-Demo suchen
        </a>
      </div>
    </div>
  );
}
