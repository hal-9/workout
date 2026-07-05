import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Logo from './Logo.jsx';

export default function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch {
      // Cookie ist ggf. schon ungültig — trotzdem lokal ausloggen.
    }
    queryClient.clear();
    navigate('/login', { replace: true });
  }

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
        <button
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
