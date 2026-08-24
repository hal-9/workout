import { describe, it, expect } from 'vitest';
import {
  deloadMessage,
  formatProposalChange,
  formatProposalValue,
  proposalReason,
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
