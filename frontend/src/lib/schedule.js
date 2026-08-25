import { localDateKey } from './dates.js';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS = { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' };

const DEFAULT_SPREAD = {
  1: ['mon'],
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'thu', 'fri'],
  6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  7: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
};

function weekdayIndex(refDate = new Date()) {
  return (refDate.getDay() + 6) % 7;
}

export function todayWeekday(refDate = new Date()) {
  return WEEKDAYS[weekdayIndex(refDate)];
}

// Map<weekday, planDay>. Explicit day.weekday wins (only if every day has one), else default spread.
// Zeigt den Ziel-Rhythmus des Plans — die tatsächliche Wochenprojektion macht projectWeek.
export function assignWeekdays(plan) {
  const map = new Map();
  if (!plan?.days?.length) return map;
  if (plan.days.every((d) => d.weekday)) {
    for (const day of plan.days) map.set(day.weekday, day);
    return map;
  }
  const spread = DEFAULT_SPREAD[Math.min(plan.days.length, 7)];
  plan.days.slice(0, 7).forEach((day, i) => map.set(spread[i], day));
  return map;
}

// Seed-Wochentag-Index (0=Mo) je Plan-Tag; Tage jenseits von 7 haben keinen Slot.
function seedIndexes(plan) {
  if (plan.days.every((d) => d.weekday)) {
    return plan.days.map((d) => WEEKDAYS.indexOf(d.weekday));
  }
  const spread = DEFAULT_SPREAD[Math.min(plan.days.length, 7)];
  return plan.days.map((d, i) => (i < spread.length ? WEEKDAYS.indexOf(spread[i]) : null));
}

// Wochenprojektion: Plan-Tage sind eine Sequenz, keine festen Wochentage. Offene Tage rutschen
// nach hinten (nie nach vorn), Pausen-Abstände aus dem Seed-Muster bleiben erhalten und
// schrumpfen nur am Wochenende, wenn die Woche sonst nicht reicht. Nie zwei Workouts pro Tag.
// doneDates: Map<day_key, Date> — jüngste erledigte Session je Tag innerhalb dieser Woche.
export function projectWeek(plan, doneDates, refDate = new Date()) {
  const todayIdx = weekdayIndex(refDate);
  if (!plan?.days?.length) {
    return { days: [], nextKey: undefined, todayEntry: null, todayIdx, trainedToday: false };
  }

  const todayKey = localDateKey(refDate);
  let trainedToday = false;
  for (const done of doneDates.values()) {
    if (localDateKey(done) === todayKey) trainedToday = true;
  }

  const seeds = seedIndexes(plan);
  const minIdx = todayIdx + (trainedToday ? 1 : 0);

  // Vorwärts: projected = max(seed, prev + originaler Abstand, minIdx). Erledigte Tage
  // gehen mit ihrem tatsächlichen Wochentag in die Kette ein.
  const entries = [];
  let prevIdx = null;
  let prevSeed = null;
  for (let i = 0; i < plan.days.length; i++) {
    const day = plan.days[i];
    const seed = seeds[i];
    const doneAt = doneDates.get(day.key);
    if (doneAt) {
      entries.push({ ...day, seedIdx: seed, doneAt, projectedIdx: null, unplaced: false });
      prevIdx = weekdayIndex(doneAt);
      prevSeed = seed;
      continue;
    }
    if (seed == null) {
      entries.push({ ...day, seedIdx: null, doneAt: null, projectedIdx: null, unplaced: true });
      continue;
    }
    const gap = prevSeed != null ? Math.max(1, seed - prevSeed) : 0;
    const idx = Math.max(seed, minIdx, prevIdx != null ? prevIdx + gap : 0);
    entries.push({ ...day, seedIdx: seed, doneAt: null, projectedIdx: idx, unplaced: false });
    prevIdx = idx;
    prevSeed = seed;
  }

  // Rückwärts klemmen: späte Abstände schrumpfen zuerst, damit alles vor Sonntag Platz findet.
  const open = entries.filter((e) => e.projectedIdx != null);
  let cap = 6;
  for (let i = open.length - 1; i >= 0; i--) {
    if (open[i].projectedIdx > cap) open[i].projectedIdx = cap;
    cap = open[i].projectedIdx - 1;
  }

  // Vorwärts reparieren: Reihenfolge + minIdx + nie zwei am selben Tag; was hinter
  // Sonntag fällt, ist diese Woche nicht mehr unterzubringen.
  let floor = minIdx;
  for (const entry of open) {
    if (entry.projectedIdx < floor) entry.projectedIdx = floor;
    if (entry.projectedIdx > 6) {
      entry.projectedIdx = null;
      entry.unplaced = true;
      continue;
    }
    floor = entry.projectedIdx + 1;
  }

  const firstOpen = entries.find((e) => !e.doneAt);
  const nextKey = firstOpen?.key ?? plan.days[0].key;
  const todayEntry = entries.find((e) => e.projectedIdx === todayIdx) ?? null;

  return { days: entries, nextKey, todayEntry, todayIdx, trainedToday };
}

export function weekProgress(plan, doneThisWeek) {
  if (!plan?.days?.length) return { done: 0, total: 0 };
  let done = 0;
  for (const day of plan.days) {
    if (doneThisWeek.has(day.key)) done++;
  }
  return { done, total: plan.days.length };
}
