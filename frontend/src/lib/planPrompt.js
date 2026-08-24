import { EQUIPMENT_LABELS, MUSCLE_ZONES } from 'shared/muscles';

const EXAMPLE = {
  schema_version: 1,
  name: 'Oberkörper / Unterkörper',
  music_url: null,
  days: [
    {
      key: 'oberkoerper_a',
      name: 'Oberkörper A',
      focus: 'Drücken im Fokus',
      weekday: 'mon',
      exercises: [
        {
          id: 'bankdruecken-langhantel',
          name: 'Bankdrücken (Langhantel)',
          muscle: 'Brust · Trizeps',
          type: 'wt',
          sets: 4,
          target_reps: '6-10',
          target_seconds: null,
          default_weight_kg: 40,
          cue: 'Schulterblätter zusammen, Stange zur unteren Brust.',
          video_query: 'Bankdrücken Langhantel Technik',
          phase: 'main',
          zones: { primary: ['brust'], secondary: ['trizeps', 'schultern'] },
          equipment: 'langhantel',
        },
        {
          id: 'plank',
          name: 'Plank',
          muscle: 'Rumpf',
          type: 'time',
          sets: 3,
          target_reps: null,
          target_seconds: 45,
          default_weight_kg: null,
          cue: 'Körper eine Linie, Po anspannen.',
          video_query: 'Plank richtige Ausführung',
          phase: 'main',
          zones: { primary: ['core'], secondary: ['schultern', 'gesaess'] },
          equipment: 'koerpergewicht',
        },
        {
          id: 'brustdehnung-tuerrahmen',
          name: 'Brustdehnung am Türrahmen',
          muscle: 'Brust · Schulter',
          type: 'time',
          sets: 1,
          target_reps: null,
          target_seconds: 40,
          default_weight_kg: null,
          cue: 'Unterarm am Rahmen, Oberkörper langsam wegdrehen.',
          video_query: 'Brustdehnung Türrahmen',
          phase: 'cooldown',
          zones: { primary: ['brust'], secondary: ['schultern'] },
          equipment: 'koerpergewicht',
        },
      ],
    },
  ],
};

function contextLines({ daysPerWeek, equipment, goal, notes }) {
  const lines = [];
  if (daysPerWeek) lines.push(`- Trainingstage pro Woche: ${daysPerWeek}`);
  const available = [...(equipment ?? [])].map((key) => EQUIPMENT_LABELS[key] ?? key);
  if (available.length) lines.push(`- Verfügbare Ausrüstung: ${available.join(', ')}`);
  if (goal?.trim()) lines.push(`- Ziel: ${goal.trim()}`);
  if (notes?.trim()) lines.push(`- Weitere Hinweise: ${notes.trim()}`);
  return lines.length ? lines.join('\n') : '- (keine Angaben — triff sinnvolle Annahmen und nenne sie kurz vor dem JSON)';
}

/**
 * Prompt, den der Nutzer in einen beliebigen KI-Assistenten einfügt. Ergebnis ist
 * JSON, das der Import in dieser App unverändert annimmt.
 */
export function buildPlanPrompt(input = {}) {
  return `Du erstellst einen Trainingsplan als JSON für eine Fitness-App. Halte dich exakt an das Schema — die App validiert streng und lehnt jede Abweichung ab.

## Kontext
${contextLines(input)}

## Regeln
1. Antworte mit GENAU EINEM JSON-Objekt in einem \`\`\`json-Codeblock. Kein Text davor oder danach.
2. \`schema_version\` ist immer die Zahl 1.
3. Jede \`id\` (Übung) und jeder \`key\` (Tag) ist im GESAMTEN Plan einmalig. Kleinbuchstaben, Bindestriche, keine Umlaute (ä→ae, ö→oe, ü→ue, ß→ss).
4. Jeder Tag braucht mindestens eine Übung. Der Plan braucht mindestens einen Tag.
5. Alle Felder jeder Übung müssen gesetzt sein — unbenutzte Zahlenfelder auf \`null\`, nicht weglassen.
6. Deutsche Bezeichnungen und Cues. Der Cue ist ein kurzer Ausführungshinweis (max. 1-2 Sätze).

## Feldreferenz
- \`name\` (Plan): frei wählbar, nicht leer.
- \`music_url\`: \`null\` oder eine vollständige URL zu einer Playlist.
- Tag: \`key\` (einmalig, technisch), \`name\` (Anzeigename), \`focus\` (kurzer Fokus-Text, darf "" sein), \`weekday\`: \`null\` oder einer von \`mon\`,\`tue\`,\`wed\`,\`thu\`,\`fri\`,\`sat\`,\`sun\`. Entweder ALLE Tage bekommen einen Wochentag oder keiner.
- \`type\`: \`wt\` (mit Gewicht), \`bw\` (Körpergewicht), \`time\` (Halten/Zeit), \`cardio\`.
- \`sets\`: ganze Zahl 1-20.
- \`target_reps\`: String wie \`"8-12"\` bei \`wt\`/\`bw\`, sonst \`null\`.
- \`target_seconds\`: ganze Zahl in SEKUNDEN bei \`time\`/\`cardio\` (25 Minuten = 1500), sonst \`null\`.
- \`default_weight_kg\`: Zahl > 0 nur bei \`type: "wt"\`, sonst \`null\`.
- \`video_query\`: Suchbegriff für eine Technik-Demo auf YouTube.
- \`phase\`: \`main\` für das Training, \`cooldown\` für Dehnübungen am Ende (zählen nicht in Volumen, Rekorde und Progression). Höchstens 4 Cooldown-Übungen pro Tag, jeweils \`sets: 1\`.
- \`zones\`: Muskelgruppen für die 3D-Anzeige. \`primary\` = direkt belastet, \`secondary\` = mitarbeitend. Erlaubte Werte (nur diese, exakt so geschrieben):
  ${MUSCLE_ZONES.join(', ')}
- \`equipment\`: genau einer von: ${Object.keys(EQUIPMENT_LABELS).join(', ')}.

## Beispiel (gültiges Minimalformat)
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`

Erstelle jetzt den Plan.`;
}
