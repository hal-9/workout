import { planSchema } from 'shared';
import { EXERCISE_TYPE_LABELS } from './planDefaults.js';

const FIELD_LABELS = {
  name: 'Name',
  focus: 'Fokus',
  muscle: 'Muskelgruppe',
  type: 'Typ',
  sets: 'Sätze',
  target_reps: 'Wiederholungen',
  target_seconds: 'Dauer',
  default_weight_kg: 'Startgewicht',
  cue: 'Technik-Hinweis',
  video_query: 'Video-Suche',
  weekday: 'Wochentag',
  exercises: 'Übungen',
  days: 'Trainingstage',
  schema_version: 'Schema-Version',
  key: 'Tag-Schlüssel',
  id: 'Übungs-ID',
  phase: 'Phase',
  music_url: 'Musik-Playlist',
};

function pathToGerman(path) {
  if (!path?.length) return 'Plan';
  const parts = [];
  for (let i = 0; i < path.length; i += 1) {
    const segment = path[i];
    if (segment === 'days' && typeof path[i + 1] === 'number') {
      parts.push(`Tag ${path[i + 1] + 1}`);
      i += 1;
      continue;
    }
    if (segment === 'exercises' && typeof path[i + 1] === 'number') {
      parts.push(`Übung ${path[i + 1] + 1}`);
      i += 1;
      continue;
    }
    if (FIELD_LABELS[segment]) {
      parts.push(FIELD_LABELS[segment]);
    }
  }
  return parts.join(', ') || 'Plan';
}

function messageToGerman(issue) {
  const { code, message, path } = issue;
  const location = pathToGerman(path);
  const field = path?.[path.length - 1];

  if (message === 'exercise ids must be unique within the plan') {
    return 'Übungs-IDs müssen im gesamten Plan eindeutig sein.';
  }
  if (message === 'day keys must be unique within the plan') {
    return 'Tag-Schlüssel müssen im gesamten Plan eindeutig sein.';
  }

  if (field === 'type' && code === 'invalid_enum_value') {
    const allowed = Object.values(EXERCISE_TYPE_LABELS).join(', ');
    return `${location}: Typ muss einer von ${allowed} sein.`;
  }

  if (field === 'weekday' && code === 'invalid_enum_value') {
    return `${location}: Ungültiger Wochentag.`;
  }

  if (code === 'too_small' && issue.type === 'string') {
    return `${location}: Pflichtfeld — bitte ausfüllen.`;
  }
  if (code === 'too_small' && issue.type === 'array') {
    return `${location}: Mindestens ein Eintrag erforderlich.`;
  }
  if (code === 'invalid_string' && issue.validation === 'url') {
    return `${location}: Bitte eine vollständige URL angeben (mit https://).`;
  }
  if (code === 'invalid_type') {
    return `${location}: Ungültiger Wert.`;
  }
  if (code === 'invalid_literal') {
    return `${location}: Ungültige Schema-Version.`;
  }

  return `${location}: ${message}`;
}

export function validatePlan(plan) {
  const result = planSchema.safeParse(plan);
  if (result.success) {
    return { ok: true, data: result.data, errors: [] };
  }
  const errors = result.error.issues.map((issue) => ({
    path: issue.path,
    message: messageToGerman(issue),
  }));
  return { ok: false, data: null, errors };
}

export function formatZodDetails(details) {
  if (!details?.length) return [];
  return details.map((issue) => messageToGerman(issue));
}
