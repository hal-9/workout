import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';
import Button from '../components/ui/Button.jsx';

const SLIDES = [
  {
    title: 'Willkommen bei LiLief',
    body: 'Dein Trainingstagebuch: Plan anlegen, Sätze abhaken, Fortschritt sehen. Kein Schnickschnack.',
    icon: null,
  },
  {
    title: '1. Plan anlegen',
    body: 'Nimm eine Vorlage oder bau dir deinen Plan selbst. Deine Trainingstage verteilt die App auf feste Wochentage — im Kalender siehst du, was wann dran ist.',
    // Kalender
    icon: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
  },
  {
    title: '2. Trainieren',
    body: 'Im Tab „Heute“ hakst du Satz für Satz ab. Gewicht und Wiederholungen sind vom letzten Mal vorbelegt. Pausentimer läuft mit, danach trägst du ein, wie schwer es war (RPE).',
    // Hantel
    icon: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  },
  {
    title: '3. Fortschritt & Freunde',
    body: 'Kurven pro Übung, Rekorde und deine Trainingswochen auf einen Blick. Wer will, verbindet sich mit Freunden und sieht deren Fortschritt — nur nach gegenseitiger Bestätigung.',
    // Kurve nach oben
    icon: 'M4 16l5-5 4 4 7-7M15 8h5v5',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Logo size={44} />
        <span className="wordmark" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          LiLief
        </span>
      </div>

      {/* Fixe Mindesthoehe, damit Punkte und Button beim Blaettern nicht springen. */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div aria-live="polite" style={{ width: '100%', minHeight: 300, padding: '24px 4px' }}>
          {slide.icon && (
            <div
              className="neu-inset"
              aria-hidden="true"
              style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', marginBottom: 20, color: 'var(--primary)' }}
            >
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={slide.icon} />
              </svg>
            </div>
          )}
          <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {slide.title}
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>{slide.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Schritt ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            style={{
              width: 44,
              height: 44,
              padding: 0,
              border: 'none',
              background: 'none',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            {/* Aktiver Schritt: Akzent-Pille, sonst kleine Mulde */}
            <span
              style={{
                width: i === index ? 22 : 10,
                height: 10,
                borderRadius: 999,
                background: i === index ? 'var(--primary)' : 'var(--bg)',
                boxShadow: i === index ? 'none' : 'var(--shadow-inset-sm)',
                transition: 'width 160ms var(--ease)',
              }}
            />
          </button>
        ))}
      </div>

      <Button fullWidth disabled={busy} onClick={() => (isLast ? finish() : go(1))} style={{ minHeight: 52, fontSize: 16 }}>
        {isLast ? 'Plan anlegen' : 'Weiter'}
      </Button>

      {!isLast && (
        <Button variant="ghost" fullWidth onClick={finish} style={{ marginTop: 8, color: 'var(--muted)', fontWeight: 500 }}>
          Überspringen
        </Button>
      )}
    </div>
  );
}
