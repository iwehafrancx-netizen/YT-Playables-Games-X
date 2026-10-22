import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * A giant cartoon robot for the boss fights: a chunky body with a glowing
 * core, a box head with big googly eyes, swinging arms and stompy legs.
 * Purely visual; each fight decides what on it can be hit.
 *
 * Built at 1 unit ≈ 1 m with the feet at the origin, about 4.6 m tall
 * before `scale`.
 */
export function buildRobot(world, { scale = 1, paint = 0x8f5de5, trim = 0xffc93c, core = 0x57f2ff, dome = false } = {}) {
  const own = (m) => {
    world.disposables.push(m);
    return m;
  };
  const shell = own(new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.1, emissive: 0xff2a1a, emissiveIntensity: 0 }));
  const band = own(new THREE.MeshStandardMaterial({ color: trim, roughness: 0.4 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.6 }));
  const glow = own(new THREE.MeshStandardMaterial({ color: core, emissive: core, emissiveIntensity: 1.2, roughness: 0.3 }));
  const white = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  const black = own(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }));
  const piece = (geo, mat, x, y, z) => {
    own(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const legs = [-0.55, 0.55].map((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 1.45, 0);
    leg.add(piece(new RoundedBoxGeometry(0.62, 1.3, 0.62, 3, 0.12), dark, 0, -0.65, 0));
    leg.add(piece(new RoundedBoxGeometry(0.85, 0.32, 1.05, 3, 0.12), band, 0, -1.3, 0.12));
    rig.add(leg);
    return leg;
  });

  const body = piece(new RoundedBoxGeometry(2.2, 1.8, 1.4, 4, 0.3), shell, 0, 2.35, 0);
  const belt = piece(new RoundedBoxGeometry(2.3, 0.28, 1.5, 3, 0.1), band, 0, 1.55, 0);
  const coreMesh = piece(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 28).rotateX(Math.PI / 2), glow, 0, 2.45, 0.72);
  const ring = piece(new THREE.TorusGeometry(0.47, 0.07, 10, 28), band, 0, 2.45, 0.74);
  rig.add(body, belt, coreMesh, ring);

  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 1.25, 3.0, 0);
    arm.add(piece(new THREE.SphereGeometry(0.32, 16, 12), band, 0, 0, 0));
    arm.add(piece(new RoundedBoxGeometry(0.42, 1.3, 0.42, 3, 0.15), shell, 0, -0.75, 0));
    arm.add(piece(new THREE.SphereGeometry(0.36, 16, 12), dark, 0, -1.5, 0));
    rig.add(arm);
    return arm;
  });

  const head = new THREE.Group();
  head.position.set(0, 3.75, 0);
  head.add(piece(new RoundedBoxGeometry(1.6, 1.15, 1.25, 4, 0.28), shell, 0, 0, 0));
  head.add(piece(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), dark, 0.35, 0.8, 0));
  const bulb = piece(new THREE.SphereGeometry(0.14, 12, 10), glow, 0.35, 1.08, 0);
  head.add(bulb);
  const pupils = [-1, 1].map((s) => {
    head.add(piece(new THREE.SphereGeometry(0.3, 20, 16), white, s * 0.4, 0.08, 0.5));
    const pupil = piece(new THREE.SphereGeometry(0.13, 14, 10), black, s * 0.4, 0.06, 0.78);
    head.add(pupil);
    return pupil;
  });
  head.add(piece(new RoundedBoxGeometry(0.8, 0.16, 0.1, 2, 0.05), dark, 0, -0.32, 0.62));
  let glass = null;
  if (dome) {
    glass = piece(new THREE.SphereGeometry(0.95, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2), own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, roughness: 0.05 })), 0, 0.5, 0);
    head.add(glass);
  }
  rig.add(head);

  root.scale.setScalar(scale);
  world.add(root);

  let flash = 0;
  let walk = 0;
  let fall = 0;
  return {
    root,
    rig,
    head,
    glass,
    coreMesh,
    scale,
    /** World position of a point given in the robot's own (unscaled) frame. */
    point(x, y, z, out = new THREE.Vector3()) {
      rig.updateWorldMatrix(true, false);
      return rig.localToWorld(out.set(x, y, z));
    },
    corePosition(out) {
      return coreMesh.getWorldPosition(out);
    },
    headPosition(out) {
      return head.getWorldPosition(out);
    },
    hurt() {
      flash = 1;
    },
    topple() {
      fall = 0.001;
    },
    /** Animate: `speed` is how fast it's walking (0 stands still). */
    tick(dt, t, speed = 0) {
      flash = Math.max(0, flash - dt * 3);
      shell.emissiveIntensity = flash * 0.9;
      walk += dt * (2 + speed * 2.5);
      const step = speed > 0.05 ? Math.sin(walk) : 0;
      legs[0].rotation.x = step * 0.45;
      legs[1].rotation.x = -step * 0.45;
      arms[0].rotation.x = -step * 0.5 + Math.sin(t * 1.3) * 0.08;
      arms[1].rotation.x = step * 0.5 - Math.sin(t * 1.3) * 0.08;
      rig.position.y = Math.abs(step) * 0.08;
      head.rotation.z = Math.sin(t * 1.7) * 0.05 + flash * 0.25;
      bulb.material.emissiveIntensity = 0.8 + Math.sin(t * 6) * 0.4;
      for (const [i, p] of pupils.entries()) {
        p.position.x = (i ? 0.4 : -0.4) + Math.sin(t * 2.3 + i) * 0.06 + (Math.random() - 0.5) * flash * 0.2;
        p.position.y = 0.06 + Math.cos(t * 1.9 + i) * 0.05;
      }
      if (fall > 0) {
        fall = Math.min(1, fall + dt * 1.4);
        rig.rotation.x = -(Math.PI / 2) * fall * fall;
      }
    },
  };
}

