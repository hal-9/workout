import { api } from '../api.js';

// Web-Push-Client: Subscription + Kategorien. Auf iOS funktioniert Push nur
// in der installierten Home-Screen-PWA. Die gewählten Kategorien werden lokal
// gespiegelt (lilief-push-categories), damit z. B. der Timer-Hook ohne
// Netzwerk-Roundtrip weiß, ob er Pushes planen soll.
export const PUSH_CATEGORY_OPTIONS = [
  { id: 'timer', label: 'Pausen-Timer', hint: 'Meldet sich, wenn die Pause bei gesperrtem Bildschirm abläuft.' },
  { id: 'friends', label: 'Freunde', hint: 'Wenn ein Freund ein Workout abschließt.' },
  { id: 'weekly', label: 'Wochen-Recap', hint: 'Sonntagabend: deine Woche in Zahlen.' },
  { id: 'wrapped', label: 'Monats-Rückblick', hint: 'Wenn dein neuer Rückblick bereitsteht.' },
];

const CATEGORIES_KEY = 'lilief-push-categories';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function storedCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeCategories(categories) {
  try {
    if (categories) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    else localStorage.removeItem(CATEGORIES_KEY);
  } catch {
    /* localStorage optional */
  }
}

export function timerPushWanted() {
  return Boolean(storedCategories()?.includes('timer'));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Fragt die Permission an, abonniert und meldet die Kategorien an den Server.
export async function enablePush(categories) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('permission denied');
  const { public_key } = await api.get('/push/public-key');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    }));
  await api.post('/push/subscribe', { subscription: sub.toJSON(), categories });
  storeCategories(categories);
}

export async function updateCategories(categories) {
  const sub = await currentSubscription();
  if (!sub) return enablePush(categories);
  await api.post('/push/subscribe', { subscription: sub.toJSON(), categories });
  storeCategories(categories);
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await api.delete('/push/subscribe', { endpoint }).catch(() => {});
  }
  storeCategories(null);
}
