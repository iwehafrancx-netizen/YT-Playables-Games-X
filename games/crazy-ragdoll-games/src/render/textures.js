import * as THREE from 'three';

// Every surface texture is painted at load time; nothing is downloaded.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Tileable value-noise field, `size` x `size`, values 0..1. */
function noiseField(size, cells, seed, octaves = 4) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const rand = rng(seed + o * 101);
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    const step = n / size;
    for (let y = 0; y < size; y++) {
      const gy = y * step;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % n) * n;
      const r1 = ((y0 + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const gx = x * step;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % n;
        const c1 = (x0 + 1) % n;
        const a = grid[r0 + c0] + (grid[r0 + c1] - grid[r0 + c0]) * sx;
        const b = grid[r1 + c0] + (grid[r1 + c1] - grid[r1 + c0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** Fills a canvas with `base` modulated by a noise field. */
function paintNoise(ctx, size, base, cells, seed, strength, octaves = 4) {
  const f = noiseField(size, cells, seed, octaves);
  const img = ctx.createImageData(size, size);
  const [r, g, b] = hex(base);
  for (let i = 0; i < f.length; i++) {
    const k = 1 + (f[i] - 0.5) * strength;
    img.data[i * 4] = Math.min(255, r * k);
    img.data[i * 4 + 1] = Math.min(255, g * k);
    img.data[i * 4 + 2] = Math.min(255, b * k);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function speckle(ctx, size, count, seed, color, maxR = 1.5) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.35;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.3 + rand() * maxR, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function toTexture(canvas, { repeat = 1, color = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function concrete(seed = 7, tone = 0xa39f97) {
  const S = 512;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, tone, 4, seed, 0.2, 5);
  speckle(ctx, S, 2600, seed + 1, '#55524c', 1.2);
  speckle(ctx, S, 900, seed + 2, '#d8d6d0', 1);
  // Water stains
  const rand = rng(seed + 3);
  for (let i = 0; i < 7; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 30 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60,56,50,0.16)');
    g.addColorStop(1, 'rgba(60,56,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Saw-cut expansion joints on the tile edges
  ctx.strokeStyle = 'rgba(40,38,34,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, S - 8, S - 8);
  return toTexture(c);
}

export function asphalt(seed = 21) {
  const S = 512;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, 0x3b3c3f, 16, seed, 0.5, 4);
  speckle(ctx, S, 5000, seed + 1, '#8a8a88', 1);
  speckle(ctx, S, 3000, seed + 2, '#1b1b1c', 1.2);
  return toTexture(c);
}

export function woodCrate(seed = 3) {
  const S = 512;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  const planks = 5;
  const ph = S / planks;
  for (let i = 0; i < planks; i++) {
    const tone = [0xb98552, 0xc4915c, 0xae7b49, 0xbf8b55][Math.floor(rand() * 4)];
    const [r, g, b] = hex(tone);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, i * ph, S, ph);
    // grain
    for (let k = 0; k < 26; k++) {
      const y = i * ph + rand() * ph;
      ctx.strokeStyle = `rgba(90,52,24,${0.08 + rand() * 0.14})`;
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + k) * 2.5 * rand());
      ctx.stroke();
    }
    if (rand() < 0.6) {
      const kx = rand() * S;
      const ky = i * ph + ph * (0.3 + rand() * 0.4);
      ctx.fillStyle = 'rgba(80,45,20,0.45)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 7 + rand() * 6, 4, 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(40,22,10,0.7)';
    ctx.fillRect(0, i * ph, S, 3);
  }
  // Frame boards and the diagonal brace
  const f = 54;
  ctx.fillStyle = '#9c6a3b';
  ctx.fillRect(0, 0, S, f);
  ctx.fillRect(0, S - f, S, f);
  ctx.fillRect(0, 0, f, S);
  ctx.fillRect(S - f, 0, f, S);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillRect(-S * 0.62, -f / 2, S * 1.24, f);
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,22,10,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(f, f, S - 2 * f, S - 2 * f);
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
  // Nails
  ctx.fillStyle = '#3d3a36';
  for (const [x, y] of [[f / 2, f / 2], [S - f / 2, f / 2], [f / 2, S - f / 2], [S - f / 2, S - f / 2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 7);
    ctx.fill();
  }
  return toTexture(c);
}

export function cardboard(seed = 5) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, 0xb88d5c, 8, seed, 0.18, 3);
  ctx.fillStyle = 'rgba(214,190,140,0.85)';
  ctx.fillRect(S * 0.42, 0, S * 0.16, S);
  ctx.strokeStyle = 'rgba(70,45,20,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  // "This side up" arrows
  ctx.fillStyle = 'rgba(40,30,25,0.65)';
  ctx.save();
  ctx.translate(S * 0.2, S * 0.25);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 22, -14);
    ctx.lineTo(i * 22 + 9, 0);
    ctx.lineTo(i * 22 + 4, 0);
    ctx.lineTo(i * 22 + 4, 14);
    ctx.lineTo(i * 22 - 4, 14);
    ctx.lineTo(i * 22 - 4, 0);
    ctx.lineTo(i * 22 - 9, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('FRAGILE', S * 0.6, S * 0.82);
  return toTexture(c);
}

export function paintedMetal(base = 0x2f6fb5, seed = 11) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, base, 6, seed, 0.16, 3);
  const rand = rng(seed + 1);
  ctx.strokeStyle = 'rgba(220,220,220,0.25)';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 0.5 + rand();
    ctx.beginPath();
    const x = rand() * S;
    const y = rand() * S;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 12);
    ctx.stroke();
  }
  speckle(ctx, S, 160, seed + 2, '#5a3b22', 2.5);
  return toTexture(c);
}

