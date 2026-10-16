import * as THREE from 'three';
import type { VesselConfig, NerveConfig } from '../config/anatomy';
import { PHYSIOLOGY } from '../config/anatomy';
import { createTissueMaterial, type TissueMaterial } from './materials';

/**
 * Vessels and nerves are tubes swept along Catmull-Rom splines.
 * TubeGeometry has a constant radius, so we post-scale each ring to taper
 * from `radius` to `radiusEnd` (arteries narrow as they branch).
 */
export function createTaperedTube(
  points: THREE.Vector3[],
  radius: number,
  radiusEnd = radius,
  radialSegments = 20,
): { geometry: THREE.BufferGeometry; curve: THREE.CatmullRomCurve3 } {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  const tubular = Math.max(16, Math.ceil(length * 2.2));
  const geo = new THREE.TubeGeometry(curve, tubular, radius, radialSegments, false);

  if (radiusEnd !== radius) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    const center = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular;
      curve.getPointAt(t, center);
      const k = THREE.MathUtils.lerp(radius, radiusEnd, t) / radius;
      for (let j = 0; j <= radialSegments; j++) {
        const idx = i * (radialSegments + 1) + j;
        p.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(k).add(center);
        pos.setXYZ(idx, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
  }
  return { geometry: geo, curve };
}

export interface VesselRuntime {
  cfg: VesselConfig;
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  material: TissueMaterial;
  /** 0..1 relative flow; updated later by the flow model. */
  flow: number;
}

export function createVessel(cfg: VesselConfig): VesselRuntime {
  const pts = cfg.points.map((p) => new THREE.Vector3(...p));
  const radiusEnd = cfg.radiusEnd ?? cfg.radius;
  const { geometry, curve } = createTaperedTube(pts, cfg.radius, radiusEnd, cfg.radius > 1 ? 24 : 14);
  const isArtery = cfg.kind === 'artery';
  const material = createTissueMaterial({
    color: isArtery ? 0xb83a40 : 0x4e2f63,
    pattern: isArtery ? 'artery' : 'vein',
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.6,
    sheenColor: isArtery ? 0xffc0b8 : 0x9a80c0,
    pulseAmp: isArtery ? PHYSIOLOGY.pulseAmplitude.artery * Math.min(1.4, cfg.radius) : PHYSIOLOGY.pulseAmplitude.vein,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `vessel-${cfg.id}`;
  mesh.userData = { kind: 'vessel', id: cfg.id };
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Rounded caps hide the open tube ends (they disappear into tissue or a parent vessel).
  const capGeo = new THREE.SphereGeometry(1, 16, 12);
  for (const [pt, r] of [
    [pts[0], cfg.radius],
    [pts[pts.length - 1], radiusEnd],
  ] as const) {
    const cap = new THREE.Mesh(capGeo, material);
    cap.position.copy(pt);
    cap.scale.setScalar(r * 0.995);
    cap.userData = mesh.userData;
    mesh.add(cap);
  }
  return { cfg, mesh, curve, material, flow: cfg.baselineFlow };
}

export interface NerveRuntime {
  cfg: NerveConfig;
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
}

export function createNerve(cfg: NerveConfig): NerveRuntime {
  const pts = cfg.points.map((p) => new THREE.Vector3(...p));
  const { geometry, curve } = createTaperedTube(pts, cfg.radius, cfg.radius * 0.92, 24);
  const material = createTissueMaterial({
    color: cfg.color,
    pattern: 'nerve',
    roughness: 0.4,
    clearcoat: 0.9,
    sheen: 0.4,
    sheenColor: 0xfff0d8,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `nerve-${cfg.id}`;
  mesh.userData = { kind: 'nerve', id: cfg.id };
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const capGeo = new THREE.SphereGeometry(1, 16, 12);
  for (const [pt, r] of [
    [pts[0], cfg.radius],
    [pts[pts.length - 1], cfg.radius * 0.92],
  ] as const) {
    const cap = new THREE.Mesh(capGeo, material);
    cap.position.copy(pt);
    cap.scale.setScalar(r * 0.99);
    cap.userData = mesh.userData;
    mesh.add(cap);
  }
  return { cfg, mesh, curve };
}
