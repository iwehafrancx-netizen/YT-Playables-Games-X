import * as THREE from 'three';
import { softDot } from './textures.js';

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** Dust puffs, debris chips, confetti and floating score text. */
export class Fx {
  constructor(scene, camera, overlay) {
    this.scene = scene;
    this.camera = camera;
    this.overlay = overlay;
    this.dotTex = softDot();

    this.puffs = [];
    this.puffPool = [];

    const MAX = 400;
    this.chipMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      MAX,
    );
    this.chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chipMesh.castShadow = true;
    this.chipMesh.frustumCulled = false;
    this.chipMesh.count = 0;
    this.bits = [];
    this.maxChips = MAX;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX; i++) this.chipMesh.setColorAt(i, white);
    scene.add(this.chipMesh);

    this.texts = [];
  }

  puff(pos, { count = 6, color = 0xd9d2c3, size = 0.5, speed = 1.2, life = 0.9, up = 0.6 } = {}) {
    for (let i = 0; i < count; i++) {
      let s = this.puffPool.pop();
      if (!s) {
        s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dotTex, transparent: true, depthWrite: false }));
        this.scene.add(s);
      }
      s.visible = true;
      s.material.color.set(color);
      s.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      s.userData.v = new THREE.Vector3(Math.cos(a) * r, up * (0.4 + Math.random()), Math.sin(a) * r);
      s.userData.life = life * (0.7 + Math.random() * 0.6);
      s.userData.max = s.userData.life;
      s.userData.size = size * (0.6 + Math.random() * 0.8);
      this.puffs.push(s);
    }
  }

  chips(pos, { count = 10, colors = [0xb98552], size = 0.06, speed = 4, life = 1.6, floor = -Infinity } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.bits.length >= this.maxChips) this.bits.shift();
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
      this.bits.push({
        p: pos.clone(),
        v: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7),
        s: size * (0.6 + Math.random() * 0.8),
        c: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        life: life * (0.7 + Math.random() * 0.6),
        floor,
        flat: false,
      });
    }
  }

  confetti(pos, count = 80) {
    const colors = [0xf5c518, 0xe2463a, 0x3c86e8, 0x3fc79a, 0xffffff, 0xf0782a];
    for (let i = 0; i < count; i++) {
      if (this.bits.length >= this.maxChips) this.bits.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.bits.push({
        p: pos.clone(),
        v: new THREE.Vector3(Math.cos(a) * sp * 0.6, 4 + Math.random() * 6, Math.sin(a) * sp * 0.6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10),
        s: 0.07,
        c: new THREE.Color(colors[i % colors.length]),
        life: 2.5 + Math.random(),
        floor: pos.y - 20,
        flat: true,
        drag: true,
      });
    }
  }

  /** Floating text anchored to a world position (DOM, so it stays crisp). */
  text(pos, str, { color = '#fff', size = 26, life = 1.1, rise = 1.2, cls = '' } = {}) {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = `${size}px`;
    this.overlay.appendChild(el);
    this.texts.push({ el, p: pos.clone(), life, max: life, rise });
  }

  update(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const s = this.puffs[i];
      const d = s.userData;
      d.life -= dt;
      if (d.life <= 0) {
        s.visible = false;
        this.puffs.splice(i, 1);
        this.puffPool.push(s);
        continue;
      }
      const k = d.life / d.max;
      s.position.addScaledVector(d.v, dt);
      d.v.multiplyScalar(1 - dt * 2.2);
      s.scale.setScalar(d.size * (1.6 - k * 0.9));
      s.material.opacity = Math.min(1, k * 1.4) * 0.55;
    }

    let n = 0;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const c = this.bits[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.bits.splice(i, 1);
        continue;
      }
      c.v.y -= (c.drag ? 4 : 11) * dt;
      if (c.drag) c.v.multiplyScalar(1 - dt * 1.5);
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.floor) {
        c.p.y = c.floor;
        c.v.y *= -0.3;
        c.v.x *= 0.6;
        c.v.z *= 0.6;
        c.w.multiplyScalar(0.5);
      }
      c.r.x += c.w.x * dt;
      c.r.y += c.w.y * dt;
      c.r.z += c.w.z * dt;
      const fade = Math.min(1, c.life * 3);
      _s.set(c.s, c.flat ? c.s * 0.15 : c.s, c.flat ? c.s * 0.6 : c.s).multiplyScalar(fade);
      _m.compose(c.p, _q.setFromEuler(_e.copy(c.r)), _s);
      this.chipMesh.setMatrixAt(n, _m);
      this.chipMesh.setColorAt(n, c.c);
      n++;
    }
    this.chipMesh.count = n;
    this.chipMesh.instanceMatrix.needsUpdate = true;
    if (this.chipMesh.instanceColor) this.chipMesh.instanceColor.needsUpdate = true;

    const w = this.overlay.clientWidth;
    const h = this.overlay.clientHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.el.remove();
        this.texts.splice(i, 1);
        continue;
      }
      t.p.y += t.rise * dt;
      _v.copy(t.p).project(this.camera);
      if (_v.z > 1) {
        t.el.style.opacity = 0;
        continue;
      }
      const k = 1 - t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
      t.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${pop})`;
      t.el.style.opacity = Math.min(1, (t.life / t.max) * 3);
    }
  }

  clear() {
    for (const s of this.puffs) {
      s.visible = false;
      this.puffPool.push(s);
    }
    this.puffs.length = 0;
    this.bits.length = 0;
    this.chipMesh.count = 0;
    for (const t of this.texts) t.el.remove();
    this.texts.length = 0;
  }
}
