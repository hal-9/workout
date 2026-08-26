# Feature-Plan M15–M20 (Stand 2026-08-26)

Fortsetzung von [FEATURE_PLAN_M7-M12.md](FEATURE_PLAN_M7-M12.md). Entscheidungen unten sind mit dem Nutzer abgestimmt und verbindlich.

## Abgestimmte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Pflanze | **Trainingsbaum** (prozedural aus echter Historie), nicht Stufen-Topfpflanze |
| Baum-Platzierung | Fortschritt, ganz oben (nur eigene Ansicht, nicht bei Freunden) |
| Push-Kategorien | Alle vier: Pausen-Timer, Freund hat trainiert, Sonntag-Recap, Wrapped |
| Leichte Version | Nur bei niedriger Readiness anbieten (energy ≤ 2), kein Dauer-Chip |
| Wrapped | Monatlich |
| Share-Card | Story-Format 1080×1920, Button im Finish-Overlay (+ Auswertung nur für frisch beendete Session via Navigation-State — Rekorde existieren nur zur Finish-Zeit) |

Reihenfolge: **M16 → M17 → M18 → M20 → M19 → M15.** Push zuletzt (größte Infrastruktur, M19-Push hängt am Scheduler).

---

## M16 — Readiness → Leichte Version

Niedrige Tagesform (energy ≤ 2) → One-Tap-Karte auf Heute: „Heute leicht trainieren?" = −10 % Gewicht (auf 0,5 kg gerundet — ein 2,5-kg-Raster würde z. B. 10 kg → 9 → zurück auf 10 runden; nur `type: 'wt'`), −1 Satz pro Hauptübung (min. 1). Cooldown unverändert.

- Persistenz: **`sessions.adaptations_json`** + `POST /sessions/:id/adaptations` existieren bereits ungenutzt → `{ "light": true }`. Kein neues Schema.
- Resume: `GET /sessions/recent` liefert `active.adaptations` → Leicht-Modus übersteht Reload/Gerätewechsel.
- Frontend-Naht: abgeleitete Übungsobjekte (Gewicht/Satzzahl transformiert) **vor** `buildInitialSets`/`ExerciseFocus`, nicht Row-Patching — Focus liest `exercise.default_weight_kg`/`exercise.sets` direkt. Bereits geloggte Sätze bleiben unangetastet; beim Aktivieren werden nur ungeloggte Rows angepasst.
- Revert: Chip „Leicht ✕" auf Heute → `{ "light": false }`, ungeloggte Rows zurück auf Planwerte.
- Progression: keine neue Logik nötig — reduziertes Gewicht liegt unter Plan-Gewicht, `sessionQualifies` in `shared/progression.js` schlägt von selbst fehl. Session zählt normal für Streak/Baum.

## M17 — Muskel-Frische-Map

Neue Karte „Erholung" in Fortschritt (nur „Ich"): 3D-Modell färbt Muskeln nach Zeit seit letztem Training. <24 h rot, 24–48 h orange, 48–72 h ausklingend, >72 h Körperfarbe.

- Rein abgeleitet, kein Backend: finished Sessions der letzten Tage (bereits geladene Heatmap-Range) → `day_key` → Übungen des aktiven Plans → `exerciseZones()` aus `shared/muscles.js`. Primärzonen volle Frische-Last, Sekundärzonen halbe (Stunden × 2).
- `MuscleBody3D` bekommt optionales Prop `heat: { [zoneId]: hours }` — färbt per Rampe statt primary/secondary, kein Puls. Bestehende Props unverändert.
- Grenze (dokumentiert, akzeptiert): Mapping über den *aktuellen* Plan — Planwechsel innerhalb des Fensters färbt ggf. ungenau.

## M18 — Share-Card

Canvas 1080×1920 im Finish-Overlay: Paletten-Gradient (`--grad-from`/`--grad-to` aus computed style), LiLief-Wortmarke, Datum, Sätze/Tonnage/Dauer, bis zu 3 PR-Zeilen. `navigator.share({ files })`, Fallback Download.

- `lib/shareCard.js` (pur, zeichnet auf übergebenes Canvas) + Button „Teilen" in `WorkoutCompleteOverlay`.
- `leaveCompletion` gibt `records` + `stats` in den Navigation-State mit → Auswertung zeigt den Teilen-Button nur direkt nach dem Finish.

## M20 — Trainingsbaum

Prozeduraler SVG-Baum ganz oben in Fortschritt, deterministisch aus der Historie gezeichnet. Ein Ast pro Trainingswoche, Ast-Stärke ~ Workouts der Woche, Blüte pro PR, Frucht pro Max-Test. Wächst nie zurück, stirbt nie (kein Schuld-UI). Leerzustand: Setzling.

