import { localDateKey } from './dates.js';
import { WEEKDAYS } from './schedule.js';

// Workout-Tausch für die aktuelle Woche: der gewählte Tag rückt in der Sequenz
// vor den ersten offenen Tag. Persistiert lokal (wie weightOverrides) und
// verfällt automatisch mit Wochenwechsel.
const STORAGE_KEY = 'weekOrder';

function currentWeekKey(refDate = new Date()) {
  const offset = (refDate.getDay() + 6) % 7;
  const monday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - offset);
  return localDateKey(monday);
}

function readOrder(refDate) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || stored.week !== currentWeekKey(refDate)) return null;
    return Array.isArray(stored.order) ? stored.order : null;
  } catch {
    return null;
  }
}

export function hasWeekOrder(refDate) {
  return readOrder(refDate) != null;
}

export function clearWeekOrder() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage nicht verfügbar */
  }
}

// Plan mit umgestellter Tages-Reihenfolge für diese Woche; ohne Override unverändert.
// Bei expliziten Wochentagen wandern die Slots mit der neuen Reihenfolge mit,
// sonst würde projectWeek den getauschten Tag weiter auf seinen alten Seed legen.
export function applyWeekOrder(plan, refDate) {
  const order = readOrder(refDate);
  if (!plan?.days?.length || !order) return plan;

  const pos = new Map(order.map((key, i) => [key, i]));
  const days = [...plan.days].sort((a, b) => {
    const ia = pos.get(a.key) ?? order.length + plan.days.indexOf(a);
    const ib = pos.get(b.key) ?? order.length + plan.days.indexOf(b);
    return ia - ib;
  });

  if (plan.days.every((d) => d.weekday)) {
    const slots = plan.days
      .map((d) => d.weekday)
      .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
    return { ...plan, days: days.map((d, i) => ({ ...d, weekday: slots[i] })) };
  }
  return { ...plan, days };
}

// dayKey vor den ersten offenen (nicht erledigten) Tag der aktuellen Sequenz schieben.
export function swapWorkout(plan, dayKey, doneKeys, refDate) {
  const current = applyWeekOrder(plan, refDate).days.map((d) => d.key);
  if (!current.includes(dayKey)) return;
  const rest = current.filter((k) => k !== dayKey);
  const firstOpen = rest.findIndex((k) => !doneKeys.has(k));
  rest.splice(firstOpen === -1 ? rest.length : firstOpen, 0, dayKey);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ week: currentWeekKey(refDate), order: rest }));
  } catch {
    /* localStorage nicht verfügbar */
  }
}
