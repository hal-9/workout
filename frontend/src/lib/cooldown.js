import stretchLibrary from '../data/stretches.json' with { type: 'json' };
import { uniqueSlug } from './planDefaults.js';

export const MAX_COOLDOWN_EXERCISES = 4;

export const COOLDOWN_FOCUS = [
  { key: 'push', label: 'Drücken (Brust, Schulter, Trizeps)' },
  { key: 'pull', label: 'Ziehen (Rücken, Bizeps)' },
  { key: 'legs', label: 'Beine' },
  { key: 'glutes', label: 'Gesäß & Hüfte' },
  { key: 'core', label: 'Rumpf' },
  { key: 'full', label: 'Ganzkörper' },
];

const FOCUS_KEYWORDS = {
  push: ['brust', 'schulter', 'trizeps', 'push', 'drücken', 'drucken', 'bankdrücken', 'bench', 'dip'],
  pull: ['rücken', 'ruecken', 'lat', 'latissimus', 'bizeps', 'rudern', 'row', 'klimmzug', 'pull', 'chin', 'ziehen'],
  legs: ['bein', 'leg', 'quadrizeps', 'quad', 'wade', 'calf', 'squat', 'kniebeuge', 'lunge', 'ausfallschritt', 'oberschenkel'],
  glutes: ['po', 'gesäß', 'gesaess', 'glute', 'hüfte', 'huefte', 'hip', 'thrust', 'bridge', 'brücke', 'abduktor'],
  core: ['bauch', 'core', 'rumpf', 'plank', 'planke', 'oblique', 'crunch'],
};

// Zweiter Fokus kommt nur mit, wenn er nah am Spitzenwert liegt.
const SECOND_FOCUS_RATIO = 0.4;

// Teilwort-Treffer wie "lat" in "Platte" vermeiden: Wortanfang muss stimmen.
function countHits(text, keyword) {
  if (!text) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(`(^|[^a-zäöüß])${escaped}`, 'gi'));
  return matches ? matches.length : 0;
}

function scoreFocus(day, keywords) {
  const heavy = [day?.focus, day?.name, ...(day?.exercises ?? []).map((ex) => ex.muscle)];
  const light = (day?.exercises ?? []).map((ex) => ex.name);

  let score = 0;
  for (const keyword of keywords) {
    for (const text of heavy) score += 2 * countHits(String(text ?? '').toLowerCase(), keyword);
    for (const text of light) score += countHits(String(text ?? '').toLowerCase(), keyword);
  }
  return score;
}

// Liefert die passendsten Fokus-Schlüssel (max. 2), sonst ['full'].
export function detectCooldownFocus(day) {
  const scored = Object.entries(FOCUS_KEYWORDS)
    .map(([key, keywords]) => [key, scoreFocus(day, keywords)])
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!scored.length) return ['full'];

  const [topKey, topScore] = scored[0];
  const keys = [topKey];
  const runnerUp = scored[1];
  if (runnerUp && runnerUp[1] >= topScore * SECOND_FOCUS_RATIO) {
    keys.push(runnerUp[0]);
  }
  return keys;
}

function stretchToExercise(stretch, existingIds) {
  return {
    id: uniqueSlug(stretch.id, existingIds),
    name: stretch.name,
    muscle: stretch.muscle,
    type: 'time',
    sets: 1,
    target_reps: null,
    target_seconds: stretch.target_seconds,
    default_weight_kg: null,
    cue: stretch.cue,
    video_query: `${stretch.name} Dehnung Technik`,
    phase: 'cooldown',
  };
}

// Nimmt abwechselnd aus den Fokus-Listen, damit gemischte Tage beide Seiten abdecken.
export function buildCooldownExercises(focusKeys, existingIds = new Set()) {
  const lists = (focusKeys ?? []).map((key) => stretchLibrary[key] ?? []).filter((l) => l.length);
  if (!lists.length) return [];

  const picked = [];
  const seenNames = new Set();
  for (let i = 0; picked.length < MAX_COOLDOWN_EXERCISES; i++) {
    let addedThisRound = false;
    for (const list of lists) {
      if (picked.length >= MAX_COOLDOWN_EXERCISES) break;
      const stretch = list[i];
      if (!stretch) continue;
      addedThisRound = true;
      if (seenNames.has(stretch.name)) continue;
      seenNames.add(stretch.name);
      picked.push(stretchToExercise(stretch, existingIds));
    }
    if (!addedThisRound) break;
  }
  return picked;
}

export function suggestCooldownForDay(day, existingIds = new Set()) {
  return buildCooldownExercises(detectCooldownFocus(day), existingIds);
}

export function isCooldownExercise(exercise) {
  return exercise?.phase === 'cooldown';
}

export function splitPhases(exercises = []) {
  return {
    main: exercises.filter((ex) => !isCooldownExercise(ex)),
    cooldown: exercises.filter((ex) => isCooldownExercise(ex)),
  };
}
