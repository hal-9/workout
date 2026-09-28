# M26 – Band-Unterstützung bei Körpergewichtsübungen (2026-09-28)

**Problem:** Klimmzüge mit Band wurden wie normale Körpergewichts-Wiederholungen
gezählt. 3 Bänder × 4 Wdh. sahen aus wie 4 echte Klimmzüge — und weniger Bänder
bei weniger Wdh. wie ein Rückschritt.

**Modell** (`shared/bandAssist.js`):
- Ein Band folgt dem Hookeschen Gesetz: Hilfe ∝ Dehnung. Der Nennwert (z. B.
  36 kg) gilt bei voller Dehnung = unten im Hang; oben ist das Band fast
  schlaff. Über die Bewegung gemittelt hilft es mit ≈ ½ Nennwert
  (`BAND_ASSIST_FACTOR = 0.5`). Mehrere Bänder addieren sich (parallel).
- Effektive Last = Körpergewicht − Hilfe, nie < 0. 3 × 36 kg bei 80 kg
  Körpergewicht → 54 kg Hilfe → 26 kg Eigenlast (nicht „108 kg weniger“).
- Fortschrittsmaß **% KG** = Epley-1RM(Eigenlast, Wdh.) / Körpergewicht.
  100 % ≈ ein Klimmzug ohne Band. Steigt mit weniger Bändern *und* mehr Wdh.

**Daten:** `set_logs.band_count`, `set_logs.band_kg` (Migration 012). Erkennung
über `isBandAssisted` (bw + „assist/unterstütz“ in Id/Name). Körpergewicht kommt
aus `max_tests` (kind `bodyweight`), zum Session-Datum, vor der ersten Wiegung
der früheste Eintrag.

**UX:** Im Fokus zweite Zahl „× Bänder“ (Stepper/Direkteingabe, Nennwert als
antippbarer Untertitel), darunter „≈ 26 kg Eigenlast · 36 % KG“. Fehlt das
Körpergewicht, fragt der Fokus einmalig danach. Prefill übernimmt die Bänder der
letzten Session; Änderung gilt für folgende offene Sätze mit.

**Bewusst nicht:** Rekorde für Band-Übungen bleiben „max. Wdh.“ (kein
Körpergewicht im Rekord-Pfad). Gemischte Bandstärken pro Satz. Kalibrierfaktor
pro Nutzer.

**Einmalige Datenkorrektur (Prod, tuncay):** alle bisherigen Sätze von
`band-assisted-pullup` auf 3 × 36 kg gesetzt; Plan-Übungsname „(20kg Band)“
entfernt.
