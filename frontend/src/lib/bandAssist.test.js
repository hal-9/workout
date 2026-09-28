import { describe, expect, it } from 'vitest';
import { isBandAssisted, usesBandMetric } from 'shared/bandAssist';

describe('isBandAssisted', () => {
  it('Plan-Flag schlägt Namenserkennung, Halten erlaubt, % KG nur bei Wdh.', () => {
    expect(isBandAssisted({ id: 'dead-hang', name: 'Dead Hang', type: 'time', band_assisted: true })).toBe(true);
    expect(isBandAssisted({ id: 'band-assisted-pullup', name: 'Klimmzug', type: 'bw', band_assisted: false })).toBe(false);
    expect(isBandAssisted({ id: 'band-assisted-pullup', name: 'Klimmzug', type: 'bw' })).toBe(true);
    expect(isBandAssisted({ id: 'x', name: 'Assisted Row', type: 'wt', band_assisted: true })).toBe(false);
    expect(usesBandMetric({ id: 'dead-hang', name: 'Dead Hang', type: 'time', band_assisted: true }, 80)).toBe(false);
    expect(usesBandMetric({ id: 'scapular-pullup', name: 'Scapular Pull-up', type: 'bw', band_assisted: true }, 80)).toBe(true);
  });
});
