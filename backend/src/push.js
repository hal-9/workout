import webpush from 'web-push';
import { listFriends } from './friends.js';

// Web Push: Versand + Subscription-Verwaltung. Ohne VAPID-Keys im Env ist
// alles ein No-Op (fail quiet) — die App funktioniert ohne Push vollständig.
export const PUSH_CATEGORIES = ['timer', 'friends', 'weekly', 'wrapped'];

let vapidConfigured = false;

export function pushEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureVapid() {
  if (vapidConfigured || !pushEnabled()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@localhost',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

export function saveSubscription(db, userId, subscription, categories) {
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, categories_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       categories_json = excluded.categories_json`
  ).run(userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, JSON.stringify(categories));
}

export function deleteSubscription(db, userId, endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, userId);
}

function subscriptionsFor(db, userId, category) {
  return db
    .prepare('SELECT endpoint, p256dh, auth, categories_json FROM push_subscriptions WHERE user_id = ?')
    .all(userId)
    .filter((row) => {
      try {
        return JSON.parse(row.categories_json).includes(category);
      } catch {
        return false;
      }
    });
}

export function usersWithCategory(db, category) {
  const rows = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all();
  return rows.map((r) => r.user_id).filter((userId) => subscriptionsFor(db, userId, category).length > 0);
}

// Sendet an alle Geräte des Nutzers mit aktiver Kategorie. Abgelaufene
// Subscriptions (404/410) werden dabei aufgeräumt.
export async function sendPush(db, userId, category, payload) {
  if (!pushEnabled()) return;
  ensureVapid();
  const subs = subscriptionsFor(db, userId, category);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    })
  );
}

// Pausen-Timer: ein In-Memory-Timeout pro Nutzer (ein Prozess, kein Cluster).
// Das Frontend plant nur beim Wechsel in den Hintergrund und storniert beim
// Zurückkommen — kein Push, während die App sichtbar ist.
const timerTimeouts = new Map();

export function schedulePushTimer(db, userId, seconds) {
  cancelPushTimer(userId);
  const timeout = setTimeout(() => {
    timerTimeouts.delete(userId);
    sendPush(db, userId, 'timer', {
      title: 'Pause vorbei',
      body: 'Weiter geht’s — nächster Satz. 💪',
      url: '/heute',
    }).catch(() => {});
  }, seconds * 1000);
  if (typeof timeout.unref === 'function') timeout.unref();
  timerTimeouts.set(userId, timeout);
}

export function cancelPushTimer(userId) {
  const existing = timerTimeouts.get(userId);
  if (existing) clearTimeout(existing);
  timerTimeouts.delete(userId);
}

// Fire-and-forget-Hook nach POST /sessions/:id/finish (Präzedenzfall: runEvaluation).
export async function notifyFriendsOfFinish(db, user) {
  if (!pushEnabled()) return;
  const friends = listFriends(db, user.id);
  await Promise.all(
    friends.map((friend) =>
      sendPush(db, friend.id, 'friends', {
        title: `${user.name} hat trainiert 💪`,
        body: 'Gerade ein Workout abgeschlossen.',
        url: '/freunde',
      })
    )
  );
}
