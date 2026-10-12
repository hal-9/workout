import Logo from './Logo.jsx';
import '../styles/ui.css';

// Erster Eindruck: Logo, große Wortmarke, ein ruhiger Satz — das Formular liegt direkt auf dem Stein.
export default function AuthShell({ subtitle, children }) {
  return (
    <div
      className="wrap"
      style={{
        maxWidth: 420,
        paddingTop: 'calc(64px + env(safe-area-inset-top))',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 32 }}>
        <Logo size={64} />
        <h1
          className="wordmark"
          style={{ margin: '12px 0 0', fontSize: 46, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05 }}
        >
          LiLief
        </h1>
        {subtitle && <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
