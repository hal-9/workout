import { useMemo, useState } from 'react';
import { EQUIPMENT, EQUIPMENT_LABELS } from 'shared/muscles';
import { libraryEntries } from '../../lib/exerciseLibrary.js';
import { formatExercisePrescription } from '../../lib/planDefaults.js';
import {
  SPLITS,
  blockLabel,
  buildPlanFromSelection,
  defaultSelection,
  proposalsFor,
  selectionCount,
} from '../../lib/planWizard.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';

// Antippbare Karte = erhaben; Druck über .btn.
const cardStyle = {
  display: 'block',
  background: 'var(--bg)',
  border: 'none',
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'var(--text)',
};

// Ausrüstungs-Chips: alle erhaben, gewählt mit Primär-Ring.
const chipStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: active ? 'var(--shadow-selected)' : 'var(--shadow-raised)',
  color: active ? 'var(--primary)' : 'var(--text)',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
});

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

const headingStyle = { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };

const subStyle = { color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, margin: '4px 0 16px' };

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
        Schritt {step + 1} von {total}
      </div>
      <div className="neu-raised" style={{ height: 8, borderRadius: 999, overflow: 'hidden', boxShadow: 'var(--shadow-raised)' }}>
        <div
          className="pl-progress-fill"
          style={{
            height: '100%',
            width: `${((step + 1) / total) * 100}%`,
            borderRadius: 999,
            background: 'var(--primary)',
          }}
        />
      </div>
    </div>
  );
}

// Auswahl-Kreis rechts: gewählt = gefüllt mit Haken, sonst leer erhaben.
function PickPebble({ picked }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 24,
        height: 22,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: picked ? 'var(--primary)' : 'var(--bg)',
        boxShadow: picked ? 'none' : 'var(--shadow-raised)',
        color: 'var(--on-primary)',
      }}
    >
      {picked && <Icon name="check" size={14} style={{ strokeWidth: 2.6 }} />}
    </span>
  );
}

function ProposalRow({ entry, picked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      className="pl-press"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        minHeight: 44,
        textAlign: 'left',
        background: 'none',
        border: 'none',
        borderRadius: 14,
        padding: '10px 6px',
        cursor: 'pointer',
        color: 'var(--text)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, lineHeight: 1.35, fontWeight: picked ? 600 : 400 }}>{entry.name}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          {formatExercisePrescription(entry)} · {EQUIPMENT_LABELS[entry.equipment] ?? entry.equipment} · {entry.muscle}
        </span>
      </span>
      <PickPebble picked={picked} />
    </button>
  );
}

