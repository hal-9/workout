import { useMemo, useRef, useState } from 'react';
import { EQUIPMENT } from 'shared/muscles';
import { buildPlanPrompt } from '../../lib/planPrompt.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';

// Ausrüstungs-Chips: Behälter eingelassen, gewählt erhaben in --text, sonst flach gedämpft.
const chipStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: active ? 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)' : 'none',
  color: active ? 'var(--text)' : 'var(--muted)',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
});

const fieldStyle = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: 'var(--shadow-inset-sm)',
  color: 'var(--text)',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 16,
};

const labelStyle = { display: 'block', fontSize: 13, color: 'var(--muted)', margin: '14px 0 6px' };

export default function PlanPromptExport() {
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipment, setEquipment] = useState(() => new Set(['koerpergewicht', 'kurzhantel']));
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const promptRef = useRef(null);

  const prompt = useMemo(
    () => buildPlanPrompt({ daysPerWeek, equipment, goal, notes }),
    [daysPerWeek, equipment, goal, notes]
  );

  const toggleEquipment = (key) => {
    setEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // Ohne Clipboard-Rechte (z.B. http): Prompt aufklappen und markieren.
      setShowPrompt(true);
      requestAnimationFrame(() => promptRef.current?.select());
    }
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Plan von einer KI erstellen lassen</div>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, margin: '4px 0 0' }}>
        Angaben ausfüllen, Prompt kopieren, in deinen KI-Assistenten einfügen — das Ergebnis unten importieren.
      </p>

      <label style={labelStyle} htmlFor="prompt-days">
        Trainingstage pro Woche
      </label>
      <select
        id="prompt-days"
        value={daysPerWeek}
        onChange={(e) => { setDaysPerWeek(Number(e.target.value)); setCopied(false); }}
        style={fieldStyle}
      >
        {[2, 3, 4, 5, 6].map((value) => (
          <option key={value} value={value}>{value} Tage</option>
        ))}
      </select>

      <span style={labelStyle}>Ausrüstung</span>
      <div className="neu-inset" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, borderRadius: 24 }}>
        {EQUIPMENT.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleEquipment(item.key)}
            aria-pressed={equipment.has(item.key)}
            className="btn"
            style={chipStyle(equipment.has(item.key))}
          >
            {equipment.has(item.key) && <Icon name="check" size={16} style={{ color: 'var(--primary)' }} />}
            {item.label}
          </button>
        ))}
      </div>

      <label style={labelStyle} htmlFor="prompt-goal">
        Ziel
      </label>
      <input
        id="prompt-goal"
        value={goal}
        onChange={(e) => { setGoal(e.target.value); setCopied(false); }}
        placeholder="z.B. Muskelaufbau, Rückenschmerzen vorbeugen"
        style={fieldStyle}
      />

      <label style={labelStyle} htmlFor="prompt-notes">
        Hinweise (optional)
      </label>
      <textarea
        id="prompt-notes"
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setCopied(false); }}
        rows={2}
        placeholder="z.B. Knieprobleme, max. 45 Minuten pro Einheit"
        style={{ ...fieldStyle, lineHeight: 1.45 }}
      />

      <Button
        variant="secondary"
        fullWidth
        onClick={handleCopy}
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: copied ? 'var(--success)' : 'var(--text)',
        }}
      >
        {copied && <Icon name="check" size={18} />}
        {copied ? 'Prompt kopiert' : 'Prompt kopieren'}
      </Button>

      <button
        type="button"
        onClick={() => setShowPrompt((value) => !value)}
        className="btn"
        style={{
          minHeight: 44,
          marginTop: 4,
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          padding: '0 4px',
        }}
        aria-expanded={showPrompt}
      >
        Prompt {showPrompt ? 'ausblenden' : 'anzeigen'}
      </button>

      {showPrompt && (
        <textarea
          ref={promptRef}
          readOnly
          value={prompt}
          rows={10}
          onFocus={(e) => e.target.select()}
          aria-label="Generierter Prompt"
          style={{
            width: '100%',
            marginTop: 8,
            background: 'var(--bg)',
            border: 'none',
            boxShadow: 'var(--shadow-inset-sm)',
            color: 'var(--text)',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        />
      )}
    </Card>
  );
}
