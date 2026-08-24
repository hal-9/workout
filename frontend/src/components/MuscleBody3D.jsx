// MuscleBody3D — rotierbarer 3D-Körper mit Muskel-Highlighting (three.js).
// Zonen-Keys und die Text-Auflösung kommen aus shared/muscles.js, damit
// Übungsdaten, Plan-Schema und Anzeige dieselbe Sprache sprechen.
// Props:
//   primary / secondary — string | string[]: Zonen-Keys oder roher muscle-Text
//   view                — 'front' | 'back' (Startposition; danach frei drehbar)
//   height              — CSS-Höhe des Canvas (default 360)
//   background          — CSS-Farbe hinter der Szene (default transparent)
//   interactive         — false schaltet OrbitControls aus (default true)
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MUSCLE_ZONES, resolveZoneKeys } from 'shared/muscles';

const ZONE_BASE = { color: 0xb4a5d8, roughness: 0.48, metalness: 0.05 };
const COL = {
  off:       { color: 0xb4a5d8, emissive: 0x000000, intensity: 0 },
  primary:   { color: 0xf4506a, emissive: 0xe11d48, intensity: 0.45 },
  secondary: { color: 0xf0955f, emissive: 0xc2551f, intensity: 0.16 },
};

function buildBody() {
  const matBody = new THREE.MeshStandardMaterial({ color: 0xe8e2f2, roughness: 0.55, metalness: 0.05 });
  const group = new THREE.Group();
  const zones = {};
  function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.rotation.x = rx; m.rotation.z = rz;
    group.add(m);
    return m;
  }
  const S = (r) => new THREE.SphereGeometry(r, 32, 24);
  const C = (rt, rb, h) => new THREE.CylinderGeometry(rt, rb, h, 32);
  const Cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 24);
  // glatte Rotationsfläche aus einem (Radius, y)-Profil
  function lathe(points, segs = 48) {
    const curve = new THREE.SplineCurve(points.map((p) => new THREE.Vector2(p[0], p[1])));
    const pts = curve.getPoints(64).map((p) => new THREE.Vector2(Math.max(p.x, 0.003), p.y));
    return new THREE.LatheGeometry(pts, segs);
  }

  // Rumpf: ein durchgehendes Profil — Schultern, Brust, Taille, Hüfte — in z abgeflacht
  mesh(lathe([[0.02,0.78],[0.09,0.80],[0.13,0.84],[0.148,0.90],[0.152,0.96],[0.138,1.05],[0.128,1.14],[0.14,1.26],[0.16,1.37],[0.168,1.44],[0.158,1.49],[0.112,1.525],[0.06,1.55],[0.03,1.565]]), matBody, 0, 0, 0, 1, 1, 0.62);
  mesh(C(0.048, 0.056, 0.12), matBody, 0, 1.585, 0, 1, 1, 0.9);
  // Kopf: Schädel + Wange + Kiefer
  mesh(lathe([[0.012,1.615],[0.05,1.63],[0.064,1.655],[0.078,1.70],[0.089,1.75],[0.085,1.80],[0.058,1.84],[0.02,1.862],[0.001,1.868]], 40), matBody, 0, 0, 0, 0.92, 1, 0.98);
  for (const s of [-1, 1]) {
    // Arm: ein konisches Profil Handgelenk→Deltoid, an der Schulter leicht nach außen geneigt
    const armGeo = lathe([[0.026,0],[0.033,0.08],[0.043,0.17],[0.040,0.25],[0.048,0.35],[0.053,0.45],[0.058,0.53],[0.046,0.58],[0.024,0.60]], 32);
    armGeo.translate(0, -0.60, 0);
    mesh(armGeo, matBody, s * 0.225, 1.49, 0, 1, 1, 1, 0, s * 0.1);
    mesh(S(0.042), matBody, s * 0.289, 0.855, 0.025, 0.75, 1.3, 0.95);
    // Bein: Hüfte→Oberschenkel→Knie→Wade→Knöchel in einem Profil
    mesh(lathe([[0.033,0],[0.038,0.05],[0.056,0.17],[0.048,0.29],[0.053,0.39],[0.07,0.54],[0.084,0.67],[0.093,0.77],[0.075,0.82]], 40), matBody, s * 0.088, 0.055, 0);
    mesh(S(0.042), matBody, s * 0.088, 0.05, -0.015, 1, 0.95, 1.1);
    const footGeo = Cap(0.036, 0.10);
    footGeo.rotateX(Math.PI / 2);
    mesh(footGeo, matBody, s * 0.088, 0.035, 0.06, 1.15, 0.75, 1.2);
  }

  function zone(key, builder) {
    const z = { meshes: [], mats: [], state: 'off' };
    zones[key] = z;
    builder((geo, x, y, z2, sx, sy, sz, rx = 0, rz = 0) => {
      const mat = new THREE.MeshStandardMaterial(ZONE_BASE);
      const m = mesh(geo, mat, x, y, z2, sx, sy, sz, rx, rz);
      m.userData.baseScale = m.scale.clone();
      z.meshes.push(m); z.mats.push(mat);
    });
  }
  zone('brust', add => { for (const s of [-1, 1]) {
    add(S(0.082), s * 0.066, 1.425, 0.06, 1.45, 0.78, 0.34, 0.35, s * -0.05);
    add(S(0.035), s * 0.10, 1.468, 0.052, 1.5, 0.5, 0.45, 0.2, s * 0.4);
  } });
  zone('schultern', add => { for (const s of [-1, 1]) {
    add(S(0.045), s * 0.195, 1.47, 0.045, 0.9, 1.1, 0.8, 0, 0);
    add(S(0.05), s * 0.215, 1.475, 0, 0.85, 1.15, 0.9, 0, 0);
    add(S(0.045), s * 0.198, 1.465, -0.045, 0.9, 1.05, 0.8, 0, 0);
  } });
  zone('bizeps', add => { for (const s of [-1, 1]) {
    add(S(0.036), s * 0.226, 1.35, 0.036, 0.8, 1.9, 0.8, 0, s * 0.1);
    add(S(0.035), s * 0.254, 1.34, 0.032, 0.75, 1.8, 0.75, 0, s * 0.1);
  } });
  zone('trizeps', add => { for (const s of [-1, 1]) {
    add(S(0.036), s * 0.228, 1.34, -0.036, 0.8, 1.9, 0.8, 0, s * 0.1);
    add(S(0.034), s * 0.254, 1.33, -0.032, 0.75, 1.75, 0.75, 0, s * 0.1);
    add(S(0.027), s * 0.264, 1.22, -0.028, 0.8, 1.3, 0.8, 0, s * 0.1);
  } });
  zone('unterarme', add => { for (const s of [-1, 1]) {
    add(Cap(0.028, 0.12), s * 0.262, 1.06, 0.025, 1, 1, 0.9, 0.05, s * 0.1);
    add(Cap(0.026, 0.12), s * 0.272, 1.05, -0.02, 1, 1, 0.9, 0, s * 0.1);
  } });
  zone('core', add => {
    const rows = [[1.22, 0.072], [1.14, 0.078], [1.06, 0.076]];
    for (const [ry, rz2] of rows) for (const s of [-1, 1]) add(S(0.03), s * 0.033, ry, rz2, 1.1, 0.95, 0.5, 0.15, 0, '_rectus_' + ry.toFixed(2) + (s < 0 ? '_l' : '_r'));
    add(S(0.05), 0, 0.97, 0.068, 1.2, 0.8, 0.45, 0.2, 0);
    for (const s of [-1, 1]) add(S(0.045), s * 0.105, 1.08, 0.028, 0.7, 1.6, 0.5, 0, s * -0.1);
  });
  zone('ruecken', add => {
    add(S(0.055), 0, 1.42, -0.082, 1.1, 1.4, 0.4, -0.1, 0);
    for (const s of [-1, 1]) {
      add(S(0.05), s * 0.09, 1.505, -0.032, 1.3, 0.6, 0.5, 0, s * -0.35);
      add(S(0.08), s * 0.075, 1.24, -0.072, 1.15, 1.6, 0.42, -0.05, s * 0.25);
      add(S(0.032), s * 0.14, 1.40, -0.058, 1, 0.7, 0.6, 0, s * 0.4);
    }
  });
  zone('unterer_ruecken', add => { for (const s of [-1, 1]) add(Cap(0.028, 0.16), s * 0.032, 1.04, -0.072, 1, 1, 0.6, -0.08, 0); });
  zone('gesaess', add => { for (const s of [-1, 1]) {
    add(S(0.07), s * 0.075, 0.885, -0.062, 1, 1.15, 0.75, 0, s * -0.15);
    add(S(0.045), s * 0.105, 0.955, -0.028, 1, 0.8, 0.7, 0, s * -0.3);
  } });
  zone('quads', add => { for (const s of [-1, 1]) {
    add(Cap(0.04, 0.16), s * 0.09, 0.72, 0.055, 1, 1, 0.8, 0.05, 0);
    add(Cap(0.035, 0.14), s * 0.125, 0.70, 0.028, 0.9, 1, 0.8, 0, s * -0.06);
    add(S(0.035), s * 0.062, 0.62, 0.048, 0.9, 1.3, 0.8, 0, s * 0.1);
  } });
  zone('hamstrings', add => { for (const s of [-1, 1]) {
    add(Cap(0.036, 0.15), s * 0.068, 0.70, -0.048, 1, 1, 0.8, -0.04, 0);
    add(Cap(0.034, 0.14), s * 0.112, 0.69, -0.044, 1, 1, 0.8, -0.04, s * -0.05);
  } });
  zone('waden', add => { for (const s of [-1, 1]) {
    add(S(0.035), s * 0.068, 0.33, -0.034, 0.85, 1.6, 0.8, 0, 0);
    add(S(0.033), s * 0.106, 0.335, -0.03, 0.8, 1.5, 0.75, 0, 0);
    add(S(0.028), s * 0.088, 0.21, -0.028, 0.9, 1.4, 0.7, 0, 0);
  } });

  return { group, zones };
}

