import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { authInputStyle, authButtonStyle, authLinkStyle } from '../components/authStyles.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await api.post('/login', { email, password });
      queryClient.setQueryData(['me'], user);
      navigate(user.onboarded ? '/heute' : '/willkommen');
    } catch {
      setError('E-Mail oder Passwort falsch.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="LiLief-Workout">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          {/* type=text statt email: Bestandsnutzer ohne nachgetragene E-Mail
              koennen sich uebergangsweise noch mit ihrem Namen anmelden. */}
          <input
            type="text"
            inputMode="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            style={authInputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={authInputStyle}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button type="submit" className="btn primary" style={authButtonStyle} disabled={pending}>
          {pending ? 'Wird eingeloggt…' : 'Einloggen'}
        </button>
      </form>
      <Link to="/registrieren" style={authLinkStyle}>
        Noch keinen Account? <strong style={{ color: 'var(--primary)' }}>Registrieren</strong>
      </Link>
    </AuthShell>
  );
}
