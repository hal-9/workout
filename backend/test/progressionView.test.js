import { describe, it, expect } from 'vitest';
import {
  deloadMessage,
  formatEvidenceEntry,
  formatProposalChange,
  formatProposalValue,
  formatSnoozedUntil,
  proposalEffect,
  proposalHeadline,
  proposalReason,
  proposalWhy,
} from '../../frontend/src/lib/progressionView.js';

describe('formatProposalValue', () => {
  it('formatiert je Feld', () => {
    expect(formatProposalValue({ field: 'default_weight_kg', from: 42.55 }, 'from')).toBe('42.6 kg');
    expect(formatProposalValue({ field: 'target_seconds', to: 1500 }, 'to')).toBe('25 Min');
    expect(formatProposalValue({ field: 'target_reps', from: '8-12' }, 'from')).toBe('8-12');
    expect(formatProposalValue({ field: 'target_reps' }, 'from')).toBe('—');
  });
});

describe('formatProposalChange', () => {
  it('zeigt den Übergang mit passender Einheit', () => {
    expect(formatProposalChange({ field: 'default_weight_kg', from: 40, to: 42.5 })).toBe('40 kg → 42.5 kg');
    expect(formatProposalChange({ field: 'target_reps', from: '8-12', to: '10-14' })).toBe('8-12 → 10-14 Wdh.');
    expect(formatProposalChange({ field: 'target_seconds', from: 30, to: 40 })).toBe('30 Sek → 40 Sek');
  });
});

describe('proposalReason', () => {
  it('benennt die Serie', () => {
    expect(proposalReason({ sessions_in_streak: 2 })).toBe('2× am Ziel');
    expect(proposalReason({ sessions_in_streak: 1 })).toBe('Ziel erreicht');
    expect(proposalReason(null)).toBe('Ziel erreicht');
  });
});

describe('deloadMessage', () => {
  it('rechnet den Faktor in Prozent um', () => {
    expect(deloadMessage({ every: 5, factor: 0.9 })).toContain('10 %');
    expect(deloadMessage({ every: 5, factor: 0.9 })).toContain('jede 5. Woche');
    expect(deloadMessage(null)).toBeNull();
  });
});

const weightProposal = {
  field: 'default_weight_kg',
  from: 7.5,
  to: 10,
  sessions_in_streak: 2,
  evidence: [
    {
      session_id: 1,
      finished_at: '2026-08-29 17:30:00',
      sets: [
        { reps: 12, weight_kg: 7.5, duration_s: null },
        { reps: 12, weight_kg: 7.5, duration_s: null },
        { reps: 12, weight_kg: 7.5, duration_s: null },
      ],
    },
    { session_id: 2, finished_at: null, sets: [{ reps: 13, weight_kg: 7.5, duration_s: null }] },
  ],
};

describe('proposalHeadline', () => {
  it('nennt die Handlung, nicht das Feld', () => {
    expect(proposalHeadline(weightProposal)).toBe('Gewicht erhöhen');
    expect(proposalHeadline({ field: 'target_reps' })).toBe('Wiederholungen erhöhen');
    expect(proposalHeadline({ field: 'target_seconds' })).toBe('Haltezeit erhöhen');
    expect(proposalHeadline(null)).toBe('Anpassung empfohlen');
  });
});

describe('proposalWhy', () => {
  it('begründet mit Serie, Satzzahl und altem Wert', () => {
    const text = proposalWhy(weightProposal);
    expect(text).toContain('in den letzten 2 Sessions');
    expect(text).toContain('alle 3 Arbeitssätze');
    expect(text).toContain('7.5 kg');
    // gemischte Wiederholungen -> untere Grenze wird benannt
    expect(text).toContain('mindestens 12 Wdh.');
  });

  it('nennt gleiche Wiederholungen ohne "mindestens"', () => {
    const uniform = {
      ...weightProposal,
      evidence: [weightProposal.evidence[0]],
      sessions_in_streak: 1,
    };
    const text = proposalWhy(uniform);
    expect(text).toContain('in der letzten Session');
    expect(text).toContain('12 Wdh.');
    expect(text).not.toContain('mindestens');
  });

  it('formuliert Dauer- und Wiederholungs-Vorschläge eigen', () => {
    expect(
      proposalWhy({ field: 'target_seconds', from: 30, sessions_in_streak: 2, evidence: [{ sets: [{ duration_s: 35 }] }] })
    ).toContain('Zieldauer von 30 Sek');
    expect(
      proposalWhy({ field: 'target_reps', from: '8-12', sessions_in_streak: 2, evidence: [{ sets: [{ reps: 12 }] }] })
    ).toContain('oberen Ende des Zielbereichs (8-12 Wdh.)');
  });
});

describe('proposalEffect', () => {
  it('sagt, was Übernehmen ändert', () => {
    expect(proposalEffect(weightProposal)).toContain('Plan-Gewicht auf 10 kg');
    expect(proposalEffect({ field: 'target_reps', to: '10-14' })).toContain('Zielbereich auf 10-14 Wdh.');
    expect(proposalEffect({ field: 'target_seconds', to: 40 })).toContain('Zieldauer auf 40 Sek');
  });
});

describe('formatEvidenceEntry', () => {
  it('zeigt Datum und Sätze', () => {
    expect(formatEvidenceEntry(weightProposal.evidence[0])).toBe('29.08. · 12×7.5 kg · 12×7.5 kg · 12×7.5 kg');
  });

  it('kommt ohne Datum und mit Dauer-Sätzen aus', () => {
    expect(formatEvidenceEntry({ sets: [{ duration_s: 45 }, { duration_s: 45 }] })).toBe('45 Sek · 45 Sek');
    expect(formatEvidenceEntry({ sets: [{ reps: 12 }] })).toBe('12 Wdh.');
    expect(formatEvidenceEntry(null)).toBe('');
  });
});

describe('formatSnoozedUntil', () => {
  it('formatiert das Datum kurz', () => {
    expect(formatSnoozedUntil('2026-09-07')).toBe('07.09.');
    expect(formatSnoozedUntil('kaputt')).toBeNull();
    expect(formatSnoozedUntil(null)).toBeNull();
  });
});
