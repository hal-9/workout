import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import Button from '../components/ui/Button.jsx';
import { authErrorStyle, authFieldStyle, authLinkStyle } from '../components/authStyles.js';

const ERRORS = {
  'invalid invite code': 'Einladungscode stimmt nicht. Prüf den Code aus deiner Einladung.',
  'email taken': 'Für diese E-Mail gibt es schon einen Account. Melde dich stattdessen an.',
  'name taken': 'Diesen Namen hat schon jemand. Wähl einen anderen.',
  'validation failed': 'Bitte prüf die Eingaben — Passwort mindestens 8 Zeichen.',
};

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_code: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api.post('/register', form);
      queryClient.setQueryData(['me'], user);
      navigate('/willkommen');
    } catch (err) {
      setError(ERRORS[err.message] ?? 'Registrierung hat nicht geklappt. Versuch es gleich noch mal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell subtitle="Account anlegen — du brauchst einen Einladungscode.">
      <form onSubmit={handleSubmit}>
        <div style={authFieldStyle}>
          <input
            type="text"
            placeholder="Name (so sehen dich Freunde)"
            aria-label="Name"
            value={form.name}
            onChange={update('name')}
            autoComplete="nickname"
            minLength={2}
            maxLength={30}
            required
            className="ui-input"
          />
        </div>
        <div style={authFieldStyle}>
          <input
            type="email"
            placeholder="E-Mail"
            aria-label="E-Mail"
            value={form.email}
            onChange={update('email')}
            autoComplete="username"
            required
            className="ui-input"
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <input
            type="password"
            placeholder="Passwort"
            aria-label="Passwort"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            minLength={8}
            required
            className="ui-input"
          />
        </div>
        <p style={{ margin: '0 0 14px', padding: '0 4px', fontSize: 13, color: 'var(--muted)' }}>
          Mindestens 8 Zeichen. Es gibt kein Passwort-Zurücksetzen — merk es dir gut.
        </p>
        <div style={authFieldStyle}>
          <input
            type="text"
            placeholder="Einladungscode"
            aria-label="Einladungscode"
            value={form.invite_code}
            onChange={update('invite_code')}
            autoComplete="off"
            required
            className="ui-input"
          />
        </div>
        {error && <p role="alert" style={authErrorStyle}>{error}</p>}
        <Button type="submit" fullWidth disabled={busy} style={{ marginTop: 6, minHeight: 52, fontSize: 16 }}>
          {busy ? 'Moment…' : 'Registrieren'}
        </Button>
      </form>
      <Link to="/login" style={authLinkStyle}>
        Schon dabei?&nbsp;<strong style={{ color: 'var(--primary)' }}>Anmelden</strong>
      </Link>
    </AuthShell>
  );
}
