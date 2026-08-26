import { pushEnabled, sendPush, usersWithCategory } from './push.js';
import { wrappedStatus } from './wrapped.js';

// Geplante Pushes ohne externe Cron-Infrastruktur: stündlich prüfen, ob eine
// Sendung fällig ist. push_log (kind, period_key) verhindert Doppel-Versand
// über Neustarts. Zeitzone bewusst Europe/Berlin — die Nutzer trainieren dort.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function berlinNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: get('weekday'), // 'Mon' … 'Sun'
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

function claimPeriod(db, kind, periodKey) {
  const result = db
    .prepare('INSERT INTO push_log (kind, period_key) VALUES (?, ?) ON CONFLICT DO NOTHING')
    .run(kind, periodKey);
  return result.changes === 1;
}

function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sendWeeklyRecap(db, sundayDate) {
  // Wochenzählung ab Montag 00:00 UTC — weicht von Berlin um 1–2 Randstunden ab, bewusst akzeptiert.
  const from = `${shiftDate(sundayDate, -6)} 00:00:00`;
  for (const userId of usersWithCategory(db, 'weekly')) {
    const plan = db.prepare('SELECT json_payload FROM plans WHERE user_id = ? AND active = 1').get(userId);
    if (!plan) continue;
    let total = 0;
    try {
      total = JSON.parse(plan.json_payload).days?.length ?? 0;
    } catch {
      continue;
    }
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM sessions
         WHERE user_id = ? AND status = 'finished' AND finished_at >= ?`
      )
      .get(userId, from);
    const done = row.n;
    await sendPush(db, userId, 'weekly', {
      title: 'Dein Wochen-Recap',
      body:
        done >= total
          ? `Woche komplett: ${done}/${total} Workouts. Stark! 🎉`
          : `${done}/${total} Workouts diese Woche.`,
      url: '/fortschritt',
    });
  }
}

async function sendWrappedAvailable(db, now) {
  for (const userId of usersWithCategory(db, 'wrapped')) {
    const status = wrappedStatus(db, userId, now);
    if (!status.available || status.seen) continue;
    await sendPush(db, userId, 'wrapped', {
      title: 'Dein Monats-Rückblick ist da 🎁',
      body: 'Workouts, Tonnage, PRs — der letzte Monat in Zahlen.',
      url: '/heute',
    });
  }
}

export async function runScheduledPushes(db, date = new Date()) {
  if (!pushEnabled()) return;
  const now = berlinNow(date);

  if (now.weekday === 'Sun' && now.hour >= 18 && claimPeriod(db, 'weekly_recap', now.date)) {
    await sendWeeklyRecap(db, now.date);
  }

  if (now.date.endsWith('-01') && now.hour >= 10 && claimPeriod(db, 'wrapped', now.date.slice(0, 7))) {
    await sendWrappedAvailable(db, date);
  }
}

export function startScheduler(db) {
  if (!pushEnabled()) return null;
  const tick = () => runScheduledPushes(db).catch(() => {});
  tick();
  const interval = setInterval(tick, CHECK_INTERVAL_MS);
  if (typeof interval.unref === 'function') interval.unref();
  return interval;
}