- **Backend `GET /api/stats/tree`**: Wochen-Aggregate seit Account-Anfang — `[{ week_start, workouts, tonnage_kg, prs, max_tests }]`. PRs werden serverseitig durch chronologisches Abspulen der Sessions pro Übung rekonstruiert (Logik aus `shared/records.js` — PRs sind nirgends persistiert, `new_records` entsteht nur zur Finish-Zeit). Wochen = lokale Konvention des Frontends? Nein: Server bucketet **UTC-Montag** (wie `finished_at`); Abweichung max. 1–2 h abends, akzeptiert.
- Frontend: `lib/tree.js` (pur: Aggregate → Zeichenanweisungen, deterministischer Hash statt `Math.random`, testbar mit Vitest) + `TrainingTree.jsx` (SVG, Palettenfarben: Laub aus `--grad-from`/`--grad-to`, Blüten `--accent`).
- Wrapped-Slide „Dein Baum ist n Äste gewachsen" nutzt dieselben Daten.

## M19 — Wrapped (monatlich)

Erster App-Start im neuen Monat + ≥1 Workout im Vormonat → Banner auf Heute → Fullscreen-Story (Tap/Swipe, 5 Slides): Workouts + beste Serie, Tonnage vs. Vormonat, Top-PR, Muskel des Monats (3D-Modell-Highlight), Baum-Wachstum. Danach über Fortschritt erneut abrufbar.

- **Backend `GET /api/wrapped?month=YYYY-MM`**: `{ workouts, tonnage_kg, tonnage_prev_kg, top_pr, top_zone, weeks_grown }`. Top-Zone serverseitig über `exerciseZones()` (shared). Monatsgrenzen UTC (Konvention wie Baum).
- **`GET /api/wrapped/latest`** → `{ month, available, seen }` (speist Banner). **`POST /api/wrapped/:month/seen`**.
- Migration `006`: Tabelle `wrapped_seen (user_id, month, seen_at, PRIMARY KEY (user_id, month))` — DB statt localStorage (Gerätewechsel, wie Onboarding).

## M15 — Web Push

iOS-Realität: nur als installierte Home-Screen-PWA, explizite Permission. Vier Kategorien, einzeln abschaltbar (Dialog „Mitteilungen" im Burger-Menü).

- **SW-Umbau**: `vite-plugin-pwa` von `generateSW` auf `strategies: 'injectManifest'` + `src/sw.js` (`precacheAndRoute(self.__WB_MANIFEST)`, `skipWaiting`/`clientsClaim`, NetworkOnly-Verhalten für `/api` beibehalten, `push`- und `notificationclick`-Handler).
- **Backend**: Dependency `web-push`. Migration `007`: `push_subscriptions (id, user_id, endpoint UNIQUE, p256dh, auth, categories_json, created_at)` + `push_log (kind, period_key, sent_at, PRIMARY KEY (kind, period_key))` gegen Doppel-Versand über Neustarts.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (deploy/.env + .env.example; öffentlicher Key via `GET /api/push/public-key`, kein VITE-Build-Env nötig).
- Routen: `GET /push/public-key`, `POST /push/subscribe` (Subscription + Kategorien, Upsert auf endpoint), `DELETE /push/subscribe`.
- **Pausen-Timer**: kein Silent-Push-Gefrickel — Frontend postet `POST /push/timer { seconds }` nur beim `visibilitychange → hidden` mit laufendem Timer (Rest-Sekunden), `DELETE /push/timer` beim Sichtbarwerden. Server: In-Memory-`setTimeout` pro User (ein Prozess, kein Cluster — reicht).
- **Freund hat trainiert**: Fire-and-forget-Hook nach der Finish-Transaktion (Präzedenzfall: `runEvaluation`), an alle akzeptierten Freunde mit Kategorie `friends`.
- **Sonntag-Recap + Wrapped-Push**: In-Process-Scheduler in `server.js` (stündliches `setInterval`), Zeitzone **Europe/Berlin** via `Intl`; So 18 Uhr „x/y Workouts diese Woche", 1. des Monats 10 Uhr „Dein Rückblick ist da". `push_log` verhindert Doppel-Feuer.
- Abgelaufene Subscriptions (410/404 beim Senden) werden gelöscht.

---

## Testkonventionen

Backend wie gehabt (Vitest + supertest, `setupTestApp()`, Gemini gemockt). Neu zu mocken: `web-push` (`vi.mock('web-push')`). Frontend-Vitest: `lib/tree.test.js`, Frische-Berechnung als pure Funktion (`lib/freshness.js` + Test).
