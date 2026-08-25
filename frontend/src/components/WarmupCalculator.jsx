import { warmupSets } from 'shared/warmupCalc';
import Dialog from './ui/Dialog.jsx';
import Field, { fieldInputStyle } from './ui/Field.jsx';
import { useState } from 'react';

export default function WarmupCalculator({ open, onClose, initialWeight = 60 }) {
  const [working, setWorking] = useState(String(initialWeight));
  const sets = warmupSets(Number(working));

  return (
    <Dialog open={open} onClose={onClose} title="Warm-up" ariaLabel="Warm-up Rechner">
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
        Schätzung basierend auf Arbeitgewicht — keine medizinische Empfehlung.
      </p>
      <Field label="Arbeitgewicht (kg)">
        <input
          type="number"
          inputMode="decimal"
          value={working}
          onChange={(e) => setWorking(e.target.value)}
          style={fieldInputStyle}
        />
      </Field>
      {sets.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {sets.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              <span>Satz {i + 1}</span>
              <span>{s.reps} × {s.weight_kg} kg</span>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
