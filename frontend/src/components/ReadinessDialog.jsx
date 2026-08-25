import { useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import Chip from './ui/Chip.jsx';

const ENERGY_LABELS = ['Sehr müde', 'Müde', 'Okay', 'Gut', 'Top'];
const SORENESS_LABELS = ['Keine', 'Leicht', 'Mittel', 'Stark', 'Sehr stark'];

export default function ReadinessDialog({ open, onClose, onSubmit }) {
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(2);
  const [timeMin, setTimeMin] = useState(60);

  const handleSubmit = () => {
    onSubmit({ energy, soreness, time_available_min: timeMin });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Tagesform" ariaLabel="Kurzer Check vor dem Training">
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
        Kurzer Check — keine medizinische Bewertung, nur für Session-Anpassungen.
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          ENERGIE
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Chip key={v} active={energy === v} onClick={() => setEnergy(v)} ariaLabel={`Energie ${v}`}>
              {v} · {ENERGY_LABELS[v - 1]}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          MUSKELKATER
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Chip key={v} active={soreness === v} onClick={() => setSoreness(v)} ariaLabel={`Muskelkater ${v}`}>
              {v} · {SORENESS_LABELS[v - 1]}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          ZEIT HEUTE (MIN.)
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 45, 60, 90].map((m) => (
            <Chip key={m} active={timeMin === m} onClick={() => setTimeMin(m)} ariaLabel={`${m} Minuten`}>
              {m}
            </Chip>
          ))}
        </div>
      </div>

      <Button fullWidth onClick={handleSubmit}>Los geht&apos;s</Button>
      <Button variant="ghost" fullWidth onClick={onClose} style={{ marginTop: 8 }}>
        Überspringen
      </Button>
    </Dialog>
  );
}

/** Deterministic adaptations based on readiness — no AI. */
export function readinessAdaptations(readiness) {
  if (!readiness) return null;
  const suggestions = [];
  if (readiness.energy <= 2) {
    suggestions.push('Volumen reduzieren oder Deload-Sätze');
  }
  if (readiness.soreness >= 4) {
    suggestions.push('Betroffene Muskelgruppen ausweichen');
  }
  if (readiness.time_available_min && readiness.time_available_min <= 45) {
    suggestions.push('Session verkürzen — Cooldown optional');
  }
  return suggestions.length ? suggestions : null;
}
