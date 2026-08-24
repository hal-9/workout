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
// freien `muscle`-Text raten. Reihenfolge zählt — spezifisch vor allgemein.
const TEXT_RULES = [
  [/unterer?\s*r(ü|ue)cken|lendenwirbel|wirbels(ä|ae)ule/, ['unterer_ruecken']],
  [/latissimus|r(ü|ue)cken|\blat\b|trapez|rudern|klimmzug|latzug/, ['ruecken']],
  [/brust|pect|bankdr(ü|ue)cken/, ['brust']],
  [/schulter|delt|nacken/, ['schultern']],
  [/bizeps|bicep/, ['bizeps']],
  [/trizeps|tricep/, ['trizeps']],
  [/unterarm|forearm|griff/, ['unterarme']],
  [/core|bauch|rumpf|flanke|abs|plank/, ['core']],
  [/\bpo\b|ges(ä|ae)(ß|ss)|glute|h(ü|ue)ft|adduktor|abduktor/, ['gesaess']],
  [/quadrizeps|quad/, ['quads']],
  [/oberschenkelr(ü|ue)ckseite|hamstring|beinbeuger/, ['hamstrings']],
  [/wade|calf|calves|soleus/, ['waden']],
  [/oberschenkel/, ['quads']],
  [/\bbein/, ['quads', 'hamstrings', 'gesaess']],
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
  return { primary, secondary: secondarySource.filter((key) => !primarySet.has(key)) };
}

export function zoneLabels(keys) {
  return keys.map((key) => ZONE_LABELS[key] ?? key);
}

/** Zonen-Keys aus Keys oder freiem Text — für Komponenten, die beides bekommen. */
export function resolveZoneKeys(input) {
  return fromText(input);
}
