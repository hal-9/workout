import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';

const SLIDES = [
  {
    title: 'Willkommen bei LiLief',
    body: 'Dein Trainingstagebuch: Plan anlegen, Sätze abhaken, Fortschritt sehen. Kein Schnickschnack.',
    icon: null,
  },
  {
    title: '1. Plan anlegen',
    body: 'Nimm eine Vorlage oder bau dir deinen Plan selbst. Deine Trainingstage verteilt die App auf feste Wochentage — im Kalender siehst du, was wann dran ist.',
    icon: '🗓️',
  },
  {
    title: '2. Trainieren',
    body: 'Im Tab „Heute“ hakst du Satz für Satz ab. Gewicht und Wiederholungen sind vom letzten Mal vorbelegt. Pausentimer läuft mit, danach trägst du ein, wie schwer es war (RPE).',
    icon: '🏋️',
  },
  {
    title: '3. Fortschritt & Freunde',
    body: 'Kurven pro Übung, Rekorde und deine Trainingswochen auf einen Blick. Wer will, verbindet sich mit Freunden und sieht deren Fortschritt — nur nach gegenseitiger Bestätigung.',
    icon: '📈',
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function go(delta) {
    setIndex((current) => Math.min(SLIDES.length - 1, Math.max(0, current + delta)));
  }

  async function finish() {
    setBusy(true);
    try {
      const user = await api.post('/me/onboarded');
      queryClient.setQueryData(['me'], user);
    } catch {
      // Flag konnte nicht gesetzt werden — trotzdem reinlassen, sonst hängt
      // der neue Nutzer im Tutorial fest.
    }
    navigate('/plan', { replace: true });
  }

  function handleTouchEnd(e) {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
    setTouchStartX(null);
  }

  return (
    <div
      className="wrap"
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'calc(48px + env(safe-area-inset-top))',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <Logo size={56} />
      </div>

      {/* Fixe Mindesthoehe, damit Punkte und Button beim Blaettern nicht springen. */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div className="glass" style={{ width: '100%', minHeight: 300, borderRadius: 18, padding: 24 }}>
          {slide.icon && <div style={{ fontSize: 44, marginBottom: 12 }}>{slide.icon}</div>}
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 24,
              background: 'var(--primary-grad)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {slide.title}
          </h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--text)' }}>{slide.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, margin: '20px 0' }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Schritt ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              padding: 0,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              transition: 'width 160ms',
              background: i === index ? 'var(--primary)' : 'var(--line)',
            }}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => (isLast ? finish() : go(1))}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 13,
          padding: 15,
          fontWeight: 600,
          fontSize: 15,
          cursor: 'pointer',
          background: 'var(--primary-grad)',
          color: 'var(--on-primary)',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {isLast ? 'Plan anlegen' : 'Weiter'}
      </button>

      {!isLast && (
        <button
          type="button"
          onClick={finish}
          style={{
            marginTop: 10,
            padding: 12,
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Überspringen
        </button>
      )}
    </div>
  );
}
