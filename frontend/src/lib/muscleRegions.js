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
  brust: [
    { c: [0.07, 1.43, 0.11], r: [0.10, 0.11, 0.09] },
  ],
  schultern: [
    { c: [0.215, 1.50, -0.04], r: [0.09, 0.09, 0.12] },
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
  core: [
    { c: [0.045, 1.18, 0.09], r: [0.10, 0.17, 0.075] },
  ],
  ruecken: [
    { c: [0.09, 1.36, -0.12], r: [0.15, 0.19, 0.08] },
  ],
  unterer_ruecken: [
    { c: [0.035, 1.08, -0.10], r: [0.07, 0.10, 0.06] },
  ],
  gesaess: [
    { c: [0.08, 0.92, -0.13], r: [0.10, 0.11, 0.07] },
  ],
  quads: [
    { c: [0.135, 0.68, 0.03], r: [0.10, 0.16, 0.07] },
  ],
  hamstrings: [
    { c: [0.13, 0.66, -0.08], r: [0.10, 0.15, 0.06] },
  ],
  waden: [
    { c: [0.19, 0.33, -0.11], r: [0.08, 0.15, 0.06] },
  ],
};
