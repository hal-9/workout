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

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 12,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'var(--text)',
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

const ghostBtnStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14,
  cursor: 'pointer',
  color: 'var(--muted)',
};

const chipStyle = (active) => ({
  background: active ? 'var(--primary-dim)' : 'var(--surface2)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 999,
  padding: '8px 13px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
});

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '10px 12px',
  fontSize: 15,
};

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        Schritt {step + 1} von {total}
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((step + 1) / total) * 100}%`,
            background: 'var(--primary-grad)',
            transition: 'width .2s ease',
          }}
        />
      </div>
    </div>
  );
}

function ProposalRow({ entry, picked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: picked ? 'var(--primary-dim)' : 'var(--surface2)',
        border: `1px solid ${picked ? 'var(--primary)' : 'var(--line)'}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 6,
        cursor: 'pointer',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14 }}>
          {picked && <span style={{ color: 'var(--primary)' }}>✓ </span>}
          {entry.name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
          {formatExercisePrescription(entry)}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
        {EQUIPMENT_LABELS[entry.equipment] ?? entry.equipment} · {entry.muscle}
      </div>
    </button>
  );
}

function BlockSection({ dayKey, zone, count, equipment, entries, selection, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const proposals = useMemo(() => proposalsFor(zone, equipment, entries), [zone, equipment, entries]);
  const picked = selection[`${dayKey}:${zone}`] ?? [];
  const visible = expanded ? proposals : proposals.slice(0, Math.max(count + 2, 3));

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <strong style={{ fontSize: 15 }}>{blockLabel(zone)}</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          {picked.length} gewählt · {count} empfohlen
        </span>
      </div>

      {proposals.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Keine Übung für {blockLabel(zone)} mit deiner Ausrüstung. Ausrüstung erweitern oder später im Editor ergänzen.
        </p>
      ) : (
        <>
          {visible.map((entry) => (
            <ProposalRow
              key={entry.id}
              entry={entry}
              picked={picked.includes(entry.id)}
              onToggle={() => onToggle(dayKey, zone, entry.id)}
            />
          ))}
          {proposals.length > visible.length && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}
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
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
            Wähle einen Split — danach gehst du Muskelgruppe für Muskelgruppe durch und suchst dir Übungen aus.
          </p>
          {SPLITS.map((item) => (
            <button key={item.key} type="button" onClick={() => handlePickSplit(item)} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{item.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{item.description}</div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--primary)',
                    background: 'var(--primary-dim)',
                    padding: '4px 8px',
                    borderRadius: 8,
                  }}
                >
                  {item.days.length} Tage
                </span>
              </div>
            </button>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {onUseTemplate && (
              <button type="button" onClick={onUseTemplate} style={{ ...ghostBtnStyle, flex: 1 }}>
                Fertige Vorlage nutzen
              </button>
            )}
            {onCancel && (
              <button type="button" onClick={onCancel} style={{ ...ghostBtnStyle, flex: 1 }}>
                Abbrechen
              </button>
            )}
          </div>
        </>
      )}

      {step === 1 && split && (
        <>
          <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Was hast du zur Verfügung?</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
            Nur passende Übungen werden vorgeschlagen.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {EQUIPMENT.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleEquipment(item.key)}
                aria-pressed={equipment.has(item.key)}
                style={chipStyle(equipment.has(item.key))}
              >
                {equipment.has(item.key) ? '✓ ' : ''}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {split && dayIndex >= 0 && dayIndex < split.days.length && (
        <>
          <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>{split.days[dayIndex].name}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
            {split.days[dayIndex].focus}
          </p>
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
          <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>Fertig — passt das so?</h3>
          <label htmlFor="wizard-plan-name" style={{ fontSize: 13, color: 'var(--muted)' }}>
            Name des Plans
          </label>
          <input
            id="wizard-plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, marginTop: 6, marginBottom: 16 }}
          />

          {draftPlan.days.map((day) => (
            <div
              key={day.key}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 15 }}>{day.name}</strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {day.exercises.length} Übungen
                </span>
              </div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--muted)' }}>
                {day.exercises.map((ex) => (
                  <li key={ex.id}>
                    {ex.name} — {formatExercisePrescription(ex)}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!canSave && (
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>
              Noch keine Übung gewählt — geh zurück und wähle mindestens eine aus.
            </p>
          )}

          <button
            type="button"
            onClick={() => onSave(draftPlan)}
            disabled={!canSave || saving}
            style={{ ...primaryBtnStyle, marginTop: 6, opacity: canSave && !saving ? 1 : 0.6 }}
          >
            {saving ? 'Speichern…' : 'Plan speichern'}
          </button>
          <button
            type="button"
            onClick={() => onRefine(draftPlan)}
            disabled={!canSave}
            style={{ ...ghostBtnStyle, width: '100%', marginTop: 8 }}
          >
            Im Editor feinjustieren
          </button>
        </>
      )}

      {step > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button type="button" onClick={() => setStep((s) => s - 1)} style={{ ...ghostBtnStyle, flex: 1 }}>
            Zurück
          </button>
          {step < totalSteps - 1 && (
            <button type="button" onClick={() => setStep((s) => s + 1)} style={{ ...primaryBtnStyle, flex: 2 }}>
              Weiter{step >= 2 ? ` · ${selectionCount(selection)} Übungen` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
