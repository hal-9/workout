import { describe, it, expect, beforeEach } from 'vitest';
import { CACHE_MAX_AGE_MS, cacheClear, cacheGet, cacheSet, isOfflineError } from './offlineCache.js';

function storageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
  };
}

describe('offlineCache', () => {
  beforeEach(() => {
    globalThis.localStorage = storageStub();
  });

  it('speichert und liest pro Key', () => {
    cacheSet('me', { id: 1 }, 1000);
    expect(cacheGet('me', 1000)).toEqual({ id: 1 });
    expect(cacheGet('plan', 1000)).toBeNull();
  });

  it('verwirft zu alte Einträge', () => {
    cacheSet('plan', { name: 'P' }, 0);
    expect(cacheGet('plan', CACHE_MAX_AGE_MS + 1)).toBeNull();
  });

  it('räumt beim Abmelden alles ab', () => {
    cacheSet('me', { id: 1 }, 1000);
    cacheSet('plan', { name: 'P' }, 1000);
    localStorage.setItem('lilief-theme', 'dark');
    cacheClear();
    expect(cacheGet('me', 1000)).toBeNull();
    expect(cacheGet('plan', 1000)).toBeNull();
    // Fremde Keys bleiben unangetastet.
    expect(localStorage.getItem('lilief-theme')).toBe('dark');
  });

  it('unterscheidet Netzfehler von Server-Antworten', () => {
    expect(isOfflineError(new Error('failed to fetch'))).toBe(true);
    expect(isOfflineError(Object.assign(new Error('x'), { status: 401 }))).toBe(false);
    expect(isOfflineError(null)).toBe(false);
  });
});
