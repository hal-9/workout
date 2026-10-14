import { isBandAssisted } from 'shared/bandAssist';
import { durationUnitLabel, fromInputValue, toInputValue } from 'shared/duration';
import {
  effectiveProgression,
  supportsProgression,
  withProgression,
} from '../../lib/progressionEdit.js';
import { EXERCISE_TYPES } from '../../lib/planDefaults.js';

const inputStyle = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: 'var(--shadow-raised)',
  color: 'var(--text)',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 16,
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: 'var(--muted)',
  marginBottom: 6,
  marginTop: 12,
};

// Häkchen-Zeile: ganze Zeile ist Ziel (≥ 44 px), Text in normaler Farbe.
const checkRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 44,
  marginTop: 4,
  fontSize: 14,
  lineHeight: 1.4,
  color: 'var(--text)',
  cursor: 'pointer',
};

const checkboxStyle = { width: 20, height: 20, flexShrink: 0, accentColor: 'var(--primary)' };

export default function ExerciseEditor({ exercise, onChange }) {
  const showReps = exercise.type === 'bw' || exercise.type === 'wt';
  const showWeight = exercise.type === 'wt';
  const showSeconds = exercise.type === 'time' || exercise.type === 'cardio';
  const isCooldown = exercise.phase === 'cooldown';
  const progression = effectiveProgression(exercise);
  const showProgression = supportsProgression(exercise);
  const incrementUnit = progression.type === 'weight' ? 'kg' : progression.type === 'duration' ? 'Sek.' : 'Wdh.';

  const handleTypeChange = (type) => {
    const next = { ...exercise, type };
    if (type === 'time' || type === 'cardio') {
      next.target_reps = null;
      next.target_seconds = next.target_seconds ?? (type === 'cardio' ? 1200 : 30);
      next.default_weight_kg = null;
    } else if (type === 'wt') {
      next.target_reps = next.target_reps ?? '8-12';
      next.target_seconds = null;
    } else {
      next.target_reps = next.target_reps ?? '8-12';
      next.target_seconds = null;
      next.default_weight_kg = null;
    }
    onChange(next);
  };

  return (
    <div>
      <label style={labelStyle}>Name</label>
      <input
        type="text"
        value={exercise.name}
        onChange={(e) => onChange({ ...exercise, name: e.target.value })}
        style={inputStyle}
        placeholder="z. B. Liegestütze"
      />

      <label style={labelStyle}>Muskelgruppe</label>
      <input
        type="text"
        value={exercise.muscle}
        onChange={(e) => onChange({ ...exercise, muscle: e.target.value })}
        style={inputStyle}
        placeholder="z. B. Brust"
      />

      <label style={labelStyle}>Typ</label>
      <select
        value={exercise.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        style={inputStyle}
      >
        {EXERCISE_TYPES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label
        style={checkRowStyle}
      >
        <input
          type="checkbox"
          style={checkboxStyle}
          checked={isCooldown}
          onChange={(e) => onChange({ ...exercise, phase: e.target.checked ? 'cooldown' : 'main' })}
        />
        Cooldown / Dehnung (zählt nicht in Fortschritt und Progression)
      </label>

      <label
        style={checkRowStyle}
      >
        <input
          type="checkbox"
          style={checkboxStyle}
          checked={Boolean(exercise.unilateral)}
          onChange={(e) => onChange({ ...exercise, unilateral: e.target.checked })}
        />
        Pro Seite (jeder Satz einmal links, einmal rechts)
      </label>

      {(exercise.type === 'bw' || exercise.type === 'time') && (
        <label
          style={checkRowStyle}
        >
          <input
            type="checkbox"
            style={checkboxStyle}
            checked={isBandAssisted(exercise)}
            onChange={(e) => onChange({ ...exercise, band_assisted: e.target.checked })}
          />
          Band-unterstützt (Bänder pro Satz tracken)
        </label>
      )}

      <label style={labelStyle}>Sätze</label>
      <input
        type="number"
        min={1}
        max={20}
        value={exercise.sets}
        onChange={(e) => onChange({ ...exercise, sets: e.target.value })}
        style={inputStyle}
      />

      {showReps && (
        <>
          <label style={labelStyle}>Wiederholungen</label>
          <input
            type="text"
            value={exercise.target_reps ?? ''}
            onChange={(e) => onChange({ ...exercise, target_reps: e.target.value })}
            style={inputStyle}
            placeholder="z. B. 8-12"
          />
        </>
      )}

      {showWeight && (
        <>
          <label style={labelStyle}>Startgewicht (kg, optional)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={exercise.default_weight_kg ?? ''}
            onChange={(e) =>
              onChange({
                ...exercise,
                default_weight_kg: e.target.value === '' ? null : e.target.value,
              })
            }
            style={inputStyle}
            placeholder="z. B. 10"
          />
        </>
      )}

      {showSeconds && (
        <>
          <label style={labelStyle}>Zieldauer ({durationUnitLabel(exercise.type)})</label>
          <input
            type="number"
            min={exercise.type === 'cardio' ? 0.5 : 1}
            step={exercise.type === 'cardio' ? 0.5 : 1}
            value={toInputValue(exercise.target_seconds, exercise.type)}
            onChange={(e) =>
              onChange({
                ...exercise,
                target_seconds: fromInputValue(e.target.value, exercise.type),
              })
            }
            style={inputStyle}
            placeholder={exercise.type === 'cardio' ? 'z. B. 25' : 'z. B. 30'}
          />
        </>
      )}

      {showProgression && (
        <div
          style={{
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
            padding: '6px 0 14px',
            marginTop: 16,
          }}
        >
          <label style={{ ...checkRowStyle, marginTop: 0, fontWeight: 500 }}>
            <input
              type="checkbox"
              style={checkboxStyle}
              checked={progression.enabled}
              onChange={(e) => onChange(withProgression(exercise, { enabled: e.target.checked }))}
            />
            Automatisch steigern
          </label>

          {progression.enabled && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Schritt ({incrementUnit})</label>
                <input
                  type="number"
                  min={0.5}
                  step={progression.type === 'weight' ? 0.5 : 1}
                  value={progression.increment ?? ''}
                  onChange={(e) =>
                    onChange(withProgression(exercise, { increment: e.target.value || 1 }))
                  }
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Nach … Sessions</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={progression.after_success ?? ''}
                  onChange={(e) =>
                    onChange(withProgression(exercise, { after_success: e.target.value || 1 }))
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>
            Vorschlag erscheint in der Auswertung — der Plan ändert sich erst nach Bestätigung.
          </p>
        </div>
      )}

      <label style={labelStyle}>Technik-Hinweis (optional)</label>
      <textarea
        value={exercise.cue}
        onChange={(e) => onChange({ ...exercise, cue: e.target.value })}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
        placeholder="Kurzer Form-Hinweis"
      />

      <label style={labelStyle}>Video-Suche (optional)</label>
      <input
        type="text"
        value={exercise.video_query}
        onChange={(e) => onChange({ ...exercise, video_query: e.target.value })}
        style={inputStyle}
        placeholder="z. B. push up form"
      />
    </div>
  );
}
