import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/heute', label: 'Heute' },
  { to: '/plan', label: 'Plan' },
  { to: '/fortschritt', label: 'Fortschritt' },
];

export default function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(20,22,27,.92)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              background: 'none',
              border: 'none',
              color: isActive ? 'var(--ember)' : 'var(--muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: 6,
              fontSize: 11,
              textDecoration: 'none',
              fontFamily: 'var(--font-display)',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
