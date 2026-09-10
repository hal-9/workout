import { useEffect } from 'react';

// Solange ein Overlay offen ist, darf der Hintergrund nicht mitscrollen —
// sonst schluckt der Body die Touch-Geste, die eigentlich das Sheet scrollen
// soll (iOS zeigt dann nur die Scrollbar am Rand). `position: fixed` statt
// `overflow: hidden`, weil Safari letzteres auf dem Body ignoriert.
let locks = 0;
let saved = null;

function lock() {
  locks += 1;
  if (locks > 1) return;
  const y = window.scrollY;
  const { position, top, left, right, width } = document.body.style;
  saved = { position, top, left, right, width, y };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !saved) return;
  const { position, top, left, right, width, y } = saved;
  saved = null;
  document.body.style.position = position;
  document.body.style.top = top;
  document.body.style.left = left;
  document.body.style.right = right;
  document.body.style.width = width;
  window.scrollTo(0, y);
}

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;
  }, [active]);
}