function BlockSection({ dayKey, zone, count, equipment, entries, selection, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const proposals = useMemo(() => proposalsFor(zone, equipment, entries), [zone, equipment, entries]);
  const picked = selection[`${dayKey}:${zone}`] ?? [];
  const visible = expanded ? proposals : proposals.slice(0, Math.max(count + 2, 3));

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{blockLabel(zone)}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {picked.length} gewählt · {count} empfohlen
        </span>
      </div>

      {proposals.length === 0 ? (
        <p style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--muted)', margin: 0 }}>
          Keine Übung für {blockLabel(zone)} mit deiner Ausrüstung. Ausrüstung erweitern oder später im Editor ergänzen.
        </p>
      ) : (
        <>
          <ul className="pl-tray">
            {visible.map((entry) => (
              <li key={entry.id}>
                <ProposalRow
                  entry={entry}
                  picked={picked.includes(entry.id)}
                  onToggle={() => onToggle(dayKey, zone, entry.id)}
                />
              </li>
            ))}
          </ul>
          {proposals.length > visible.length && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn"
              style={{ minHeight: 44, marginTop: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '0 4px' }}
            >
              {proposals.length - visible.length} weitere anzeigen
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function PlanWizard({ onSave, onRefine, onCancel, onUseTemplate, saving }) {
  const entries = useMemo(() => libraryEntries(), []);
  const [step, setStep] = useState(0);
  const [split, setSplit] = useState(null);
  const [equipment, setEquipment] = useState(() => new Set(EQUIPMENT.map((item) => item.key)));
  const [selection, setSelection] = useState({});
  const [name, setName] = useState('');

  const totalSteps = split ? split.days.length + 3 : 3;
  const dayIndex = step - 2;

  const handlePickSplit = (nextSplit) => {
    setSplit(nextSplit);
    setName(nextSplit.title);
    setSelection(defaultSelection(nextSplit, equipment, entries));
    setStep(1);
  };

  const toggleEquipment = (key) => {
    setEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Vorauswahl neu berechnen — sonst stehen Übungen drin, die es nicht gibt.
      if (split) setSelection(defaultSelection(split, next, entries));
      return next;
    });
  };

  const toggleExercise = (dayKey, zone, entryId) => {
    setSelection((prev) => {
      const key = `${dayKey}:${zone}`;
      const current = prev[key] ?? [];
      return {
        ...prev,
        [key]: current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
      };
    });
  };

  const draftPlan = useMemo(
    () => (split ? buildPlanFromSelection({ name, split, selection, entries }) : null),
    [split, name, selection, entries]
  );

  const canSave = Boolean(draftPlan?.days.length);

  return (
    <div>
      {step > 0 && <ProgressBar step={step} total={totalSteps} />}

      {step === 0 && (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.45, margin: '0 0 16px' }}>
            Wähle einen Split — danach gehst du Muskelgruppe für Muskelgruppe durch und suchst dir Übungen aus.
          </p>
          {SPLITS.map((item) => (
            <button key={item.key} type="button" onClick={() => handlePickSplit(item)} className="neu-raised btn" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{item.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{item.description}</div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--muted)',
                    background: 'var(--bg)',
                    boxShadow: 'var(--shadow-raised)',
                    padding: '5px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.days.length} Tage
                </span>
              </div>
            </button>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {onUseTemplate && (
              <Button variant="secondary" onClick={onUseTemplate} style={{ flex: 1 }}>
                Fertige Vorlage nutzen
              </Button>
            )}
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} style={{ flex: 1 }}>
                Abbrechen
              </Button>
            )}
          </div>
        </>
      )}

      {step === 1 && split && (
        <>
          <h3 style={headingStyle}>Was hast du zur Verfügung?</h3>
          <p style={subStyle}>Nur passende Übungen werden vorgeschlagen.</p>
          <div className="neu-raised" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 26, marginBottom: 20 }}>
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
        </>
      )}

      {split && dayIndex >= 0 && dayIndex < split.days.length && (
        <>
          <h3 style={headingStyle}>{split.days[dayIndex].name}</h3>
          <p style={{ ...subStyle, marginBottom: 20 }}>{split.days[dayIndex].focus}</p>
          {split.days[dayIndex].blocks.map(([zone, count]) => (
            <BlockSection
              key={zone}
              dayKey={split.days[dayIndex].key}
              zone={zone}
              count={count}
              equipment={equipment}
              entries={entries}
              selection={selection}
              onToggle={toggleExercise}
            />
          ))}
        </>
      )}

      {split && step === totalSteps - 1 && (
        <>
          <h3 style={{ ...headingStyle, marginBottom: 16 }}>Fertig — passt das so?</h3>
          <label htmlFor="wizard-plan-name" style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>
            Name des Plans
          </label>
          <input
            id="wizard-plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, marginTop: 6, marginBottom: 20 }}
          />

          {draftPlan.days.map((day) => (
            <Card key={day.key} style={{ paddingBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{day.name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {day.exercises.length} Übungen
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {day.exercises.map((ex) => (
                  <li
                    key={ex.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                      padding: '10px 0',
                      borderTop: '1px solid var(--line)',
                      fontSize: 15,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>{ex.name}</span>
                    <span style={{ flexShrink: 0, fontSize: 14, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {formatExercisePrescription(ex)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {!canSave && (
            <p style={{ color: 'var(--danger)', fontSize: 14 }}>
              Noch keine Übung gewählt — geh zurück und wähle mindestens eine aus.
            </p>
          )}

          <Button fullWidth onClick={() => onSave(draftPlan)} disabled={!canSave || saving} style={{ marginTop: 6 }}>
            {saving ? 'Speichern…' : 'Plan speichern'}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => onRefine(draftPlan)} disabled={!canSave} style={{ marginTop: 12 }}>
            Im Editor feinjustieren
          </Button>
        </>
      )}

      {step > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} style={{ flex: 1 }}>
            Zurück
          </Button>
          {step < totalSteps - 1 && (
            <Button onClick={() => setStep((s) => s + 1)} style={{ flex: 2 }}>
              Weiter{step >= 2 ? ` · ${selectionCount(selection)} Übungen` : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
