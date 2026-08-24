// Muskelzonen des 3D-Modells. Die Keys sind die Sprache zwischen Übungsdaten,
// Plan-Schema und der Highlight-Anzeige — nie freien Text vergleichen.
export const MUSCLE_ZONES = [
  'brust', 'schultern', 'bizeps', 'trizeps', 'unterarme', 'core',
  'ruecken', 'unterer_ruecken', 'gesaess', 'quads', 'hamstrings', 'waden',
];

export const ZONE_LABELS = {
  brust: 'Brust',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  unterarme: 'Unterarme',
  core: 'Rumpf',
  ruecken: 'Rücken',
  unterer_ruecken: 'Unterer Rücken',
  gesaess: 'Gesäß',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  waden: 'Waden',
};

export const EQUIPMENT = [
  { key: 'koerpergewicht', label: 'Körpergewicht' },
  { key: 'kurzhantel', label: 'Kurzhanteln' },
  { key: 'langhantel', label: 'Langhantel' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'maschine', label: 'Maschinen' },
  { key: 'kabelzug', label: 'Kabelzug' },
  { key: 'band', label: 'Widerstandsband' },
  { key: 'klimmzugstange', label: 'Klimmzugstange' },
  { key: 'cardio', label: 'Cardiogerät' },
];

export const EQUIPMENT_KEYS = EQUIPMENT.map((item) => item.key);

export const EQUIPMENT_LABELS = Object.fromEntries(EQUIPMENT.map(({ key, label }) => [key, label]));

// Fallback für handgeschriebene/importierte Übungen ohne `zones`: aus dem
// freien `muscle`-Text raten. Deutsche und englische Begriffe, weil ältere und
// KI-erzeugte Pläne beides enthalten. Reihenfolge zählt — spezifisch vor
// allgemein, damit "lower back" nicht als "back" durchrutscht.
const TEXT_RULES = [
  [/unterer?\s*r(ü|ue)cken|lower\s*back|lendenwirbel|wirbels(ä|ae)ule|erector/, ['unterer_ruecken']],
  [/latissimus|r(ü|ue)cken|\blats?\b|\bback\b|trapez|\btraps?\b|rudern|\brow\b|klimmzug|pull-?up|latzug/, ['ruecken']],
  [/brust|chest|pect|bankdr(ü|ue)cken/, ['brust']],
  [/schulter|shoulder|delt|nacken/, ['schultern']],
  [/bizeps|bicep/, ['bizeps']],
  [/trizeps|tricep/, ['trizeps']],
  [/unterarm|forearm|griff|\bgrip\b/, ['unterarme']],
  [/core|bauch|rumpf|flanke|abs\b|abdomin|oblique|plank/, ['core']],
  [/\bpo\b|ges(ä|ae)(ß|ss)|glute|h(ü|ue)ft|\bhips?\b|adduktor|abduktor|adductor|abductor/, ['gesaess']],
  [/quadrizeps|quad/, ['quads']],
  [/oberschenkelr(ü|ue)ckseite|hamstring|beinbeuger/, ['hamstrings']],
  [/wade|calf|calves|soleus/, ['waden']],
  [/oberschenkel|\bthigh/, ['quads']],
  [/\bbein|\blegs?\b/, ['quads', 'hamstrings', 'gesaess']],
  [/ganzk(ö|oe)rper|full\s*body|total\s*body/, ['brust', 'ruecken', 'schultern', 'core', 'quads', 'gesaess']],
];

function fromText(input) {
  const items = Array.isArray(input) ? input : input == null ? [] : [input];
  const out = new Set();
  for (const item of items) {
    let text = String(item).toLowerCase().trim();
    if (MUSCLE_ZONES.includes(text)) { out.add(text); continue; }
    for (const [re, keys] of TEXT_RULES) {
      if (re.test(text)) {
        keys.forEach((key) => out.add(key));
        text = text.replace(new RegExp(re.source, 'g'), ' ');
      }
    }
  }
  return [...out];
}

// Laufen, Radfahren & Co. haben keinen gezielten Muskel, arbeiten aber klar
// über die Beine. Ohne das bliebe jede Cardio-Übung ohne Markierung.
const CARDIO_TEXT = /cardio|ausdauer|laufband|treadmill|fahrrad|rad\b|ergometer|crosstrainer|rudergerät|liss|hiit|zone\s*2|seilspringen/;
const CARDIO_ZONES = ['quads', 'hamstrings', 'waden', 'gesaess'];

function looksLikeCardio(exercise) {
  if (exercise?.type === 'cardio') return true;
  const text = [exercise?.muscle, exercise?.name].map((v) => String(v ?? '').toLowerCase()).join(' ');
  return CARDIO_TEXT.test(text);
}

/**
 * Zonen einer Übung — bevorzugt die gepflegten `zones`, sonst geraten aus `muscle`.
 * Sekundäre Zonen, die schon primär sind, fallen raus.
 */
export function exerciseZones(exercise) {
  const declared = exercise?.zones;
  const primary = Array.isArray(declared?.primary) && declared.primary.length
    ? declared.primary.filter((key) => MUSCLE_ZONES.includes(key))
    : fromText(exercise?.muscle);
  const secondarySource = Array.isArray(declared?.secondary)
    ? declared.secondary.filter((key) => MUSCLE_ZONES.includes(key))
    : [];
  const primarySet = new Set(primary);
  const secondary = secondarySource.filter((key) => !primarySet.has(key));
  if (!primary.length && !secondary.length && looksLikeCardio(exercise)) {
    return { primary: [], secondary: CARDIO_ZONES };
  }
  return { primary, secondary };
}

export function zoneLabels(keys) {
  return keys.map((key) => ZONE_LABELS[key] ?? key);
}

/** Zonen-Keys aus Keys oder freiem Text — für Komponenten, die beides bekommen. */
export function resolveZoneKeys(input) {
  return fromText(input);
}
