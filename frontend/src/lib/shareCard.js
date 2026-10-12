import { formatRecordValue } from './records.js';

// Share-Card im Story-Format: zeichnet die Session-Kennzahlen auf ein Canvas
// auf dem Mesh der Hauptbuttons und teilt das PNG über navigator.share
// (Fallback: Download). Reine Canvas-2D-API, keine Dependencies.
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

const FONT = "-apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif";

// Dieselben Mesh-Farben wie Hauptbutton und Bühne (in beiden Modi gleich).
const MESH_FALLBACK = { m0: '#4a2fa0', m1: '#2e2380', m2: '#7b3fc0', m3: '#b0306e', m4: '#e07a5f', ink: '#fff7fb' };

export function shareCardColors() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name, key) => cs.getPropertyValue(name).trim() || MESH_FALLBACK[key];
  return {
    m0: read('--m0', 'm0'),
    m1: read('--m1', 'm1'),
    m2: read('--m2', 'm2'),
    m3: read('--m3', 'm3'),
    m4: read('--m4', 'm4'),
    ink: read('--m-ink', 'ink'),
  };
}

// Weiche Farbflecken statt CSS-blur (ctx.filter fehlt in älterem Safari) + Korn.
function drawMesh(ctx, W, H, c) {
  ctx.fillStyle = c.m0;
  ctx.fillRect(0, 0, W, H);
  const blobs = [
    [c.m1, 0.1, 0.1, 0.62],
    [c.m2, 0.3, 0.52, 0.55],
    [c.m3, 0.82, 0.86, 0.6],
    [c.m4, 0.95, 0.12, 0.42],
  ];
  for (const [color, x, y, r] of blobs) {
    const g = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, H * r);
    g.addColorStop(0, color);
    g.addColorStop(0.45, `${color}b0`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  const gctx = grain.getContext('2d');
  const img = gctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Schriftgröße schrumpfen, bis der Text in maxWidth passt.
function fitText(ctx, text, maxWidth, startPx, weight = 800) {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 4;
  } while (px > 32);
  return px;
}

export function drawShareCard(canvas, { colors, dayName, dateLabel, stats, records = [] }) {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  const W = SHARE_WIDTH;
  const H = SHARE_HEIGHT;
  const cx = W / 2;

  drawMesh(ctx, W, H, colors);
  ctx.shadowColor = 'rgba(30, 6, 40, 0.35)';
  ctx.shadowBlur = 28;

  ctx.textAlign = 'center';
  ctx.fillStyle = colors.ink;
  ctx.font = `800 88px ${FONT}`;
  ctx.fillText('LiLief', cx, 200);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(dateLabel, cx, 262);

  // Haken im Ring
  const ringY = 470;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(cx, ringY, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(cx - 48, ringY + 4);
  ctx.lineTo(cx - 10, ringY + 42);
  ctx.lineTo(cx + 56, ringY - 34);
  ctx.stroke();

  // Tag-Name + Untertitel
  ctx.fillStyle = '#ffffff';
  const namePx = fitText(ctx, dayName, W - 160, 96);
  ctx.font = `800 ${namePx}px ${FONT}`;
  ctx.fillText(dayName, cx, 720);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText('Workout geschafft', cx, 796);

  // Kennzahlen-Reihe
  const cells = [
    { value: String(stats?.sets ?? 0), label: 'SÄTZE' },
    (stats?.tonnage_kg ?? 0) > 0 ? { value: `${stats.tonnage_kg}`, label: 'KG BEWEGT' } : null,
    (stats?.duration_min ?? 0) > 0 ? { value: `${stats.duration_min}`, label: 'MINUTEN' } : null,
  ].filter(Boolean);
  const cellW = (W - 160) / cells.length;
  const statsY = 1020;
  cells.forEach((cell, i) => {
    const x = 80 + cellW * i + cellW / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 96px ${FONT}`;
    ctx.fillText(cell.value, x, statsY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(cell.label, x, statsY + 56);
  });

  // Bis zu 3 Rekord-Zeilen
  const shown = records.slice(0, 3);
  let y = 1250;
  for (const record of shown) {
    const boxX = 90;
    const boxW = W - 180;
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundedRect(ctx, boxX, y, boxW, 110, 26);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FONT}`;
    const valueText = formatRecordValue(record.kind, record.value);
    const valueW = ctx.measureText(valueText).width;
    ctx.fillText(valueText, boxX + boxW - 36, y + 70);

    ctx.textAlign = 'left';
    const namePx2 = fitText(ctx, `★ ${record.name}`, boxW - valueW - 110, 40, 600);
    ctx.font = `600 ${namePx2}px ${FONT}`;
    ctx.fillText(`★ ${record.name}`, boxX + 36, y + 70);
    ctx.textAlign = 'center';
    y += 134;
  }
  if (shown.length > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(
      records.length > 3 ? `Neue Rekorde (+${records.length - 3} weitere)` : 'Neue Rekorde',
      cx,
      1250 - 36
    );
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('LiLief · selbst gehostet, selbst geschafft', cx, H - 90);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

// Teilt die Card als PNG; ohne Web-Share-Support fällt sie auf Download zurück.
export async function shareCard(card) {
  const canvas = document.createElement('canvas');
  drawShareCard(canvas, card);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], 'lilief-workout.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Share fehlgeschlagen → Download-Fallback unten
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lilief-workout.png';
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
