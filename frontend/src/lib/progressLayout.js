// Persönliches Layout des Fortschritt-Tabs: Reihenfolge + ausgeblendete Karten.
// localStorage ist nur der schnelle Cache; der Server (users.progress_layout_json)
// gewinnt beim ersten Laden auf einem Gerät ohne lokale Werte.
const STORAGE_KEY = 'lilief-progress-layout';

export function getStoredLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredLayout(layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: layout.order, hidden: layout.hidden }));
}

// Gespeicherte Layouts können veraltete IDs enthalten (Karte entfernt) oder
// neue Karten noch nicht kennen — unbekannte fliegen raus, fehlende kommen
// in Default-Reihenfolge ans Ende.
export function mergeLayout(defaultIds, layout) {
  if (!layout) return { order: [...defaultIds], hidden: [] };
  const known = new Set(defaultIds);
  const order = (layout.order ?? []).filter((id) => known.has(id));
  const placed = new Set(order);
  for (const id of defaultIds) {
    if (!placed.has(id)) order.push(id);
  }
  const hidden = (layout.hidden ?? []).filter((id) => known.has(id));
  return { order, hidden };
}
