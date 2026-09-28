// Band-unterstützte Körpergewichtsübungen (Klimmzug, Dips, Nordic Curl mit
// Band). Erkennung über Id/Name — "Band Pull-Apart" u. ä. nutzen das Band als
// Widerstand, nicht als Hilfe, und fallen deshalb absichtlich nicht darunter.
export function isBandAssisted(exercise) {
  return exercise?.type === 'bw' && /assist|unterstütz/i.test(`${exercise.id} ${exercise.name}`);
}

// Gängiges schweres Band; Vorbelegung, solange kein eigener Wert geloggt ist.
export const DEFAULT_BAND_KG = 36;

// Physik statt Etikett: Ein Band folgt dem Hookeschen Gesetz — die Hilfe ist
// proportional zur Dehnung. Die Hersteller-Angabe (z. B. 36 kg) gilt bei voller
// Dehnung, also unten im Hang, wo das Band (über die Stange, unter dem Knie)
// am längsten ist. Oben, Kinn über der Stange, hängt es fast schlaff → ≈ 0 kg.
// Über die Bewegung gemittelt hilft ein lineares Band deshalb etwa mit der
// Hälfte seines Nennwerts. Mehrere Bänder wirken parallel und addieren sich.
// ponytail: fixer Faktor 0,5; ein Band-Kalibrierfeld pro Nutzer, falls die
// Hilfe messbar abweicht (kurze Bänder/hohe Stange dehnen stärker).
export const BAND_ASSIST_FACTOR = 0.5;

export function bandAssistKg(count, bandKg = DEFAULT_BAND_KG) {
  const n = Number(count) || 0;
  const kg = Number(bandKg) || 0;
  return n * kg * BAND_ASSIST_FACTOR;
}

// Tatsächlich gehobene Last: Körpergewicht minus mittlere Bandhilfe, nie
// negativ — mehr Hilfe als Körpergewicht heißt nur, dass das Band dich trägt.
export function effectiveLoadKg(bodyweightKg, count, bandKg) {
  const bw = Number(bodyweightKg) || 0;
  if (bw <= 0) return null;
  return Math.max(0, Math.round((bw - bandAssistKg(count, bandKg)) * 10) / 10);
}

// Fortschrittsmaß in % des Körpergewichts: Epley-1RM der effektiven Last,
// bezogen auf das Körpergewicht. 100 % ≈ ein Klimmzug ohne Band ist drin.
// Steigt sowohl mit weniger Bändern als auch mit mehr Wiederholungen.
export function bodyweightShare(bodyweightKg, reps, count, bandKg) {
  const bw = Number(bodyweightKg) || 0;
  const load = effectiveLoadKg(bw, count, bandKg);
  if (load == null || !reps) return null;
  // Epley wie in records.js — hier inline, um den Import-Zyklus zu vermeiden.
  const e1rm = load * (1 + Number(reps) / 30);
  return Math.round((e1rm / bw) * 100);
}

// Körpergewicht zum Zeitpunkt `dateIso` aus chronologisch sortierten
// max_tests-Zeilen ({date, value}): letzter Eintrag davor, sonst der früheste
// bekannte — Historie vor der ersten Wiegung bleibt so auswertbar.
export function bodyweightAt(rows, dateIso) {
  if (!rows?.length) return null;
  const day = String(dateIso ?? '').slice(0, 10);
  let pick = null;
  for (const row of rows) {
    if (row.date <= day) pick = row;
  }
  return Number((pick ?? rows[0]).value) || null;
}
