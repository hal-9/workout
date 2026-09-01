import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import {
  formatEvidenceEntry,
  formatProposalChange,
  formatSnoozedUntil,
  proposalEffect,
  proposalHeadline,
  proposalWhy,
} from '../lib/progressionView.js';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function ProgressionProposals({ proposals = [], deload }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [openWhy, setOpenWhy] = useState(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['plan'] });
    queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });
  }

  const applyMutation = useMutation({
    mutationFn: (exerciseIds) => api.post('/progression/apply', { exercise_ids: exerciseIds }),
    onSuccess: () => {
      refresh();
      showToast('Plan aktualisiert');
    },
    onError: () => showToast('Übernahme fehlgeschlagen', 'error'),
  });

  const snoozeMutation = useMutation({
    mutationFn: (exerciseIds) => api.post('/progression/snooze', { exercise_ids: exerciseIds }),
    onSuccess: (res) => {
      refresh();
      const until = formatSnoozedUntil(res?.snoozed_until);
      showToast(until ? `Verschoben — wieder ab ${until}` : 'Verschoben');
    },
    onError: () => showToast('Verschieben fehlgeschlagen', 'error'),
  });

  const busy = applyMutation.isPending || snoozeMutation.isPending;

  if (!proposals.length && !deload) return null;

  return (
    <Card>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Empfehlungen</h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
        Vorschläge für den Plan — nichts ändert sich, bis du übernimmst.
      </p>
      {deload && (
        <p style={{ fontSize: 12, color: 'var(--accent)', margin: '0 0 12px' }}>
          Deload-Woche — Gewichte etwas zurücknehmen.
        </p>
      )}
      {proposals.map((p) => {
        const whyOpen = openWhy === p.exercise_id;
        return (
          <div key={p.exercise_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.name}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{proposalHeadline(p)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--primary)', marginTop: 4 }}>
              {formatProposalChange(p)}
            </div>

            <p style={{ fontSize: 13, color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.45 }}>{proposalWhy(p)}</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.45 }}>
              {proposalEffect(p)}
            </p>

            {p.evidence?.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setOpenWhy(whyOpen ? null : p.exercise_id)}
                  aria-expanded={whyOpen}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 12,
                    padding: '8px 0',
                    cursor: 'pointer',
                  }}
                >
                  {whyOpen ? 'Belege ausblenden ▴' : 'Belege anzeigen ▾'}
                </button>
                {whyOpen && (
                  <div style={{ marginBottom: 4 }}>
                    {p.evidence.map((entry, i) => (
                      <div
                        key={entry.session_id ?? i}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}
                      >
                        {formatEvidenceEntry(entry)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                onClick={() => applyMutation.mutate([p.exercise_id])}
                disabled={busy}
                style={{ padding: '8px 12px', fontSize: 13, minHeight: 36 }}
              >
                Übernehmen
              </Button>
              <Button
                variant="ghost"
                onClick={() => snoozeMutation.mutate([p.exercise_id])}
                disabled={busy}
                style={{ padding: '8px 12px', fontSize: 13, minHeight: 36 }}
              >
                Nächste Woche nochmal
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
