import { HEAD, NECK, PELVIS, ELBOW_F, HAND_F, ELBOW_B, HAND_B, KNEE_F, FOOT_F, KNEE_B, FOOT_B } from '../engine/ragdoll.js';
import { star } from '../engine/fx.js';
import { ARROWS, SUITS } from './catalog.js';

const TAU = Math.PI * 2;
const OUTLINE = '#1b1d24';
export const ARROW_LEN = 0.8;

export const PALETTES = {
  meadow: { sky: ['#5cb8ff', '#c9ecff'], far: '#9fd3a8', near: '#6dbb63', ground: '#5aa94f', dirt: '#8a5a2e', stone: '#a3abb5', sun: '#fff6c8' },
  desert: { sky: ['#ff9f5a', '#ffe2a8'], far: '#f0c27a', near: '#dca15a', ground: '#e8b866', dirt: '#b77a3a', stone: '#c99556', sun: '#fff1c2' },
  snow: { sky: ['#7fbff0', '#eaf6ff'], far: '#dde8f4', near: '#bfd0e3', ground: '#f3f8fd', dirt: '#9fb2c6', stone: '#8fa3b8', sun: '#ffffff' },
  dusk: { sky: ['#5d4194', '#ff9e6e'], far: '#9b5d8e', near: '#6a3f6e', ground: '#4f7a4a', dirt: '#5a3a2a', stone: '#8c8aa0', sun: '#ffd27a' },
  night: { sky: ['#0b1a3a', '#2c4382'], far: '#22335e', near: '#172648', ground: '#2e5040', dirt: '#2a2a33', stone: '#5d6680', sun: '#f4f1d0', stars: true },
  gold: { sky: ['#ffb83a', '#fff1c2'], far: '#f5cf6a', near: '#e4ae3c', ground: '#d9a83a', dirt: '#9a6a1c', stone: '#d1a64a', sun: '#ffffff', rays: true },
};

/** Cheap smooth noise for hill outlines. */
function hill(x, seed) {
  return Math.sin(x * 0.21 + seed) * 0.6 + Math.sin(x * 0.53 + seed * 2.3) * 0.3 + Math.sin(x * 1.31 + seed * 0.7) * 0.12;
}

/** Sky, sun or moon and two layers of parallax hills, in screen space. */
export function drawSky(ctx, view, theme, time) {
  const p = PALETTES[theme] ?? PALETTES.meadow;
  const { w, h } = view;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.sky[0]);
  g.addColorStop(1, p.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cam = view.cam;
  if (p.stars) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97.3 - cam.x * 2) % w + w) % w;
      const sy = (i * 53.7) % (h * 0.6);
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i);
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // Sun or moon, hardly moving with the camera.
  const sunX = w * 0.78 - cam.x * 2;
  const sunY = h * 0.2;
  const r = Math.min(w, h) * 0.07;
  if (p.rays) {
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(time * 0.1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.max(w, h), -40);
      ctx.lineTo(Math.max(w, h), 40);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = p.sun;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(sunX, sunY, r * 1.6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(sunX, sunY, r, 0, TAU);
  ctx.fill();
  // Drifting clouds.
  ctx.fillStyle = theme === 'night' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 5; i++) {
    const cw = w + 300;
    const cx = (((i * 331 + time * (8 + i * 3) - cam.x * 6) % cw) + cw) % cw - 150;
    const cy = h * (0.12 + ((i * 0.17) % 0.3));
    const s = 26 + (i % 3) * 10;
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, TAU);
    ctx.arc(cx + s * 0.9, cy + s * 0.25, s * 0.75, 0, TAU);
    ctx.arc(cx - s * 0.9, cy + s * 0.3, s * 0.65, 0, TAU);
    ctx.fill();
  }
  // Two layers of hills, the far one moving least.
  const ground = view.toScreen(0, 0).y;
  for (const [par, color, height, seed] of [
    [0.25, p.far, 0.32, 1.7],
    [0.5, p.near, 0.2, 4.1],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const wx = (x - w / 2) / view.scale + cam.x * par;
      const y = ground - (height * h * 0.5) * (1.2 + hill(wx * 0.6, seed)) - (1 - par) * 20;
      ctx.lineTo(x, Math.min(y, ground + 4));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
}

/** The ground strip, in world space. */
export function drawGround(ctx, theme, b) {
  const p = PALETTES[theme] ?? PALETTES.meadow;
  ctx.fillStyle = p.dirt;
  ctx.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, -b.y0 + 1);
  ctx.fillStyle = p.ground;
  ctx.fillRect(b.x0 - 1, -0.35, b.x1 - b.x0 + 2, 0.35);
  // Tufts along the edge.
  ctx.beginPath();
  for (let x = Math.floor(b.x0); x < b.x1 + 1; x += 0.5) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 0.12, 0.12 + 0.06 * Math.sin(x * 7));
    ctx.lineTo(x + 0.25, 0);
  }
  ctx.fill();
}

