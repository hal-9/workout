import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { authErrorStyle, authFieldStyle, authLinkStyle } from '../components/authStyles.js';

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
      setError('E-Mail oder Passwort stimmt nicht. Prüf beides und versuch es noch mal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell subtitle="Dein Trainingstagebuch.">
      <form onSubmit={handleSubmit}>
        <div style={authFieldStyle}>
          {/* type=text statt email: Bestandsnutzer ohne nachgetragene E-Mail
              koennen sich uebergangsweise noch mit ihrem Namen anmelden. */}
          <input
            type="text"
            inputMode="email"
            placeholder="E-Mail"
            aria-label="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="ui-input"
          />
        </div>
        <div style={authFieldStyle}>
          <input
            type="password"
            placeholder="Passwort"
            aria-label="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="ui-input"
          />
        </div>
        {error && <p role="alert" style={authErrorStyle}>{error}</p>}
        <Button type="submit" fullWidth disabled={pending} style={{ marginTop: 6, minHeight: 52, fontSize: 16 }}>
          {pending ? 'Wird angemeldet…' : 'Anmelden'}
        </Button>
      </form>
      <Link to="/registrieren" style={authLinkStyle}>
        Noch keinen Account?&nbsp;<strong style={{ color: 'var(--primary)' }}>Registrieren</strong>
      </Link>
    </AuthShell>
  );
}
