import Logo from './Logo.jsx';
import '../styles/ui.css';

// Erster Eindruck auf der Mesh-Bühne — derselbe Verlauf wie Boot-Splash und
// Hauptbutton, darauf große helle Schrift. Farben werden in .auth-stage umgestellt.
export default function AuthShell({ subtitle, children }) {
  return (
    <div className="stage auth-stage">
      <span className="mesh mesh-stage" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <div className="auth-scroll">
        <div
          className="wrap"
          style={{
            maxWidth: 440,
            width: '100%',
            paddingTop: 'calc(40px + env(safe-area-inset-top))',
            paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
          }}
        >
          <div className="stage-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 40, '--delay': '0ms' }}>
            <Logo size={72} />
            <h1 className="stage-title" style={{ marginTop: 14, fontSize: 'clamp(60px, 20vw, 84px)' }}>
              LiLief
            </h1>
            {subtitle && <p style={{ margin: '12px 0 0', fontSize: 20, fontWeight: 500, lineHeight: 1.35 }}>{subtitle}</p>}
          </div>
          <div className="stage-rise" style={{ '--delay': '120ms' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