/** Towers, planks and crates. */
export function drawSolid(ctx, s, theme) {
  const p = PALETTES[theme] ?? PALETTES.meadow;
  if (s.kind === 'ground') return;
  if (s.kind === 'tower') {
    ctx.fillStyle = p.stone;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // Brick courses.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    let row = 0;
    for (let y = s.y + s.h - 0.32; y > s.y; y -= 0.32, row++) {
      ctx.moveTo(s.x, y);
      ctx.lineTo(s.x + s.w, y);
      for (let x = s.x + (row % 2 ? 0.3 : 0.6); x < s.x + s.w; x += 0.6) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(s.y + s.h, y + 0.32));
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(s.x, s.y, 0.12, s.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.x + s.w - 0.14, s.y, 0.14, s.h);
    // Cap stone.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.x - 0.1, s.y + s.h - 0.22, s.w + 0.2, 0.22);
    ctx.fillStyle = p.stone;
    ctx.fillRect(s.x - 0.1, s.y + s.h - 0.18, s.w + 0.2, 0.18);
    return;
  }
  if (s.kind === 'plank') {
    // Ropes up out of shot: it's hanging there.
    ctx.strokeStyle = '#6b5236';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (const x of [s.x + 0.12, s.x + s.w - 0.12]) {
      ctx.moveTo(x, s.y + s.h);
      ctx.lineTo(x, s.y + 40);
    }
    ctx.stroke();
    ctx.fillStyle = '#9a6634';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#b87d45';
    ctx.fillRect(s.x, s.y + s.h * 0.55, s.w, s.h * 0.45);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.025;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#3b3f4a';
    for (const x of [s.x + 0.12, s.x + s.w - 0.12]) {
      ctx.beginPath();
      ctx.arc(x, s.y + s.h * 0.5, 0.035, 0, TAU);
      ctx.fill();
    }
    return;
  }
  if (s.kind === 'crate') {
    ctx.strokeStyle = '#6b5236';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(s.x + s.w / 2, s.y + s.h);
    ctx.lineTo(s.x + s.w / 2, s.y + 40);
    ctx.stroke();
    ctx.fillStyle = '#b5793e';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = '#7a4a1e';
    ctx.lineWidth = 0.08;
    ctx.strokeRect(s.x + 0.04, s.y + 0.04, s.w - 0.08, s.h - 0.08);
    ctx.beginPath();
    ctx.moveTo(s.x + 0.08, s.y + 0.08);
    ctx.lineTo(s.x + s.w - 0.08, s.y + s.h - 0.08);
    ctx.moveTo(s.x + s.w - 0.08, s.y + 0.08);
    ctx.lineTo(s.x + 0.08, s.y + s.h - 0.08);
    ctx.stroke();
  }
}

const mix = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

function seg(ctx, a, b) {
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
}

