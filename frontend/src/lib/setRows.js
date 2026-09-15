// Große Zahl (Wdh. bzw. Dauer) eines Satzes setzen. Die neue Zahl gilt auch
// für die folgenden offenen Sätze, sofern sie noch denselben Wert tragen wie
// der bearbeitete — sonst muss man 3→5 pro Satz wiederholen. Einzeln
// abweichende Sätze bleiben unangetastet, erledigte auch.
// `fallback` ist der Plan-Zielwert, den leere Sätze anzeigen — ohne Historie
// stehen alle Sätze auf '' und würden sonst nie als „gleich" erkannt.
export function applyBigNumber(rows, index, field, resolve, fallback = '') {
  const valueOf = (s) => Number(s[field] === '' || s[field] == null ? fallback : s[field]) || 0;
  const before = rows[index] ? valueOf(rows[index]) : 0;
  const next = String(Math.max(0, resolve(before)));
  return rows.map((s, i) => {
    if (i === index) return { ...s, [field]: next };
    if (i > index && !s.logged && valueOf(s) === before) return { ...s, [field]: next };
    return s;
  });
}
