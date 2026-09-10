// Ellipsoid-Regionen, die Faces des Meshy-GLB den Muskelzonen zuordnen.
// Das Modell ist EIN verschmolzener Mesh ohne anatomische Teile — die Zonen
// entstehen rein räumlich: Face-Schwerpunkt fällt in eine Region → Zone.
// Koordinatenraum: normalisiert auf Füße y=0, Scheitel y=1.9, x/z zentriert,
// Blick des Modells Richtung +z. `c` = Zentrum (x immer >= 0), `r` = Radien.
// mirror: true (Default) spiegelt die Region auf die -x-Seite.
// Werte aus der Geometrie vermessen (Höhenband-Statistik) und per Dev-Ansicht
// /dev/muskeln (nur im Vite-Dev-Server) visuell nachkalibriert.
// Eigenheiten des Scans: Arme hängen hinter der Mittelebene (Arm-Mitte
// z ≈ −0.08), Unterschenkel komplett bei z < 0, Hände leicht nach vorn.
export const ZONE_REGIONS = {
  // Dach-Keys (brust, schultern, core, ruecken, gesaess, waden) haben keine
  // eigene Region — expandZones löst sie auf ihre Teilzonen auf.
  // Brust in drei Höhenbändern (Mitte der Pec-Masse bei y≈1.43); r.x etwas
  // größer als das alte Einzel-Ellipsoid, damit am Außenrand keine Lücken
  // zwischen den Bändern bleiben.
  brust_oben: [
    { c: [0.08, 1.50, 0.09], r: [0.12, 0.055, 0.09] },
  ],
  brust_mitte: [
    { c: [0.08, 1.43, 0.11], r: [0.12, 0.055, 0.09] },
  ],
  brust_unten: [
    { c: [0.08, 1.36, 0.10], r: [0.12, 0.055, 0.09] },
  ],
  // Deltamuskel dreigeteilt. Arme hängen im Scan hinter der Mittelebene,
  // deshalb liegt „vorn" nur knapp vor z=0. Werte aus der Face-Verteilung
  // (x/z-Histogramm im Band y 1.38–1.64): Kappe vorn z≈0…0.06, seitlich
  // x≈0.25–0.29 / z≈−0.06, hinten z≈−0.14…−0.18.
  schultern_vorn: [
    { c: [0.185, 1.50, 0.035], r: [0.065, 0.085, 0.055] },
  ],
  schultern_seite: [
    { c: [0.265, 1.50, -0.06], r: [0.055, 0.09, 0.065] },
  ],
  schultern_hinten: [
    { c: [0.19, 1.50, -0.15], r: [0.065, 0.085, 0.055] },
  ],
  bizeps: [
    { c: [0.265, 1.31, -0.02], r: [0.065, 0.12, 0.055] },
  ],
  trizeps: [
    { c: [0.26, 1.31, -0.115], r: [0.07, 0.12, 0.05] },
  ],
  unterarme: [
    { c: [0.285, 1.07, 0.0], r: [0.07, 0.14, 0.10] },
  ],
  // Bauch: gerade Säule bis x≈0.08, schräge Bauchmuskeln als Flanke, die
  // um die Seite herum bis z≈0 reicht.
  core_gerade: [
    { c: [0.035, 1.18, 0.095], r: [0.055, 0.17, 0.06] },
  ],
  core_seitlich: [
    { c: [0.125, 1.17, 0.045], r: [0.055, 0.16, 0.07] },
  ],
  // Rücken: Latissimus unten/seitlich (Achsel bis Taille), oberer Rücken
  // (Trapez, Rhomboiden, Schulterblatt) bis zum Nackenansatz. Grenze y≈1.42.
  ruecken_lat: [
    { c: [0.10, 1.31, -0.11], r: [0.13, 0.13, 0.08] },
  ],
  ruecken_oben: [
    { c: [0.06, 1.51, -0.12], r: [0.13, 0.10, 0.08] },
  ],
  unterer_ruecken: [
    { c: [0.035, 1.08, -0.10], r: [0.07, 0.10, 0.06] },
  ],
  // Gesäß: große Masse hinten; Gluteus medius als obere Hüftseite. z ≤ 0
  // halten — die hängenden Hände liegen bei x≈0.2 / z≈0.1…0.18.
  gesaess_gross: [
    { c: [0.07, 0.90, -0.14], r: [0.09, 0.10, 0.07] },
  ],
  gesaess_seite: [
    { c: [0.165, 0.98, -0.06], r: [0.055, 0.075, 0.075] },
  ],
  // Adduktoren = Innenseite des Oberschenkels (x < ~0.08, vorn und hinten).
  adduktoren: [
    { c: [0.05, 0.70, -0.03], r: [0.045, 0.14, 0.09] },
  ],
  quads: [
    { c: [0.135, 0.68, 0.03], r: [0.10, 0.16, 0.07] },
  ],
  hamstrings: [
    { c: [0.13, 0.66, -0.08], r: [0.10, 0.15, 0.06] },
  ],
  // Wade: Gastrocnemius-Bauch oben (y≈0.32–0.48), Soleus darunter bis zur
  // Achillessehne. Grenze y≈0.33. Schienbein (z > −0.06) bleibt Körperfarbe.
  waden_gastro: [
    { c: [0.19, 0.40, -0.12], r: [0.08, 0.08, 0.06] },
  ],
  waden_soleus: [
    { c: [0.19, 0.25, -0.10], r: [0.08, 0.09, 0.06] },
  ],
};