export function hazard(seed = 13) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1d1d1f';
  const w = S / 4;
  for (let i = -4; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w * 2, 0);
    ctx.lineTo(i * w * 2 + w, 0);
    ctx.lineTo(i * w * 2 + w + S, S);
    ctx.lineTo(i * w * 2 + S, S);
    ctx.closePath();
    ctx.fill();
  }
  speckle(ctx, S, 500, seed, '#8a7a5a', 1.8);
  return toTexture(c);
}

export function bullseye() {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rings = ['#e23b2e', '#f6f1e7', '#e23b2e', '#f6f1e7', '#e23b2e'];
  for (let i = 0; i < rings.length; i++) {
    ctx.fillStyle = rings[i];
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, (S / 2) * (1 - i / rings.length), 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#f6c90e';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.07, 0, 7);
  ctx.fill();
  return toTexture(c);
}

export function blockWall(seed = 17) {
  const S = 512;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, 0xbab6ad, 8, seed, 0.22, 4);
  speckle(ctx, S, 1800, seed + 1, '#6f6a62', 1.2);
  ctx.strokeStyle = 'rgba(70,66,60,0.55)';
  ctx.lineWidth = 4;
  const rows = 8;
  const bh = S / rows;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * bh);
    ctx.lineTo(S, r * bh);
    ctx.stroke();
    const off = r % 2 ? S / 4 : 0;
    for (let x = off; x <= S; x += S / 2) {
      ctx.beginPath();
      ctx.moveTo(x, r * bh);
      ctx.lineTo(x, (r + 1) * bh);
      ctx.stroke();
    }
  }
  return toTexture(c);
}

export function water() {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, 0x2e6f86, 8, 31, 0.35, 4);
  return toTexture(c);
}

export function grass(seed = 41) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, 0x5d7f3a, 8, seed, 0.4, 4);
  speckle(ctx, S, 1500, seed + 1, '#9bb85f', 1);
  speckle(ctx, S, 1000, seed + 2, '#3a4f22', 1.2);
  return toTexture(c);
}

export function foam(seed = 51, base = 0x3d8be0, fleck = '#1d4f8a') {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  paintNoise(ctx, S, base, 16, seed, 0.25, 3);
  speckle(ctx, S, 600, seed + 1, fleck, 1.2);
  return toTexture(c);
}

