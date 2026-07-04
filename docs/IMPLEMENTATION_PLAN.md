# Workout-App — Implementation Plan (Handover)

> **Für das ausführende Modell:** Dieses Dokument ist die vollständige und verbindliche Spezifikation.
> Arbeite die Meilensteine M1–M6 **strikt nacheinander** ab. Ein Meilenstein ist erst fertig, wenn
> alle Pflicht-Tests grün sind und die Definition of Done erfüllt ist. Baue **keine** Features, die
> hier nicht spezifiziert sind. Wenn zwei Stellen dieses Dokuments sich widersprechen oder etwas
> unklar ist: **anhalten und nachfragen**, nicht raten.

## 1. Projektüberblick

Selbst-gehostete Workout-PWA für genau 2 Nutzer (Tuncay + Partnerin). Kein öffentlicher Dienst,
keine Registrierung. Nutzer werden geseedet.

```
iPhone PWA (React + Vite, "Add to Home Screen")
   │ HTTPS
   ▼
Caddy (Reverse Proxy, Auto-TLS)
   │
   ▼
Node/Express API  ──  SQLite (Datei, Docker Volume)
   │
   └──► Google Gemini API (Server-seitig, Key nur im Backend-ENV)
```

### Kern-Features (MVP — nicht mehr, nicht weniger)

- Login für 2 geseedete Nutzer (bcrypt, httpOnly-Session-Cookie, 90 Tage rolling)
- Trainingsplan pro Nutzer, Import als JSON (Schema v1, siehe §3.1)
- Workout-Ansicht: Sätze mit editierbaren Reps/Kg, vorausgefüllt mit Werten der letzten Session
- Extra-Sätze über den Plan hinaus erlaubt; ungeloggte Übungen gelten als geskippt
- Session finish → Backend aggregiert → 1 Gemini-Call (2.5 Flash) → Auswertung anzeigen & speichern
- Fortschritt: Max-Tests (Liegestütze), Klimmzug-Stufen, Körpergewichts-Log, Recharts-Charts,
  Partner-Fortschritt read-only per Toggle
- Pause-Timer zwischen Sätzen (rein Frontend)
- PWA: Manifest, Service Worker, Offline-Queue für Set-Logs (IndexedDB, Sync bei Reconnect)

### Explizit NICHT im Scope

App Store / Capacitor · Push Notifications · mehr als 2 Nutzer · Passwort-Reset ·
Registrierung · Session-Start offline · Editieren abgeschlossener Sessions ·
Multi-Device-Sync über die Offline-Queue hinaus · Auto-Retry der LLM-Auswertung.

### Stack (gepinnt)

| Bereich | Wahl |
|---|---|
| Node | 22 LTS |
| Package Manager | npm (workspaces: `frontend`, `backend`) |
| Backend | Express 4, better-sqlite3, zod, bcrypt |
| Frontend | React 18, Vite, @tanstack/react-query, Recharts, vite-plugin-pwa, react-markdown |
| Tests | Vitest + supertest (Backend) |
| LLM | Google Gemini API (`@google/genai`), Modell `gemini-2.5-flash`, max_tokens 600 |
| Deploy | Docker Compose (caddy + api), Caddy Auto-TLS |

### Monorepo-Layout

```
/frontend        Vite-React-App (PWA)
/backend         Express-API, Migrations, Seed, Tests
/deploy          compose.yml, Caddyfile, deploy.sh, .env.example
/docs            dieses Dokument, VPS_SETUP.md, ux-reference.html
```

### Arbeitsregeln

1. Pro Meilenstein: Tasks umsetzen → Pflicht-Tests schreiben/grün machen → manuelle Checkliste
   durchgehen → Commit(s) mit klarer Message.
2. `docs/ux-reference.html` ist die maßgebliche Design-Referenz (Farben, Layout, Typografie,
   iOS-Meta-Tags). Vor M2 einmal komplett lesen und die Design-Tokens (Farben, Radien, Abstände)
   als CSS-Variablen ins Frontend übernehmen. Falls die Datei fehlt: anhalten und nachfragen.
