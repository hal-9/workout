import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

export default function Plan() {
  const queryClient = useQueryClient();
  const { data: plan, error: planError } = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get('/plan'),
    retry: false,
  });

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);

  async function handleImport(e) {
    e.preventDefault();
    setImportError(null);
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError({ error: 'ungültiges JSON' });
      return;
    }

    try {
      await api.post('/plan', parsed);
      setImportText('');
      queryClient.invalidateQueries({ queryKey: ['plan'] });
    } catch (err) {
      setImportError({ error: err.message, details: err.details });
    }
  }

  return (
    <div className="wrap">
      <h2>Plan</h2>

      {plan && (
        <div style={{ marginBottom: 24 }}>
          <h3>{plan.name}</h3>
          {plan.days.map((day) => (
            <div
              key={day.key}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 15,
                marginBottom: 10,
              }}
            >
              <strong>{day.name}</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{day.focus}</div>
              {day.exercises.map((ex) => (
                <div
                  key={ex.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderTop: '1px solid var(--line)',
                    fontSize: 13.5,
                  }}
                >
                  <span>{ex.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                    {ex.sets} × {ex.target_reps ?? `${ex.target_seconds}s`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {planError && planError.status === 404 && (
        <p style={{ color: 'var(--muted)' }}>Noch kein aktiver Plan.</p>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Plan importieren</h3>
        <form onSubmit={handleImport}>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            placeholder="Plan-JSON hier einfügen"
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              borderRadius: 9,
              padding: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          />
          {importError && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              <div>{importError.error}</div>
              {importError.details && (
                <ul>
                  {importError.details.map((d, i) => (
                    <li key={i}>
                      {d.path?.join('.')}: {d.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="submit"
            className="btn primary"
            style={{
              marginTop: 10,
              width: '100%',
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
            Importieren
          </button>
        </form>
      </div>
    </div>
  );
}
