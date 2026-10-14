import { describe, it, expect } from 'vitest';
import { trendView } from './coachSummary.js';

describe('coachSummary', () => {
  it('unbekannter Trend fällt auf flat zurück', () => {
    expect(trendView('up').symbol).toBe('↑');
    expect(trendView('weird')).toEqual(trendView('flat'));
  });
});