3. Keine zusätzlichen Dependencies ohne Not. Jede neue Dependency kurz begründen.
4. Alle UI-Texte auf Deutsch.

## 2. Datenmodell (SQLite)

Migrations als nummerierte SQL-Dateien unter `backend/migrations/` (`001_init.sql`, …), beim
API-Start automatisch angewandt (simple Runner-Funktion: Tabelle `schema_migrations(name)`,
noch nicht angewandte Dateien in Reihenfolge ausführen, alles in einer Transaktion).

```sql
CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  password_digest TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_sessions (
  id         INTEGER PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE,          -- 32 zufällige Bytes, hex (crypto.randomBytes)
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,                 -- ISO-8601 UTC
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plans (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  json_payload   TEXT NOT NULL,             -- validierter Plan als JSON-String
  active         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  plan_id     INTEGER NOT NULL REFERENCES plans(id),
  day_key     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','finished','discarded')),
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE set_logs (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  exercise_id TEXT NOT NULL,
  set_number  INTEGER NOT NULL,
  reps        INTEGER,
  weight_kg   REAL,
  duration_s  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, exercise_id, set_number)
);

CREATE TABLE max_tests (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind    TEXT NOT NULL CHECK (kind IN ('pushups','pullup_stage','bodyweight')),
  value   REAL NOT NULL,
  date    TEXT NOT NULL                      -- YYYY-MM-DD
);

CREATE TABLE evaluations (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL UNIQUE REFERENCES sessions(id),
  model      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','ok','failed')),
  summary_md TEXT,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Seed (`backend/seed.js`, idempotent — überspringt existierende Nutzer): legt die 2 Nutzer an.
Namen und Passwörter kommen aus ENV: `SEED_USER1_NAME`, `SEED_USER1_PASSWORD`,
`SEED_USER2_NAME`, `SEED_USER2_PASSWORD`. bcrypt cost 12.

## 3. Contracts

### 3.1 Plan-JSON-Schema v1

Workflow: Neuer Plan wird extern mit Claude generiert → JSON im Screen „Plan importieren"
eingefügt → Backend validiert → als aktiver Plan gespeichert (alter Plan `active=0`).

Beispiel:

```json
{
  "schema_version": 1,
  "name": "Home Push/Pull/Legs",
  "days": [
    {
      "key": "push",
      "name": "Push & Core",
      "focus": "Brust · Schultern · Trizeps · Core",
      "exercises": [
        {
          "id": "pu",
          "name": "Liegestütze",
          "muscle": "Brust · Schulter · Trizeps",
          "type": "bw",
          "sets": 5,
          "target_reps": "8-12",
          "target_seconds": null,
          "default_weight_kg": null,
          "cue": "Körper als Linie, Ellbogen ~45°",
          "video_query": "push up proper form tutorial"
        }
      ]
    }
  ]
}
```

Verbindliches zod-Schema (`backend/src/planSchema.js`):

```js
import { z } from 'zod';

const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  muscle: z.string().min(1),
  type: z.enum(['bw', 'wt', 'time', 'cardio']),
  sets: z.number().int().min(1).max(20),
  target_reps: z.string().nullable(),      // z.B. "8-12"; null bei time/cardio
  target_seconds: z.number().int().positive().nullable(),
  default_weight_kg: z.number().positive().nullable(),
  cue: z.string(),
  video_query: z.string(),
}).strip();

const daySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  focus: z.string(),
  exercises: z.array(exerciseSchema).min(1),
}).strip();

export const planSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().min(1),
  days: z.array(daySchema).min(1),
}).strip()
  .refine(
    (plan) => {
      const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.id));
      return new Set(ids).size === ids.length;
    },
    { message: 'exercise ids must be unique within the plan' }
  )
  .refine(
    (plan) => new Set(plan.days.map((d) => d.key)).size === plan.days.length,
    { message: 'day keys must be unique within the plan' }
  );
