// MuscleBody3D — rotierbares 3D-Modell (Meshy-Scan) mit Muskel-Highlighting.
// Das GLB (public/models/muscle-body.glb, meshopt-komprimiert) ist EIN
// verschmolzener Mesh ohne anatomische Teile. Zonen entstehen zur Ladezeit:
// jedes Face wird über die Ellipsoid-Regionen aus lib/muscleRegions.js einem
// Material-Slot zugeordnet (geometry.groups) — Highlight bleibt Material-Tint
// wie beim alten prozeduralen Modell. Zonen-Keys aus shared/muscles.js.
// Props:
//   primary / secondary — string | string[]: Zonen-Keys oder roher muscle-Text
//   view                — 'front' | 'back' (Startposition; danach frei drehbar)
//   height              — CSS-Höhe des Canvas (default 360)
//   background          — CSS-Farbe hinter der Szene (default transparent)
//   interactive         — false schaltet OrbitControls aus (default true)
//   debugZones          — true färbt jede Zone in eigener Farbe (Kalibrierung)
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MUSCLE_ZONES, resolveZoneKeys } from 'shared/muscles';
import { ZONE_REGIONS } from '../lib/muscleRegions.js';

const MODEL_URL = '/models/muscle-body.glb';
const MODEL_HEIGHT = 1.9; // Regionen sind in diesem Maß definiert (Füße y=0)

const BODY_BASE = { color: 0xe8e2f2, roughness: 0.55, metalness: 0.05 };
const ZONE_BASE = { color: 0xb4a5d8, roughness: 0.48, metalness: 0.05 };
// off = Körperfarbe: inaktive Zonen dürfen auf der durchgehenden Haut des
// Scans nicht als Flecken sichtbar sein (anders als die alten Zonen-Blobs).
const COL = {
  off:       { color: 0xe8e2f2, emissive: 0x000000, intensity: 0 },
  primary:   { color: 0xf4506a, emissive: 0xe11d48, intensity: 0.45 },
  secondary: { color: 0xf0955f, emissive: 0xc2551f, intensity: 0.16 },
};
const DEBUG_COLORS = [0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x46f0f0, 0xf032e6, 0xbcf60c, 0x008080, 0x9a6324, 0x800000];

// Regionen zu flacher Testliste auflösen; slot = Index in MUSCLE_ZONES + 1 (0 = Körper)
const REGION_TESTS = MUSCLE_ZONES.flatMap((key, i) => {
  const regions = ZONE_REGIONS[key] ?? [];
  return regions.flatMap(({ c, r, mirror = true }) => {
    const sides = mirror && c[0] !== 0 ? [1, -1] : [1];
    return sides.map((s) => ({ slot: i + 1, cx: s * c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2] }));
  });
});

function classify(x, y, z) {
  let best = 0, bestD = 1;
  for (const t of REGION_TESTS) {
    const dx = (x - t.cx) / t.rx, dy = (y - t.cy) / t.ry, dz = (z - t.cz) / t.rz;
    const d = dx * dx + dy * dy + dz * dz;
    if (d <= bestD) { bestD = d; best = t.slot; }
  }
  return best;
}

// GLB einmal laden, Positionen in den normalisierten Raum backen und Faces
// nach Zonen-Slot in geometry.groups sortieren. Geometrie wird von allen
// Instanzen geteilt — beim Unmount nie disposen.
let modelPromise = null;
function loadGroupedGeometry() {
  if (modelPromise) return modelPromise;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  modelPromise = loader.loadAsync(MODEL_URL).then((gltf) => {
    let src = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    const geo = src.geometry;

    // Quantisierte Positionen → Weltkoordinaten → normalisierter Raum (Float32)
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(src.matrixWorld);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      box.expandByPoint(v);
    }
    const scale = MODEL_HEIGHT / (box.max.y - box.min.y);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = (arr[i * 3] - cx) * scale;
      arr[i * 3 + 1] = (arr[i * 3 + 1] - box.min.y) * scale;
      arr[i * 3 + 2] = (arr[i * 3 + 2] - cz) * scale;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));

    // Faces klassifizieren und Index-Buffer nach Slot gruppieren
    const index = geo.index.array;
    const faceCount = index.length / 3;
    const slotOf = new Uint8Array(faceCount);
    for (let f = 0; f < faceCount; f++) {
      const a = index[f * 3] * 3, b = index[f * 3 + 1] * 3, c = index[f * 3 + 2] * 3;
      slotOf[f] = classify(
        (arr[a] + arr[b] + arr[c]) / 3,
        (arr[a + 1] + arr[b + 1] + arr[c + 1]) / 3,
        (arr[a + 2] + arr[b + 2] + arr[c + 2]) / 3,
      );
    }
    const newIndex = new Uint32Array(index.length);
    geo.clearGroups();
    let offset = 0;
    for (let slot = 0; slot <= MUSCLE_ZONES.length; slot++) {
      const start = offset;
      for (let f = 0; f < faceCount; f++) {
        if (slotOf[f] !== slot) continue;
        newIndex[offset++] = index[f * 3];
        newIndex[offset++] = index[f * 3 + 1];
        newIndex[offset++] = index[f * 3 + 2];
      }
      geo.addGroup(start, offset - start, slot);
    }
    geo.setIndex(new THREE.BufferAttribute(newIndex, 1));
    return geo;
  });
  return modelPromise;
}