export function softDot() {
  const S = 64;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export function gearIcon(color = '#f5c518') {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? 46 : 60;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, 7);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Painted landing target: concentric rings with their point values. */
export function landingTarget(points = [200, 500, 1000]) {
  const S = 512;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rings = [
    { r: 1, fill: '#f2f2ee' },
    { r: 0.66, fill: '#f5c518' },
    { r: 0.33, fill: '#e2463a' },
  ];
  for (const ring of rings) {
    ctx.fillStyle = ring.fill;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, (S / 2 - 4) * ring.r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.fillStyle = '#1d1d1f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px sans-serif';
  const R = S / 2 - 4;
  ctx.fillText(points[0], S / 2, S / 2 - R * 0.83);
  ctx.fillText(points[0], S / 2, S / 2 + R * 0.83);
  ctx.fillText(points[1], S / 2, S / 2 - R * 0.5);
  ctx.fillText(points[1], S / 2, S / 2 + R * 0.5);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(points[2], S / 2, S / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Maple lane boards with the aiming arrows and the foul line. */
export function laneWood(length = 16, seed = 61) {
  const W = 256;
  const H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  const boards = 13;
  const bw = W / boards;
  for (let i = 0; i < boards; i++) {
    const tone = 205 + Math.floor(rand() * 30);
    ctx.fillStyle = `rgb(${tone},${tone - 38},${tone - 92})`;
    ctx.fillRect(i * bw, 0, bw, H);
    for (let k = 0; k < 18; k++) {
      ctx.strokeStyle = `rgba(120,70,30,${0.05 + rand() * 0.08})`;
      ctx.lineWidth = 0.6 + rand();
      const x = i * bw + rand() * bw;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rand() - 0.5) * 3, H);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70,40,15,0.35)';
    ctx.fillRect(i * bw, 0, 1, H);
  }
  // Arrows a third of the way down, dots near the foul line.
  const toV = (m) => H - (m / length) * H;
  ctx.fillStyle = '#7a2a1a';
  for (let i = 1; i < boards; i += 2) {
    const x = i * bw + bw / 2;
    const y = toV(4.2 + Math.abs(i - boards / 2) * 0.25);
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, toV(1.2), 2.5, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#20232a';
  ctx.fillRect(0, toV(0.5) - 3, W, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Bowling-pin skin: lacquered white with the two red neck stripes (v runs base to crown). */
export function pinSkin() {
  const c = makeCanvas(32, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f2ec';
  ctx.fillRect(0, 0, 32, 256);
  ctx.fillStyle = '#d0281f';
  ctx.fillRect(0, 256 * (1 - 0.66), 32, 9);
  ctx.fillRect(0, 256 * (1 - 0.61), 32, 9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The cartoon face, painted on the body colour: brows, cheeks and a big
 * mouth (the eyes and nose are 3D). three's sphere UVs: u = 0.25 faces +Z.
 */
export function faceSkin(skin, mood = 'smile') {
  const W = 512;
  const H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, W, H);
  const fx = W * 0.25;
  const ink = '#2a1414';
  const mouth = '#4a0f18';
  const tongue = '#ff6f8a';

  // Blush.
  ctx.fillStyle = 'rgba(255, 70, 90, 0.35)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + s * 62, H * 0.58, 20, 12, 0, 0, 7);
    ctx.fill();
  }

  // Thick, lopsided brows: one always a little higher than the other.
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 11;
  const lift = mood === 'yell' ? -16 : mood === 'dizzy' ? 6 : 0;
  for (const s of [-1, 1]) {
    const y = H * 0.24 + lift + (s > 0 ? -6 : 4);
    ctx.beginPath();
    if (mood === 'dizzy') {
      ctx.moveTo(fx + s * 16, y + (s > 0 ? -6 : 8));
      ctx.lineTo(fx + s * 52, y + (s > 0 ? 8 : -6));
    } else {
      ctx.moveTo(fx + s * 14, y + 4);
      ctx.quadraticCurveTo(fx + s * 34, y - 14, fx + s * 56, y);
    }
    ctx.stroke();
  }

  const my = H * 0.66;
  if (mood === 'yell') {
    // Huge scream: open right down the chin, uvula and all.
    ctx.fillStyle = mouth;
    ctx.beginPath();
    ctx.ellipse(fx, my + 4, 34, 40, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#7a1a26';
    ctx.beginPath();
    ctx.ellipse(fx, my - 22, 6, 9, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.ellipse(fx, my + 30, 22, 13, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(fx - 18, my - 36, 36, 10);
  } else if (mood === 'dizzy') {
    // Crooked mouth with the tongue lolling out of one side.
    ctx.strokeStyle = mouth;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = fx - 38 + i * 3.2;
      const y = my + Math.sin(i * 0.8) * 6 + i * 0.6;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.ellipse(fx + 22, my + 22, 13, 20, -0.3, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#d94a68';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx + 22, my + 10);
    ctx.lineTo(fx + 26, my + 32);
    ctx.stroke();
  } else {
    // Goofy grin: wide open, two big buck teeth, tongue at the bottom.
    ctx.fillStyle = mouth;
    ctx.beginPath();
    ctx.moveTo(fx - 54, my - 14);
    ctx.quadraticCurveTo(fx, my - 4, fx + 54, my - 14);
    ctx.quadraticCurveTo(fx + 44, my + 44, fx, my + 44);
    ctx.quadraticCurveTo(fx - 44, my + 44, fx - 54, my - 14);
    ctx.fill();
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.ellipse(fx + 6, my + 30, 22, 12, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(fx + (s < 0 ? -15 : 1), my - 10, 14, 20, 3);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Red crate face with a hazard border and TNT stencil. */
export function tntCrate() {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d23a2c';
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.rect(26, 26, S - 52, S - 52);
  ctx.clip('evenodd');
  for (let i = -S; i < S * 2; i += 36) {
    ctx.fillStyle = (i / 36) % 2 ? '#1c1c1c' : '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 18, 0);
    ctx.lineTo(i + 18 - S, S);
    ctx.lineTo(i - S, S);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#fff4d6';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', S / 2, S / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
