import Logo from './Logo.jsx';

export default function AuthShell({ title, children }) {
  return (
    <div className="wrap" style={{ paddingTop: 'calc(60px + env(safe-area-inset-top))' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Logo size={72} />
      </div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'center',
          background: 'var(--primary-grad)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {title}
      </h1>
      {children}
    </div>
  );
}
