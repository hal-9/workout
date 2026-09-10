// Muskelzonen des 3D-Modells. Die Keys sind die Sprache zwischen Übungsdaten,
// Plan-Schema und der Highlight-Anzeige — nie freien Text vergleichen.
//
// Dach-Keys (`brust`, `schultern`, `core`, `ruecken`, `gesaess`, `waden`) fassen
// Teilzonen zusammen, die Übungen unterschiedlich treffen: Schrägbank ≠ Dips,
// Klimmzug ≠ Face Pull, Plank ≠ Seitstütz, Hip Thrust ≠ Abduktion, Wadenheben
// stehend ≠ sitzend. Ältere Pläne und Freitext nutzen weiter das Dach — es wird
// bei der Anzeige auf alle Teilzonen aufgelöst (`expandZones`). Die Bibliothek
// nutzt im Hauptteil nur Teilzonen (Test erzwingt das).
// Nicht gesplittet: Quadrizeps/Beinbeuger (Köpfe im Training nicht getrennt
// ansteuerbar), Bizeps/Trizeps/Unterarme (gleiche Stelle am Modell).
export const MUSCLE_ZONES = [
  'brust', 'brust_oben', 'brust_mitte', 'brust_unten',
  'schultern', 'schultern_vorn', 'schultern_seite', 'schultern_hinten',
  'bizeps', 'trizeps', 'unterarme',
  'core', 'core_gerade', 'core_seitlich',
  'ruecken', 'ruecken_lat', 'ruecken_oben', 'unterer_ruecken',
  'gesaess', 'gesaess_gross', 'gesaess_seite', 'adduktoren',
  'quads', 'hamstrings',
  'waden', 'waden_gastro', 'waden_soleus',
];

export const ZONE_CHILDREN = {
  brust: ['brust_oben', 'brust_mitte', 'brust_unten'],
  schultern: ['schultern_vorn', 'schultern_seite', 'schultern_hinten'],
  core: ['core_gerade', 'core_seitlich'],
  ruecken: ['ruecken_lat', 'ruecken_oben'],
  gesaess: ['gesaess_gross', 'gesaess_seite'],
  waden: ['waden_gastro', 'waden_soleus'],
};

/** Zonen, die am Modell eine eigene Region haben (keine Dach-Keys). */
export const LEAF_ZONES = MUSCLE_ZONES.filter((key) => !ZONE_CHILDREN[key]);

export const ZONE_PARENT = Object.fromEntries(
  Object.entries(ZONE_CHILDREN).flatMap(([parent, children]) => children.map((child) => [child, parent]))
);

export const ZONE_LABELS = {
  brust: 'Brust',
  brust_oben: 'Obere Brust',
  brust_mitte: 'Mittlere Brust',
  brust_unten: 'Untere Brust',
  schultern: 'Schultern',
  schultern_vorn: 'Vordere Schulter',
  schultern_seite: 'Seitliche Schulter',
  schultern_hinten: 'Hintere Schulter',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  unterarme: 'Unterarme',
  core: 'Rumpf',
  core_gerade: 'Gerader Bauch',
  core_seitlich: 'Seitlicher Bauch',
  ruecken: 'Rücken',
  ruecken_lat: 'Latissimus',
  ruecken_oben: 'Oberer Rücken',
  unterer_ruecken: 'Unterer Rücken',
  gesaess: 'Gesäß',
  gesaess_gross: 'Großer Gesäßmuskel',
  gesaess_seite: 'Seitliches Gesäß',
  adduktoren: 'Adduktoren',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  waden: 'Waden',
  waden_gastro: 'Wade (Gastrocnemius)',
  waden_soleus: 'Wade (Soleus)',
};

