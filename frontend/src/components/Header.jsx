import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { THEME_PALETTES } from 'shared/themes';
import { api } from '../api.js';
import Logo from './Logo.jsx';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import { getTheme, setTheme } from '../lib/theme.js';
import { isSoundEnabled, setSoundEnabled, unlockAudio } from '../lib/workoutSounds.js';

const ICON_BUTTON = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  color: 'var(--muted)',
  cursor: 'pointer',
};

const MENU_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  background: 'none',
  border: 'none',
  borderRadius: 12,
  color: 'var(--text)',
  font: 'inherit',
  fontSize: 14,
  textAlign: 'left',
  textDecoration: 'none',
  cursor: 'pointer',
};

function FriendsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SoundIcon({ on }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      )}
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function Switch({ on }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 42,
        height: 26,
        borderRadius: 13,
        padding: 3,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        background: on ? 'var(--primary-grad)' : 'var(--line)',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(0, 0, 0, 0.06)',
        transition: 'background 160ms ease',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        }}
      />
    </span>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const menuRef = useRef(null);
  const burgerRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [theme, setLocalTheme] = useState(getTheme);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/me'), retry: false });

  const saveTheme = useMutation({
    mutationFn: (next) => api.put('/me/theme', next),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });

  // Der Server ist die Quelle fuer das Geraet, das die Auswahl noch nicht kennt
  // (neues Handy, PWA neu installiert). Lokal gewaehlt wird sofort geschrieben,
  // deshalb kann das hier nur beim ersten /me auseinanderlaufen.
  const serverMode = me?.theme?.mode ?? null;
  const serverPalette = me?.theme?.palette ?? null;
  useEffect(() => {
    if (!serverMode || !serverPalette) return;
    if (serverMode === theme.mode && serverPalette === theme.palette) return;
    const next = { mode: serverMode, palette: serverPalette };
    setTheme(next);
    setLocalTheme(next);
  }, [serverMode, serverPalette]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handlePointer = (e) => {
      if (menuRef.current?.contains(e.target) || burgerRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pointerdown', handlePointer);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pointerdown', handlePointer);
    };
  }, [menuOpen]);

  function applyTheme(next) {
    setTheme(next);
    setLocalTheme(next);
    saveTheme.mutate(next);
  }

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch {
      // Cookie ist ggf. schon ungültig — trotzdem lokal ausloggen.
    }
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) unlockAudio();
  };

  return (
    <>
      <header
        className="glass"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          className="wrap"
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            to="/heute"
            aria-label="Zu Heute"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <Logo size={26} />
            <strong
              style={{
                fontSize: 17,
                fontWeight: 700,
                background: 'var(--primary-grad)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              LiLief
            </strong>
          </Link>

          <button
            ref={burgerRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menü"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            style={{ ...ICON_BUTTON, marginRight: -14 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        // Bewusst neben und nicht im <header>: ein backdrop-filter im
        // backdrop-filter bringt nichts, und das Menü braucht ohnehin einen
        // deckenden Grund — Glas über dem vollen Screen liest sich schlecht.
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--header-h) + env(safe-area-inset-top) + 6px)',
            left: 0,
            right: 0,
            zIndex: 45,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            className="wrap"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <div
              ref={menuRef}
              className="ed-sheet"
              role="menu"
              aria-label="Einstellungen"
              style={{
                pointerEvents: 'auto',
                width: 244,
                padding: 8,
                borderRadius: 16,
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <Link to="/freunde" role="menuitem" style={MENU_ROW} onClick={() => setMenuOpen(false)}>
                <FriendsIcon />
                Freunde
              </Link>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={soundOn}
                onClick={handleToggleSound}
                style={MENU_ROW}
              >
                <SoundIcon on={soundOn} />
                <span style={{ flex: 1 }}>Ton</span>
                <Switch on={soundOn} />
              </button>

              <div style={{ height: 1, background: 'var(--line)', margin: '6px 10px' }} />

              <div style={{ padding: '4px 12px 10px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Design
                </div>

                <div
                  role="group"
                  aria-label="Helligkeit"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 4,
                    padding: 3,
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                  }}
                >
                  {[
                    { id: 'light', label: 'Hell', glyph: '☀' },
                    { id: 'dark', label: 'Dunkel', glyph: '☾' },
                  ].map((option) => {
                    const active = theme.mode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => applyTheme({ ...theme, mode: option.id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          minHeight: 36,
                          padding: '6px 8px',
                          borderRadius: 9,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          background: active ? 'var(--primary-grad)' : 'transparent',
                          color: active ? 'var(--on-primary)' : 'var(--muted)',
                        }}
                      >
                        <span aria-hidden="true">{option.glyph}</span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  role="group"
                  aria-label="Farbthema"
                  style={{ display: 'flex', gap: 8, marginTop: 10 }}
                >
                  {THEME_PALETTES.map((palette) => {
                    const active = theme.palette === palette.id;
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        aria-label={palette.label}
                        aria-pressed={active}
                        title={palette.label}
                        onClick={() => applyTheme({ ...theme, palette: palette.id })}
                        style={{
                          width: 40,
                          height: 40,
                          padding: 3,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          background: 'none',
                          border: `2px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${palette.swatch[0]} 0%, ${palette.swatch[1]} 100%)`,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--line)', margin: '2px 10px 6px' }} />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmLogout(true);
                }}
                style={{ ...MENU_ROW, color: 'var(--danger)' }}
              >
                <LogoutIcon />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Abmelden?">
        <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--muted)' }}>
          Du wirst aus der App ausgeloggt und musst dich neu anmelden.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" fullWidth onClick={() => setConfirmLogout(false)}>
            Abbrechen
          </Button>
          <Button variant="danger" fullWidth onClick={handleLogout}>
            Abmelden
          </Button>
        </div>
      </Dialog>
    </>
  );
}
