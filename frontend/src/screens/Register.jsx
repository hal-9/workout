import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { authInputStyle, authButtonStyle, authLinkStyle } from '../components/authStyles.js';

const ERRORS = {
  'invalid invite code': 'Einladungscode stimmt nicht.',
  'email taken': 'Für diese E-Mail gibt es schon einen Account.',
  'name taken': 'Diesen Namen hat schon jemand.',
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
      setError(ERRORS[err.message] ?? 'Registrierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Account anlegen">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Name (so sehen dich Freunde)"
            value={form.name}
            onChange={update('name')}
            autoComplete="nickname"
            minLength={2}
            maxLength={30}
            required
            style={authInputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            placeholder="E-Mail"
            value={form.email}
            onChange={update('email')}
            autoComplete="username"
            required
            style={authInputStyle}
          />
        </div>
        <div style={{ marginBottom: 4 }}>
          <input
            type="password"
            placeholder="Passwort"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            minLength={8}
            required
            style={authInputStyle}
          />
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
          Mindestens 8 Zeichen. Es gibt kein Passwort-Zurücksetzen — merk es dir gut.
        </p>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Einladungscode"
            value={form.invite_code}
            onChange={update('invite_code')}
            autoComplete="off"
            required
            style={authInputStyle}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button
          type="submit"
          className="btn primary"
          disabled={busy}
          style={{ ...authButtonStyle, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Moment…' : 'Los geht’s'}
        </button>
      </form>
      <Link to="/login" style={authLinkStyle}>
        Schon dabei? <strong style={{ color: 'var(--primary)' }}>Einloggen</strong>
      </Link>
    </AuthShell>
  );
}