/** The archer: stick body with a round head, big googly eyes, hat and bow. */
export function drawArcher(ctx, a, time) {
  const pts = a.ragdoll.points;
  const k = a.size;
  const suit = SUITS[a.look.suit] ?? SUITS.red;
  const tint = a.flash > 0 ? 0.65 : a.poison ? 0.0 : 0;
  let body = tint ? mix(suit.body, '#ffffff', tint) : suit.body;
  let trim = tint ? mix(suit.trim, '#ffffff', tint) : suit.trim;
  if (a.poison && !tint) {
    body = mix(suit.body, '#7ad13a', 0.35);
    trim = mix(suit.trim, '#3f7a1a', 0.35);
  }
  const limb = 0.13 * k;
  const torso = 0.22 * k;
  const edge = 0.05 * k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Outline pass: the whole silhouette in one dark stroke.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = limb + edge;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[ELBOW_B]);
  seg(ctx, pts[ELBOW_B], pts[HAND_B]);
  seg(ctx, pts[PELVIS], pts[KNEE_B]);
  seg(ctx, pts[KNEE_B], pts[FOOT_B]);
  seg(ctx, pts[PELVIS], pts[KNEE_F]);
  seg(ctx, pts[KNEE_F], pts[FOOT_F]);
  ctx.stroke();
  ctx.lineWidth = torso + edge;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[PELVIS]);
  ctx.stroke();
  // Back limbs in the darker trim colour.
  ctx.strokeStyle = trim;
  ctx.lineWidth = limb;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[ELBOW_B]);
  seg(ctx, pts[ELBOW_B], pts[HAND_B]);
  seg(ctx, pts[PELVIS], pts[KNEE_B]);
  seg(ctx, pts[KNEE_B], pts[FOOT_B]);
  ctx.stroke();
  ctx.strokeStyle = body;
  ctx.lineWidth = torso;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[PELVIS]);
  ctx.stroke();
  ctx.lineWidth = limb;
  ctx.beginPath();
  seg(ctx, pts[PELVIS], pts[KNEE_F]);
  seg(ctx, pts[KNEE_F], pts[FOOT_F]);
  ctx.stroke();
  // Belt.
  ctx.strokeStyle = trim;
  ctx.lineWidth = 0.05 * k;
  ctx.beginPath();
  const bx = pts[NECK].x - pts[PELVIS].x;
  const by = pts[NECK].y - pts[PELVIS].y;
  const bl = Math.hypot(bx, by) || 1;
  const cx = pts[PELVIS].x + (bx / bl) * 0.1 * k;
  const cy = pts[PELVIS].y + (by / bl) * 0.1 * k;
  ctx.moveTo(cx - (by / bl) * 0.11 * k, cy + (bx / bl) * 0.11 * k);
  ctx.lineTo(cx + (by / bl) * 0.11 * k, cy - (bx / bl) * 0.11 * k);
  ctx.stroke();
  drawHead(ctx, a, body, trim, time);
  drawBow(ctx, a);
  // Bow arm on top of the bow grip.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = limb + edge;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[ELBOW_F]);
  seg(ctx, pts[ELBOW_F], pts[HAND_F]);
  ctx.stroke();
  ctx.strokeStyle = body;
  ctx.lineWidth = limb;
  ctx.beginPath();
  seg(ctx, pts[NECK], pts[ELBOW_F]);
  seg(ctx, pts[ELBOW_F], pts[HAND_F]);
  ctx.stroke();
  if (a.stun > 0) drawDizzy(ctx, pts[HEAD], k, time);
}

