import { describe, expect, it } from 'vitest';
import { applyReplacements, buildReplacement, rankAlternatives, scoreAlternative } from './exerciseSwap.js';

// Eigene Fixtures statt der echten Bibliothek: die Tests prüfen die Bewertungs-
// logik, nicht den Datenbestand.
const ohp = {
  id: 'ohp', name: 'Schulterdrücken (Langhantel)', muscle: 'Schultern', type: 'wt', sets: 3,
  target_reps: '6-10', default_weight_kg: 20, pattern: 'push_vertical',
  zones: { primary: ['schultern_vorn'], secondary: ['schultern_seite', 'trizeps', 'core'] },
};
const bench = {
  id: 'bench', name: 'Bankdrücken', muscle: 'Brust', type: 'wt', sets: 4, target_reps: '6-10', default_weight_kg: 40,
  pattern: 'push_horizontal', zones: { primary: ['brust'], secondary: ['trizeps', 'schultern_vorn'] },
};

function entry(id, over) {
  return {
    id, name: id, muscle: id, type: 'bw', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: null,
    cue: 'cue cue cue cue cue cue', video_query: 'q', phase: 'main', equipment: 'koerpergewicht', aliases: [], ...over,
  };
}

const pike = entry('pike-pushup', { name: 'Pike Push-up', pattern: 'push_vertical', zones: { primary: ['schultern_vorn'], secondary: ['trizeps', 'core'] } });
const dbPress = entry('db-press', { name: 'Schulterdrücken (Kurzhanteln)', type: 'wt', equipment: 'kurzhantel', default_weight_kg: 10, pattern: 'push_vertical', zones: { primary: ['schultern_vorn'], secondary: ['schultern_seite', 'trizeps'] } });
const lateral = entry('lateral', { name: 'Seitheben', type: 'wt', equipment: 'kurzhantel', pattern: 'shoulder_abduction', zones: { primary: ['schultern_seite'], secondary: [] } });
const pushup = entry('pushup', { name: 'Liegestütze', pattern: 'push_horizontal', zones: { primary: ['brust'], secondary: ['trizeps', 'schultern_vorn', 'core'] } });
const dips = entry('dips', { name: 'Dips', pattern: 'elbow_extension', zones: { primary: ['brust', 'trizeps'], secondary: ['schultern_vorn'] } });
const pushdown = entry('pushdown', { name: 'Trizepsdrücken', type: 'wt', equipment: 'kabelzug', pattern: 'elbow_extension', zones: { primary: ['trizeps'], secondary: [] } });
const stretch = entry('stretch', { name: 'Brustdehnung', phase: 'cooldown', type: 'time', pattern: 'mobility', zones: { primary: ['brust'], secondary: [] } });
const entries = [pike, dbPress, lateral, pushup, dips, pushdown, stretch];

describe('scoreAlternative', () => {
  it('gleiche Primärmuskeln + gleiches Muster = Gleichwertig, mit Begründung', () => {
    const r = scoreAlternative(ohp, pike);
    expect(r.rating.key).toBe('equal');
    expect(r.reasons.map((x) => x.kind)).toEqual(expect.arrayContaining(['pattern', 'covered']));
    expect(r.reasons.find((x) => x.kind === 'covered').text).toContain('Vordere Schulter');
  });

  it('Seitheben ersetzt Schulterdrücken nicht — anderer Schulteranteil', () => {
    const r = scoreAlternative(ohp, lateral);
    expect(r.covered).toEqual([]);
    expect(r.missing).toEqual(['schultern_vorn']);
    expect(r.rating.key).toBe('partial');
  });

  it('Dach-Zone „Schultern" im Plan zählt jede Teilzone als Treffer', () => {
    const generic = { ...ohp, zones: { primary: ['schultern'], secondary: [] }, pattern: undefined };
    expect(scoreAlternative(generic, lateral).covered).toEqual(['schultern']);
    expect(scoreAlternative(generic, lateral).rating.key).toBe('good');
  });

  it('alle Primärmuskeln getroffen, anderes Muster = Guter Ersatz; nennt Zusätzliches', () => {
    const r = scoreAlternative(bench, dips);
    expect(r.rating.key).toBe('good');
    expect(r.reasons.find((x) => x.kind === 'pattern-diff')).toBeTruthy();
  });
});

describe('rankAlternatives', () => {
  it('sortiert Gleichwertig vor Gut vor Teilweise und lässt Fremdes weg', () => {
    const ranked = rankAlternatives(bench, { entries });
    expect(ranked.map((r) => r.entry.id)).toEqual(['pushup', 'dips']);
    expect(ranked.map((r) => r.entry.id)).not.toContain('pushdown');
    expect(ranked.map((r) => r.entry.id)).not.toContain('stretch');
  });

  it('filtert nach Gerät (Reisen: nur Körpergewicht)', () => {
    const all = rankAlternatives(ohp, { entries }).map((r) => r.entry.id);
    expect(all.sort()).toEqual(['db-press', 'pike-pushup']);
    const bw = rankAlternatives(ohp, { entries, equipment: ['koerpergewicht'] }).map((r) => r.entry.id);
    expect(bw).toEqual(['pike-pushup']);
  });

  it('schließt Übungen des Tages und das Original aus', () => {
    const ranked = rankAlternatives(ohp, { entries, excludeIds: new Set(['pike-pushup']) });
    expect(ranked.map((r) => r.entry.id)).toEqual(['db-press']);
    expect(rankAlternatives(pike, { entries }).map((r) => r.entry.id)).not.toContain('pike-pushup');
  });

  it('Suche zeigt auch Übungen ohne Muskel-Überdeckung', () => {
    const ranked = rankAlternatives(ohp, { entries, query: 'seith' });
    expect(ranked.map((r) => r.entry.id)).toEqual(['lateral']);
  });
});

describe('buildReplacement / applyReplacements', () => {
  it('übernimmt Satzzahl vom Original, Vorgabe vom Ersatz, Id kollisionsfrei', () => {
    const rep = buildReplacement(bench, pushup, new Set(['pushup']));
    expect(rep.id).toBe('pushup-2');
    expect(rep.sets).toBe(4);
    expect(rep.target_reps).toBe('8-12');
    expect(rep.type).toBe('bw');
    expect(rep.phase).toBe('main');
    expect(rep.pattern).toBe('push_horizontal');
  });

  it('setzt den Ersatz an die Stelle des Originals', () => {
    const day = { key: 'push', exercises: [bench, ohp] };
    const rep = buildReplacement(bench, pushup);
    const out = applyReplacements(day, [{ original_id: 'bench', exercise: rep }]);
    expect(out.exercises.map((e) => e.id)).toEqual(['pushup', 'ohp']);
    expect(applyReplacements(day, [])).toBe(day);
  });
});
