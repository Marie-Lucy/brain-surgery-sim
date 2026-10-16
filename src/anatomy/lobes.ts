import * as THREE from 'three';
import type { LobeConfig } from '../config/anatomy';
import { PHYSIOLOGY } from '../config/anatomy';
import { createTissueMaterial } from './materials';
import { fbm3, noise3 } from './noise';
import { useRaycastProxy } from './raycastProxy';

/**
 * Builds a lobe as a "superquadric" (a rounded box) with gyral relief.
 *
 * The flat-ish faces stand in for the opercula, the lips of the sylvian fissure
 * that face each other. The underside tapers so the deep corridor opens onto
 * the basal cisterns, the way the fissure widens once its arachnoid is opened.
 */
const sgnPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export function createLobe(cfg: LobeConfig, side: 'frontal' | 'temporal', seed: number): THREE.Mesh {
  const geo = buildLobeGeometry(cfg, seed, 220, 160);

  const mat = createTissueMaterial({
    color: 0xffffff,
    vertexColors: true,
    pattern: 'cortex',
    roughness: 0.55,
    clearcoat: 0.75,
    clearcoatRoughness: 0.22,
    sheen: 0.35,
    sheenColor: 0xffb0a0,
    pulseAmp: PHYSIOLOGY.pulseAmplitude.brain,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `${side}-lobe`;
  mesh.userData = { kind: 'lobe', id: side };
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  useRaycastProxy(mesh, buildLobeGeometry(cfg, seed, 120, 84));
  return mesh;
}

function buildLobeGeometry(cfg: LobeConfig, seed: number, wSeg: number, hSeg: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, wSeg, hSeg);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  // Step 1: map unit-sphere directions onto the superquadric.
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // SphereGeometry is y-up; rotate so z is "up" (toward the microscope).
    const dx = v.x, dy = -v.z, dz = v.y;
    const lat = Math.asin(THREE.MathUtils.clamp(dz, -1, 1));
    const lon = Math.atan2(dy, dx);
    const top = lat >= 0;
    const eV = top ? cfg.boxinessTop : cfg.boxinessBottom;
    const cl = sgnPow(Math.cos(lat), eV);
    const x = cfg.radii[0] * cl * sgnPow(Math.cos(lon), cfg.boxinessXY);
    const y = cfg.radii[1] * cl * sgnPow(Math.sin(lon), cfg.boxinessXY);
    const z = (top ? cfg.zTop : cfg.zBottom) * sgnPow(Math.sin(lat), eV);
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();

  // Step 2: gyri and sulci. The displacement is always inward (<= 0) so the
  // lobes never poke across the fissure. Sulci are the narrow grooves where
  // the noise crosses zero.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(cfg.color);
  const sulcusColor = new THREE.Color(0x7a2f2c);
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const s = cfg.gyriScale;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    const warp = fbm3(v.x * 0.03 + seed, v.y * 0.03, v.z * 0.03, 2) * 3;
    const g = Math.abs(noise3(v.x * s + warp, v.y * s + seed * 3.1, v.z * s));
    const ridge = Math.pow(Math.min(1, g * 2.4), 0.55); // 0 in sulcus, 1 on gyral crown
    const small = fbm3(v.x * 0.35, v.y * 0.35 + seed, v.z * 0.35, 2) * 0.25;
    const d = cfg.gyriDepth * (ridge - 1) + small - 0.25;
    v.addScaledVector(n, d);
    pos.setXYZ(i, v.x, v.y, v.z);
    c.copy(sulcusColor).lerp(base, 0.35 + 0.65 * ridge);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
