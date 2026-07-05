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

export function todayWeekday() {
  return WEEKDAYS[(new Date().getDay() + 6) % 7];
}

// Prefer today's due workout, then the rest of the week, then any open day.
export function nextDueDayKey(plan, doneThisWeek) {
  if (!plan?.days?.length) return undefined;
  const dueByWeekday = assignWeekdays(plan);
  const todayIdx = (new Date().getDay() + 6) % 7;
  for (let i = todayIdx; i < 7; i++) {
    const day = dueByWeekday.get(WEEKDAYS[i]);
    if (day && !doneThisWeek.has(day.key)) return day.key;
  }
  return plan.days.find((d) => !doneThisWeek.has(d.key))?.key ?? plan.days[0].key;
}
