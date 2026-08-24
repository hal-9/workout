import { formatDuration } from 'shared/duration';

export function formatProposalValue(proposal, key) {
  const value = proposal?.[key];
  if (value == null) return '—';
  if (proposal.field === 'target_seconds') return formatDuration(value);
  if (proposal.field === 'default_weight_kg') return `${Math.round(value * 10) / 10} kg`;
  return String(value);
}

// "40 kg → 42.5 kg" bzw. "8-12 → 10-14 Wdh."
export function formatProposalChange(proposal) {
  const from = formatProposalValue(proposal, 'from');
  const to = formatProposalValue(proposal, 'to');
  if (proposal?.field === 'target_reps') return `${from} → ${to} Wdh.`;
  return `${from} → ${to}`;
}

export function proposalReason(proposal) {
  const count = proposal?.sessions_in_streak ?? 0;
  if (count <= 1) return 'Ziel erreicht';
  return `${count}× am Ziel`;
}

export function deloadMessage(deload) {
  if (!deload) return null;
  const percent = Math.round((1 - deload.factor) * 100);
  return `Deload-Woche (jede ${deload.every}. Woche): Gewichte um ca. ${percent} % zurücknehmen, Technik sauber halten.`;
}
