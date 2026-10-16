import * as THREE from 'three';

/**
 * Aneurysm clip model (Yasargil/Sugita style).
 *
 * Local frame (origin = midpoint of the blades):
 *   +X  blade axis (head/spring at -X, blade tips at +X)
 *   ±Y  closing direction (the two blades approach each other along Y)
 *   +Z  blade width. Curved blades bend toward +Z.
 *
 * Permanent clips are titanium; temporary clips are gold-coloured and have a
 * weaker spring, so they occlude the parent artery without crushing it.
 */
export interface ClipModel {
  group: THREE.Group;
  type: 'straight' | 'curved';
  bladeLength: number;
  temporary: boolean;
  /** 0 = fully open, 1 = closed. */
  setClosure(t: number): void;
  setGhost(ghost: boolean): void;
  dispose(): void;
}

const BLADE_THICK = 0.45;
const BLADE_WIDTH = 0.9;

function bladeGeometry(length: number, curved: boolean): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(length, BLADE_THICK, BLADE_WIDTH, 32, 1, 2);
  g.translate(length / 2, 0, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const u = x / length;
    // Rounded, slightly narrowing tip.
    const taper = 1 - 0.25 * Math.pow(u, 3);
    p.setZ(i, p.getZ(i) * taper + (curved ? 2.2 * u * u : 0));
  }
  g.computeVertexNormals();
  return g;
}

export function createClip(type: 'straight' | 'curved', bladeLength = 7, temporary = false): ClipModel {
  const group = new THREE.Group();
  group.name = temporary ? 'temporary-clip' : 'aneurysm-clip';
  const mat = new THREE.MeshPhysicalMaterial({
    color: temporary ? 0xd9ac55 : 0xb8bcc6,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.3,
    transparent: true,
    opacity: 1,
  });

  const half = bladeLength / 2;
  const blades: THREE.Group[] = [];
  const bGeo = bladeGeometry(bladeLength, type === 'curved');
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(-half, 0, 0);
    const blade = new THREE.Mesh(bGeo, mat);
    blade.position.y = s * BLADE_THICK * 0.5;
    blade.castShadow = true;
    pivot.add(blade);
    pivot.userData.side = s;
    blades.push(pivot);
    group.add(pivot);
  }

  // Spring coil and the crossing arms behind the blades.
  const coil = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.28, 10, 24), mat);
  coil.position.set(-half - 2.1, 0, 0);
  coil.castShadow = true;
  group.add(coil);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.38, 0.9), mat);
    arm.position.set(-half - 1.0, s * 0.55, 0);
    arm.rotation.z = -s * 0.35;
    arm.castShadow = true;
    group.add(arm);
  }

  group.traverse((o) => (o.userData.clip = true));

  const model: ClipModel = {
    group,
    type,
    bladeLength,
    temporary,
    setClosure(t) {
      // Blades hinge at the head; an open clip spreads about 3-4 mm at the tips.
      const angle = (1 - t) * Math.atan2(1.8, bladeLength);
      for (const b of blades) b.rotation.z = b.userData.side * angle;
    },
    setGhost(ghost) {
      mat.opacity = ghost ? 0.6 : 1;
      mat.depthWrite = !ghost;
    },
    dispose() {
      bGeo.dispose();
      mat.dispose();
    },
  };
  model.setClosure(0);
  return model;
}
