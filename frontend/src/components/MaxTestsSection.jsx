import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Field, { fieldInputStyle } from './ui/Field.jsx';
import { useToast } from '../context/ToastContext.jsx';

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
      <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Max-Tests & Körpergewicht</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(KIND_LABELS).map(([k, label]) => (
          <div key={k} style={{ flex: '1 1 100px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {latestByKind[k] ? latestByKind[k].value : '—'}
            </div>
            {latestByKind[k] && (
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{latestByKind[k].date}</div>
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
        <Button type="submit" fullWidth disabled={addMutation.isPending}>
          Eintragen
        </Button>
      </form>
    </Card>
  );
}
