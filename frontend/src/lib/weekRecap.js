import { addDays, mondayStart, parseUtc } from './dates.js';
import { weekProgress } from './schedule.js';

export function weekGoalMet(done, total) {
  if (total === 0) return false;
  return done >= Math.ceil(total * 0.75);
}

export function buildWeekRecap(plan, weekSessionsList) {
  if (!plan?.days?.length) {
    return { weeks: [], averageDone: 0, streak: 0, total: 0 };
  }

  const total = plan.days.length;
  const weeks = weekSessionsList.map(({ weekStart, sessions }) => {
    const doneKeys = new Map();
    for (const s of sessions) {
      if (!doneKeys.has(s.day_key)) doneKeys.set(s.day_key, s);
    }
    const { done } = weekProgress(plan, doneKeys);
    const weekNumber = getIsoWeek(weekStart);
    return {
      weekStart,
      weekLabel: `KW ${weekNumber}`,
      done,
      total,
      goalMet: weekGoalMet(done, total),
    };
  });

  const averageDone =
    weeks.length > 0 ? Math.round((weeks.reduce((sum, w) => sum + w.done, 0) / weeks.length) * 10) / 10 : 0;

  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].goalMet) streak++;
    else break;
  }

  return { weeks, averageDone, streak, total };
}

export function groupSessionsByWeek(sessions, weeksCount = 4) {
  const buckets = [];
  for (let weeksAgo = weeksCount - 1; weeksAgo >= 0; weeksAgo--) {
    const weekStart = mondayStart(weeksAgo);
    const weekEnd = addDays(weekStart, 7);
    const inWeek = (sessions ?? []).filter((s) => {
      const finished = parseUtc(s.finished_at);
      return finished >= weekStart && finished < weekEnd;
    });
    buckets.push({ weekStart, sessions: inWeek });
  }
  return buckets;
}

function getIsoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
