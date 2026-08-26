import { useEffect, useState } from 'react';

function formatMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMinutes(ms) {
  return `${Math.max(0, Math.floor(ms / 60000))} min`;
}

// Eigener Sekunden-Tick, damit nur dieses Label neu rendert und nicht der ganze Heute-Screen.
export default function ElapsedTimer({ startedAt, variant = 'mmss' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const ms = startedAt ? now - startedAt : 0;
  return <>{variant === 'minutes' ? formatMinutes(ms) : formatMMSS(ms)}</>;
}
