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

// Map<weekday, planDay>. Explicit day.weekday wins (only if every day has one), else default spread.
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

export function todayWeekday(refDate = new Date()) {
  return WEEKDAYS[weekdayIndex(refDate)];
}

// Prefer today's due workout, then the rest of the week, then any open day.
export function nextDueDayKey(plan, doneThisWeek, refDate = new Date()) {
  if (!plan?.days?.length) return undefined;
  const dueByWeekday = assignWeekdays(plan);
  const todayIdx = weekdayIndex(refDate);
  for (let i = todayIdx; i < 7; i++) {
    const day = dueByWeekday.get(WEEKDAYS[i]);
    if (day && !doneThisWeek.has(day.key)) return day.key;
  }
  return plan.days.find((d) => !doneThisWeek.has(d.key))?.key ?? plan.days[0].key;
}

// Scheduled workouts on past weekdays this week that are still open.
export function getMissedDays(plan, doneThisWeek, refDate = new Date()) {
  if (!plan?.days?.length) return [];
  const dueByWeekday = assignWeekdays(plan);
  const todayIdx = weekdayIndex(refDate);
  const missed = [];
  for (let i = 0; i < todayIdx; i++) {
    const weekday = WEEKDAYS[i];
    const day = dueByWeekday.get(weekday);
    if (day && !doneThisWeek.has(day.key)) {
      missed.push({ ...day, weekday });
    }
  }
  return missed;
}

export function missedDayKeys(plan, doneThisWeek, refDate = new Date()) {
  return new Set(getMissedDays(plan, doneThisWeek, refDate).map((d) => d.key));
}

export function weekProgress(plan, doneThisWeek) {
  if (!plan?.days?.length) return { done: 0, total: 0 };
  let done = 0;
  for (const day of plan.days) {
    if (doneThisWeek.has(day.key)) done++;
  }
  return { done, total: plan.days.length };
}
