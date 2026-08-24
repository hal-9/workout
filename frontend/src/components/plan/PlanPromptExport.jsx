import { useMemo, useRef, useState } from 'react';
import { EQUIPMENT } from 'shared/muscles';
import { buildPlanPrompt } from '../../lib/planPrompt.js';

const chipStyle = (active) => ({
  background: active ? 'var(--primary-dim)' : 'var(--surface2)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 999,
  padding: '6px 11px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
});

const fieldStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '9px 11px',
  fontSize: 15,
};

const labelStyle = { display: 'block', fontSize: 13, color: 'var(--muted)', margin: '12px 0 5px' };

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
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--surface)',
        marginBottom: 16,
      }}
    >
      <strong style={{ fontSize: 14 }}>Plan von einer KI erstellen lassen</strong>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {EQUIPMENT.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleEquipment(item.key)}
            aria-pressed={equipment.has(item.key)}
            style={chipStyle(equipment.has(item.key))}
          >
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
        style={{ ...fieldStyle, fontSize: 14 }}
      />

      <button
        type="button"
        onClick={handleCopy}
        style={{
          width: '100%',
          marginTop: 12,
          border: 'none',
          borderRadius: 12,
          padding: 13,
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          background: copied ? 'var(--success-dim)' : 'var(--primary-grad)',
          color: copied ? 'var(--success)' : 'var(--on-primary)',
        }}
      >
        {copied ? '✓ Prompt kopiert' : 'Prompt kopieren'}
      </button>

      <button
        type="button"
        onClick={() => setShowPrompt((value) => !value)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          fontSize: 13,
          cursor: 'pointer',
          padding: '8px 0 0',
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
            background: 'var(--surface2)',
            border: '1px solid var(--line)',
            color: 'var(--text)',
            borderRadius: 9,
            padding: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        />
      )}
    </div>
  );
}