export default function MuscleBody3D({
  primary = [], secondary = [],
  view = 'front', height = 360, background = 'transparent', interactive = true,
}) {
  const hostRef = useRef(null);
  // Startausrichtung, ohne die Szene bei jedem view-Wechsel neu zu bauen.
  const viewRef = useRef(view);
  const sceneRef = useRef(null); // { zones, applyState, dispose, setView }

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

    const { group, zones } = buildBody();
    scene.add(group);

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

    function applyState(key2, state) {
      const z = zones[key2]; if (!z) return;
      z.state = state;
      const c = COL[state];
      for (const mat of z.mats) { mat.color.setHex(c.color); mat.emissive.setHex(c.emissive); mat.emissiveIntensity = c.intensity; }
      if (state !== 'primary') for (const m of z.meshes) m.scale.copy(m.userData.baseScale);
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
      for (const z of Object.values(zones)) {
        if (z.state !== 'primary') continue;
        for (const mat of z.mats) mat.emissiveIntensity = 0.25 + 0.55 * wave;
        for (const m of z.meshes) {
          const b = m.userData.baseScale, k = 1 + 0.045 * wave;
          m.scale.set(b.x * k, b.y * k, b.z * k);
        }
      }
      if (controls) controls.update();
      renderer.render(scene, camera);
    })();

    sceneRef.current = { zones, applyState, setView };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (controls) controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [interactive]);

  // Highlights bei Prop-Änderung
  useEffect(() => {
    const s = sceneRef.current; if (!s) return;
    const prim = new Set(resolveZoneKeys(primary));
    const sec = new Set(resolveZoneKeys(secondary).filter((k) => !prim.has(k)));
    for (const key of MUSCLE_ZONES) s.applyState(key, prim.has(key) ? 'primary' : sec.has(key) ? 'secondary' : 'off');
  }, [primary, secondary]);

  // Kamera bei view-Änderung
  useEffect(() => { sceneRef.current?.setView(view); }, [view]);

  return <div ref={hostRef} style={{ width: '100%', height, background, touchAction: 'none' }} />;
}
