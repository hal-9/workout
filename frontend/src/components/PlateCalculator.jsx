import { useState } from 'react';
import { calculatePlates, formatPlateList } from 'shared/plateCalc';
import Dialog from './ui/Dialog.jsx';
import Field, { fieldInputStyle } from './ui/Field.jsx';

export default function PlateCalculator({ open, onClose, initialWeight = 60 }) {
  const [target, setTarget] = useState(String(initialWeight));
  const [bar, setBar] = useState('20');

  const result = calculatePlates(Number(target), Number(bar));

  return (
    <Dialog open={open} onClose={onClose} title="Scheiben-Rechner" ariaLabel="Scheiben-Rechner">
      <Field label="Zielgewicht (kg)">
        <input
          type="number"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          style={fieldInputStyle}
        />
      </Field>
      <Field label="Stangengewicht (kg)">
        <input
          type="number"
          inputMode="decimal"
          value={bar}
          onChange={(e) => setBar(e.target.value)}
          style={fieldInputStyle}
        />
      </Field>
      {result && (
        <div
          style={{
            background: 'var(--primary-dim)',
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
          }}
        >
          {result.total ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Pro Seite: {formatPlateList(result.perSide)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                Gesamt: {result.total} kg
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>
              Nicht exakt ladbar — {result.remainder?.toFixed(2)} kg Rest pro Seite
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
