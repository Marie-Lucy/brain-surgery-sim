import * as THREE from 'three';
import { ANEURYSM, PHYSIOLOGY } from '../config/anatomy';
import { createTissueMaterial, type TissueMaterial } from './materials';
import { noise3 } from './noise';

/**
 * IC-PC aneurysm: a saccular outpouching at the junction of the ICA and the
 * PCom origin.
 *
 * Built as a lathe (surface of revolution) along the projection axis:
 *   neck  - the narrower base where the sac joins the ICA wall. The clip blades
 *           must close across it, parallel to the parent artery.
 *   dome  - the body of the sac (6.6 mm here)
 *   bleb  - a small daughter sac on the dome; the wall is thinnest there and it
 *           is the most likely rupture point
 */
export interface AneurysmRuntime {
  group: THREE.Group;
  dome: THREE.Mesh;
  bleb: THREE.Mesh;
  material: TissueMaterial;
  blebMaterial: TissueMaterial;
  /** World-space neck centre (on the ICA centreline) and unit projection axis. */
  neckCenter: THREE.Vector3;
  axis: THREE.Vector3;
  domeCenter: THREE.Vector3;
  blebPosition: THREE.Vector3;
}

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};

export function createAneurysm(): AneurysmRuntime {
  const R = ANEURYSM.domeDiameter / 2;
  const neckR = ANEURYSM.neckDiameter / 2;
  const c = ANEURYSM.domeOffset;
  const end = c + R;

  // Radius profile along the axis (s = distance from the ICA centreline).
  const profile: THREE.Vector2[] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    // Cluster samples near the tip for a smooth round dome.
    const t = i / N;
    const s = end * (1 - Math.pow(1 - t, 1.6));
    const dome = Math.sqrt(Math.max(0, R * R - (s - c) * (s - c)));
    const neck = s < c ? neckR * (1 - 0.06 * Math.sin((s / c) * Math.PI)) : 0; // slight waist
    let r = smax(dome, neck, 0.9);
    if (i === N) r = 0;
    profile.push(new THREE.Vector2(r, s));
  }
  const geo = new THREE.LatheGeometry(profile, 48);

  // Gentle irregularity: real aneurysm domes are rarely perfectly round.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const along = v.y / end;
    if (along > 0.45) {
      const radial = new THREE.Vector3(v.x, 0, v.z);
      const len = radial.length();
      if (len > 1e-4) {
        const bump = noise3(v.x * 0.6 + 3, v.y * 0.6, v.z * 0.6) * 0.22 * (along - 0.45) * 2;
        radial.multiplyScalar((len + bump) / len);
        pos.setXYZ(i, radial.x, v.y, radial.z);
      }
    }
  }
  geo.computeVertexNormals();

  const material = createTissueMaterial({
    color: ANEURYSM.color,
    pattern: 'artery',
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.7,
    sheenColor: 0xffb4b4,
    pulseAmp: PHYSIOLOGY.pulseAmplitude.aneurysm,
  });
  const dome = new THREE.Mesh(geo, material);
  dome.name = 'aneurysm-dome';
  dome.userData = { kind: 'aneurysm', id: 'dome' };
  dome.castShadow = true;
  dome.receiveShadow = true;

  // Bleb: a small, thin-walled, darker red bulge on the dome.
  const axisLocal = new THREE.Vector3(0, 1, 0);
  const tilt = new THREE.Vector3(...ANEURYSM.bleb.tilt);
  const blebDirLocal = axisLocal.clone().add(new THREE.Vector3(tilt.x, 0, tilt.z)).normalize();
  const blebR = ANEURYSM.bleb.diameter / 2;
  const blebLocal = new THREE.Vector3(0, c, 0).addScaledVector(blebDirLocal, R + blebR * 0.25);
  const blebMaterial = createTissueMaterial({
    color: ANEURYSM.blebColor,
    pattern: 'none',
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    sheen: 0.8,
    sheenColor: 0xff8a8a,
    pulseAmp: PHYSIOLOGY.pulseAmplitude.aneurysm * 0.8,
  });
  const bleb = new THREE.Mesh(new THREE.SphereGeometry(blebR, 24, 18), blebMaterial);
  bleb.position.copy(blebLocal);
  bleb.name = 'aneurysm-bleb';
  bleb.userData = { kind: 'aneurysm', id: 'bleb' };
  bleb.castShadow = true;

  const group = new THREE.Group();
  group.name = 'aneurysm';
  group.add(dome, bleb);

  const neckCenter = new THREE.Vector3(...ANEURYSM.neckCenterOnIca);
  const axis = new THREE.Vector3(...ANEURYSM.direction).normalize();
  group.position.copy(neckCenter);
  group.quaternion.setFromUnitVectors(axisLocal, axis);
  group.updateMatrixWorld(true);

  return {
    group,
    dome,
    bleb,
    material,
    blebMaterial,
    neckCenter,
    axis,
    domeCenter: neckCenter.clone().addScaledVector(axis, c),
    blebPosition: bleb.getWorldPosition(new THREE.Vector3()),
  };
}
