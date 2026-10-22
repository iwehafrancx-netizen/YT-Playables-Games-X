import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export const THEMES = {
  morning: {
    elevation: 22, azimuth: 135, turbidity: 6, rayleigh: 1.6, mie: 0.005,
    sun: 0xfff1dc, sunIntensity: 2.6, hemiSky: 0xcfe3ff, hemiGround: 0x6d6457, hemi: 0.55,
    fog: 0xc9d8e6, fogNear: 45, fogFar: 170, exposure: 0.78,
  },
  noon: {
    elevation: 55, azimuth: 160, turbidity: 4, rayleigh: 1.2, mie: 0.004,
    sun: 0xffffff, sunIntensity: 2.9, hemiSky: 0xd6e8ff, hemiGround: 0x7a6f60, hemi: 0.6,
    fog: 0xbcd3ea, fogNear: 55, fogFar: 200, exposure: 0.68,
  },
  sunset: {
    elevation: 7, azimuth: 230, turbidity: 9, rayleigh: 3, mie: 0.01,
    sun: 0xffc48a, sunIntensity: 2.4, hemiSky: 0xffcfa8, hemiGround: 0x5a4a44, hemi: 0.55,
    fog: 0xe6b394, fogNear: 40, fogFar: 150, exposure: 0.9,
  },
  overcast: {
    elevation: 35, azimuth: 120, turbidity: 18, rayleigh: 0.6, mie: 0.02,
    sun: 0xeef2f6, sunIntensity: 1.7, hemiSky: 0xdfe6ee, hemiGround: 0x6b6b6b, hemi: 0.9,
    fog: 0xbfc6cc, fogNear: 35, fogFar: 140, exposure: 0.95,
  },
  dusk: {
    elevation: 3, azimuth: 250, turbidity: 6, rayleigh: 2.6, mie: 0.006,
    sun: 0xff9f6b, sunIntensity: 1.9, hemiSky: 0x9fa8d8, hemiGround: 0x3f3a44, hemi: 0.75,
    fog: 0x8c86a6, fogNear: 35, fogFar: 140, exposure: 1.0,
  },
};

/** Renderer, scene, sky, sun and camera shared by every level. */
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    this.camera.position.set(0, 3, 10);

    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    this.scene.add(this.hemi);

    this.scene.fog = new THREE.Fog(0xcccccc, 50, 200);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = null;
    this.themeName = null;

    this.quality = 2;
    this.frameTimes = [];
    this.applyQuality();
    this.resize();
  }

  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name;
    const t = THEMES[name] ?? THEMES.noon;
    this.sky.visible = true;
    this.scene.background = null;
    const u = this.sky.material.uniforms;
    u.turbidity.value = t.turbidity;
    u.rayleigh.value = t.rayleigh;
    u.mieCoefficient.value = t.mie;
    u.mieDirectionalG.value = 0.8;
    const phi = THREE.MathUtils.degToRad(90 - t.elevation);
    const theta = THREE.MathUtils.degToRad(t.azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);

    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.hemi.intensity = t.hemi;
    this.scene.fog.color.set(t.fog);
    this.scene.fog.near = t.fogNear;
    this.scene.fog.far = t.fogFar;
    this.renderer.toneMappingExposure = t.exposure;

    // Image-based lighting baked from the sky so metals and plastics pick up the time of day.
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(100);
    envSky.material.uniforms = THREE.UniformsUtils.clone(u);
    envScene.add(envSky);
    this.envTarget?.dispose();
    this.envTarget = this.pmrem.fromScene(envScene, 0.02);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.55;
    envSky.geometry.dispose();
    envSky.material.dispose();
  }

  /** Keep the shadow frustum centred on whatever the camera is looking at. */
  focusShadows(target, radius = 16) {
    const cam = this.sun.shadow.camera;
    if (cam.right !== radius) {
      cam.left = -radius;
      cam.right = radius;
      cam.top = radius;
      cam.bottom = -radius;
      cam.near = 1;
      cam.far = 140;
      cam.updateProjectionMatrix();
    }
    // Snap to shadow texels to stop shimmering as the focus moves.
    const texel = (radius * 2) / this.sun.shadow.mapSize.x;
    const x = Math.round(target.x / texel) * texel;
    const y = Math.round(target.y / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(x, y, z);
    this.sun.position.set(x, y, z).addScaledVector(this.sunDir, 60);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens get a wider vertical FOV so the action still fits.
    this.baseFov = w < h ? 62 : 48;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  applyQuality() {
    const q = this.quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, [1, 1.25, 1.75, 2][q]));
    const size = [512, 1024, 2048, 2048][q];
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.renderer.shadowMap.type = q === 0 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  }

  /** Drops resolution and shadow quality if the device can't hold a smooth frame rate. */
  trackFrame(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.frameTimes.length = 0;
    if (median > 1 / 45 && this.quality > 0) {
      this.quality--;
      this.applyQuality();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