```

Regeln:
- `exercise.id` eindeutig im gesamten Plan und **stabil über Plan-Versionen** (Basis für
  planübergreifendes Prefill und Verlaufsvergleich).
- `schema_version !== 1` → 422 mit `{error: "unsupported schema_version"}`.
- Unbekannte Felder werden gestript (`.strip()`), nicht abgelehnt.
- Validierungsfehler → 422 mit `{error: "validation failed", details: [...zod issues]}` —
  das Frontend zeigt `details` im Import-Screen an.

### 3.2 API-Endpunkte

Basis: alle unter `/api`, JSON in/out. Alle Endpoints außer `POST /api/login` antworten
`401 {error:"unauthorized"}` ohne gültiges Session-Cookie. Alle Daten sind strikt auf den
eingeloggten Nutzer gescoped — einzige Ausnahme: `GET /api/partner/progress`.

**Auth-Middleware:** liest Cookie `session`, sucht `auth_sessions.token`, prüft `expires_at`.
Bei Treffer: `expires_at` auf `now + 90 Tage` verlängern und Cookie mit neuem `Max-Age`
erneut setzen (rolling). Cookie-Attribute: `httpOnly`, `secure` (außer `NODE_ENV=test`),
`sameSite=lax`, `path=/`.

---

`POST /api/login`
Request `{ "name": "tuncay", "password": "..." }`
→ 200 `{ "id": 1, "name": "tuncay" }` + Set-Cookie · → 401 bei falschen Credentials.

`POST /api/logout` → 204, löscht die auth_session-Row und das Cookie.

`GET /api/me` → 200 `{ "id": 1, "name": "tuncay" }`.

---

`GET /api/plan` → 200 geparster `json_payload` des aktiven Plans plus `{"plan_id": 3}`
· → 404 `{error:"no active plan"}` wenn keiner existiert.

`POST /api/plan`
Request: das Plan-JSON (§3.1). Validierung → bei Erfolg in einer Transaktion: alle Pläne des
Nutzers `active=0`, neuen Plan mit `active=1` einfügen.
→ 201 `{ "plan_id": 4 }` · → 422 (siehe §3.1).

---

`POST /api/sessions`
Request `{ "day_key": "push" }`. Logik (Transaktion):
1. Existiert eine Session des Nutzers mit `status='active'`, gleichem `day_key` und
   `started_at` < 24h alt → diese zurückgeben: 200 `{ "session_id": 7, "resumed": true,
   "set_logs": [...] }` (inkl. bereits geloggter Sets, damit das Frontend den Zustand
   wiederherstellen kann).
2. Sonst: **alle** noch aktiven Sessions des Nutzers (egal welcher `day_key`) auf
   `status='discarded'` setzen, neue Session anlegen → 201 `{ "session_id": 8,
   "resumed": false, "set_logs": [] }`.
3. `day_key` muss im aktiven Plan existieren, sonst 422. Kein aktiver Plan → 409.

`POST /api/sessions/:id/sets`
Request `{ "exercise_id": "pu", "set_number": 1, "reps": 10, "weight_kg": null, "duration_s": null }`
**Upsert** auf `(session_id, exercise_id, set_number)` — `INSERT ... ON CONFLICT ... DO UPDATE`
(reps/weight_kg/duration_s/updated_at überschreiben). Idempotent: identischer Request zweimal
→ identischer Endzustand. Das ist die Basis der Offline-Queue.
→ 200 `{ "ok": true }` · → 404 fremde/unbekannte Session · → 409 `{error:"session finished"}`
wenn `status != 'active'`. `set_number` ≥ 1, auch > `sets` aus dem Plan erlaubt (Extra-Sätze).
Genau eines von `reps`/`duration_s` muss gesetzt sein (passend zum Übungstyp); Validierung
mit zod, sonst 422.

`POST /api/sessions/:id/finish`
→ setzt `status='finished'`, `finished_at=now`; legt `evaluations`-Row mit `status='pending'`
an; startet den LLM-Call **asynchron** (fire-and-forget, §4); antwortet **sofort**
200 `{ "session_id": 8, "summary": { "exercises": [...] } }` (geloggte Sets gruppiert je Übung).
→ 409 wenn Session nicht `active`. Session ohne einen einzigen Set-Log → trotzdem finishbar,
aber **keine** Evaluation anlegen (nichts auszuwerten) → Response enthält `"evaluation": false`.

`POST /api/sessions/:id/evaluate`
Manueller Retry. Nur erlaubt, wenn Evaluation existiert und `status='failed'` → wieder auf
`pending`, LLM-Call erneut asynchron starten → 202 `{ "status": "pending" }`.
→ 409 bei `pending` (läuft schon) oder `ok` (fertig) · → 404 wenn keine Evaluation existiert.

`GET /api/sessions/:id/evaluation`
→ 200 `{ "status": "pending" }` | `{ "status": "ok", "summary_md": "..." }` |
`{ "status": "failed", "error": "..." }` · → 404 wenn keine Evaluation existiert.
Frontend pollt alle 2s bis `ok`/`failed` (Abbruch nach 60s → wie `failed` behandeln,
Retry-Button zeigen).

---

`GET /api/history?day_key=push`
Liefert für den Trainingstag zweierlei:

```json
{
  "prefill": {
    "pu":  [ { "set_number": 1, "reps": 10, "weight_kg": null, "duration_s": null }, ... ],
    "dip": [ ... ]
  },
  "recent_sessions": [
    { "session_id": 7, "started_at": "...", "day_key": "push",
      "sets": [ { "exercise_id": "pu", "set_number": 1, "reps": 10, ... } ] }
  ]
}
```

- `prefill`: **pro `exercise_id`** des Tages (aus dem aktiven Plan) die Sets der jüngsten
  `finished` Session des Nutzers, die Logs zu dieser `exercise_id` enthält — **planübergreifend**,
  d.h. Suche über alle Sessions, nicht nur die des aktiven Plans. Keine Treffer → Key fehlt im
  Objekt (Frontend fällt auf `target_reps`/`default_weight_kg` aus dem Plan zurück).
- `recent_sessions`: die letzten 5 `finished` Sessions mit diesem `day_key` inkl. Sets
  (für die Verlaufsansicht).

---

`POST /api/max-tests`
Request `{ "kind": "pushups", "value": 25, "date": "2026-07-04" }` (`date` optional,
Default heute) → 201 `{ "id": 12 }`. `kind` ∈ pushups|pullup_stage|bodyweight, sonst 422.

`GET /api/max-tests?kind=pushups` → 200 `[ { "id": 12, "kind": "pushups", "value": 25,
"date": "2026-07-04" }, ... ]` aufsteigend nach `date`. Ohne `kind`-Param: alle Kinds.

`GET /api/partner/progress`
→ 200 `{ "name": "partnerin", "max_tests": [ ...alle max_tests des anderen Nutzers... ] }`.
Bei 2 geseedeten Nutzern ist „der andere" eindeutig (der eine User, der nicht der eingeloggte
ist). Read-only, keine Session-/Set-Daten.

## 4. LLM-Auswertung

Modul `backend/src/evaluation.js`. Ablauf bei finish/evaluate:

1. **Aggregieren** — kompaktes JSON:

```json
{
  "day": "Push & Core",
  "current_session": {
    "date": "2026-07-04",
    "exercises": [
      { "id": "pu", "name": "Liegestütze", "type": "bw",
        "sets": [ { "set": 1, "reps": 10 }, { "set": 2, "reps": 9 } ] }
    ]
  },
  "previous_sessions": [
    { "date": "2026-07-01", "exercises": [ ...gleiches Format... ] }
  ],
  "bodyweight_log": [ { "date": "2026-06-20", "kg": 82.5 }, ... ]
}
```

- `previous_sessions`: die letzten 3–5 `finished` Sessions gleichen `day_key` (ohne die aktuelle).
- `bodyweight_log`: letzte 5 Einträge aus `max_tests` mit `kind='bodyweight'`.
- Nur geloggte Sets aufnehmen; `weight_kg`/`duration_s` nur wenn gesetzt.

2. **Call** — Google Gemini API (offizielles SDK `@google/genai`), Modell
`gemini-2.5-flash`, `maxOutputTokens: 600`, Timeout 30s. System-Prompt wörtlich:

```
Du bist ein sachlicher Krafttrainings-Coach. Du bekommst Trainingsdaten als JSON:
die aktuelle Session, die letzten Sessions desselben Trainingstags und den
Körpergewichts-Verlauf.

