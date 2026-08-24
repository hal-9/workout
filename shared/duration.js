// Dauern liegen in der DB immer in Sekunden. Cardio-Übungen werden dem Nutzer
// in Minuten angezeigt und eingegeben, alles andere in Sekunden.

function isMinuteType(type) {
  return type === 'cardio';
}

export function durationUnitLabel(type) {
  return isMinuteType(type) ? 'Min.' : 'Sek.';
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(',', '.').trim();
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Eingabewert (Anzeige-Einheit) → Sekunden für die API
export function fromInputValue(value, type) {
  const parsed = parseNumber(value);
  if (parsed === null || parsed <= 0) return null;
  const seconds = isMinuteType(type) ? parsed * 60 : parsed;
  return Math.round(seconds);
}

// Sekunden aus der API → Eingabewert in Anzeige-Einheit
export function toInputValue(seconds, type) {
  const parsed = parseNumber(seconds);
  if (parsed === null) return '';
  if (!isMinuteType(type)) return String(Math.round(parsed));
  const minutes = parsed / 60;
  return String(Number(minutes.toFixed(2)));
}

// Reine Anzeige, unabhängig vom Übungstyp
export function formatDuration(seconds) {
  const parsed = parseNumber(seconds);
  if (parsed === null) return '';
  const total = Math.round(parsed);
  if (total < 60) return `${total} Sek`;
  const mins = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return `${mins} Min`;
  return `${mins}:${String(rest).padStart(2, '0')}`;
}
