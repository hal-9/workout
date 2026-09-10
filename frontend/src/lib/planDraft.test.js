import { describe, it, expect, beforeEach } from 'vitest';
import { clearDraft, DRAFT_MAX_AGE_MS, loadDraft, saveDraft } from './planDraft.js';

const plan = { name: 'P', days: [{ key: 'a', exercises: [] }] };

// Wie in weekOrder.test.js: die Testumgebung ist Node, ohne localStorage.
function storageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('planDraft', () => {
  beforeEach(() => {
    globalThis.localStorage = storageStub();
  });

  it('speichert und liest einen Entwurf mit Zeitstempel', () => {
    saveDraft(plan, 1000);
    expect(loadDraft(1000)).toEqual({ saved_at: 1000, plan });
  });

  it('verwirft Entwürfe, die älter als eine Woche sind', () => {
    saveDraft(plan, 0);
    expect(loadDraft(DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem('lilief-plan-draft')).toBeNull();
  });

  it('ignoriert leere, kaputte und gelöschte Entwürfe', () => {
    expect(loadDraft()).toBeNull();
    localStorage.setItem('lilief-plan-draft', '{nope');
    expect(loadDraft()).toBeNull();
    saveDraft({ days: [] }, 1000);
    expect(loadDraft(1000)).toBeNull();
    saveDraft(plan, 1000);
    clearDraft();
    expect(loadDraft(1000)).toBeNull();
  });
});