Aufgabe:
1. Vergleiche die aktuelle Session pro Übung mit den vorherigen Sessions
   (Wiederholungen, Gewicht, Volumen). Benenne Fortschritt und Rückschritt konkret.
2. Beziehe den Körpergewichts-Trend ein, wo er relevant ist
   (z.B. bei Körpergewichtsübungen).
3. Gib 2–3 konkrete, umsetzbare Empfehlungen für die nächste Session.

Antworte knapp auf Deutsch in Markdown. Struktur: kurze Gesamteinschätzung,
dann pro Übung eine Zeile, dann "**Empfehlungen:**" als Liste.
Keine Einleitungsfloskeln. Maximal ~250 Wörter.
```

User-Message: das Aggregations-JSON als String.

3. **Ergebnis speichern** — Erfolg: `status='ok'`, `summary_md` = Antworttext.
Fehler (API down, Timeout, non-2xx): `status='failed'`, `error` = kurze Fehlermeldung.
**Niemals** darf ein Eval-Fehler das Speichern der Session beeinträchtigen — der Call läuft
komplett entkoppelt nach der finish-Response. Kein Auto-Retry. Status-Guard (§3.2 evaluate)
verhindert parallele Calls für dieselbe Session.

`GEMINI_API_KEY` ausschließlich aus Backend-ENV. Fehlt der Key: Evaluation direkt auf
`failed` mit `error='GEMINI_API_KEY not configured'`.

## 5. Frontend-Spezifikation

### Allgemein

- React 18 + Vite, React Query für sämtliches API-Fetching/Caching. Kein Redux/Zustand.
- Routing: react-router (5 Routen). Nicht eingeloggt (401 von `/api/me`) → Redirect Login.
- Design-Quelle: `docs/ux-reference.html` — Farben, Typografie, Abstände, Komponenten-Look,
  iOS-Meta-Tags (`apple-mobile-web-app-capable` etc.) von dort übernehmen.
- Mobile-first (iPhone), Bottom-Tab-Navigation: Heute · Plan · Fortschritt.
- Dev: Vite-Proxy `/api` → `http://localhost:3000`.

