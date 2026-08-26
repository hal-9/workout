import { describe, it, expect } from 'vitest';
import { mergeLayout } from './progressLayout.js';

const DEFAULTS = ['a', 'b', 'c', 'd'];

describe('mergeLayout', () => {
  it('liefert Default-Reihenfolge ohne gespeichertes Layout', () => {
    expect(mergeLayout(DEFAULTS, null)).toEqual({ order: ['a', 'b', 'c', 'd'], hidden: [] });
  });

  it('übernimmt gespeicherte Reihenfolge und versteckte Karten', () => {
    const layout = { order: ['c', 'a', 'd', 'b'], hidden: ['d'] };
    expect(mergeLayout(DEFAULTS, layout)).toEqual({ order: ['c', 'a', 'd', 'b'], hidden: ['d'] });
  });

  it('wirft unbekannte IDs raus und hängt neue Karten hinten an', () => {
    const layout = { order: ['c', 'gibtsnicht', 'a'], hidden: ['gibtsnicht', 'b'] };
    expect(mergeLayout(DEFAULTS, layout)).toEqual({
      order: ['c', 'a', 'b', 'd'],
      hidden: ['b'],
    });
  });

  it('übersteht fehlende Felder', () => {
    expect(mergeLayout(DEFAULTS, {})).toEqual({ order: ['a', 'b', 'c', 'd'], hidden: [] });
  });
});