export default function MuscleBody3D({
  primary = [], secondary = [],
  view = 'front', height = 360, background = 'transparent', interactive = true,
  debugZones = false,
}) {
  const hostRef = useRef(null);
  // Startausrichtung, ohne die Szene bei jedem view-Wechsel neu zu bauen.
  const viewRef = useRef(view);
  // Gewünschte Highlights — greifen auch, wenn das GLB erst später fertig lädt.
  const wantRef = useRef({ primary, secondary });
  const sceneRef = useRef(null); // { applyWanted, setView }

  // Szene einmal aufbauen
  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcabfe0, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe4f1, 0.5);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    const target = new THREE.Vector3(0, 0.95, 0);
    const dist = 2.6;
    function setView(v) {
      camera.position.set(0, 1.1, v === 'back' ? -dist : dist);
      camera.lookAt(target);
      if (controls) controls.update();
    }
    let controls = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = 1.2;
      controls.maxDistance = 6;
    }
    setView(viewRef.current);

    // Material pro Slot: 0 = Körper, danach eine Zone je MUSCLE_ZONES-Index
    const bodyMat = new THREE.MeshStandardMaterial(BODY_BASE);
    const zoneMats = MUSCLE_ZONES.map(() => new THREE.MeshStandardMaterial(ZONE_BASE));
    const zoneState = Object.fromEntries(MUSCLE_ZONES.map((k) => [k, 'off']));
    let disposed = false;

    loadGroupedGeometry().then((geo) => {
      if (disposed) return;
      scene.add(new THREE.Mesh(geo, [bodyMat, ...zoneMats]));
      applyWanted();
    });

    function applyWanted() {
      if (debugZones) {
        zoneMats.forEach((mat, i) => { mat.color.setHex(DEBUG_COLORS[i % DEBUG_COLORS.length]); mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; });
        return;
      }
      const { primary: p, secondary: s } = wantRef.current;
      const prim = new Set(resolveZoneKeys(p));
      const sec = new Set(resolveZoneKeys(s).filter((k) => !prim.has(k)));
      MUSCLE_ZONES.forEach((key2, i) => {
        const state = prim.has(key2) ? 'primary' : sec.has(key2) ? 'secondary' : 'off';
        zoneState[key2] = state;
        const c = COL[state];
        const mat = zoneMats[i];
        mat.color.setHex(c.color); mat.emissive.setHex(c.emissive); mat.emissiveIntensity = c.intensity;
      });
    }

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    let raf;
    (function loop() {
      raf = requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      const wave = 0.5 + 0.5 * Math.sin(t * 4.2);
      MUSCLE_ZONES.forEach((key2, i) => {
        if (zoneState[key2] !== 'primary') return;
        zoneMats[i].emissiveIntensity = 0.25 + 0.55 * wave;
      });
      if (controls) controls.update();
      renderer.render(scene, camera);
    })();

    sceneRef.current = { applyWanted, setView };
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (controls) controls.dispose();
      renderer.dispose();
      bodyMat.dispose();
      zoneMats.forEach((m) => m.dispose());
      // Geometrie ist modulweit geteilt — nicht disposen.
      host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [interactive, debugZones]);

  // Highlights bei Prop-Änderung
  useEffect(() => {
    wantRef.current = { primary, secondary };
    sceneRef.current?.applyWanted();
  }, [primary, secondary]);

  // Kamera bei view-Änderung
  useEffect(() => { sceneRef.current?.setView(view); }, [view]);

  return <div ref={hostRef} style={{ width: '100%', height, background, touchAction: 'none' }} />;
}