### Screens

**Login** — Name + Passwort, Fehlermeldung bei 401. Nach Erfolg → Heute.

**Heute** — Tagesauswahl (Cards aus `plan.days` mit `name` + `focus`). Tap auf Tag →
`POST /api/sessions` + `GET /api/history?day_key=…` → Workout-Ansicht:
- Pro Übung eine Card: Name, `muscle`, `cue`, Video-Link
  (`https://www.youtube.com/results?search_query=<encodeURIComponent(video_query)>`,
  öffnet extern).
- Pro Satz eine Zeile: Satz-Nr., Eingabefelder (Reps + Kg bei `wt`; Reps bei `bw`;
  Sekunden bei `time`/`cardio`), vorbelegt aus `prefill` (Fallback: Plan-Targets).
  `inputmode="numeric"` bzw. `"decimal"`.
- Satz abhaken → Upsert-POST (bzw. Offline-Queue, §5 PWA) → **Pause-Timer** startet:
  Countdown, wählbar 60/90/120s (Auswahl persistiert in localStorage), sichtbar als
  Balken/Kreis, abbrechbar. Rein Frontend, kein Backend-Bezug.
- „+ Satz"-Button pro Übung: fügt Zeile mit nächster `set_number` hinzu.
- Bei `resumed: true`: bereits geloggte Sets als abgehakt rendern.
- „Workout abschließen"-Button → `POST …/finish` → Navigation zum Auswertungs-Screen.
  Ungeloggte Übungen zählen als geskippt — kein Warn-Dialog nötig.