/**
 * The Crab King: a wide mechanical crab with googly eyes on stalks and two
 * huge pincers. `open` (0–1) raises the claws off its belly. Same animation
 * hooks as the robot.
 */
export function buildCrab(world, { scale = 1, paint = 0xff6a3d, trim = 0xffc93c, core = 0x57f2ff } = {}) {
  const own = (m) => {
    world.disposables.push(m);
    return m;
  };
  const shell = own(new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, emissive: 0xff2a1a, emissiveIntensity: 0 }));
  const band = own(new THREE.MeshStandardMaterial({ color: trim, roughness: 0.4 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.6 }));
  const glow = own(new THREE.MeshStandardMaterial({ color: core, emissive: core, emissiveIntensity: 1.2, roughness: 0.3 }));
  const white = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  const black = own(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }));
  const piece = (geo, mat, x, y, z) => {
    own(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  rig.add(piece(new THREE.SphereGeometry(1, 32, 20).scale(1.6, 0.75, 1.1), shell, 0, 1.25, 0));
  const coreMesh = piece(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 28).rotateX(Math.PI / 2), glow, 0, 1.05, 1.08);
  rig.add(coreMesh, piece(new THREE.TorusGeometry(0.5, 0.07, 10, 28), band, 0, 1.05, 1.1));

  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group();
      leg.position.set(s * 1.3, 1.0, -0.5 + i * 0.45);
      const bit = piece(new THREE.CylinderGeometry(0.09, 0.06, 1.3, 8), dark, s * 0.45, -0.45, 0);
      bit.rotation.z = s * 0.9;
      leg.add(bit);
      rig.add(leg);
      legs.push(leg);
    }
  }

  const pupils = [];
  for (const s of [-1, 1]) {
    rig.add(piece(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), dark, s * 0.45, 2.15, 0.35));
    rig.add(piece(new THREE.SphereGeometry(0.3, 18, 14), white, s * 0.45, 2.55, 0.38));
    const p = piece(new THREE.SphereGeometry(0.13, 12, 10), black, s * 0.45, 2.55, 0.66);
    rig.add(p);
    pupils.push(p);
  }

  // Each claw pivots up off the belly; jaws snap while it's open.
  const claws = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 1.25, 1.35, 0.6);
    arm.add(piece(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10).rotateX(Math.PI / 2), shell, 0, 0, 0.4));
    const claw = new THREE.Group();
    claw.position.set(0, 0, 0.95);
    claw.add(piece(new THREE.SphereGeometry(0.55, 18, 14).scale(1, 0.8, 1.1), shell, 0, 0, 0));
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.1, 0.4);
    jaw.add(piece(new THREE.BoxGeometry(0.3, 0.2, 0.9), band, 0, 0.12, 0.35));
    const lower = piece(new THREE.BoxGeometry(0.3, 0.2, 0.8), band, 0, -0.18, 0.3);
    claw.add(jaw, lower);
    arm.add(claw);
    rig.add(arm);
    return { arm, jaw, s };
  });

  root.scale.setScalar(scale);
  world.add(root);

  let flash = 0;
  let fall = 0;
  let open = 0;
  return {
    root,
    rig,
    coreMesh,
    scale,
    corePosition(out) {
      return coreMesh.getWorldPosition(out);
    },
    headPosition(out) {
      return rig.getWorldPosition(out).add(new THREE.Vector3(0, 2.5 * scale, 0));
    },
    setOpen(k) {
      open = k;
    },
    hurt() {
      flash = 1;
    },
    topple() {
      fall = 0.001;
    },
    tick(dt, t, speed = 0) {
      flash = Math.max(0, flash - dt * 3);
      shell.emissiveIntensity = flash * 0.9;
      for (const [i, leg] of legs.entries()) leg.rotation.x = Math.sin(t * (4 + speed * 6) + i * 1.3) * 0.35 * Math.min(1, speed + 0.2);
      for (const c of claws) {
        // Closed: claws folded down in front of the belly. Open: raised high.
        c.arm.rotation.x = -open * 1.2;
        c.arm.rotation.y = -c.s * (1 - open) * 0.55;
        c.jaw.rotation.x = -0.25 - Math.max(0, Math.sin(t * 9)) * 0.4 * open;
      }
      for (const [i, p] of pupils.entries()) {
        p.position.x = (i ? 0.45 : -0.45) + Math.sin(t * 2.6 + i) * 0.07;
        p.position.y = 2.55 + Math.cos(t * 2 + i) * 0.06;
      }
      rig.position.y = Math.abs(Math.sin(t * 5)) * 0.05 * speed;
      if (fall > 0) {
        fall = Math.min(1, fall + dt * 1.4);
        rig.rotation.z = Math.PI * fall * fall;
        rig.position.y = 1.4 * Math.sin(Math.PI * fall);
      }
    },
  };
}
