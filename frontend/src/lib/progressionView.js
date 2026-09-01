import { formatDuration } from 'shared/duration';
import { parseUtc } from './dates.js';

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

const HEADLINES = {
  default_weight_kg: 'Gewicht erhöhen',
  target_reps: 'Wiederholungen erhöhen',
  target_seconds: 'Haltezeit erhöhen',
};

/** Handlungsaussage statt Feldname — steht als Titel über dem Vorschlag. */
export function proposalHeadline(proposal) {
  return HEADLINES[proposal?.field] ?? 'Anpassung empfohlen';
}

function evidenceSets(proposal) {
  return (proposal?.evidence ?? []).flatMap((e) => e.sets ?? []);
}

function setCount(proposal) {
  return Math.max(0, ...(proposal?.evidence ?? []).map((e) => e.sets?.length ?? 0));
}

function repsLabel(proposal) {
  const reps = evidenceSets(proposal)
    .map((s) => Number(s.reps))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!reps.length) return null;
  const min = Math.min(...reps);
  const allEqual = reps.every((r) => r === min);
  return allEqual ? `${min} Wdh.` : `mindestens ${min} Wdh.`;
}

/** Warum es diesen Vorschlag gibt — in ganzen Sätzen, aus den echten Sessions abgeleitet. */
export function proposalWhy(proposal) {
  const sessions = proposal?.sessions_in_streak ?? proposal?.evidence?.length ?? 0;
  const sessionsLabel = sessions === 1 ? 'in der letzten Session' : `in den letzten ${sessions} Sessions`;
  const sets = setCount(proposal);
  const setsLabel = sets > 0 ? (sets === 1 ? 'den Arbeitssatz' : `alle ${sets} Arbeitssätze`) : 'alle Arbeitssätze';

  if (proposal?.field === 'default_weight_kg') {
    const reps = repsLabel(proposal);
    const weight = formatProposalValue(proposal, 'from');
    return `Du hast ${sessionsLabel} ${setsLabel} mit ${reps ?? 'dem Zielwert'} bei ${weight} geschafft.`;
  }

  if (proposal?.field === 'target_seconds') {
    return `Du hast ${sessionsLabel} ${setsLabel} die Zieldauer von ${formatProposalValue(proposal, 'from')} gehalten.`;
  }

  if (proposal?.field === 'target_reps') {
    return `Du hast ${sessionsLabel} ${setsLabel} am oberen Ende des Zielbereichs (${formatProposalValue(
      proposal,
      'from'
    )} Wdh.) abgeschlossen.`;
  }

  return `Ziel ${sessionsLabel} erreicht.`;
}

/** Was die Übernahme konkret ändert. */
export function proposalEffect(proposal) {
  const to = formatProposalValue(proposal, 'to');
  if (proposal?.field === 'default_weight_kg') {
    return `Übernehmen setzt das Plan-Gewicht auf ${to}. Der Wiederholungsbereich bleibt unverändert.`;
  }
  if (proposal?.field === 'target_seconds') {
    return `Übernehmen setzt die Zieldauer auf ${to}.`;
  }
  if (proposal?.field === 'target_reps') {
    return `Übernehmen setzt den Zielbereich auf ${to} Wdh. Das Gewicht bleibt unverändert.`;
  }
  return `Übernehmen setzt den Zielwert auf ${to}.`;
}

function formatSet(set) {
  const reps = Number(set?.reps);
  const weight = Number(set?.weight_kg);
  const duration = Number(set?.duration_s);
  if (Number.isFinite(duration) && duration > 0) return formatDuration(duration);
  if (Number.isFinite(reps) && Number.isFinite(weight) && weight > 0) {
    return `${reps}×${Math.round(weight * 10) / 10} kg`;
  }
  if (Number.isFinite(reps)) return `${reps} Wdh.`;
  return '—';
}

/** Eine Beleg-Zeile: "31.08. · 12×7.5 kg · 12×7.5 kg". */
export function formatEvidenceEntry(entry) {
  const sets = (entry?.sets ?? []).map(formatSet);
  const date = entry?.finished_at
    ? parseUtc(entry.finished_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : null;
  return [date, ...sets].filter(Boolean).join(' · ');
}

/** 'YYYY-MM-DD' → '07.09.' für die Snooze-Rückmeldung. */
export function formatSnoozedUntil(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-');
  return `${d}.${m}.`;
}