**Auswertung** — pollt `GET …/evaluation` alle 2s (max 60s). `pending`: Spinner + Hinweis.
`ok`: `summary_md` via react-markdown rendern. `failed`/Timeout: Fehlertext + Button
„Erneut auswerten" → `POST …/evaluate` → wieder pollen. Zusätzlich die Session-Summary
(geloggte Sets je Übung) anzeigen. Falls finish `evaluation: false` lieferte: nur Summary,
Hinweis „Keine Auswertung (keine Sätze geloggt)".

**Plan** — aktiver Plan als Übersicht (Tage → Übungen mit Targets). Bereich „Plan importieren":
Textarea für JSON, Import-Button → `POST /api/plan`. 422 → `details` lesbar auflisten.
Erfolg → neuen Plan anzeigen.

**Fortschritt** — drei Bereiche + Formular „Neuer Eintrag" (kind-Auswahl, Wert, Datum):
- Liegestütze-Max: Recharts `LineChart` über `max_tests?kind=pushups`.
- Körpergewicht: `LineChart` über `kind=bodyweight`.
- Klimmzug-Stufe: aktuelle Stufe prominent (Zahl + Label) + kleine Verlaufs-Liste.
  Stufen-Skala als Konstante im Frontend (`frontend/src/pullupStages.js`). Falls
  `ux-reference.html` eine Skala definiert, diese übernehmen; sonst Default:
  1 Dead Hang · 2 Scapula Pulls · 3 Negative · 4 Band-assistiert · 5 halber ROM ·
  6 voller Klimmzug · 7 Klimmzug mit Zusatzgewicht.
