/** Timestamp-based rest timer — survives background tab throttling. */
export const REST_DEFAULT_SECONDS = 60;

export function createRestTimerState(targetTimestampMs, pausedAtMs = null, totalSeconds = null) {
  return { targetTimestampMs, pausedAtMs, totalSeconds };
}

export function remainingSeconds(state) {
  if (!state?.targetTimestampMs) return 0;
  if (state.pausedAtMs) {
    const pausedRemaining = Math.ceil((state.targetTimestampMs - state.pausedAtMs) / 1000);
    return Math.max(0, pausedRemaining);
  }
  return Math.max(0, Math.ceil((state.targetTimestampMs - Date.now()) / 1000));
}

export function startRestTimer(durationSeconds) {
  return createRestTimerState(Date.now() + durationSeconds * 1000, null, durationSeconds);
}

export function extendRestTimer(state, extraSeconds = 30) {
  const current = remainingSeconds(state);
  const total = (state?.totalSeconds ?? current) + extraSeconds;
  return createRestTimerState(Date.now() + (current + extraSeconds) * 1000, null, total);
}

export function pauseRestTimer(state) {
  if (!state || state.pausedAtMs) return state;
  return { ...state, pausedAtMs: Date.now() };
}

export function resumeRestTimer(state) {
  if (!state?.pausedAtMs) return state;
  const remaining = Math.max(0, Math.ceil((state.targetTimestampMs - state.pausedAtMs) / 1000));
  return createRestTimerState(Date.now() + remaining * 1000, null, state.totalSeconds);
}

export function isRestTimerActive(state) {
  return state && remainingSeconds(state) > 0;
}
