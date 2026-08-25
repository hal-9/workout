import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { formatProposalChange } from '../lib/progressionView.js';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function ProgressionProposals({ proposals = [], deload }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const applyMutation = useMutation({
    mutationFn: (exerciseIds) => api.post('/progression/apply', { exercise_ids: exerciseIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });
      showToast('Plan aktualisiert');
    },
    onError: () => showToast('Übernahme fehlgeschlagen', 'error'),
  });

  if (!proposals.length && !deload) return null;

  return (
    <Card>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Nächste Session</h3>
      {deload && (
        <p style={{ fontSize: 12, color: 'var(--accent)', margin: '0 0 12px' }}>
          Deload-Woche — Gewichte etwas zurücknehmen.
        </p>
      )}
      {proposals.map((p) => (
        <div
          key={p.exercise_id}
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>
            {formatProposalChange(p)}
          </div>
          {p.rationale && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{p.rationale}</div>
          )}
          <Button
            variant="secondary"
            onClick={() => applyMutation.mutate([p.exercise_id])}
            disabled={applyMutation.isPending}
            style={{ marginTop: 8, padding: '8px 12px', fontSize: 13, minHeight: 36 }}
          >
            Übernehmen
          </Button>
        </div>
      ))}
    </Card>
  );
}
