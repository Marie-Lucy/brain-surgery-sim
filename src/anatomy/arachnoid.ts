import * as THREE from 'three';
import type { ArachnoidSegmentConfig } from '../config/anatomy';
import { createTissueMaterial, type TissueMaterial } from './materials';
import { noise3 } from './noise';

/**
 * Arachnoid membrane segments.
 *
 * The arachnoid is the thin, translucent layer that bridges the sylvian fissure
 * and wraps the basal cisterns. In surgery it is opened sharply, with micro
 * scissors or a needle, rather than torn, so traction does not reach the
 * vessels and bridging veins. Each segment here can be cut on its own.
 */
export interface ArachnoidRuntime {
  cfg: ArachnoidSegmentConfig;
  mesh: THREE.Mesh;
  material: TissueMaterial;
  cut: boolean;
}

/** Extra width (mm) tucked under each lobe so the membrane edges stay hidden. */
const TUCK = 1.6;

export function createArachnoidSegment(cfg: ArachnoidSegmentConfig, seed: number): ArachnoidRuntime {
  const width = cfg.x[1] - cfg.x[0];
  // Fissure segments are rebuilt to the current gap width by fitToGap().
  const height = cfg.layer === 'fissure' ? 1 : cfg.y![1] - cfg.y![0];
  const geo = new THREE.PlaneGeometry(width, height, 36, cfg.layer === 'fissure' ? 6 : 24);
  geo.userData.seed = seed;
  geo.userData.unitY = Float32Array.from({ length: geo.attributes.position.count }, (_, i) => geo.attributes.position.getY(i) / height);
  shapeMembrane(geo, height, cfg.layer === 'fissure');

  const material = createTissueMaterial({
    color: 0xf3efe8,
    pattern: 'membrane',
    roughness: 0.55,
    clearcoat: 0,
    sheen: 0.25,
    sheenColor: 0xffffff,
    opacity: cfg.opacity,
    side: THREE.DoubleSide,
    envMapIntensity: 0.2,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = `arachnoid-${cfg.id}`;
  mesh.userData = { kind: 'arachnoid', id: cfg.id };
  mesh.renderOrder = 2;
  const cx = (cfg.x[0] + cfg.x[1]) / 2;
  const cy = cfg.layer === 'fissure' ? 0 : (cfg.y![0] + cfg.y![1]) / 2;
  mesh.position.set(cx, cy, cfg.z);
  return { cfg, mesh, material, cut: false };
}

/** Places vertices across the given height and adds sag and wrinkles. */
function shapeMembrane(geo: THREE.BufferGeometry, height: number, sag: boolean): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const unitY = geo.userData.unitY as Float32Array;
  const seed = geo.userData.seed as number;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), u = unitY[i];
    const y = u * height;
    // The membrane droops slightly into the fissure and is finely wrinkled.
    const edge = sag ? 1 - Math.pow(2 * u, 2) : 1;
    const wrinkle = noise3(x * 0.4 + seed, y * 0.6, seed) * 0.35;
    pos.setXYZ(i, x, y, (-0.35 - 0.04 * height) * edge + wrinkle * edge);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

/** Stretch fissure-layer segments across the current gap. */
export function fitToGap(seg: ArachnoidRuntime, halfGap: number): void {
  if (seg.cfg.layer !== 'fissure') return;
  shapeMembrane(seg.mesh.geometry, 2 * halfGap + 2 * TUCK, true);
}