function drawHead(ctx, a, body, trim, time) {
  const r = a.ragdoll;
  const h = r.points[HEAD];
  const n = r.points[NECK];
  const k = a.size;
  const R = 0.17 * k;
  const up = Math.atan2(h.y - n.y, h.x - n.x) - Math.PI / 2;
  const s = a.side;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(up);
  if (a.look.hat === 'hood') {
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(-s * 0.02 * k, 0.01 * k, R * 1.22, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(0, 0, R + 0.025 * k, 0, TAU);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  // A soft highlight so the head reads round.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(-s * 0.05 * k, 0.06 * k, R * 0.45, 0, TAU);
  ctx.fill();
  drawHat(ctx, a, trim, R, s, k, time);
  // Big googly eyes, the second one hanging off the edge of the face.
  const eyes = [
    [s * 0.06 * k, 0.035 * k, 0.085 * k],
    [s * 0.16 * k, 0.025 * k, 0.075 * k],
  ];
  eyes.forEach(([ex, ey, er], i) => {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(ex, ey, er + 0.016 * k, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, TAU);
    ctx.fill();
    const e = r.eyes[i];
    const travel = er * 0.48;
    // The pupil wobble is in world space; undo the head's tilt.
    const c = Math.cos(-up);
    const sn = Math.sin(-up);
    const pxw = e.x * travel;
    const pyw = e.y * travel;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(ex + pxw * c - pyw * sn, ey + pxw * sn + pyw * c, er * 0.48, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawHat(ctx, a, trim, R, s, k, time) {
  const hat = a.look.hat;
  if (hat === 'band') {
    ctx.strokeStyle = '#e8343a';
    ctx.lineWidth = 0.06 * k;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.98, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // Tails flapping behind.
    ctx.beginPath();
    const tx = -s * R * 0.9;
    const ty = R * 0.45;
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx - s * 0.12 * k, ty + Math.sin(time * 12) * 0.05 * k, tx - s * 0.24 * k, ty - 0.04 * k + Math.sin(time * 12 + 1) * 0.06 * k);
    ctx.stroke();
  } else if (hat === 'helmet') {
    ctx.fillStyle = '#8a93a3';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.025 * k;
    ctx.beginPath();
    ctx.arc(0, 0.02 * k, R * 1.08, Math.PI * 0.05, Math.PI * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c3cad6';
    ctx.fillRect(-R * 0.15, R * 0.5, R * 0.3, R * 0.55);
  } else if (hat === 'crown') {
    ctx.fillStyle = '#ffd23a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.025 * k;
    const w = R * 1.3;
    const y0 = R * 0.7;
    ctx.beginPath();
    ctx.moveTo(-w / 2, y0);
    ctx.lineTo(-w / 2, y0 + R * 0.7);
    ctx.lineTo(-w / 4, y0 + R * 0.35);
    ctx.lineTo(0, y0 + R * 0.85);
    ctx.lineTo(w / 4, y0 + R * 0.35);
    ctx.lineTo(w / 2, y0 + R * 0.7);
    ctx.lineTo(w / 2, y0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8343a';
    ctx.beginPath();
    ctx.arc(0, y0 + R * 0.2, R * 0.1, 0, TAU);
    ctx.fill();
  } else if (hat === 'wizard') {
    ctx.fillStyle = trim;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.025 * k;
    ctx.beginPath();
    ctx.moveTo(-R * 1.25, R * 0.55);
    ctx.lineTo(-s * R * 0.4, R * 2.6);
    ctx.lineTo(R * 1.25, R * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    ctx.save();
    ctx.translate(-s * R * 0.15, R * 1.4);
    star(ctx, R * 0.25);
    ctx.restore();
  }
}

function drawDizzy(ctx, h, k, time) {
  ctx.fillStyle = '#ffd23a';
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i * TAU) / 3;
    ctx.save();
    ctx.translate(h.x + Math.cos(a) * 0.28 * k, h.y + 0.3 * k + Math.sin(a) * 0.08 * k);
    star(ctx, 0.07 * k);
    ctx.restore();
  }
}

/** The bow in the front hand, its string, and the arrow on it while drawing. */
function drawBow(ctx, a) {
  const pts = a.ragdoll.points;
  const hand = pts[HAND_F];
  let dx;
  let dy;
  if (a.alive) {
    dx = Math.cos(a.angle) * a.side;
    dy = Math.sin(a.angle);
  } else {
    const e = pts[ELBOW_F];
    const l = Math.hypot(hand.x - e.x, hand.y - e.y) || 1;
    dx = (hand.x - e.x) / l;
    dy = (hand.y - e.y) / l;
  }
  const k = a.size;
  const px = -dy;
  const py = dx;
  const half = 0.5 * k;
  const t1 = { x: hand.x + px * half - dx * 0.16 * k, y: hand.y + py * half - dy * 0.16 * k };
  const t2 = { x: hand.x - px * half - dx * 0.16 * k, y: hand.y - py * half - dy * 0.16 * k };
  const drawing = a.alive && a.draw > 0.04;
  const nock = drawing ? pts[HAND_B] : { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.018 * k;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(nock.x, nock.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.stroke();
  if (drawing) drawArrowShape(ctx, nock.x + dx * ARROW_LEN, nock.y + dy * ARROW_LEN, Math.atan2(dy, dx), a.loaded ?? 'basic');
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.09 * k;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.quadraticCurveTo(hand.x + dx * 0.34 * k, hand.y + dy * 0.34 * k, t2.x, t2.y);
  ctx.stroke();
  ctx.strokeStyle = a.look.bow ?? '#a0662e';
  ctx.lineWidth = 0.05 * k;
  ctx.stroke();
}

/** An arrow with its tip at x, y pointing along `ang`. */
export function drawArrowShape(ctx, x, y, ang, type = 'basic', alpha = 1) {
  const t = ARROWS[type] ?? ARROWS.basic;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(-ARROW_LEN, 0);
  ctx.lineTo(-0.1, 0);
  ctx.stroke();
  ctx.strokeStyle = t.color;
  ctx.lineWidth = 0.032;
  ctx.stroke();
  // Head.
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0.02, 0);
  ctx.lineTo(-0.16, 0.07);
  ctx.lineTo(-0.16, -0.07);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.head;
  ctx.beginPath();
  ctx.moveTo(-0.01, 0);
  ctx.lineTo(-0.14, 0.045);
  ctx.lineTo(-0.14, -0.045);
  ctx.closePath();
  ctx.fill();
  if (type === 'bomb') {
    ctx.fillStyle = '#2b2d35';
    ctx.beginPath();
    ctx.arc(-0.22, 0, 0.075, 0, TAU);
    ctx.fill();
  }
  // Fletching.
  ctx.fillStyle = type === 'basic' ? '#f4f1e8' : t.color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.015;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(-ARROW_LEN + 0.2, 0);
    ctx.lineTo(-ARROW_LEN + 0.02, s * 0.07);
    ctx.lineTo(-ARROW_LEN - 0.04, s * 0.06);
    ctx.lineTo(-ARROW_LEN + 0.05, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
