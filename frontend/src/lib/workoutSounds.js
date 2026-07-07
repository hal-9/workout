const STORAGE_KEY = 'soundEnabled';

let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function isSoundEnabled() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function unlockAudio() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playTone(frequency, durationMs, gain = 0.15) {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(ctx.destination);
  const now = ctx.currentTime;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function playTick() {
  playTone(880, 80, 0.12);
}

export function playRestEnd() {
  playTone(660, 120, 0.14);
  setTimeout(() => playTone(880, 160, 0.16), 140);
}
