import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { PULLUP_STAGES } from '../pullupStages.js';

function groupByKind(entries) {
  const byKind = { pushups: [], pullup_stage: [], bodyweight: [] };
  for (const entry of entries) {
    byKind[entry.kind]?.push(entry);
  }
  return byKind;
}

function Chart({ data, dataLabel }) {
  if (!data.length) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine Einträge.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
        <YAxis stroke="var(--muted)" fontSize={11} />
        <Tooltip formatter={(v) => [v, dataLabel]} />
        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Fortschritt() {
  const queryClient = useQueryClient();
  const { data: others } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const viewPartner = selectedUserId !== null;

  const { data: ownEntries } = useQuery({
    queryKey: ['max-tests'],
    queryFn: () => api.get('/max-tests'),
    enabled: !viewPartner,
  });
  const { data: partnerData } = useQuery({
    queryKey: ['partner-progress', selectedUserId],
    queryFn: () => api.get(`/partner/progress?user_id=${selectedUserId}`),
    enabled: viewPartner,
  });
  const { data: recent } = useQuery({
    queryKey: ['sessions-recent'],
    queryFn: () => api.get('/sessions/recent'),
    enabled: !viewPartner,
  });

  const [kind, setKind] = useState('pushups');
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');

  async function submitEntry(e) {
    e.preventDefault();
    await api.post('/max-tests', {
      kind,
      value: Number(value),
      ...(date ? { date } : {}),
    });
    setValue('');
    setDate('');
    queryClient.invalidateQueries({ queryKey: ['max-tests'] });
  }

  const entries = viewPartner ? partnerData?.max_tests ?? [] : ownEntries ?? [];
  const byKind = groupByKind(entries);
  const currentStageEntry = byKind.pullup_stage[byKind.pullup_stage.length - 1];
  const currentStageIndex = currentStageEntry ? Number(currentStageEntry.value) - 1 : null;

  return (
    <div className="wrap">
      <h2>Fortschritt</h2>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 0 16px' }}>
        <button
          onClick={() => setSelectedUserId(null)}
          style={{
            flex: '0 0 auto',
            background: !viewPartner ? 'var(--primary-dim)' : 'var(--surface)',
            border: `1px solid ${!viewPartner ? 'var(--primary)' : 'var(--line)'}`,
            color: !viewPartner ? 'var(--primary)' : 'var(--muted)',
            borderRadius: 11,
            padding: '9px 13px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ich
        </button>
        {(others ?? []).map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUserId(u.id)}
            style={{
              flex: '0 0 auto',
              background: selectedUserId === u.id ? 'var(--primary-dim)' : 'var(--surface)',
              border: `1px solid ${selectedUserId === u.id ? 'var(--primary)' : 'var(--line)'}`,
              color: selectedUserId === u.id ? 'var(--primary)' : 'var(--muted)',
              borderRadius: 11,
              padding: '9px 13px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {u.name}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <h3>Liegestütze — Max-Test</h3>
        <Chart data={byKind.pushups} dataLabel="Liegestütze" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <h3>Klimmzug-Stufen</h3>
        {currentStageIndex !== null && PULLUP_STAGES[currentStageIndex] ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: 'var(--primary)' }}>
              {currentStageIndex + 1}. {PULLUP_STAGES[currentStageIndex].label}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{PULLUP_STAGES[currentStageIndex].description}</div>
          </>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine Stufe erfasst.</p>
        )}
        {byKind.pullup_stage.length > 0 && (
          <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>
            {byKind.pullup_stage
              .slice(-5)
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  {e.date}: {PULLUP_STAGES[Number(e.value) - 1]?.label ?? e.value}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <h3>Körpergewicht</h3>
        <Chart data={byKind.bodyweight} dataLabel="kg" />
      </div>

      {!viewPartner && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <h3>Auswertungen</h3>
          {(recent?.sessions ?? []).length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine abgeschlossenen Workouts.</p>
          )}
          {(recent?.sessions ?? []).map((s) => (
            <Link
              key={s.session_id}
              to={`/session/${s.session_id}/auswertung`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '9px 0',
                borderBottom: '1px solid var(--line)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              <span>{s.day_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                {new Date(s.finished_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                })}{' '}
                {s.evaluation_status === 'ok'
                  ? '✓'
                  : s.evaluation_status === 'pending'
                    ? '…'
                    : s.evaluation_status === 'failed'
                      ? '⚠'
                      : '–'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {!viewPartner && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
          <h3>Neuer Eintrag</h3>
          <form onSubmit={submitEntry} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
              <option value="pushups">Liegestütze-Max</option>
              <option value="pullup_stage">Klimmzug-Stufe</option>
              <option value="bodyweight">Körpergewicht</option>
            </select>
            <input
              type="number"
              inputMode="decimal"
              placeholder={kind === 'pullup_stage' ? 'Stufe (1-6)' : 'Wert'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              style={inputStyle}
            />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            <button
              type="submit"
              className="btn primary"
              style={{
                border: 'none',
                borderRadius: 13,
                padding: 15,
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                background: 'var(--primary-grad)',
                color: 'var(--on-primary)',
              }}
            >
              Eintragen
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '10px 12px',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
};