// Kurze Erklärung je Teilzone — für die Legende im Muskel-Modal, damit klar wird,
// warum z. B. Schulterdrücken und Seitheben nicht dasselbe trainieren.
export const ZONE_HINTS = {
  brust_oben: 'Oberer Brustanteil am Schlüsselbein — arbeitet bei Schrägbank und Drücken nach oben.',
  brust_mitte: 'Hauptmasse der Brust — Flachbank, Liegestütze, Fliegende.',
  brust_unten: 'Unterer Brustrand — Dips, Negativbank, Liegestütze mit erhöhten Händen.',
  schultern_vorn: 'Hebt den Arm nach vorn/oben — arbeitet bei jedem Drücken mit.',
  schultern_seite: 'Hebt den Arm seitlich — macht die Schulter optisch breit.',
  schultern_hinten: 'Zieht den Arm nach hinten — Gegenspieler zum Drücken, wichtig für die Haltung.',
  core_gerade: 'Gerader Bauchmuskel — beugt den Rumpf und hält ihn gegen Durchhängen (Plank, Crunch).',
  core_seitlich: 'Schräge Bauchmuskeln — drehen und neigen den Rumpf, stabilisieren seitlich (Seitstütz, Twist).',
  ruecken_lat: 'Breiter Rückenmuskel — zieht den Arm von oben/vorn zum Körper (Klimmzug, Latzug).',
  ruecken_oben: 'Trapez und Rhomboiden zwischen den Schulterblättern — ziehen die Schultern zurück (Rudern, Face Pull).',
  gesaess_gross: 'Großer Gesäßmuskel — streckt die Hüfte (Hip Thrust, Kniebeuge, Kreuzheben).',
  gesaess_seite: 'Gluteus medius an der Hüftseite — führt das Bein nach außen, stabilisiert einbeinig.',
  adduktoren: 'Innenseite des Oberschenkels — zieht das Bein zur Mitte (Adduktoren-Maschine, Copenhagen Plank).',
  waden_gastro: 'Zweiköpfiger Wadenmuskel — arbeitet bei gestrecktem Knie (Wadenheben stehend).',
  waden_soleus: 'Tiefer Wadenmuskel — arbeitet vor allem bei gebeugtem Knie (Wadenheben sitzend).',
};

/** Sammel-Keys auf ihre Teilzonen auflösen (für Anzeige und Frische). */
export function expandZones(keys) {
  const out = [];
  for (const key of keys ?? []) {
    const children = ZONE_CHILDREN[key];
    if (children) out.push(...children);
    else out.push(key);
  }
  return [...new Set(out)];
}

/**
 * Wie stark decken sich zwei Zonen-Keys? 1 = identisch, 0.6 = Dach ↔ Teilzone
 * (z. B. Plan sagt „Schultern", Bibliothek sagt „Seitliche Schulter"), 0 = fremd.
 */
export function zoneOverlap(a, b) {
  if (a === b) return 1;
  if (ZONE_PARENT[a] === b || ZONE_PARENT[b] === a) return 0.6;
  return 0;
}

// Bewegungsmuster. Zwei Übungen mit gleichem Muster sind austauschbar — das ist
// neben der Muskel-Überdeckung das wichtigste Signal für Alternativen.
export const MOVEMENT_PATTERNS = [
  { key: 'push_horizontal', label: 'Horizontales Drücken' },
  { key: 'push_vertical', label: 'Drücken über Kopf' },
  { key: 'chest_fly', label: 'Fliegende (Brust)' },
  { key: 'pull_horizontal', label: 'Rudern' },
  { key: 'pull_vertical', label: 'Ziehen von oben' },
  { key: 'shoulder_abduction', label: 'Seitheben' },
  { key: 'shoulder_flexion', label: 'Frontheben' },
  { key: 'rear_delt', label: 'Hintere Schulter' },
  { key: 'elbow_flexion', label: 'Bizeps-Beugen' },
  { key: 'elbow_extension', label: 'Trizeps-Strecken' },
  { key: 'grip', label: 'Griffkraft' },
  { key: 'squat', label: 'Kniebeuge' },
  { key: 'hinge', label: 'Hüftbeugen (Kreuzheben)' },
  { key: 'lunge', label: 'Ausfallschritt / einbeinig' },
  { key: 'hip_extension', label: 'Hüftstrecken (Brücke/Thrust)' },
  { key: 'hip_abduction', label: 'Hüft-Abduktion' },
  { key: 'hip_adduction', label: 'Hüft-Adduktion' },
  { key: 'knee_extension', label: 'Beinstrecken' },
  { key: 'knee_flexion', label: 'Beinbeugen' },
  { key: 'calf_raise', label: 'Wadenheben' },
  { key: 'carry', label: 'Tragen / Halten' },
  { key: 'core_anti_extension', label: 'Rumpf stabilisieren' },
  { key: 'core_flexion', label: 'Rumpf beugen' },
  { key: 'core_lateral', label: 'Seitlicher Rumpf' },
  { key: 'core_rotation', label: 'Rumpf rotieren' },
  { key: 'back_extension', label: 'Rückenstrecken' },
  { key: 'cardio', label: 'Ausdauer' },
  { key: 'mobility', label: 'Dehnung / Mobilität' },
];

