import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/heute', label: 'Heute', icon: 'calendar' },
  { to: '/kalender', label: 'Kalender', icon: 'grid' },
  { to: '/plan', label: 'Plan', icon: 'list' },
  { to: '/fortschritt', label: 'Fortschritt', icon: 'chart' },
];

function TabIcon({ type }) {
  if (type === 'calendar') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (type === 'grid') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (type === 'list') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default function BottomNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'var(--bg)',
        boxShadow: '0 -8px 16px -14px var(--neu-lo)',
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
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
            aria-current={undefined}
            style={({ isActive }) => ({
              // Aktiver Tab liegt als Ganzes erhaben — Icon und Label auf einem Knopf.
              margin: '0 6px',
              background: 'none',
              border: 'none',
              borderRadius: 18,
              boxShadow: isActive ? 'var(--shadow-raised)' : 'none',
              transition: 'box-shadow 200ms var(--ease)',
              color: isActive ? 'var(--primary)' : 'var(--muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '7px 4px 6px',
              minHeight: 52,
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              fontFamily: 'var(--font-display)',
            })}
          >
            <TabIcon type={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
