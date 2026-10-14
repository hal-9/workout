import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import { equipmentLabel } from '../lib/equipment.js';

const kg = (value) => `${String(value).replace('.', ',')} kg`;

// Gewichte, die per „Hab ich nicht" markiert wurden. „Wieder da" nimmt sie
// aus der Liste — danach schlägt die Progression sie wieder vor.
export default function UnavailableWeightsDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['unavailable-weights'],
    queryFn: () => api.get('/progression/unavailable'),
    enabled: open,
  });
  const remove = useMutation({
    mutationFn: (entry) => api.delete('/progression/unavailable', entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailable-weights'] });
      queryClient.invalidateQueries({ queryKey: ['progression-proposals'] });
    },
  });
  const weights = data?.weights ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="Fehlende Gewichte">
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)' }}>
        Diese Gewichte schlägt die App nicht vor. Stattdessen gibt es eine Wiederholung mehr.
      </p>
      {weights.length === 0 && <p style={{ margin: 0, fontSize: 15 }}>Keine — alle Gewichte sind da.</p>}
      {weights.map((w) => (
        <div
          key={`${w.equipment}|${w.weight_kg}`}
          style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}
        >
          <span style={{ flex: 1, fontSize: 15 }}>
            {kg(w.weight_kg)}
            <span style={{ color: 'var(--muted)' }}>
              {' · '}
              {equipmentLabel({ equipment: w.equipment }) ?? 'diese Übung'}
            </span>
          </span>
          <Button
            variant="secondary"
            onClick={() => remove.mutate({ equipment: w.equipment, weight_kg: w.weight_kg })}
            disabled={remove.isPending}
            style={{ padding: '0 16px', fontSize: 14 }}
          >
            Wieder da
          </Button>
        </div>
      ))}
    </Dialog>
  );
}
