import { useState } from 'react';
import DayEditor from './DayEditor.jsx';
import {
  clonePlan,
  createEmptyDay,
  preparePlanForSave,
  plansEqual,
} from '../../lib/planDefaults.js';
import { validatePlan } from '../../lib/planValidation.js';
import { planDeloadWeeks, withPlanDeload } from '../../lib/progressionEdit.js';

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '10px 12px',
  fontSize: 15,
};

const primaryBtnStyle = {
  width: '100%',
  border: 'none',
  borderRadius: 13,
  padding: 15,
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
  background: 'var(--primary-grad)',
  color: 'var(--on-primary)',
};

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function PlanEditor({
  initialPlan,
  hasActivePlan,
  isEditingExisting = false,
  onSave,
  onCancel,
  saving,
}) {
  const [draft, setDraft] = useState(() => clonePlan(initialPlan));
  const [errors, setErrors] = useState([]);

  const isDirty = !plansEqual(draft, initialPlan);

  const handleDayChange = (dayIndex, day) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === dayIndex ? day : d)),
    }));
  };

  const handleAddDay = () => {
    const existingKeys = new Set(draft.days.map((d) => d.key));
    setDraft((prev) => ({
      ...prev,
      days: [...prev.days, createEmptyDay(existingKeys)],
    }));
  };

  const handleRemoveDay = (dayIndex) => {
    if (draft.days.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== dayIndex),
    }));
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
    onCancel();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    const prepared = preparePlanForSave(draft);
    const validation = validatePlan(prepared);
    if (!validation.ok) {
      setErrors(validation.errors.map((err) => err.message));
      return;
    }

    if (hasActivePlan && !isEditingExisting) {
      const confirmed = window.confirm(
        'Aktuellen Plan ersetzen? Dein Trainingsverlauf bleibt erhalten, aber der aktive Plan wird überschrieben.'
      );
      if (!confirmed) return;
    }

    await onSave(validation.data);
  };

  const allHaveWeekday = draft.days.length > 0 && draft.days.every((d) => d.weekday);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Plan bearbeiten</h3>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Abbrechen
        </button>
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
        Planname
      </label>
      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        style={inputStyle}
        placeholder="z. B. Mein 4-Tage Plan"
        required
      />

      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', margin: '10px 0 4px' }}>
        Deload alle … Wochen (optional)
      </label>
      <input
        type="number"
        min={2}
        max={52}
        step={1}
        value={planDeloadWeeks(draft) ?? ''}
        onChange={(e) => setDraft((prev) => withPlanDeload(prev, e.target.value || null))}
        style={inputStyle}
        placeholder="z. B. 6 — leer lassen für keinen Deload"
      />
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
        Zeigt in der gewählten Woche einen Hinweis auf Heute, Gewichte etwa 10 % zurückzunehmen.
      </p>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', margin: '10px 0 4px' }}>
        Musik-Playlist (optional)
      </label>
      <input
        type="url"
        inputMode="url"
        value={draft.music_url ?? ''}
        onChange={(e) => setDraft((prev) => ({ ...prev, music_url: e.target.value }))}
        style={inputStyle}
        placeholder="https://music.apple.com/… oder https://open.spotify.com/…"
      />
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
        Öffnet beim Training die native Musik-App — dort läuft die Wiedergabe auch im Hintergrund weiter.
      </p>

      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '16px 0 8px' }}>
        {allHaveWeekday
          ? 'Alle Tage haben einen Wochentag — dieser Wochenplan wird verwendet.'
          : 'Wenn alle Tage einen Wochentag haben, wird dieser Plan genutzt — sonst verteilt die App die Tage automatisch.'}
      </p>

      {draft.days.map((day, dayIndex) => (
        <DayEditor
          key={day.key}
          day={day}
          index={dayIndex}
          total={draft.days.length}
          onChange={(next) => handleDayChange(dayIndex, next)}
          onRemove={() => handleRemoveDay(dayIndex)}
          onMoveUp={() => {
            setDraft((prev) => ({ ...prev, days: moveItem(prev.days, dayIndex, dayIndex - 1) }));
          }}
          onMoveDown={() => {
            setDraft((prev) => ({ ...prev, days: moveItem(prev.days, dayIndex, dayIndex + 1) }));
          }}
        />
      ))}

      <button
        type="button"
        onClick={handleAddDay}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px dashed var(--line)',
          borderRadius: 12,
          padding: 12,
          fontSize: 14,
          cursor: 'pointer',
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        + Trainingstag hinzufügen
      </button>

      {errors.length > 0 && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
          <strong>Bitte korrigieren:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" className="btn primary" style={primaryBtnStyle} disabled={saving}>
        {saving ? 'Speichern…' : 'Plan speichern'}
      </button>
    </form>
  );
}
