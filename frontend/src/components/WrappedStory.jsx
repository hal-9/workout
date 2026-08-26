import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { formatRecordValue } from '../lib/records.js';
import TrainingTree from './TrainingTree.jsx';

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

function Slide({ kicker, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, flex: 1, textAlign: 'center', padding: '0 28px' }}>
      {kicker && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>
          {kicker}
        </div>
      )}
      {children}
    </div>
  );
}

// Fullscreen-Story im Stil der aktiven Palette: Tap rechts = weiter, links = zurück.
// Markiert den Monat beim Öffnen als gesehen (Banner verschwindet auch bei Abbruch).
export default function WrappedStory({ month, onClose }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);

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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, opacity: 0.85 }}>
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
          <div style={{ fontSize: 30, fontWeight: 700 }}>★ {data.top_pr.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}>
            {formatRecordValue(data.top_pr.kind, data.top_pr.previous)} → {formatRecordValue(data.top_pr.kind, data.top_pr.value)}
          </div>
        </Slide>
      );
    }
    if (data.top_zone) {
      const view = BACK_ZONES.includes(data.top_zone.zone) ? 'back' : 'front';
      list.push(
        <Slide key="zone" kicker="Muskel des Monats">
          <div style={{ fontSize: 30, fontWeight: 700 }}>{data.top_zone.label}</div>
          <div style={{ width: '100%', maxWidth: 300 }}>
            <Suspense fallback={<div style={{ height: 260 }} />}>
              <MuscleBody3D primary={[data.top_zone.zone]} view={view} height={260} interactive={false} />
            </Suspense>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, opacity: 0.85 }}>
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
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'left' }}>
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--primary-grad)',
        color: 'var(--on-primary)',
        cursor: 'pointer',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ display: 'flex', gap: 5, padding: '14px 16px 0' }}>
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: i <= index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px 0' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Schließen"
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            borderRadius: 999,
            width: 34,
            height: 34,
            color: 'inherit',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {slides.length ? slides[Math.min(index, slides.length - 1)] : <Slide>Lade…</Slide>}

      <div style={{ textAlign: 'center', padding: '0 0 22px', fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.75 }}>
        {last ? 'Tippen zum Schließen' : 'Tippen für mehr'}
      </div>
    </div>
  );
}
