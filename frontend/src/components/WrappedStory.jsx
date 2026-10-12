import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { formatRecordValue } from '../lib/records.js';
import TrainingTree from './TrainingTree.jsx';
import { useScrollLock } from '../lib/scrollLock.js';
import '../styles/kal.css';

const MuscleBody3D = lazy(() => import('./MuscleBody3D.jsx'));

const BACK_ZONES = ['ruecken', 'unterer_ruecken', 'gesaess', 'hamstrings', 'waden', 'trizeps'];

export function monthLabel(month) {
  const d = new Date(`${month}-01T00:00:00Z`);
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const bigNumber = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 84,
  lineHeight: 1,
  letterSpacing: -2,
};

// Ruhige Fläche auf dem Mesh, damit Baum und Körper ihre eigenen Farben behalten.
const panel = {
  width: '100%',
  borderRadius: 24,
  padding: 12,
  background: 'var(--bg)',
  color: 'var(--text)',
  textShadow: 'none',
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

function Slide({ kicker, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, flex: 1, textAlign: 'center', padding: '0 28px' }}>
      {kicker && (
        <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.85 }}>{kicker}</div>
      )}
      {children}
    </div>
  );
}

// Fullscreen-Story auf der Mesh-Bühne: Tap rechts = weiter, links = zurück.
// Markiert den Monat beim Öffnen als gesehen (Banner verschwindet auch bei Abbruch).
export default function WrappedStory({ month, onClose }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  useScrollLock();

  const { data } = useQuery({
    queryKey: ['wrapped', month],
    queryFn: () => api.get(`/wrapped?month=${month}`),
  });
  const { data: treeData } = useQuery({
    queryKey: ['stats-tree'],
    queryFn: () => api.get('/stats/tree'),
    retry: false,
  });

  useEffect(() => {
    api.post(`/wrapped/${month}/seen`).catch(() => {});
    return () => queryClient.invalidateQueries({ queryKey: ['wrapped-latest'] });
  }, [month, queryClient]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slides = useMemo(() => {
    if (!data) return [];
    const list = [];
    list.push(
      <Slide key="intro" kicker={`Dein Rückblick · ${monthLabel(month)}`}>
        <div style={bigNumber}>{data.workouts}</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          Workout{data.workouts === 1 ? '' : 's'} in {data.weeks_grown} Woche{data.weeks_grown === 1 ? '' : 'n'}
        </div>
      </Slide>
    );
    if (data.tonnage_kg > 0) {
      const prev = data.tonnage_prev_kg;
      const delta = prev > 0 ? Math.round((data.tonnage_kg / prev - 1) * 100) : null;
      list.push(
        <Slide key="tonnage" kicker="Bewegt">
          <div style={bigNumber}>{data.tonnage_kg.toLocaleString('de-DE')}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Kilogramm gestemmt</div>
          {delta != null && (
            <div style={{ fontSize: 16, opacity: 0.85 }}>
              {delta >= 0 ? '+' : ''}
              {delta} % vs. Vormonat
            </div>
          )}
        </Slide>
      );
    }
    if (data.top_pr) {
      list.push(
        <Slide key="pr" kicker="Stärkster Moment">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 30, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            <StarIcon />
            {data.top_pr.name}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>
            {formatRecordValue(data.top_pr.kind, data.top_pr.previous)} → {formatRecordValue(data.top_pr.kind, data.top_pr.value)}
          </div>
        </Slide>
      );
    }
    if (data.top_zone) {
      const view = BACK_ZONES.includes(data.top_zone.zone) ? 'back' : 'front';
      list.push(
        <Slide key="zone" kicker="Muskel des Monats">
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{data.top_zone.label}</div>
          <div style={{ ...panel, maxWidth: 300 }}>
            <Suspense fallback={<div style={{ height: 260 }} />}>
              <MuscleBody3D primary={[data.top_zone.zone]} view={view} height={260} interactive={false} />
            </Suspense>
          </div>
          <div style={{ fontSize: 16, opacity: 0.85 }}>
            {data.top_zone.sets} Sätze
          </div>
        </Slide>
      );
    }
    list.push(
      <Slide key="tree" kicker="Dein Baum">
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          +{data.weeks_grown} {data.weeks_grown === 1 ? 'Ast' : 'Äste'} gewachsen
        </div>
        <div style={{ ...panel, maxWidth: 320, textAlign: 'left' }}>
          {treeData && <TrainingTree weeks={treeData.weeks} />}
        </div>
      </Slide>
    );
    return list;
  }, [data, treeData, month]);

  const last = index >= slides.length - 1;

  function advance(e) {
    const x = e.clientX ?? 0;
    const goBack = x < window.innerWidth / 3;
    if (goBack) {
      setIndex((i) => Math.max(0, i - 1));
    } else if (last) {
      onClose();
    } else {
      setIndex((i) => Math.min(slides.length - 1, i + 1));
    }
  }

  return (
    <div
      onClick={advance}
      className="stage stage-open"
      style={{
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Der eine festliche Ort: das Mesh als ganze Bühne. */}
      <span className="mesh mesh-stage" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <div style={{ display: 'flex', gap: 5, padding: '14px 16px 0' }}>
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: 'var(--m-ink)',
              opacity: i <= index ? 0.95 : 0.3,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Schließen"
          className="btn kal-story-close"
          style={{
            border: 'none',
            borderRadius: 999,
            width: 44,
            height: 44,
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* key = index: jede Folie kommt neu aus der Unschärfe; die erste erst, wenn die Pille offen ist. */}
      <div key={index} className="stage-rise" style={{ flex: 1, display: 'flex', '--delay': index === 0 ? '420ms' : '0ms' }}>
        {slides.length ? slides[Math.min(index, slides.length - 1)] : <Slide>Lade…</Slide>}
      </div>

      <div style={{ textAlign: 'center', padding: '0 0 22px', fontSize: 13, opacity: 0.8 }}>
        {last ? 'Tippen zum Schließen' : 'Tippen für mehr'}
      </div>
    </div>
  );
}
