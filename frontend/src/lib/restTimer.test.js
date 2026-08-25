import { describe, it, expect } from 'vitest';
import { remainingSeconds, startRestTimer, extendRestTimer, pauseRestTimer, resumeRestTimer } from './restTimer.js';

describe('restTimer', () => {
  it('counts down based on target timestamp', () => {
    const state = startRestTimer(90);
    expect(remainingSeconds(state)).toBeGreaterThanOrEqual(89);
    expect(remainingSeconds(state)).toBeLessThanOrEqual(90);
  });

  it('extends timer by 30 seconds', () => {
    const state = startRestTimer(10);
    const extended = extendRestTimer(state, 30);
    expect(remainingSeconds(extended)).toBeGreaterThanOrEqual(39);
  });

  it('pauses and resumes preserving remaining time', () => {
    const state = startRestTimer(60);
    const paused = pauseRestTimer(state);
    const remainingAtPause = remainingSeconds(paused);
    const resumed = resumeRestTimer(paused);
    expect(remainingSeconds(resumed)).toBeGreaterThanOrEqual(remainingAtPause - 1);
  });
});
