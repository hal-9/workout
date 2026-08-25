import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

const cardStyle = {
  borderRadius: 16,
  padding: 16,
  marginBottom: 14,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 0',
  borderBottom: '1px solid var(--line)',
};

// Lange Namen kuerzen statt die Buttons wegzudruecken.
const nameStyle = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const smallButton = (variant) => ({
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 36,
  background: variant === 'primary' ? 'var(--primary-grad)' : 'var(--surface2)',
  color: variant === 'primary' ? 'var(--on-primary)' : 'var(--muted)',
});

const ADD_ERRORS = {
  'user not found': 'Kein Account mit dieser E-Mail. Frag nach der Adresse, mit der registriert wurde.',
  'cannot befriend yourself': 'Das ist deine eigene E-Mail.',
  pending: 'Anfrage läuft schon.',
  accepted: 'Ihr seid schon verbunden.',
  'validation failed': 'Das sieht nicht nach einer E-Mail-Adresse aus.',
};

function Avatar({ name }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        flexShrink: 0,
        borderRadius: '50%',
        background: 'var(--primary-grad)',
        color: 'var(--on-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function Freunde() {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['friends'], queryFn: () => api.get('/friends') });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  const addFriend = useMutation({
    mutationFn: (value) => api.post('/friends/requests', { email: value }),
    onSuccess: (result) => {
      setEmail('');
      setFeedback({
        tone: 'ok',
        text:
          result.status === 'accepted'
            ? `${result.name} hatte dich schon angefragt — ihr seid jetzt verbunden.`
            : `Anfrage an ${result.name} raus.`,
      });
      refresh();
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: ADD_ERRORS[err.message] ?? 'Hat nicht geklappt.' });
    },
  });

  const accept = useMutation({
    mutationFn: (id) => api.post(`/friends/requests/${id}/accept`),
    onSuccess: refresh,
  });

  const removeRequest = useMutation({
    mutationFn: (id) => api.delete(`/friends/requests/${id}`),
    onSuccess: refresh,
  });

  const unfriend = useMutation({
    mutationFn: (userId) => api.delete(`/friends/${userId}`),
    onSuccess: refresh,
  });

  function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    addFriend.mutate(email);
  }

  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  return (
    <div className="wrap">
      <h2>Freunde</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: -6 }}>
        Ihr seht euren Fortschritt gegenseitig — erst wenn beide Seiten bestätigt haben.
      </p>

      <form onSubmit={handleSubmit} className="glass" style={cardStyle}>
        <label htmlFor="friend-email" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Freund per E-Mail hinzufügen
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            id="friend-email"
            type="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              borderRadius: 10,
              padding: '11px 12px',
              fontSize: 16,
            }}
          />
          <button type="submit" disabled={addFriend.isPending} style={smallButton('primary')}>
            Anfragen
          </button>
        </div>
        {feedback && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: feedback.tone === 'error' ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {feedback.text}
          </p>
        )}
      </form>

      {incoming.length > 0 && (
        <div className="glass" style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Anfragen an dich</h3>
          {incoming.map((r) => (
            <div key={r.id} style={rowStyle}>
              <Avatar name={r.name} />
              <span style={nameStyle}>{r.name}</span>
              <button onClick={() => accept.mutate(r.id)} style={smallButton('primary')}>
                Annehmen
              </button>
              <button onClick={() => removeRequest.mutate(r.id)} style={smallButton()}>
                Ablehnen
              </button>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="glass" style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Gesendet</h3>
          {outgoing.map((r) => (
            <div key={r.id} style={rowStyle}>
              <Avatar name={r.name} />
              <span style={nameStyle}>{r.name}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>wartet</span>
              <button onClick={() => removeRequest.mutate(r.id)} style={smallButton()}>
                Zurückziehen
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="glass" style={cardStyle}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Verbunden</h3>
        {isLoading && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Lädt…</p>}
        {!isLoading && friends.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Noch niemand. Schick oben eine Anfrage raus.
          </p>
        )}
        {friends.map((f) => (
          <div key={f.id} style={rowStyle}>
            <Avatar name={f.name} />
            <span style={nameStyle}>{f.name}</span>
            <button onClick={() => unfriend.mutate(f.id)} style={smallButton()}>
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
