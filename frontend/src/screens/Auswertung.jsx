import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { formatDuration } from 'shared/duration';
import { formatProposalChange, proposalReason } from '../lib/progressionView.js';
import { clearOverride } from '../lib/weightOverrides.js';
import { shareCard, shareCardColors } from '../lib/shareCard.js';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export default function Auswertung() {
  const { id } = useParams();
  const location = useLocation();
  const [fetched, setFetched] = useState(null);

  // Direktaufruf (z.B. aus der Historie): Summary vom Server statt Router-State
  const known = location.state ?? fetched;
  const summary = known?.summary;
  const hasEvaluation = known ? (known.evaluation ?? true) : null;

  const [evaluation, setEvaluation] = useState(null);
  const [pollKey, setPollKey] = useState(0);
  const startedAtRef = useRef(Date.now());
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState(null);
  const [applyState, setApplyState] = useState({ status: 'idle', error: null, count: 0 });
  const [sharing, setSharing] = useState(false);

  // Share-Card gibt es nur direkt nach dem Finish — new_records entstehen
  // ausschließlich zur Finish-Zeit und kommen über den Navigation-State mit.
  const shareStats = location.state?.stats ?? null;

  async function handleShare() {
    if (sharing || !shareStats) return;
    setSharing(true);
    try {
      await shareCard({
        colors: shareCardColors(),
        dayName: location.state?.day_name || 'Workout',
        dateLabel: new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        stats: shareStats,
        records: location.state?.records ?? [],
      });
    } catch {
      /* Teilen ist optional */
    } finally {
      setSharing(false);
    }
  }

  const { data: progression } = useQuery({
    queryKey: ['progression-proposals'],
    queryFn: () => api.get('/progression/proposals'),
    retry: false,
  });

  useEffect(() => {
    if (location.state) return;
    let cancelled = false;
    api
      .get(`/sessions/${id}/summary`)
      .then((res) => {
        if (!cancelled) setFetched(res);
      })
      .catch(() => {
        if (!cancelled) setFetched({ summary: null, evaluation: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, location.state]);

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

  const proposals = progression?.proposals ?? [];
  // Vorauswahl: alle Vorschläge angehakt, bis der Nutzer etwas abwählt.
  const selected = selectedIds ?? new Set(proposals.map((p) => p.exercise_id));

  function toggleProposal(exerciseId) {
    const next = new Set(selected);
    if (next.has(exerciseId)) next.delete(exerciseId);
    else next.add(exerciseId);
    setSelectedIds(next);
  }

  async function applyProposals() {
    const exerciseIds = [...selected];
    if (!exerciseIds.length) return;

    setApplyState({ status: 'saving', error: null, count: 0 });
    try {
      const res = await api.post('/progression/apply', { exercise_ids: exerciseIds });
      // Lokale Gewichts-Overrides sind jetzt überholt — der Plan führt.
      for (const applied of res.applied ?? []) clearOverride(applied.exercise_id);
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setApplyState({ status: 'done', error: null, count: res.applied?.length ?? 0 });
    } catch (err) {
      setApplyState({ status: 'error', error: err.message || 'Fehler beim Speichern', count: 0 });
    }
  }

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2>Auswertung</h2>
        {shareStats && (
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              borderRadius: 11,
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {sharing ? 'Erstelle…' : 'Als Bild teilen'}
          </button>
        )}
      </div>
      {fetched?.day_name && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -6 }}>
          {fetched.day_name}
          {fetched.finished_at &&
            ` · ${new Date(fetched.finished_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE')}`}
        </p>
      )}

      {!known && <p style={{ color: 'var(--muted)' }}>Lade…</p>}

      {known && !hasEvaluation && (
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
              background: 'var(--primary-grad)',
              color: 'var(--on-primary)',
            }}
          >
            Erneut auswerten
          </button>
        </div>
      )}

      {applyState.status === 'done' && (
        <div
          style={{
            background: 'var(--success-dim)',
            border: '1px solid var(--success)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--success)',
          }}
        >
          Plan aktualisiert — {applyState.count} Übung{applyState.count === 1 ? '' : 'en'} angepasst.
          Die alte Version bleibt als Historie erhalten.
        </div>
      )}

      {applyState.status !== 'done' && proposals.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Plan anpassen?</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
            Ziel mehrfach erreicht. Übernehmen legt eine neue Plan-Version an.
          </p>

          {proposals.map((proposal) => {
            const checked = selected.has(proposal.exercise_id);
            return (
              <label
                key={proposal.exercise_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 0',
                  borderTop: '1px solid var(--line)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProposal(proposal.exercise_id)}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, display: 'block' }}>{proposal.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                    {proposalReason(proposal)}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  {formatProposalChange(proposal)}
                </span>
              </label>
            );
          })}

          {applyState.error && (
            <p style={{ color: 'var(--danger)', fontSize: 12, margin: '10px 0 0' }}>{applyState.error}</p>
          )}

          <button
            type="button"
            onClick={applyProposals}
            disabled={applyState.status === 'saving' || selected.size === 0}
            className="btn primary"
            style={{
              width: '100%',
              marginTop: 14,
              border: 'none',
              borderRadius: 13,
              padding: 13,
              fontWeight: 600,
              fontSize: 14,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              background: selected.size === 0 ? 'var(--surface2)' : 'var(--primary-grad)',
              color: selected.size === 0 ? 'var(--muted)' : 'var(--on-primary)',
            }}
          >
            {applyState.status === 'saving' ? 'Wird gespeichert…' : 'Plan anpassen'}
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
              <strong>{ex.name ?? ex.exercise_id}</strong>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {ex.sets
                  .map(
                    (s) =>
                      `Satz ${s.set_number}: ${s.reps ?? (s.duration_s != null ? formatDuration(s.duration_s) : '-')}`
                  )
                  .join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
