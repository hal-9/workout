import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Logo from './Logo.jsx';
import { getTheme, setTheme } from '../lib/theme.js';

export default function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [theme, setCurrentTheme] = useState(getTheme);
  const dark = theme === 'dark';

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch {
      // Cookie ist ggf. schon ungültig — trotzdem lokal ausloggen.
    }
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const handleToggleTheme = () => {
    const nextTheme = dark ? 'light' : 'dark';
    setTheme(nextTheme);
    setCurrentTheme(nextTheme);
  };

  return (
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
        style={{
          maxWidth: 560,
          margin: '0 auto',
          height: 52,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link
            to="/freunde"
            aria-label="Freunde"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontSize: 18,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label={dark ? 'Hellmodus' : 'Dunkelmodus'}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            {dark ? '☀' : '☾'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Abmelden"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
