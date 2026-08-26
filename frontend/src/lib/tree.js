// Trainingsbaum — deterministische Zeichenanweisungen aus den Wochen-Aggregaten
// von GET /stats/tree. Kein Math.random: Jitter kommt aus einem FNV-Hash über
// week_start, damit derselbe Verlauf immer denselben Baum ergibt.
// Ein Ast pro Trainingswoche (Länge ~ Workouts, Stärke ~ Tonnage),
// Blüten = PRs, Früchte = Max-Tests. Der Baum wächst nie zurück.

export const TREE_WIDTH = 320;
export const TREE_HEIGHT = 340;
const GROUND_Y = 316;

const MAX_BLOSSOMS = 6;
const MAX_FRUITS = 3;

// FNV-1a → [0, 1)
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function quadPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * weeks: [{ week_start, workouts, tonnage_kg, prs, max_tests }] aufsteigend.
 * Rückgabe: { seedling, trunk, branches[], crown, totals } — alle Koordinaten
 * im viewBox-Raum TREE_WIDTH × TREE_HEIGHT, Boden bei GROUND_Y.
 */
export function buildTree(weeks = []) {
  const active = weeks.filter((w) => w.workouts > 0 || w.max_tests > 0);
  const totals = {
    weeks: active.length,
    workouts: active.reduce((s, w) => s + w.workouts, 0),
    prs: active.reduce((s, w) => s + w.prs, 0),
    maxTests: active.reduce((s, w) => s + w.max_tests, 0),
  };

  if (!active.length) {
    return { seedling: true, trunk: null, branches: [], crown: null, totals };
  }

  const n = active.length;
  const seed = active[0].week_start;
  const trunkH = Math.min(60 + n * 16, 250);
  const sway = (hash01(seed) - 0.5) * 34;
  const base = { x: TREE_WIDTH / 2, y: GROUND_Y };
  const top = { x: base.x + sway, y: GROUND_Y - trunkH };
  const ctrl = { x: base.x + sway * 0.4, y: GROUND_Y - trunkH * 0.55 };

  // Stamm als konturiertes Polygon (unten breit, oben schmal)
  const baseWidth = 7 + Math.min(11, n * 0.6);
  const left = [];
  const right = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p = quadPoint(base, ctrl, top, t);
    const w = (baseWidth * (1 - 0.72 * t)) / 2;
    left.push(`${round1(p.x - w)},${round1(p.y)}`);
    right.unshift(`${round1(p.x + w)},${round1(p.y)}`);
  }
  const trunk = `${left.join(' ')} ${right.join(' ')}`;

  const branches = active.map((week, i) => {
    const jitter = hash01(week.week_start);
    const side = i % 2 === 0 ? -1 : 1;
    const t = 0.3 + (0.62 * (i + 1)) / (n + 1);
    const start = quadPoint(base, ctrl, top, t);

    const elevation = (24 + jitter * 28) * (Math.PI / 180);
    const rawLen = 30 + Math.min(4, week.workouts) * 13;
    const len = rawLen * (1 - 0.3 * t);
    const dir = { x: side * Math.cos(elevation), y: -Math.sin(elevation) };
    const end = { x: start.x + dir.x * len, y: start.y + dir.y * len };
    const mid = {
      x: (start.x + end.x) / 2 + side * 2,
      y: (start.y + end.y) / 2 + 4,
    };

    const width = 2 + Math.min(4.5, week.tonnage_kg / 800);
    const leafR = 10 + Math.min(4, week.workouts) * 2.6;

    // Blüten/Früchte kreisförmig um das Laub, Winkel aus dem Hash gedreht
    const marks = (count, cap, radiusFactor, saltPrefix) =>
      Array.from({ length: Math.min(count, cap) }, (_, k) => {
        const angle = 2 * Math.PI * (k / cap + hash01(`${saltPrefix}:${week.week_start}`));
        const r = leafR * radiusFactor;
        return {
          x: round1(end.x + Math.cos(angle) * r),
          y: round1(end.y + Math.sin(angle) * r),
        };
      });

    return {
      week_start: week.week_start,
      path: `M ${round1(start.x)} ${round1(start.y)} Q ${round1(mid.x)} ${round1(mid.y)} ${round1(end.x)} ${round1(end.y)}`,
      width: round1(width),
      leaf: { x: round1(end.x), y: round1(end.y), r: round1(leafR) },
      leafTone: jitter < 0.5 ? 'a' : 'b',
      blossoms: marks(week.prs, MAX_BLOSSOMS, 0.62, 'pr'),
      extraBlossoms: Math.max(0, week.prs - MAX_BLOSSOMS),
      fruits: marks(week.max_tests, MAX_FRUITS, 0.3, 'max'),
    };
  });

  const crown = { x: round1(top.x), y: round1(top.y), r: round1(12 + Math.min(14, n * 1.1)) };

  return { seedling: false, trunk, branches, crown, totals };
}
