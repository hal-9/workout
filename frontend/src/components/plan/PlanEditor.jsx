import { useEffect, useState } from 'react';
import DayEditor from './DayEditor.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import {
  clonePlan,
  createEmptyDay,
  preparePlanForSave,
  plansEqual,
} from '../../lib/planDefaults.js';
import { validatePlan } from '../../lib/planValidation.js';
import { planDeloadWeeks, withPlanDeload } from '../../lib/progressionEdit.js';
import { clearDraft, loadDraft, saveDraft } from '../../lib/planDraft.js';

const inputStyle = {
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

const hintStyle = { color: 'var(--muted)', fontSize: 13, lineHeight: 1.45, margin: '6px 0 0' };

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
  // Wiederherstellbarer Entwurf: beim Öffnen anbieten, nicht stillschweigend
  // laden — sonst wundert man sich über fremde Änderungen.
  const [recoverable, setRecoverable] = useState(() => loadDraft());

  const isDirty = !plansEqual(draft, initialPlan);

  useEffect(() => {
    if (isDirty) saveDraft(draft);
  }, [draft, isDirty]);

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
    clearDraft();
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
    clearDraft();
  };

  const allHaveWeekday = draft.days.length > 0 && draft.days.every((d) => d.weekday);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Plan bearbeiten</h3>
        <Button variant="ghost" onClick={handleCancel} style={{ padding: '0 4px', fontWeight: 500 }}>
          Abbrechen
        </Button>
      </div>

      {recoverable && !isDirty && (
        <div className="neu-inset" style={{ borderRadius: 20, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 12 }}>
            Nicht gespeicherter Entwurf von {new Date(recoverable.saved_at).toLocaleString('de-DE')}.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(clonePlan(recoverable.plan));
                setRecoverable(null);
              }}
              style={{ flex: 1, fontSize: 14 }}
            >
              Entwurf laden
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearDraft();
                setRecoverable(null);
              }}
              style={{ flex: 1, fontSize: 14, color: 'var(--muted)' }}
            >
              Verwerfen
            </Button>
          </div>
        </div>
      )}

      <label style={{ ...labelStyle, marginTop: 8 }}>Planname</label>
      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        style={inputStyle}
        placeholder="z. B. Mein 4-Tage Plan"
        required
      />

      <label style={labelStyle}>Deload alle … Wochen (optional)</label>
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
      <p style={hintStyle}>
        Zeigt in der gewählten Woche einen Hinweis auf Heute, Gewichte etwa 10 % zurückzunehmen.
      </p>

      <label style={labelStyle}>Musik-Playlist (optional)</label>
      <input
        type="url"
        inputMode="url"
        value={draft.music_url ?? ''}
        onChange={(e) => setDraft((prev) => ({ ...prev, music_url: e.target.value }))}
        style={inputStyle}
        placeholder="https://music.apple.com/… oder https://open.spotify.com/…"
      />
      <p style={hintStyle}>
        Öffnet beim Training die native Musik-App — dort läuft die Wiedergabe auch im Hintergrund weiter.
      </p>

      <h3 style={{ margin: '28px 0 0', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Trainingstage</h3>
      <p style={{ ...hintStyle, margin: '4px 0 16px' }}>
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

      <Button variant="secondary" fullWidth onClick={handleAddDay} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="plus" size={18} />
        Trainingstag hinzufügen
      </Button>

      {errors.length > 0 && (
        <div role="alert" style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>
          <strong>Bitte korrigieren:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Speichern bleibt erreichbar, egal wie lang der Plan wird: feste Leiste im Grundmaterial. */}
      <div
        style={{
          position: 'sticky',
          bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom))',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg)',
          margin: '8px -16px 0',
          padding: '12px 16px',
          boxShadow: '0 -10px 18px -12px var(--neu-lo)',
        }}
      >
        <span style={{ fontSize: 13, color: isDirty ? 'var(--text)' : 'var(--muted)', flexShrink: 0 }}>
          {isDirty ? 'Nicht gespeichert' : 'Gespeichert'}
        </span>
        <Button type="submit" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Speichern…' : 'Plan speichern'}
        </Button>
      </div>
    </form>
  );
}
