import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export default function Auswertung() {
  const { id } = useParams();
  const location = useLocation();
  const summary = location.state?.summary;
  const hasEvaluation = location.state?.evaluation ?? true;

  const [evaluation, setEvaluation] = useState(null);
  const [pollKey, setPollKey] = useState(0);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!hasEvaluation) return;

    startedAtRef.current = Date.now();
    let cancelled = false;
    let timeoutId;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await api.get(`/sessions/${id}/evaluation`);
        if (cancelled) return;

        if (res.status === 'pending') {
          if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
            setEvaluation({ status: 'failed', error: 'Zeitüberschreitung' });
            return;
          }
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setEvaluation(res);
        }
      } catch {
        if (!cancelled) setEvaluation({ status: 'failed', error: 'Fehler beim Abrufen' });
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [id, hasEvaluation, pollKey]);

  async function retry() {
    await api.post(`/sessions/${id}/evaluate`);
    setEvaluation(null);
    setPollKey((k) => k + 1);
  }

  return (
    <div className="wrap">
      <h2>Auswertung</h2>

      {!hasEvaluation && (
        <p style={{ color: 'var(--muted)' }}>Keine Auswertung (keine Sätze geloggt).</p>
      )}

      {hasEvaluation && (!evaluation || evaluation.status === 'pending') && (
        <p style={{ color: 'var(--muted)' }}>Auswertung wird erstellt…</p>
      )}

      {hasEvaluation && evaluation?.status === 'ok' && (
        <div style={{ marginBottom: 20 }}>
          <ReactMarkdown>{evaluation.summary_md}</ReactMarkdown>
        </div>
      )}

      {hasEvaluation && evaluation?.status === 'failed' && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: 'var(--danger)' }}>{evaluation.error}</p>
          <button
            onClick={retry}
            className="btn primary"
            style={{
              border: 'none',
              borderRadius: 13,
              padding: 15,
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              background: 'var(--ember)',
              color: '#160a04',
            }}
          >
            Erneut auswerten
          </button>
        </div>
      )}

      {summary && (
        <div>
          <h3>Session-Zusammenfassung</h3>
          {summary.exercises.map((ex) => (
            <div
              key={ex.exercise_id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <strong>{ex.exercise_id}</strong>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {ex.sets.map((s) => `Satz ${s.set_number}: ${s.reps ?? s.duration_s ?? '-'}`).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
