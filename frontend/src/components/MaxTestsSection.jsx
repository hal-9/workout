import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Field, { fieldInputStyle } from './ui/Field.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { deNum } from './ProgressSummary.jsx';

// "2026-10-12" → "12.10.2026"
const formatDate = (date) => date.split('-').reverse().join('.');

const KIND_LABELS = {
  pushups: 'Liegestütze (max)',
  pullup_stage: 'Klimmzug-Stufe',
  bodyweight: 'Körpergewicht (kg)',
};

export default function MaxTestsSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: tests = [] } = useQuery({
    queryKey: ['max-tests'],
    queryFn: () => api.get('/max-tests'),
  });

  const [kind, setKind] = useState('pushups');
  const [value, setValue] = useState('');

  const addMutation = useMutation({
    mutationFn: (body) => api.post('/max-tests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['max-tests'] });
      setValue('');
      showToast('Eintrag gespeichert');
    },
    onError: () => showToast('Speichern fehlgeschlagen', 'error'),
  });

  const latestByKind = {};
  for (const t of tests) {
    latestByKind[t.kind] = t;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(value);
    if (!num) return;
    addMutation.mutate({ kind, value: num });
  };

  return (
    <Card>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Max-Tests & Körpergewicht</h3>
      <p style={{ margin: '4px 0 12px', fontSize: 14, color: 'var(--muted)' }}>Letzter Eintrag je Test</p>
      {/* Werte liegen in einer Mulde, durch Haarlinien getrennt. */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg)',
          boxShadow: 'var(--shadow-raised)',
          borderRadius: 16,
          padding: '10px 0',
          marginBottom: 16,
        }}
      >
        {Object.entries(KIND_LABELS).map(([k, label], i) => (
          <div
            key={k}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              padding: '0 12px',
              borderLeft: i > 0 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>
              {latestByKind[k] ? deNum(latestByKind[k].value) : '—'}
            </div>
            {latestByKind[k] && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(latestByKind[k].date)}</div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <Field label="Typ">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={fieldInputStyle}
          >
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Wert">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            style={fieldInputStyle}
          />
        </Field>
        <Button type="submit" variant="secondary" fullWidth disabled={addMutation.isPending}>
          Eintragen
        </Button>
      </form>
    </Card>
  );
}
