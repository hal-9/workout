import { Fragment, useState } from 'react';
import { WEEKDAYS, WEEKDAY_LABELS } from '../../lib/schedule.js';
import { suggestCooldownForDay } from '../../lib/cooldown.js';
import {
  createEmptyExercise,
} from '../../lib/planDefaults.js';
import ExerciseEditor from './ExerciseEditor.jsx';
import ExerciseLibraryPicker from './ExerciseLibraryPicker.jsx';
import { libraryEntryToExercise } from '../../lib/exerciseLibrary.js';

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '10px 12px',
  fontSize: 15,
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted)',
  marginBottom: 4,
  marginTop: 10,
};

const smallBtnStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--text)',
};

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function DayEditor({
  day,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const [open, setOpen] = useState(index === 0);
  const firstCooldownIndex = day.exercises.findIndex((ex) => ex.phase === 'cooldown');
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleNameChange = (name) => {
    onChange({ ...day, name });
  };

  const handleExerciseChange = (exIndex, exercise) => {
    const exercises = day.exercises.map((ex, i) => (i === exIndex ? exercise : ex));
    onChange({ ...day, exercises });
  };

  const handleAddExercise = () => {
    const existingIds = new Set(day.exercises.map((ex) => ex.id));
    onChange({
      ...day,
      exercises: [...day.exercises, createEmptyExercise(existingIds)],
    });
  };

  // Cooldown-Einträge hinten anhängen, Hauptübungen vor dem Cooldown einsortieren.
  const handlePickFromLibrary = (entry) => {
    const existingIds = new Set(day.exercises.map((ex) => ex.id));
    const exercise = libraryEntryToExercise(entry, existingIds);

    if (exercise.phase === 'cooldown' || firstCooldownIndex === -1) {
      onChange({ ...day, exercises: [...day.exercises, exercise] });
      return;
    }

    const next = [...day.exercises];
    next.splice(firstCooldownIndex, 0, exercise);
    onChange({ ...day, exercises: next });
  };

  const handleAddCooldown = () => {
    const existingIds = new Set(day.exercises.map((ex) => ex.id));
    const stretches = suggestCooldownForDay(day, existingIds);
    if (!stretches.length) return;
    onChange({ ...day, exercises: [...day.exercises, ...stretches] });
  };

  const handleRemoveExercise = (exIndex) => {
    if (day.exercises.length <= 1) return;
    onChange({
      ...day,
      exercises: day.exercises.filter((_, i) => i !== exIndex),
    });
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.target.open)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '4px 12px 12px',
        marginBottom: 10,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '10px 0',
          listStyle: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--primary)',
              background: 'var(--primary-dim)',
              padding: '2px 6px',
              borderRadius: 6,
              marginRight: 8,
            }}
          >
            Tag {index + 1}
          </span>
          <strong>{day.name || 'Unbenannter Tag'}</strong>
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 18 }}>{open ? '›' : '›'}</span>
      </summary>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onMoveUp} disabled={index === 0} style={smallBtnStyle}>
          Tag ↑
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} style={smallBtnStyle}>
          Tag ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={total <= 1}
          style={{ ...smallBtnStyle, color: 'var(--danger)' }}
        >
          Tag entfernen
        </button>
      </div>

      <label style={{ ...labelStyle, marginTop: 0 }}>Name</label>
      <input
        type="text"
        value={day.name}
        onChange={(e) => handleNameChange(e.target.value)}
        style={inputStyle}
        placeholder="z. B. Oberkörper A"
      />

      <label style={labelStyle}>Fokus (optional)</label>
      <input
        type="text"
        value={day.focus}
        onChange={(e) => onChange({ ...day, focus: e.target.value })}
        style={inputStyle}
        placeholder="z. B. Brust, Schultern, Trizeps"
      />

      <label style={labelStyle}>Ziel-Wochentag (optional)</label>
      <select
        value={day.weekday ?? ''}
        onChange={(e) => onChange({ ...day, weekday: e.target.value || null })}
        style={inputStyle}
      >
        <option value="">Automatisch</option>
        {WEEKDAYS.map((wd) => (
          <option key={wd} value={wd}>
            {WEEKDAY_LABELS[wd]}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Übungen</strong>
        {day.exercises.map((exercise, exIndex) => (
          <Fragment key={exercise.id}>
            {exIndex === firstCooldownIndex && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  borderTop: '1px solid var(--line)',
                  paddingTop: 10,
                  marginTop: 6,
                  marginBottom: 8,
                }}
              >
                Cooldown
              </div>
            )}
            <ExerciseEditor
              exercise={exercise}
              index={exIndex}
              total={day.exercises.length}
              onChange={(next) => handleExerciseChange(exIndex, next)}
              onRemove={() => handleRemoveExercise(exIndex)}
              onMoveUp={() => {
                const exercises = moveItem(day.exercises, exIndex, exIndex - 1);
                onChange({ ...day, exercises });
              }}
              onMoveDown={() => {
                const exercises = moveItem(day.exercises, exIndex, exIndex + 1);
                onChange({ ...day, exercises });
              }}
            />
          </Fragment>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setLibraryOpen((open) => !open)}
            style={{
              ...smallBtnStyle,
              flex: '1 1 100%',
              padding: '10px',
              borderColor: libraryOpen ? 'var(--primary)' : 'var(--line)',
              color: libraryOpen ? 'var(--primary)' : 'var(--text)',
            }}
          >
            {libraryOpen ? 'Bibliothek schließen' : 'Übung aus Bibliothek'}
          </button>
          <button
            type="button"
            onClick={handleAddExercise}
            style={{ ...smallBtnStyle, flex: 1, padding: '10px' }}
          >
            + Leere Übung
          </button>
          {firstCooldownIndex === -1 && (
            <button
              type="button"
              onClick={handleAddCooldown}
              style={{ ...smallBtnStyle, flex: 1, padding: '10px' }}
            >
              + Cooldown vorschlagen
            </button>
          )}
        </div>

        {libraryOpen && (
          <ExerciseLibraryPicker
            onPick={handlePickFromLibrary}
            onClose={() => setLibraryOpen(false)}
            usedNames={new Set(day.exercises.map((ex) => ex.name.toLowerCase()))}
          />
        )}
      </div>
    </details>
  );
}
