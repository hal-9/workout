# Feature-Plan M21–M24 (Stand 2026-09-10)

Fortsetzung von [FEATURE_PLAN_M15-M20.md](FEATURE_PLAN_M15-M20.md). Vier Wünsche aus dem Training: erledigte Sätze nachträglich ändern, Übung im Workout tauschen, deutlich größere Übungsbibliothek, Schulter-Anteile statt „Schultern".

## Abgestimmte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Satz-Edit | In der Fokus-Ansicht: erledigten Punkt antippen = Satz ansehen/ändern (vorher: antippen = löschen). Löschen ist jetzt ein expliziter Button. Änderungen speichern sich selbst (Upsert, 600 ms entprellt), kein „Speichern"-Knopf. |
| Tausch-Reichweite | Nur diese Session (`sessions.adaptations_json.replaced`), Plan bleibt unangetastet. Dauerhaft ersetzen = weiterhin Plan-Editor. |
| Tausch-Ids | Ersatz loggt unter eigener Id (Bibliotheks-Id, gegen Plan-Ids kollisionsfrei). Nie unter der Original-Id — sonst würden Liegestütze als „Bankdrücken 0 kg" in Historie/Progression landen. |
| Satzzahl beim Tausch | Vom Original (Volumen des Tages bleibt), Wiederholungs-/Zeitziel und Gewicht vom Ersatz (andere Übung, andere Vorgabe). |
| Schon geloggte Sätze des Originals | Bleiben in der Session gespeichert und zählen (Summary/Stats). UI zeigt nur den Ersatz. Hinweis im Dialog. |
| Bewertung der Alternativen | Zonen-Überdeckung (primär↔primär am stärksten) + gleiches Bewegungsmuster. Drei Stufen: Gleichwertig / Guter Ersatz / Teilweise. Kandidaten ohne primären Treffer und ohne gleiches Muster erscheinen nur per Suche. |
| Geräte-Filter | Multi-Select-Chips, gemerkt in `localStorage` (`swapEquipment`) — Reisewoche = einmal „Körpergewicht" wählen. |
| Teilzonen | Dach-Keys mit Kindern: Brust (oben/mitte/unten), Schultern (vorn/seite/hinten), Bauch (gerade/seitlich), Rücken (Latissimus/oberer Rücken), Gesäß (groß/seitlich) + neue Einzelzone Adduktoren, Waden (Gastrocnemius/Soleus). Dach-Keys bleiben gültig (alte Pläne, Freitext) und werden bei Anzeige/Frische auf alle Kinder aufgelöst. Bibliothek darf im Hauptteil nur Teilzonen als primär nutzen (Test erzwingt das; einzige Ausnahme Tibialis Raise = Schienbein ohne eigene Zone). **Nicht** gesplittet: Quadrizeps/Beinbeuger (Köpfe im Training nicht getrennt ansteuerbar), Bizeps/Trizeps/Unterarme (gleiche Stelle am Modell, nur Bodybuilding-Feinheiten). |
| Bibliothek | Wandert nach `shared/exercises.json` — Backend braucht sie für Namen/Zonen getauschter Übungen. Neue Felder `pattern` (Bewegungsmuster, auch im Plan-Schema optional) und `aliases` (nur Bibliothek, für Namens-Matching „Push-Up" → Liegestütze). |

---

## M21 — Erledigte Sätze nachträglich ändern

`ExerciseFocus.jsx` hat einen `selectedIndex`. Angezeigter Satz = ausgewählter erledigter Satz, sonst der erste offene. Im Review-Modus: große Zahl grün, Label „SATZ n ERLEDIGT · TIPPEN ZUM ÄNDERN", CTA „Weiter mit Satz k ›" (bzw. „Alle Sätze erledigt · Fertig ›", schließt den Fokus), Sekundär „Satz n entfernen" (der alte Punkt-Tap) und „Schließen".

- Persistenz: `adjustBigNumber`/`adjustWeight` in `Heute.jsx` rufen für geloggte Rows `schedulePersist` → `POST /sessions/:id/sets` (Upsert existiert). Offline-Fallback wie beim Loggen (`cancelQueuedSet` + `enqueueSet`). Letzter Row-Stand kommt aus `setsRef`, nicht aus dem Closure.
- Nebenbei behoben: Fokus einer komplett erledigten Übung zeigte „Satz geschafft" und hätte beim Tippen den letzten Satz *gelöscht* (toggle). Jetzt Review-Modus mit „Fertig".
- Auswahl setzt sich bei neuem aktivem Satz oder Übungswechsel zurück (Effect auf `activeIndex`/`exercise.id`).

## M22 — Übung im Workout tauschen

Einstieg: Link „Tauschen" in der Fokus-Ansicht (neben Muskeln/Details), gesperrt wenn `focusDisabled`. Öffnet `ExerciseSwapSheet.jsx` (Bottom-Sheet über dem Fokus).

- `lib/exerciseSwap.js` (pur, Vitest): `scoreAlternative` (Score + Rating + Gründe), `rankAlternatives` (Filter Gerät/Suche/Tag-Dopplung, Sortierung Rating → Score → Name), `buildReplacement`, `applyReplacements`. Dach-Zone im Plan trifft Teilzonen mit 0,6 (`zoneOverlap` in `shared/muscles.js`).
- Gründe im UI: „Gleiches Bewegungsmuster: …", „Trainiert ebenfalls: …", „Nur mitarbeitend: …", „Fehlt: …" (rot), „Zusätzlich: …".
- `Heute.jsx`: `replaced`-State, abgeleiteter Tag `applyReplacements(planDayRaw, replaced)` **vor** der leichten Version. `applySwap` holt Prefill für die Ersatz-Id (`/history?…&exercise_ids=`), `revertSwap` baut Original-Rows neu. Persistenz `POST /sessions/:id/adaptations { replaced }`; der Endpoint **mergt** jetzt flach (`light` und `replaced` löschen sich nicht mehr gegenseitig).
- Backend `sessionExercises.js`: `sessionExerciseMeta(day, adaptations)` für Summary-Namen und Gemini-Prompt; `replacedExercisesForUser` speist `exerciseMetaForUser` in `stats.js` und `wrapped.js` (Tonnage/Sätze/Baum zählen Ersatz-Übungen). PRs (`detectNewRecords`) und Progression bleiben plan-basiert — ein Tausch bricht keine Progressions-Serie, weil Sessions ohne Sätze der Übung rausgefiltert werden (`evaluatePlan`).
- Grenzen (akzeptiert): Frische-Map mappt über den Plan-Tag, nicht über die echten Logs — bei getauschter Übung färbt sie die Zonen des Originals. Offline-Tausch überlebt keinen Reload (Adaptations-POST best effort).

## M23 — Übungsbibliothek ausgebaut

`shared/exercises.json`: 240 Einträge (106 → 240, davon 220 Hauptübungen, 20 Dehnungen), jeder Eintrag mit `zones`, `equipment`, `pattern`, `aliases`. Ausbau per Subagent gegen die Invarianten, Original-Ids und -Namen unangetastet. Invarianten in `backend/test/exerciseLibrary.test.js`: jede Zone ≥ 6 Hauptübungen, davon ≥ 3 mit Körpergewicht/Band; jedes Kraft-Muster ≥ 2 Geräte-Varianten; Hauptübungen ohne Dach-Zone `schultern`; Aliase eindeutig. Der Test ist der Wächter — neue Einträge müssen ihn grün halten.

## M24 — Teilzonen in Daten und 3D-Modell

- `shared/muscles.js`: `MUSCLE_ZONES` (27 Keys), `ZONE_CHILDREN`/`ZONE_PARENT`/`LEAF_ZONES`, `expandZones`, `zoneOverlap`, `ZONE_HINTS` (Erklärtexte im Muskel-Modal), `MOVEMENT_PATTERNS`. `TEXT_RULES`: spezifische Begriffe (Schrägbank, Latissimus, Flanke, Abduktor, Soleus …) vor dem jeweiligen Dach-Key; generischer Text landet auf dem Dach. `exerciseZones()` fällt vor dem Text-Raten auf die Bibliothek zurück (Id, dann normalisierter Name/Alias) — deshalb zeigt „Overhead Press" aus einem Freitext-Plan die vordere Schulter, „Seitheben" die seitliche.
- 3D: `lib/muscleRegions.js` — nur Blatt-Zonen haben Regionen. Alle Werte aus x/z- bzw. y/x-Histogrammen der Face-Schwerpunkte (Dev-Hook `window.__muscleGeometry` in `/dev/muskeln`, nur DEV), nicht aus dem Blick geraten. Erkenntnisse: Schulterkappe vorn z ≈ 0…0,06, seitlich x ≈ 0,25–0,29 / z ≈ −0,06, hinten z ≈ −0,14…−0,18 (von vorn ist „seitlich" nur ein schmaler Rand — korrekt); Brust-Bänder brauchen r.x 0,12, sonst Lücken am Außenrand; Rücken-Split bei y ≈ 1,42; Gesäß seitlich muss bei z ≤ 0 bleiben, weil die hängenden Hände bei x ≈ 0,2 / z ≈ 0,1–0,18 liegen; Unterschenkel liegt komplett bei z < 0, Schienbein bleibt Körperfarbe.
- `MuscleBody3D` löst Dach-Keys per `expandZones` auf (Highlight und Frische); Wizard-Blöcke (`['schultern', n]`, `['brust', n]` …) matchen per `zoneOverlap` weiter. `DEBUG_COLORS` hat eine Farbe pro `MUSCLE_ZONES`-Index.

## Offen / Ideen

- „Dauerhaft im Plan ersetzen" direkt aus dem Tausch-Sheet.
- Weitere Teilzonen nur bei Bedarf (Trizeps langer Kopf, Unterarm-Beuger/-Strecker) — Mechanik (Dach-Key + Kinder + Regionen) ist generisch.
- Frische-Map über echte Logs statt Plan-Tag, sobald getauschte Übungen häufiger werden.