- **Partner-Toggle** (Segmented Control „Ich / <Partnername>"): bei Partner →
  `GET /api/partner/progress`, gleiche Charts read-only ohne Eintrag-Formular.

### PWA & Offline-Queue

- `vite-plugin-pwa`: Manifest (Name, Icons, `display: standalone`, Theme-Color aus
  ux-reference), Precache der App-Shell. API-Requests **nie** cachen.
- Offline-Queue (`frontend/src/offlineQueue.js`), gilt **nur** für Set-Upserts:
  - Schlägt der POST fehl (offline/Netzfehler), Eintrag
    `{session_id, exercise_id, set_number, payload}` in IndexedDB speichern —
    gekeyt auf `session_id:exercise_id:set_number`, neuer Wert überschreibt alten
    (letzter Stand gewinnt).
  - Bei `online`-Event + beim App-Start: Queue sequenziell abspielen (Upsert = idempotent),
    Erfolge entfernen. 409 (Session inzwischen finished/discarded) → Eintrag verwerfen.
  - UI: dezenter Offline-Indikator + Badge „n Sätze warten auf Sync".
- Session-Start und finish erfordern Verbindung — offline: Buttons deaktiviert mit Hinweis.

## 6. Meilensteine

Backend-Tests: Vitest + supertest, DB pro Testlauf als frische Temp-Datei
(`DATABASE_PATH` aus ENV), Migrations + Test-Seed im Setup. `npm test -w backend`.

---

### M1 — Gerüst, DB, Auth

**Tasks**
1. Monorepo: Root-`package.json` (npm workspaces), `backend/`- und `frontend/`-Scaffold
   (Vite-React-Template), `.gitignore`, `.env.example` (alle ENV-Variablen aus diesem Dokument).
2. Express-App: JSON-Body-Parser, Cookie-Parsing, zentrale Fehlerbehandlung
   (JSON-Fehlerformat `{error: "..."}`), `GET /api/healthz` → `{ok:true}`.
3. Migrations-Runner + `001_init.sql` (§2). better-sqlite3, `DATABASE_PATH` aus ENV.
4. Seed-Skript (§2), `npm run seed -w backend`.
5. Auth: login/logout/me, Auth-Middleware mit 90d-Rolling-Cookie (§3.2).

**Pflicht-Tests**
- login: korrekt → 200 + Cookie; falsches Passwort/unbekannter Name → 401.
- me: mit Cookie → 200 + korrekte Daten; ohne → 401; mit abgelaufenem Token → 401.
- Rolling: Request mit gültigem Cookie verlängert `expires_at` in der DB.
- logout: 204, Token danach ungültig.
- Migrations-Runner: zweifacher Lauf ist idempotent.

**DoD:** Tests grün · `npm run dev -w backend` startet · Login per curl durchspielbar ·
Seed idempotent.

---

### M2 — Plan: Schema, Import, Rendering

**Tasks**
1. zod-Schema (§3.1) + `GET/POST /api/plan` (§3.2).
2. Frontend-Grundgerüst: Router, Login-Screen, Auth-Guard (React Query auf `/api/me`),
   Bottom-Tabs, Design-Tokens aus `ux-reference.html`.
3. Plan-Screen: Anzeige + Import (Textarea, Fehlerdarstellung).

**Pflicht-Tests**
- POST /api/plan: gültiger Plan → 201, ist danach der aktive (GET liefert ihn), alter Plan
  `active=0`. `schema_version: 2` → 422. Doppelte exercise-`id` → 422. Doppelter day-`key`
  → 422. Fehlendes Pflichtfeld → 422 mit `details`. Unbekannte Felder werden gestript.
- GET /api/plan ohne Plan → 404.

**DoD:** Tests grün · im Browser: Login → Plan-JSON einfügen → Plan wird gerendert ·
kaputtes JSON zeigt verständliche Fehler.

---

### M3 — Sessions & Set-Logging

**Tasks**
1. `POST /api/sessions` (Resume-/Discard-Logik), `POST …/sets` (Upsert),
   `POST …/finish` (ohne LLM — Evaluation-Row anlegen, Call kommt in M4),
   `GET /api/history` (Prefill planübergreifend + recent_sessions).
2. Heute-Screen komplett (§5): Tagesauswahl, Workout-Ansicht, Prefill, Abhaken,
   Extra-Satz, Pause-Timer, Resume-Verhalten, Abschließen (Navigation zur Auswertung
   mit vorerst statischem Pending-Zustand).

**Pflicht-Tests**
- sessions: neue Session 201 · zweiter Aufruf gleicher day_key < 24h → 200 resumed:true
  mit set_logs · aktive Session anderen day_keys wird discarded · `started_at` > 24h
  (per direktem DB-Update im Test gealtert) → neue Session, alte discarded ·
  unbekannter day_key → 422 · kein Plan → 409.
- sets: Insert dann Update auf gleichem Key → genau 1 Row, neue Werte · identischer
  Request 2× → idempotent · finished Session → 409 · fremde Session (anderer Nutzer) → 404 ·
  reps und duration_s gleichzeitig → 422.
- finish: setzt status/finished_at, legt Evaluation pending an · ohne Sets →
  `evaluation:false`, keine Row · doppeltes finish → 409.
- history: Prefill liefert jüngste finished Session je exercise_id **auch aus anderem Plan**
  (Test: Plan A loggen, Plan B mit gleicher exercise_id importieren, Prefill da) ·
  Übung ohne Historie fehlt im prefill-Objekt · discarded/active Sessions zählen nicht.

**DoD:** Tests grün · kompletter Workout-Flow im Browser durchspielbar · zweites Öffnen
setzt Session fort · Prefill sichtbar.

---

### M4 — LLM-Auswertung

**Tasks**
1. Aggregation + Gemini-Call + Persistenz (§4), Anbindung an finish.
2. `POST …/evaluate` (Retry) + `GET …/evaluation`.
3. Auswertungs-Screen komplett (Polling, Markdown, Retry, Timeout).

**Pflicht-Tests** (Gemini-SDK im Test mocken — kein echter API-Call)
- finish → Evaluation wird `ok` mit summary_md (Mock-Antwort) · Mock wirft Fehler →
  `failed` + error, finish-Response war trotzdem 200.
- Aggregat korrekt: nur gleicher day_key, max 5 previous, ohne aktuelle Session,
  bodyweight_log = letzte 5 Einträge.
- evaluate: bei failed → 202 und erneuter Call · bei pending/ok → 409 · ohne Evaluation → 404.
- evaluation-GET: alle drei Status-Formen.

**DoD:** Tests grün · mit echtem Key: Workout abschließen liefert deutsche
Markdown-Auswertung · Key entfernen → failed-Zustand + Retry-Button funktioniert.

---

### M5 — Fortschritt

**Tasks**
1. `POST/GET /api/max-tests`, `GET /api/partner/progress`.
2. Fortschritt-Screen (§5): Formular, zwei Recharts-Liniencharts, Klimmzug-Stufen-Anzeige,
   Partner-Toggle.

**Pflicht-Tests**
- max-tests: POST gültig → 201 · ungültiger kind → 422 · Default-Datum heute ·
  GET gefiltert + sortiert · Nutzer sieht nur eigene Einträge.
- partner/progress: liefert exakt die max_tests des jeweils anderen Nutzers + dessen Name.

**DoD:** Tests grün · Einträge erfassen → Charts aktualisieren sich · Partner-Toggle
zeigt dessen Daten read-only.

---

### M6 — PWA, Offline-Queue, Deploy

**Tasks**
1. vite-plugin-pwa (Manifest, Icons, iOS-Meta-Tags aus ux-reference).
2. Offline-Queue (§5) + Offline-Indikator.
3. `deploy/compose.yml`: Services `caddy` (Ports 80/443, mountet Caddyfile +
   `frontend-dist/` nach `/srv/frontend`, Volumes `caddy_data`/`caddy_config`) und `api`
   (Build aus `backend/Dockerfile`, Node-22-Alpine, mountet `./data`, liest `.env`,
   `restart: unless-stopped`, kein Port nach außen). `backend/Dockerfile` (npm ci --omit=dev,
   startet Migrations + Server).
4. `deploy/Caddyfile` mit Platzhalter `workout.example.com`:

```
workout.example.com {
  handle /api/* {
    reverse_proxy api:3000
  }
  handle {
    root * /srv/frontend
    try_files {path} /index.html
    file_server
  }
}
```

5. `deploy/deploy.sh` (idempotent): `git pull` → Frontend-Build im Container
   (`docker run --rm -v ...frontend:/app -w /app node:22 sh -c "npm ci && npm run build"`)
   → `dist/` nach `frontend-dist/` syncen → `docker compose up -d --build api` →
   `docker compose restart caddy` nur bei Caddyfile-Änderung.
6. `deploy/.env.example` mit allen Variablen (GEMINI_API_KEY, SESSION_SECRET,
   DATABASE_PATH, SEED_*).

**Pflicht-Tests:** keine neuen Backend-Tests; bestehende müssen grün bleiben.

**Manuelle Checkliste**
- Lokal `docker compose up` (Domain temporär durch `localhost:80`-Block ersetzt oder
  `caddy` mit internem TLS off): App lädt, Login, kompletter Flow.
- Offline-Test im Browser (DevTools offline): Sets abhaken → Queue-Badge → online →
  Sync, Daten in DB.
- iPhone: Add to Home Screen, App startet standalone, Icons/Statusbar korrekt.

**DoD:** Checkliste bestanden · VPS-Deployment nach `docs/VPS_SETUP.md` möglich.

## 7. ENV-Variablen (vollständig)

| Variable | Zweck |
|---|---|
| `NODE_ENV` | production/development/test |
| `PORT` | API-Port, Default 3000 |
| `DATABASE_PATH` | Pfad zur SQLite-Datei, z.B. `/data/app.db` |
| `SESSION_SECRET` | reserviert (Cookie-Signierung), `openssl rand -hex 32` |
| `GEMINI_API_KEY` | nur Backend |
| `SEED_USER1_NAME` / `SEED_USER1_PASSWORD` | Nutzer 1 |
| `SEED_USER2_NAME` / `SEED_USER2_PASSWORD` | Nutzer 2 |
