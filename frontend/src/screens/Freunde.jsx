import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import '../styles/kal.css';

const sectionTitle = { margin: '28px 0 12px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 4px',
  minHeight: 60,
};

// Lange Namen kuerzen statt die Buttons wegzudruecken.
const nameStyle = {
  flex: 1,
  minWidth: 0,
  fontSize: 15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Zeilen-Aktionen: erhabene Pille (positiv) oder Textbutton (zurückhaltend).
const pillButton = {
  flexShrink: 0,
  borderRadius: 999,
  padding: '0 14px',
  minHeight: 44,
  fontSize: 14,
  fontWeight: 600,
};

const quietButton = {
  ...pillButton,
  padding: '0 8px',
  fontWeight: 500,
  color: 'var(--muted)',
};

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
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-raised)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 600,
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
  const { data: activityData } = useQuery({
    queryKey: ['friends-activity'],
    queryFn: () => api.get('/friends/activity'),
  });

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
      <header style={{ marginTop: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Freunde</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' }}>
          Ihr seht euren Fortschritt gegenseitig — erst wenn beide Seiten bestätigt haben.
        </p>
      </header>

      <Card style={{ marginBottom: 0 }}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="friend-email" style={{ fontSize: 13, color: 'var(--muted)' }}>
            Freund per E-Mail hinzufügen
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
                minHeight: 44,
                background: 'var(--bg)',
                boxShadow: 'var(--shadow-raised)',
                border: 'none',
                color: 'var(--text)',
                borderRadius: 14,
                padding: '11px 14px',
                fontSize: 16,
              }}
            />
            <Button type="submit" disabled={addFriend.isPending} style={{ flexShrink: 0, padding: '0 18px' }}>
              Anfragen
            </Button>
          </div>
          {feedback && (
            <p
              role="status"
              style={{
                margin: '10px 0 0',
                fontSize: 14,
                color: feedback.tone === 'error' ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {feedback.text}
            </p>
          )}
        </form>
      </Card>

      {incoming.length > 0 && (
        <section>
          <h2 style={sectionTitle}>Anfragen an dich</h2>
          <ul className="kal-tray">
            {incoming.map((r) => (
              <li key={r.id} style={rowStyle}>
                <Avatar name={r.name} />
                <span style={nameStyle}>{r.name}</span>
                <Button variant="secondary" onClick={() => accept.mutate(r.id)} style={{ ...pillButton, color: 'var(--primary)' }}>
                  Annehmen
                </Button>
                <Button variant="ghost" onClick={() => removeRequest.mutate(r.id)} style={quietButton}>
                  Ablehnen
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 style={sectionTitle}>Gesendet</h2>
          <ul className="kal-tray">
            {outgoing.map((r) => (
              <li key={r.id} style={rowStyle}>
                <Avatar name={r.name} />
                <span style={nameStyle}>
                  {r.name}
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>wartet</span>
                </span>
                <Button variant="ghost" onClick={() => removeRequest.mutate(r.id)} style={quietButton}>
                  Zurückziehen
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(activityData?.activity ?? []).length > 0 && (
        <section>
          <h2 style={sectionTitle}>Diese Woche</h2>
          <ul className="kal-tray">
            {activityData.activity.map((a) => (
              <li key={a.user_id} style={rowStyle}>
                <Avatar name={a.name} />
                <span style={nameStyle}>{a.name}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{a.workouts_this_week}</span> Workout
                  {a.workouts_this_week === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ paddingBottom: 24 }}>
        <h2 style={sectionTitle}>Verbunden</h2>
        {isLoading && <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Lädt…</p>}
        {!isLoading && friends.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Noch niemand. Schick oben eine Anfrage raus.</p>
        )}
        {friends.length > 0 && (
          <ul className="kal-tray">
            {friends.map((f) => (
              <li key={f.id} style={rowStyle}>
                <Avatar name={f.name} />
                <span style={nameStyle}>{f.name}</span>
                <Button variant="ghost" onClick={() => unfriend.mutate(f.id)} style={quietButton}>
                  Entfernen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
