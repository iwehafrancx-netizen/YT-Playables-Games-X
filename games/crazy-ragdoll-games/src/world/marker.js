import * as THREE from 'three';

/**
 * A big bouncing arrow that points at whatever the player should hit next.
 * Drawn over everything so it can't hide behind the scenery.
 */
export function marker(world, color = 0xffd23a) {
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const edge = new THREE.MeshBasicMaterial({ color: 0x1b1d24, depthTest: false, transparent: true });
  const head = new THREE.ConeGeometry(0.42, 0.7, 20).rotateX(Math.PI);
  const shaft = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 12).translate(0, 0.6, 0);
  const rim = new THREE.ConeGeometry(0.5, 0.82, 20).rotateX(Math.PI);
  world.disposables.push(mat, edge, head, shaft, rim);
  const g = new THREE.Group();
  const back = new THREE.Mesh(rim, edge);
  back.position.y = 0.02;
  g.add(back, new THREE.Mesh(head, mat), new THREE.Mesh(shaft, mat));
  for (const m of g.children) m.renderOrder = 10;
  g.children[0].renderOrder = 9;
  g.visible = false;
  world.add(g);
  const at = new THREE.Vector3();
  return {
    /** Points at `pos` (or hides when `pos` is null), bobbing and pulsing over time `t`. */
    show(pos, t, scale = 1) {
      g.visible = !!pos;
      if (!pos) return;
      at.copy(pos);
      g.position.set(at.x, at.y + 0.6 + Math.abs(Math.sin(t * 5)) * 0.45 * scale, at.z);
      g.scale.setScalar(scale * (1 + Math.sin(t * 10) * 0.06));
      g.rotation.y = t * 2;
    },
  };
}
