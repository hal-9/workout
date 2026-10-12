import { Fragment, useState } from 'react';
import { WEEKDAYS, WEEKDAY_LABELS } from '../../lib/schedule.js';
import { suggestCooldownForDay } from '../../lib/cooldown.js';
import {
  createEmptyExercise,
} from '../../lib/planDefaults.js';
import ExerciseEditor from './ExerciseEditor.jsx';
import ExerciseRow from './ExerciseRow.jsx';
import Dialog from '../ui/Dialog.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import { DayPebble } from './PlanOverview.jsx';
import ExerciseLibraryPicker from './ExerciseLibraryPicker.jsx';
import { libraryEntryToExercise } from '../../lib/exerciseLibrary.js';

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

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: 'var(--muted)',
  marginBottom: 6,
  marginTop: 12,
};

const smallBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: 500,
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
  // Index der Übung, die im Blatt bearbeitet wird — null = Liste.
  const [editIndex, setEditIndex] = useState(null);

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
      className="neu-raised pl-day"
      style={{
        borderRadius: 20,
        padding: '0 16px',
        marginBottom: 14,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '14px 0',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <DayPebble active={open}>{String.fromCharCode(65 + index)}</DayPebble>
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>
          {day.name || 'Unbenannter Tag'}
          <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>
            Tag {index + 1} · {day.exercises.length} Übungen
          </span>
        </span>
        <span className="pl-chevron" style={{ display: 'flex', color: 'var(--muted)' }}>
          <Icon name="chevronRight" size={18} />
        </span>
      </summary>

      <div style={{ paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Tag nach oben"
            className="btn btn-secondary"
            style={{ ...smallBtnStyle, width: 44, padding: 0, opacity: index === 0 ? 0.45 : 1 }}
          >
            <Icon name="chevronDown" size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Tag nach unten"
            className="btn btn-secondary"
            style={{ ...smallBtnStyle, width: 44, padding: 0, opacity: index === total - 1 ? 0.45 : 1 }}
          >
            <Icon name="chevronDown" size={18} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="btn"
            style={{
              ...smallBtnStyle,
              marginLeft: 'auto',
              background: 'none',
              color: 'var(--danger)',
              opacity: total <= 1 ? 0.45 : 1,
            }}
          >
            Tag entfernen
          </button>
        </div>

        <label style={labelStyle}>Name</label>
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

        <div style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 10px' }}>Übungen</div>
        <ul className="pl-tray">
          {day.exercises.map((exercise, exIndex) => (
            <Fragment key={exercise.id}>
              {exIndex === firstCooldownIndex && (
                <li style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 6px 4px' }}>Cooldown</li>
              )}
              <li>
                <ExerciseRow
                  exercise={exercise}
                  index={exIndex}
                  total={day.exercises.length}
                  onEdit={() => setEditIndex(exIndex)}
                  onMoveUp={() => onChange({ ...day, exercises: moveItem(day.exercises, exIndex, exIndex - 1) })}
                  onMoveDown={() => onChange({ ...day, exercises: moveItem(day.exercises, exIndex, exIndex + 1) })}
                />
              </li>
            </Fragment>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setLibraryOpen((open) => !open)}
            aria-expanded={libraryOpen}
            className={libraryOpen ? 'btn' : 'btn btn-secondary'}
            style={{
              ...smallBtnStyle,
              flex: '1 1 100%',
              boxShadow: libraryOpen ? 'var(--shadow-inset-sm)' : undefined,
              color: libraryOpen ? 'var(--primary)' : 'var(--text)',
            }}
          >
            {libraryOpen ? 'Bibliothek schließen' : 'Übung aus Bibliothek'}
          </button>
          <button
            type="button"
            onClick={handleAddExercise}
            className="btn btn-secondary"
            style={{ ...smallBtnStyle, flex: '1 1 auto' }}
          >
            <Icon name="plus" size={16} />
            Leere Übung
          </button>
          {firstCooldownIndex === -1 && (
            <button
              type="button"
              onClick={handleAddCooldown}
              className="btn btn-secondary"
              style={{ ...smallBtnStyle, flex: '1 1 auto' }}
            >
              <Icon name="plus" size={16} />
              Cooldown vorschlagen
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

        <Dialog
          open={editIndex != null}
          onClose={() => setEditIndex(null)}
          title={day.exercises[editIndex]?.name || 'Übung'}
        >
          {editIndex != null && (
            <>
              <ExerciseEditor
                exercise={day.exercises[editIndex]}
                onChange={(next) => handleExerciseChange(editIndex, next)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    handleRemoveExercise(editIndex);
                    setEditIndex(null);
                  }}
                  disabled={day.exercises.length <= 1}
                  style={{ flex: 1, color: 'var(--danger)' }}
                >
                  Entfernen
                </Button>
                <Button onClick={() => setEditIndex(null)} style={{ flex: 1 }}>
                  Fertig
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </div>
    </details>
  );
}
