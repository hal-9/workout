# Feature-Plan M7–M12 (Stand 2026-08-24)

Fortsetzung von [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (M1–M6 abgeschlossen).
Entscheidungen unten sind mit dem Nutzer abgestimmt und verbindlich.

## Abgestimmte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Cooldown-Logging | One-Tap-Done, Ziel-Dauer wird als `duration_s` geschrieben, optionaler Halte-Timer |
| RPE-Granularität | Pro Übung (Chip-Reihe nach dem letzten Satz), nicht pro Satz |
| Musik | Deep-Link-Button (`music_url`), **kein** MusicKit-Embed |
| Auto-Progression | Vorschlag + Bestätigung durch Nutzer, nie automatisch |

## Musik: Begründung der Entscheidung

MusicKit JS v3 wäre technisch möglich, ist aber für eine PWA die falsche Wahl:
Apple Developer Program (100 USD/Jahr), MusicKit-Identifier + `.p8`-Key, Backend-Endpoint
für JWT-Developer-Tokens, Auth pro Nutzer, Apple-Music-Abo pro Hörer. Entscheidend:
MusicKit verwaltet die Queue im Main-JS-Thread, deshalb **stoppt die Wiedergabe, sobald die
PWA in den Hintergrund geht oder der Bildschirm sperrt** — genau der Normalfall im Training.
Spotifys Web Playback SDK ist auf iOS noch schlechter (Autoplay/Resume defekt).

Lösung: `music_url` (Apple Music / Spotify / beliebige URL) pro Plan bzw. Nutzer-Setting,
Button auf Heute öffnet die native App. Dort läuft Hintergrund-Wiedergabe inkl.
Lock-Screen-Controls korrekt.

---

## M7 — Zeit-UX + Cooldown-Phase + Musik-Button ✅ umgesetzt

Ziel: Dauern menschenlesbar, jedes Workout endet mit einem Cooldown, Musik startbar.

### 7.1 Dauer-Anzeige (keine Migration)

DB bleibt bei Sekunden (`set_logs.duration_s`, `target_seconds` im Plan-JSON).
Umrechnung passiert ausschließlich in der Anzeige-Schicht.

- Neu `frontend/src/lib/duration.js`
  - `formatDuration(seconds)` → `"25 Min"` | `"1:30"` | `"45 Sek"`
  - `toInputValue(seconds, type)` → Minuten bei `cardio`, Sekunden bei `time`
  - `fromInputValue(value, type)` → Sekunden (ganzzahlig, `12,5` Min → `750`)
- `type: 'cardio'` → Eingabe in Minuten, Spaltenkopf **Min.**, Dezimalstellen erlaubt
- `type: 'time'` → Eingabe bleibt Sekunden (Plank 45 s bleibt 45)
- Betroffen: `screens/Heute.jsx`, `components/plan/ExerciseEditor.jsx`,
  `screens/Auswertung.jsx`, `screens/Fortschritt.jsx`
- `backend/src/evaluation.js`: `duration_display` neben `duration_s` in das Aggregat,
  damit das LLM keine "1500 Sekunden" mehr schreibt
- Tests: `backend/test/duration.test.js` (Round-Trip, Formatierung, Komma-Eingabe)

### 7.2 Cooldown-Phase

- `shared/planSchema.js`: `phase: z.enum(['main','cooldown']).default('main')` im
  `exerciseSchema`. Optional + Default ⇒ alle bestehenden Pläne bleiben valide.
- Heute: eigene Karte **Cooldown** nach dem Hauptblock, gedimmt bis die Hauptübungen
  fertig sind. Ein Tap = erledigt, `duration_s` = `target_seconds`. Optionaler Halte-Timer.
- Cooldown-Sätze sind ausgeschlossen aus: Volumen/Tonnage, PRs, Progression,
  Trend-Vergleich (`exerciseCompare`, `exerciseProgress`, `progress.js`).
- Neu `frontend/src/data/stretches.json`: Stretch-Bibliothek nach Fokus
  (push / pull / legs / glutes / core / full).
- Plan-Editor: Button "Cooldown vorschlagen" hängt passende Stretches an den Tag an.
- Cooldown-Blöcke in die drei Templates aufnehmen.
- Tests: Schema-Rückwärtskompatibilität, `phase`-Default, Ausschluss aus Progress/PR.

### 7.3 Musik-Button

- `music_url` als optionales Feld im Plan-JSON (Top-Level) — leer = Button versteckt.
- Heute: Button "Musik" öffnet die URL in neuem Tab/nativer App.
- Plan-Editor: Eingabefeld mit URL-Validierung.

## M8 — Abschluss-Animation ✅ umgesetzt

Hook in `finishWorkout()` (`screens/Heute.jsx`) vor dem Navigate nach Auswertung.
Keine neuen Dependencies — Web Animations API, CSS, vorhandenes WebAudio.

- `components/WorkoutCompleteOverlay.jsx`
- SVG-Häkchen als Stroke-Draw (`stroke-dashoffset`, Spring-Kurve, ~520 ms)
- weicher Radial-Bloom `--primary` → `--accent` dahinter
- ~14 Partikel, Gravitation + Drag, gedeckte Markenfarben, gestaffeltes Ausblenden
- Zwei-Ton-Chime über `lib/workoutSounds.js`
- Zahlen zählen hoch (Sätze, Tonnage, Dauer); PR-Zeile, sobald M9 steht
- `prefers-reduced-motion` → nur Crossfade
- Gesamt ~1,4 s, Tap überspringt

## M9 — PRs, Streaks & Stats ✅ umgesetzt

- `shared/records.js`: Bestwerte pro Übung aus `status='finished'`-Sessions —
  max. Gewicht, max. Wdh., geschätztes 1RM (Epley), bestes Satz-Volumen, Session-Tonnage.
  Abgeleitet, keine Cache-Tabelle.
- `POST /sessions/:id/finish` liefert `new_records[]` → speist das M8-Overlay
  ("Neuer Rekord: Bankdrücken 60 kg").
- `GET /stats`: Tonnage-Trend pro Woche, Volumen pro Muskelgruppe,
  12-Wochen-Frequenz-Heatmap, Streak (bestehende Logik in `lib/weekRecap.js`).
- Frontend: PR-Badge in der Satz-Zeile, Rekord-Sektion + Charts in Fortschritt (Recharts).
- Cooldown und `cardio` zählen nicht in die Tonnage.

## M10 — RPE + Notizen → besseres LLM-Feedback ✅ umgesetzt

- Migration `002_rpe_notes.sql`: neue Tabelle `exercise_rpe (session_id, exercise_id, rpe)`
  mit `UNIQUE (session_id, exercise_id)` plus `sessions.note TEXT`.
  **Abweichung vom ursprünglichen Plan:** RPE liegt *nicht* als Spalte auf `set_logs`.
  Das Upsert in `POST /sessions/:id/sets` setzt `rpe = excluded.rpe` und hätte den Wert
  bei jedem erneuten Abhaken des letzten Satzes auf NULL gesetzt. Eigene Tabelle
  entspricht außerdem der Semantik "ein Wert pro Übung und Session".
- `POST /sessions/:id/rpe` — Upsert, `rpe: null` löscht. Nur bei aktiver Session (409/404 sonst).
- `POST /sessions/:id/note` — speichert die Notiz schon während der Session (Frontend
  entprellt 800 ms), damit ein Reload sie nicht verliert. `POST /sessions/:id/finish`
  nimmt `note` zusätzlich mit, damit der letzte Stand sicher landet.
- Resume (`POST /sessions`) und `GET /sessions/recent` liefern `rpe` und `note` mit.
- RPE-Chips 6–10 in der Übungskarte, sobald alle geplanten Sätze abgehakt sind.
- `evaluation.js`: RPE, Notiz und `phase: 'cooldown'` im Aggregat, Prompt nutzt sie explizit.

## M11 — Auto-Progression schreibt zurück ✅ umgesetzt

- `shared/progression.js` ist die einzige Quelle: `progressionConfig`, `sessionQualifies`,
  `evaluateExercise`, `evaluatePlan`, `applyProposals`, `deloadWeek`.
- Optional pro Übung im Plan-JSON:
  `progression: { type: 'weight'|'reps'|'duration', increment, after_success, deload_every_weeks, deload_factor }`
  Fehlendes Feld nutzt die Voreinstellung des Typs (`wt` → +2,5 kg, `bw` → +2 Wdh.,
  `time` → +10 s, `cardio` → **aus**), `progression: null` schaltet die Übung ab.
  Cooldown-Übungen sind immer ausgenommen.
- Eine Session zählt nur, wenn **alle geplanten Sätze** das Ziel erreichen — bei
  Gewichtsübungen zusätzlich mindestens mit dem aktuellen Plan-Gewicht. Vorschlag erst
  nach `after_success` Sessions in Folge.
- `GET /progression/proposals` → offene Vorschläge + Deload-Status.
- `POST /progression/apply { exercise_ids }` → **Server rechnet die Werte selbst neu**,
  der Client schickt nur die Auswahl. Danach: alte Plan-Zeile `active = 0`, neue Zeile
  `active = 1`. Sessions behalten ihre alte `plan_id`, die Historie bleibt intakt.
  Folge: nach jedem Bump braucht es wieder `after_success` neue Sessions — genau richtig
  für progressive Overload.
- Auswertung: Karte "Plan anpassen?" mit Checkbox je Übung (alle vorausgewählt) und
  Bestätigungs-Button. Angenommene Vorschläge löschen den lokalen
  `weightOverrides`-Eintrag der Übung, damit der Plan wieder führt.
- Deload ist **opt-in** (`deload_every_weeks`), sonst erscheint kein Banner aus dem Nichts.
  Konfiguriert wird er planweit im Plan-Editor (schreibt das Feld auf alle Übungen mit
  aktiver Steigerung, kleinster Wert gewinnt); Banner auf Heute in der betroffenen Woche.
- Plan-Editor: pro Übung "Automatisch steigern" (Ein/Aus, Schrittweite, nach N Sessions).

`frontend/src/lib/progression.js` (die alte, rein hinweisende Progression) ist
entfallen — die Logik liegt jetzt vollständig in `shared/progression.js`.

## M12 — Übungs-Demos + Bibliothek ✅ umgesetzt

- `frontend/src/data/exercises.json`: 66 Einträge (46 Haupt-, 20 Cooldown-Übungen),
  erzeugt aus den drei Templates und `stretches.json` — also bereits kuratierte
  deutsche Technik-Hinweise, keine neu erfundenen Inhalte.
- `frontend/src/lib/exerciseLibrary.js`: Gruppen-Zuordnung, Suche über Name/Muskel/Cue,
  `libraryEntryToExercise` (eindeutige Id), `demoSearchUrl`.
  Die Muskel-Bezeichnungen der Templates sind uneinheitlich ("Po" vs. "Gesäß",
  "Core/Rücken"), deshalb werden Gruppen per Keyword-Score zugeordnet; bei Gleichstand
  entscheidet die Reihenfolge (Core und Gesäß stehen vor Rücken).
- Plan-Editor: "Übung aus Bibliothek" öffnet Suche + Gruppen-Chips. Hauptübungen werden
  **vor** dem Cooldown-Block einsortiert, Stretches hinten angehängt. Bereits im Tag
  vorhandene Übungen sind markiert.
- Heute: "Details" öffnet ein Bottom-Sheet mit Cue, Ziel, geplanten Sätzen, Bestwert und
  geschätztem 1RM plus Link auf die Video-Suche. Cooldown-Zeilen haben dafür ein `i`-Icon.
  Kein Embed — ausgehender YouTube-Suchlink, damit keine CSP-/CDN-Abhängigkeit entsteht.

---

## Reihenfolge

M7 → M8 → M9 → M10 → M11 → M12.
M7 und M8 sind die sichtbaren Gewinne; M9 liefert die PR-Zeile für das M8-Overlay nach.
