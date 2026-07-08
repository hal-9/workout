import { useMemo, useState } from 'react';
import { planSchema } from 'shared';
import { formatZodDetails } from '../../lib/planValidation.js';

const textareaStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: 10,
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
};

const primaryBtnStyle = {
  marginTop: 10,
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
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--muted)',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        Erweitert: JSON importieren {open ? '▾' : '▸'}
      </button>

      {open && (
        <form onSubmit={handleImport} style={{ marginTop: 12 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
            Für KI-generierte Pläne oder Power-User: JSON einfügen oder .json-Datei hochladen.
          </p>

          <label
            htmlFor="plan-json-file"
            style={{
              display: 'inline-block',
              marginBottom: 10,
              padding: '8px 12px',
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              borderRadius: 9,
              fontSize: 13,
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
                marginTop: 8,
                padding: 10,
                borderRadius: 9,
                background: preview.error ? 'rgba(221,74,114,.08)' : 'var(--success-dim)',
                fontSize: 13,
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
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
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

          <button type="submit" className="btn primary" style={primaryBtnStyle} disabled={importing || !preview?.data}>
            {importing ? 'Importieren…' : 'JSON importieren'}
          </button>
        </form>
      )}
    </div>
  );
}
