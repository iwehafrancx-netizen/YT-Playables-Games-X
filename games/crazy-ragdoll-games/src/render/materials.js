import * as THREE from 'three';
import * as tex from './textures.js';

const cache = new Map();

function once(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

const std = (o) => new THREE.MeshStandardMaterial(o);

/** Shared, lazily built materials. Callers clone a material before tinting it. */
export const Mat = {
  concrete: () => once('concrete', () => std({ map: tex.concrete(), roughness: 0.92, metalness: 0 })),
  concreteDark: () => once('concreteDark', () => std({ map: tex.concrete(19, 0x76746f), roughness: 0.95 })),
  asphalt: () => once('asphalt', () => std({ map: tex.asphalt(), roughness: 0.97 })),
  wall: () => once('wall', () => std({ map: tex.blockWall(), roughness: 0.9 })),
  crate: () => once('crate', () => std({ map: tex.woodCrate(), roughness: 0.8 })),
  cardboard: () => once('cardboard', () => std({ map: tex.cardboard(), roughness: 0.9 })),
  hazard: () => once('hazard', () => std({ map: tex.hazard(), roughness: 0.6, metalness: 0.2 })),
  steelBlue: () => once('steelBlue', () => std({ map: tex.paintedMetal(0x2f6fb5), roughness: 0.5, metalness: 0.45 })),
  steelRed: () => once('steelRed', () => std({ map: tex.paintedMetal(0xb83a2c, 12), roughness: 0.5, metalness: 0.45 })),
  steelGreen: () => once('steelGreen', () => std({ map: tex.paintedMetal(0x3f7a4f, 13), roughness: 0.55, metalness: 0.4 })),
  steelOrange: () => once('steelOrange', () => std({ map: tex.paintedMetal(0xe2731f, 14), roughness: 0.5, metalness: 0.4 })),
  steelGrey: () => once('steelGrey', () => std({ map: tex.paintedMetal(0x6c7178, 15), roughness: 0.45, metalness: 0.6 })),
  steel: () => once('steel', () => std({ color: 0x9aa1a8, roughness: 0.35, metalness: 0.9 })),
  darkSteel: () => once('darkSteel', () => std({ color: 0x2b2e33, roughness: 0.5, metalness: 0.7 })),
  rubber: () => once('rubber', () => std({ color: 0x1c1c1e, roughness: 0.85 })),
  bullseye: () => once('bullseye', () => std({ map: tex.bullseye(), roughness: 0.55 })),
  foam: () => once('foam', () => std({ map: tex.foam(), roughness: 0.95 })),
  trampoline: () => once('trampoline', () => std({ color: 0x1e2a44, roughness: 0.7 })),
  white: () => once('white', () => std({ color: 0xf2f2ee, roughness: 0.6 })),
  toyRed: () => once('toyRed', () => std({ color: 0xef4b3c, roughness: 0.35 })),
  toyBlue: () => once('toyBlue', () => std({ color: 0x3c86e8, roughness: 0.35 })),
  toyYellow: () => once('toyYellow', () => std({ color: 0xffc928, roughness: 0.35 })),
  toyGreen: () => once('toyGreen', () => std({ color: 0x3fcf7a, roughness: 0.35 })),
  toyPurple: () => once('toyPurple', () => std({ color: 0x9b5de5, roughness: 0.35 })),
  toyOrange: () => once('toyOrange', () => std({ color: 0xff8a2a, roughness: 0.35 })),
  toyPink: () => once('toyPink', () => std({ color: 0xff5ca8, roughness: 0.35 })),
  toyDark: () => once('toyDark', () => std({ color: 0x2b2f3a, roughness: 0.4 })),
  glowGreen: () => once('glowGreen', () => std({ color: 0x3ad16b, emissive: 0x1d9e48, emissiveIntensity: 0.8, roughness: 0.4 })),
  gold: () => once('gold', () => std({ color: 0xf5c518, emissive: 0x6b4d00, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.9 })),
  saw: () => once('saw', () => std({ color: 0xd9dde3, roughness: 0.25, metalness: 1 })),
  glass: () => once('glass', () => std({ color: 0xbfe6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 })),
  lane: () => once('lane', () => std({ map: tex.laneWood(), roughness: 0.22, metalness: 0.05 })),
  pin: () => once('pin', () => std({ map: tex.pinSkin(), roughness: 0.18, metalness: 0 })),
};

const BOX_PAINT = { steelBlue: 0x2f6fb5, steelRed: 0xb83a2c, steelGreen: 0x3f7a4f, steelOrange: 0xe2731f, steelGrey: 0x6c7178 };

/** Corrugated paint for a shipping container in one of the steel colours. */
export function containerMat(color) {
  return once(`box:${color}`, () => std({ map: tex.containerSide(BOX_PAINT[color] ?? BOX_PAINT.steelBlue), roughness: 0.55, metalness: 0.35 }));
}
