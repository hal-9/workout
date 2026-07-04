import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const user = await api.post('/login', { name, password });
      queryClient.setQueryData(['me'], user);
      navigate('/heute');
    } catch {
      setError('Name oder Passwort falsch.');
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 'calc(60px + env(safe-area-inset-top))' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Trainingskonsole</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
            style={inputStyle}
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
            style={inputStyle}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button type="submit" className="btn primary" style={btnStyle}>
          Einloggen
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '12px 14px',
  fontFamily: 'var(--font-display)',
  fontSize: 15,
};

const btnStyle = {
  width: '100%',
  border: 'none',
  borderRadius: 13,
  padding: 15,
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
  background: 'var(--ember)',
  color: '#160a04',
};
