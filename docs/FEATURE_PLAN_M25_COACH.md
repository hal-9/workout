# M25 — Coach-Auswertung 2.0 (Stand 2026-09-15)

Fortsetzung von [FEATURE_PLAN_M21-M24.md](FEATURE_PLAN_M21-M24.md). Auslöser: Die Gemini-Auswertung war regelmäßig mitten im Satz abgeschnitten, und als Markdown-Blob wirkte sie wie Chatbot-Output statt wie ein Coach.

## Bug: abgeschnittene Auswertung

`gemini-2.5-flash` denkt standardmäßig mit; die Denk-Tokens zählen gegen `maxOutputTokens`. Bei 600 Tokens blieb für den sichtbaren Text oft nicht genug — `finishReason: MAX_TOKENS`, der Code hat das nie geprüft und das Fragment als `ok` gespeichert.

Fix in `backend/src/evaluation.js`: `thinkingConfig: { thinkingBudget: 0 }` (Vergleiche werden ohnehin serverseitig vorgerechnet, siehe unten), `maxOutputTokens` 2000, `MAX_TOKENS` → `status: failed` mit Fehlertext (Retry-Button statt stummem Fragment).

## Abgestimmte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Ausgabeformat | Strukturiertes JSON via Gemini `responseSchema` statt Markdown: `headline`, `verdict`, `exercises[] {exercise_id, trend, text}`, `recommendations[] {text, exercise_id?, field?, value?}`, `note_reply?`. Gespeichert in `evaluations.summary_json`; alte Zeilen behalten `summary_md`, Frontend rendert Markdown als Fallback. |
| Rechnen | Nicht das Modell. `buildAggregate` liefert pro Übung `metrics` (aus `shared/records.sessionMetrics`), `vs_last` (Differenz zur letzten Session mit der Übung), `best_before`, `new_record` (`detectNewRecords`, gleiche Logik wie beim Finish). Dazu `session_number_for_day`, `sessions_last_7_days/28_days`, `duration_display`, `readiness` (energy/soreness), `light_version`, `rpe`, `note`. |
| Validierung | Zod-Schema serverseitig. Unbekannte `exercise_id` fliegt aus `exercises`; bei Empfehlungen bleibt der Text, die Übernahme-Daten werden gestrichen, wenn Feld nicht zum Übungstyp passt oder Wert außerhalb (`validHintValue`: weight_kg nur `wt` 0,5–500; reps `wt`/`bw` 1–100 ganzzahlig; duration_s `time`/`cardio` 5–3600). Namen kommen aus dem Plan-Snapshot, nicht vom Modell. |
| Übernahme | „Für nächstes Mal übernehmen" schreibt einen **Coach-Tipp** (`coach_hints`, PK `user_id, exercise_id, field`) — kein Plan-Edit, kein localStorage. `/history` liefert `hints`, `buildInitialSets` in `Heute.jsx` legt den Wert über Prefill/Plan (`withCoachHint` in `lib/setRows.js`, nur offene Sätze). Der Tipp wird beim Finish der nächsten Session mit dieser Übung gelöscht — gilt also genau einmal. Übungskarte zeigt „★ Coach: 45 kg". |
| Warum nicht `weightOverrides` (localStorage)? | Prefill aus der Historie schlägt das Override (`fromSource.weight_kg ?? defaultWeight`), außerdem pro Gerät. Tipps müssen serverseitig sein und über der Historie stehen. |
| Warum nicht Progression-Apply? | Das ist regelbasiert und ändert den Plan dauerhaft (neue Plan-Version). Ein LLM-Tipp ist ein Vorschlag für *eine* Session — falsch geraten = nächstes Mal weg. |
| Modell | Bleibt `gemini-2.5-flash`. Thinking aus, weil alle Vergleiche vorgerechnet sind und der Nutzer auf dem Auswertungsbildschirm wartet. |

## Dateien

- Backend: `migrations/011_coach.sql`, `src/evaluation.js` (Prompt, Schema, `normalizeSummary`, `buildAggregate` → `{ aggregate, exerciseMeta }`), `src/sessionHistory.js` (`previousSessionsForRecords`, aus `routes/sessions.js` herausgezogen), `src/routes/coach.js` (`POST /coach/hints`), `routes/history.js` (`hints`), `routes/sessions.js` (Finish löscht verbrauchte Tipps; `GET /sessions/:id/evaluation` liefert `summary`).
- Frontend: `components/CoachSummary.jsx`, `lib/coachSummary.js`, `lib/setRows.js` (`withCoachHint`), `screens/Auswertung.jsx`, `screens/Heute.jsx`, `screens/CoachDev.jsx` (nur DEV, `/dev/coach` mit Fixture — Login im Browser ist für den Agenten tabu, deshalb existiert diese Seite).
- Tests: `backend/test/evaluation.test.js`, `backend/test/coachHints.test.js`, `frontend/src/lib/coachSummary.test.js`, `frontend/src/lib/setRows.test.js`.

## Nicht live verifiziert

Lokal gibt es keinen `GEMINI_API_KEY`, Prod-DB-Zugriff war in der Session gesperrt. Erste echte Antwort nach dem Deploy anschauen: passt der Ton der `headline`, setzt das Modell `exercise_id/field/value` bei konkreten Empfehlungen?

## Offen / Ideen

- Streaming der Auswertung (SSE) statt Polling — erst, wenn die JSON-Variante sitzt.
- Coach-Ton wählbar (sachlich / motivierend / hart) als eine Prompt-Zeile pro Nutzer.
- Wochen-Digest über den bestehenden Push-Scheduler.
- `headline` auf die Share-Card (M18).
- Backend-Testsuite flackert unter Parallelität (auch auf `main` ohne diese Änderungen: 1–7 zufällige Fehler pro Lauf, `--no-file-parallelism` ist grün). Ursache nicht untersucht.
