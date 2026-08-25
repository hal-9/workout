# M14 – Flexibler Wochenplan (Sequenz statt fester Wochentage)

Stand: 2026-08-25. Ablösung des "Nachholen"-Modells aus M7.

## Problem

Feste Wochentag-Zuordnung (Mo/Di/Do/Fr) + "Nachholen"-Button: Wer Montag verpasst
und Dienstag nachholt, kollidiert mit Dienstags-Workout — der Rest der Woche rückte
nie nach. Ergebnis: dauerhaft "hinterher" trainieren oder Workouts doppelt an einem Tag.

## Entscheidung

Plan-Tage sind eine **Sequenz mit Pausen-Muster**, keine festen Wochentage. Der
Kalender zeigt **projizierte** Termine, rein abgeleitet aus `(Plan, erledigte
Sessions dieser Woche, heute)`. Kein neuer DB/API-Zustand, rein Frontend
(`frontend/src/lib/schedule.js` → `projectWeek`).

### Projektionsregeln

1. Seed-Termine aus explizitem `weekday` je Plan-Tag (Alles-oder-nichts-Regel wie
   bisher) oder Default-Spread. Abstände zwischen Seeds = Pausen-Muster.
2. Offene Tage immer in Plan-Reihenfolge, auch nach Erledigung außer der Reihe.
3. **Slip-only:** `projiziert = max(Seed, Vorgänger + Original-Abstand, heute)`.
   Frühes Training zieht nichts nach vorn. Vorgänger = Ist-Datum (erledigt) oder
   Projektion (offen) — Pause nach spät erledigtem Workout bleibt also erhalten.
4. Nie zwei Workouts am selben Tag (heute schon trainiert → frühestens morgen).
5. Überlauf hinter Sonntag: **späte** Abstände schrumpfen zuerst (Rückwärts-Klemme
   an So, dann Vorwärts-Reparatur). Nahe Pausen überleben.
6. Passt trotzdem nicht alles: letzte Tage der Sequenz sind "diese Woche nicht
   mehr" — sichtbar, weiter antippbar, kein Übertrag.
7. **Soft Reset:** Montag startet frisch, kein Carryover. Vergangene Wochen zeigen
   im Kalender ihre `x/y`-Bilanz.

### UX

- "Nachholen"-Karte, "Nachholbar"/"Offen"-Badges und Verpasst-Styling entfernt —
  ein verrutschtes Workout *ist* einfach das nächste. Kein Schuld-UI.
- Heute-Chips zeigen den projizierten Wochentag bzw. "diese Woche nicht mehr".
- Pausentag: Hinweiszeile "Heute Pause · X geplant für Y".
- Kalender: aktuelle Woche = Projektion, vergangene Wochen = Ziel-Rhythmus + Ist.
- Plan-Editor: Feld heißt jetzt "Ziel-Wochentag" — es seedet das Muster, fixiert
  aber keinen Termin mehr.
- Manuelle Steuerung = ausschließlich die Tages-Chips (jeden Tag jederzeit wählbar).
  Bewusst kein zusätzliches Verschiebe-UI.

## Warum so

- **Slip-only statt Vorziehen:** Projektion soll Verrutschen abfedern, nicht
  Vorarbeiten belohnen; Wochenstruktur bleibt stabil.
- **Späte Kompression:** lieber am Wochenende eine Pause opfern als ein Workout
  streichen; nahe Pausen (Regeneration) haben Vorrang.
- **Soft Reset statt Übertrag:** Übertrag in die Folgewoche wäre die
  Abwärtsspirale — eine schlechte Woche darf enden.

## Tests

`frontend/src/lib/schedule.test.js` (Vitest, `cd frontend && npm test`):
Seed-Treue, Verschiebung mit Abstands-Erhalt, slip-only, nie-zwei-pro-Tag,
Wochenend-Kompression, echter Überlauf, Reihenfolge bei Out-of-order,
explizite Ziel-Wochentage.
