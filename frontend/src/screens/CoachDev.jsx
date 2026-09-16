import { useState } from 'react';
import CoachSummary from '../components/CoachSummary.jsx';
import { hintKey } from '../lib/coachSummary.js';

// Nur DEV: Coach-Auswertung mit Beispieldaten ansehen, ohne echte Gemini-Antwort.
const FIXTURE = {
  headline: 'Rudern: neuer Bestwert bei 42,5 kg',
  verdict:
    'Dritte Pull-Session in Folge mit Zuwachs. RPE 7 beim Rudern heißt: da ist noch Luft. Klimmzüge stagnieren bei RPE 9 — hier lieber halten als steigern.',
  note_reply: 'Wenig Schlaf hat man dem Volumen nicht angesehen — Leistung war trotzdem oben.',
  exercises: [
    { exercise_id: 'row', name: 'Kurzhantel-Rudern', trend: 'up', text: '+2,5 kg bei gleichen Wiederholungen, e1RM 51 kg' },
    { exercise_id: 'pullup', name: 'Klimmzüge', trend: 'flat', text: '3×6 wie letztes Mal, RPE 9 → an der Grenze' },
    { exercise_id: 'curl', name: 'Bizeps-Curls', trend: 'down', text: 'Volumen −8 %, letzter Satz nur 7 Wdh.' },
    { exercise_id: 'facepull', name: 'Face Pulls', trend: 'new', text: 'Erste Session — 3×15 mit 10 kg als Basis' },
  ],
  recommendations: [
    { text: 'Rudern auf 45 kg erhöhen, Wiederholungen bei 8–10 halten.', exercise_id: 'row', exercise_name: 'Kurzhantel-Rudern', field: 'weight_kg', value: 45 },
    { text: 'Klimmzüge: Gewicht halten, dafür 2 Minuten Pause statt 90 Sekunden.' },
    { text: 'Face Pulls auf 18 Wiederholungen pro Satz hochziehen.', exercise_id: 'facepull', exercise_name: 'Face Pulls', field: 'reps', value: 18 },
  ],
};

export default function CoachDev() {
  const [hintStates, setHintStates] = useState({});
  function apply(rec) {
    const key = hintKey(rec);
    setHintStates((prev) => ({ ...prev, [key]: 'saving' }));
    setTimeout(() => setHintStates((prev) => ({ ...prev, [key]: 'done' })), 600);
  }
  return (
    <div className="wrap">
      <h2>Auswertung</h2>
      <CoachSummary summary={FIXTURE} hintStates={hintStates} onApply={apply} />
    </div>
  );
}