export const PATTERN_KEYS = MOVEMENT_PATTERNS.map((item) => item.key);
export const PATTERN_LABELS = Object.fromEntries(MOVEMENT_PATTERNS.map(({ key, label }) => [key, label]));

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
// Spezifische Teilzonen-Begriffe stehen vor ihrem Dach-Key; generische Begriffe
// („Brust", „Core") landen bewusst auf dem Dach und werden bei der Anzeige expandiert.
const TEXT_RULES = [
  [/unterer?\s*r(ü|ue)cken|lower\s*back|lendenwirbel|wirbels(ä|ae)ule|erector/, ['unterer_ruecken']],
  [/latissimus|\blats?\b|klimmzug|pull-?up|chin-?up|latzug|pulldown/, ['ruecken_lat']],
  [/oberer?\s*r(ü|ue)cken|upper\s*back|trapez|\btraps?\b|rhomboid|nacken|shrug/, ['ruecken_oben']],
  [/r(ü|ue)cken|\bback\b|rudern|\brow\b/, ['ruecken']],
  [/obere\s*brust|upper\s*chest|schr(ä|ae)gbank|incline/, ['brust_oben']],
  [/untere\s*brust|lower\s*chest|negativbank|decline|\bdips?\b/, ['brust_unten']],
  [/brust|chest|pect|bankdr(ü|ue)cken/, ['brust']],
  [/vordere\s*schulter|front\s*delt|anterior|frontheben|front\s*raise/, ['schultern_vorn']],
  [/hintere\s*schulter|rear\s*delt|posterior|face\s*pull|reverse\s*fly/, ['schultern_hinten']],
  [/seitliche\s*schulter|side\s*delt|lateral\s*delt|seitheben|lateral\s*raise/, ['schultern_seite']],
  [/schulter|shoulder|delt/, ['schultern']],
  [/bizeps|bicep/, ['bizeps']],
  [/trizeps|tricep/, ['trizeps']],
  [/unterarm|forearm|griff|\bgrip\b/, ['unterarme']],
  [/flanke|oblique|schr(ä|ae)ge?r?\s*bauch|seitlich\w*\s*(bauch|rumpf)|seitst(ü|ue)tz|side\s*plank/, ['core_seitlich']],
  [/gerade\w*\s*bauch|rectus|sixpack|crunch/, ['core_gerade']],
  [/core|bauch|rumpf|abs\b|abdomin|plank/, ['core']],
  [/adduktor|adductor|innenschenkel|inner\s*thigh/, ['adduktoren']],
  [/abduktor|abductor|gluteus\s*medius|seitliche?s?\s*ges(ä|ae)(ß|ss)|h(ü|ue)ftau(ß|ss)enseite/, ['gesaess_seite']],
  [/\bpo\b|ges(ä|ae)(ß|ss)|glute|h(ü|ue)ft|\bhips?\b/, ['gesaess']],
  [/quadrizeps|quad/, ['quads']],
  [/oberschenkelr(ü|ue)ckseite|hamstring|beinbeuger/, ['hamstrings']],
  [/soleus/, ['waden_soleus']],
  [/gastrocnemius|gastro/, ['waden_gastro']],
  [/wade|calf|calves/, ['waden']],
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

function validKeys(list) {
  return Array.isArray(list) ? list.filter((key) => MUSCLE_ZONES.includes(key)) : [];
}

// Wird von library.js gesetzt, damit muscles.js nicht selbst die Bibliothek
// importieren muss (kein Import-Zyklus, Konsumenten ohne Bibliothek bleiben leicht).
let libraryLookup = null;
export function registerLibraryLookup(fn) {
  libraryLookup = fn;
}

/**
 * Zonen einer Übung — bevorzugt die gepflegten `zones`, sonst die Bibliothek
 * (gleiche Id oder gleicher Name), sonst geraten aus `muscle`.
 * Sekundäre Zonen, die schon primär sind, fallen raus.
 */
export function exerciseZones(exercise) {
  const declared = exercise?.zones;
  let primary = validKeys(declared?.primary);
  let secondarySource = validKeys(declared?.secondary);
  let source = primary.length ? 'plan' : null;

  if (!primary.length) {
    const entry = libraryLookup?.(exercise);
    if (entry?.zones?.primary?.length) {
      primary = validKeys(entry.zones.primary);
      if (!Array.isArray(declared?.secondary)) secondarySource = validKeys(entry.zones.secondary);
      source = 'library';
    }
  }
  if (!primary.length) {
    primary = fromText(exercise?.muscle);
    if (primary.length) source = 'text';
  }

  const primarySet = new Set(primary);
  const secondary = secondarySource.filter((key) => !primarySet.has(key));
  if (!primary.length && !secondary.length && looksLikeCardio(exercise)) {
    return { primary: [], secondary: CARDIO_ZONES, source: 'cardio' };
  }
  return { primary, secondary, source };
}

export function zoneLabels(keys) {
  return keys.map((key) => ZONE_LABELS[key] ?? key);
}

/** Zonen-Keys aus Keys oder freiem Text — für Komponenten, die beides bekommen. */
export function resolveZoneKeys(input) {
  return fromText(input);
}
