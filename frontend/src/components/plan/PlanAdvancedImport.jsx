import { useMemo, useState } from 'react';
import { planSchema } from 'shared';
import { formatZodDetails } from '../../lib/planValidation.js';
import PlanPromptExport from './PlanPromptExport.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

const textareaStyle = {
  width: '100%',
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: 'var(--shadow-raised)',
  color: 'var(--text)',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.45,
};

function parseImportText(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'Ungültiges JSON — bitte Syntax prüfen.' };
  }
}

export default function PlanAdvancedImport({ hasActivePlan, onImport, importing }) {
  const [open, setOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);

  const preview = useMemo(() => {
    if (!importText.trim()) return null;
    const parsed = parseImportText(importText);
    if (!parsed.ok) return { error: parsed.error };
    if (parsed.data?.schema_version !== 1) {
      return { error: 'Nicht unterstützte Schema-Version — bitte schema_version: 1 verwenden.' };
    }
    const result = planSchema.safeParse(parsed.data);
    if (!result.success) {
      return {
        error: 'Validierung fehlgeschlagen',
        details: formatZodDetails(result.error.issues),
      };
    }
    return {
      name: result.data.name,
      days: result.data.days.length,
      exercises: result.data.days.reduce((sum, d) => sum + d.exercises.length, 0),
      data: result.data,
    };
  }, [importText]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result ?? ''));
      setImportError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError(null);
    if (!preview?.data) {
      setImportError({
        error: preview?.error ?? 'Bitte gültiges Plan-JSON einfügen.',
        details: preview?.details,
      });
      return;
    }

    if (hasActivePlan) {
      const confirmed = window.confirm(
        'Aktuellen Plan ersetzen? Dein Trainingsverlauf bleibt erhalten.'
      );
      if (!confirmed) return;
    }

    try {
      await onImport(preview.data);
      setImportText('');
    } catch (err) {
      setImportError({
        error: err.message === 'validation failed' ? 'Validierung fehlgeschlagen' : err.message,
        details: formatZodDetails(err.details),
      });
    }
  };

  return (
    <div style={{ marginTop: 28 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          minHeight: 52,
          background: 'var(--bg)',
          border: 'none',
          borderRadius: 20,
          padding: '12px 16px',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text)',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        Plan von KI erstellen & importieren
        <span className="pl-chevron" data-open={open} style={{ display: 'flex', color: 'var(--muted)' }}>
          <Icon name="chevronRight" size={18} />
        </span>
      </button>

      {open && (
        <form onSubmit={handleImport} style={{ marginTop: 20 }}>
          <PlanPromptExport />

          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, margin: '0 0 12px' }}>
            Antwort der KI hier einfügen — oder eine .json-Datei hochladen.
          </p>

          <label
            htmlFor="plan-json-file"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              marginBottom: 14,
              padding: '8px 16px',
              background: 'var(--bg)',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            JSON-Datei wählen
          </label>
          <input
            id="plan-json-file"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
            rows={8}
            placeholder="Plan-JSON hier einfügen"
            style={textareaStyle}
            aria-label="Plan JSON"
          />

          {preview && !importError && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 14,
                background: preview.error ? 'none' : 'var(--success-dim)',
                fontSize: 14,
                lineHeight: 1.45,
                color: preview.error ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {preview.error ? (
                <>
                  <div>{preview.error}</div>
                  {preview.details && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {preview.details.map((msg) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div>
                  Vorschau: <strong>{preview.name}</strong> — {preview.days} Tage, {preview.exercises}{' '}
                  Übungen
                </div>
              )}
            </div>
          )}

          {importError && (
            <div style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.45, marginTop: 10 }}>
              <div>{importError.error}</div>
              {importError.details && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {importError.details.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Sekundär: Hauptaktion der Ansicht bleibt „Bearbeiten" bzw. der Assistent. */}
          <Button type="submit" variant="secondary" fullWidth disabled={importing || !preview?.data} style={{ marginTop: 14 }}>
            {importing ? 'Importieren…' : 'JSON importieren'}
          </Button>
        </form>
      )}
    </div>
  );
}
