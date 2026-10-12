import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { formatDuration } from 'shared/duration';
import { formatProposalChange, proposalReason } from '../lib/progressionView.js';
import { clearOverride } from '../lib/weightOverrides.js';
import { shareCard, shareCardColors } from '../lib/shareCard.js';
import CoachSummary from '../components/CoachSummary.jsx';
import { hintKey } from '../lib/coachSummary.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import '../styles/kal.css';

const sectionTitle = { margin: '0 0 4px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' };

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
  const [hintStates, setHintStates] = useState({});

  // Coach-Empfehlung → Zielwert für die nächste Session mit der Übung.
  async function applyHint(rec) {
    const key = hintKey(rec);
    setHintStates((prev) => ({ ...prev, [key]: 'saving' }));
    try {
      await api.post('/coach/hints', {
        session_id: Number(id),
        hints: [{ exercise_id: rec.exercise_id, field: rec.field, value: rec.value }],
      });
      setHintStates((prev) => ({ ...prev, [key]: 'done' }));
    } catch {
      setHintStates((prev) => ({ ...prev, [key]: 'error' }));
    }
  }

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
    <div className="wrap" style={{ paddingBottom: 24 }}>
      <header style={{ marginTop: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Auswertung</h1>
          {shareStats && (
            <Button
              variant="secondary"
              onClick={handleShare}
              disabled={sharing}
              style={{ flexShrink: 0, padding: '0 16px', fontSize: 14 }}
            >
              {sharing ? 'Erstelle…' : 'Als Bild teilen'}
            </Button>
          )}
        </div>
        {fetched?.day_name && (
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {fetched.day_name}
            {fetched.finished_at &&
              ` · ${new Date(fetched.finished_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE')}`}
          </p>
        )}
      </header>

      {!known && <p style={{ color: 'var(--muted)', fontSize: 15 }}>Lade…</p>}

      {known && !hasEvaluation && (
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>Keine Auswertung (keine Sätze geloggt).</p>
      )}

      {hasEvaluation && (!evaluation || evaluation.status === 'pending') && (
        <p role="status" style={{ color: 'var(--muted)', fontSize: 15 }}>
          Auswertung wird erstellt…
        </p>
      )}

      {hasEvaluation && evaluation?.status === 'ok' && (
        <div style={{ marginBottom: 28 }}>
          {evaluation.summary ? (
            <CoachSummary summary={evaluation.summary} hintStates={hintStates} onApply={applyHint} />
          ) : (
            // Auswertungen vor der strukturierten Version liegen nur als Markdown vor.
            <div className="kal-prose">
              <ReactMarkdown>{evaluation.summary_md}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {hasEvaluation && evaluation?.status === 'failed' && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--danger)', fontSize: 15, margin: '0 0 12px' }}>{evaluation.error}</p>
          <Button variant="secondary" onClick={retry}>
            Erneut auswerten
          </Button>
        </div>
      )}

      {applyState.status === 'done' && (
        <div
          role="status"
          className="neu-inset"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            borderRadius: 20,
            padding: '14px 16px',
            marginBottom: 28,
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          <Icon name="check" size={18} style={{ color: 'var(--success)', marginTop: 1 }} />
          <span>
            Plan aktualisiert — {applyState.count} Übung{applyState.count === 1 ? '' : 'en'} angepasst.
            <span style={{ color: 'var(--muted)' }}> Die alte Version bleibt als Historie erhalten.</span>
          </span>
        </div>
      )}

      {applyState.status !== 'done' && proposals.length > 0 && (
        <Card style={{ marginBottom: 28 }}>
          <h2 style={sectionTitle}>Plan anpassen?</h2>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)' }}>
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
                  gap: 12,
                  minHeight: 52,
                  padding: '8px 0',
                  borderTop: '1px solid var(--line)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProposal(proposal.exercise_id)}
                  style={{ width: 22, height: 22, margin: 0, flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, display: 'block' }}>{proposal.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{proposalReason(proposal)}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }}>
                  {formatProposalChange(proposal)}
                </span>
              </label>
            );
          })}

          {applyState.error && (
            <p style={{ color: 'var(--danger)', fontSize: 14, margin: '10px 0 0' }}>{applyState.error}</p>
          )}

          <Button
            fullWidth
            onClick={applyProposals}
            disabled={applyState.status === 'saving' || selected.size === 0}
            style={{ marginTop: 14 }}
          >
            {applyState.status === 'saving' ? 'Wird gespeichert…' : 'Plan anpassen'}
          </Button>
        </Card>
      )}

      {summary && (
        <section>
          <h2 style={{ ...sectionTitle, marginBottom: 12 }}>Session-Zusammenfassung</h2>
          <ul className="kal-tray">
            {summary.exercises.map((ex) => (
              <li key={ex.exercise_id} style={{ padding: '10px 4px' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{ex.name ?? ex.exercise_id}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
                  {ex.sets
                    .map(
                      (s) =>
                        `Satz ${s.set_number}: ${s.reps ?? (s.duration_s != null ? formatDuration(s.duration_s) : '-')}`
                    )
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
