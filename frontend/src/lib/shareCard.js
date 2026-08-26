import { formatRecordValue } from './records.js';

// Share-Card im Story-Format: zeichnet die Session-Kennzahlen auf ein Canvas
// im Look der aktiven Palette und teilt das PNG über navigator.share
// (Fallback: Download). Reine Canvas-2D-API, keine Dependencies.
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

const FONT = "-apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif";

export function shareCardColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    gradFrom: cs.getPropertyValue('--grad-from').trim() || '#8b5cf6',
    gradTo: cs.getPropertyValue('--grad-to').trim() || '#ec4899',
  };
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

  // Hintergrund: Paletten-Gradient + zwei weiche Lichtkreise für Tiefe
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, colors.gradFrom);
  grad.addColorStop(1, colors.gradTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.16, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.08, H * 0.82, 420, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `700 44px ${FONT}`;
  const brand = 'L I L I E F';
  ctx.fillText(brand, cx, 170);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(dateLabel, cx, 232);

  // Haken im Ring
  const ringY = 470;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 10;
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundedRect(ctx, boxX, y, boxW, 110, 26);
    ctx.fill();

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
