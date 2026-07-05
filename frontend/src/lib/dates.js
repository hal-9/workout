export function parseUtc(ts) {
  return new Date(ts.replace(' ', 'T') + 'Z');
}

export function mondayStart(weeksAgo = 0) {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset - weeksAgo * 7);
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function localDateKey(date) {
  const p = (x) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function toSqlUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function formatWeekLabel(weekStart) {
  const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}
