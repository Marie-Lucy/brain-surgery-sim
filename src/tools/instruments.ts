import * as THREE from 'three';

/**
 * Procedural cursor models for the microsurgical instruments.
 *
 * Local frame for every instrument: the working tip sits at the origin and the
 * shaft runs along +Y toward the surgeon's hand. `setAction(t)` animates jaws or
 * tines (0 = open/rest, 1 = closed/active).
 */
export interface InstrumentModel {
  group: THREE.Group;
  setAction(t: number): void;
}

const steel = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });
const darkSteel = () =>
  new THREE.MeshPhysicalMaterial({ color: 0x6d7178, metalness: 1, roughness: 0.42, envMapIntensity: 1.0 });
const insulation = (color: number) =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 0.2, roughness: 0.35, clearcoat: 0.8 });

function cyl(r0: number, r1: number, len: number, mat: THREE.Material, seg = 16): THREE.Mesh {
  // Cylinder from y=0 (radius r0) to y=len (radius r1).
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function finish(group: THREE.Group): THREE.Group {
  group.traverse((o) => {
    o.userData.instrument = true;
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return group;
}

/** Suction tube: a fine Frazier-type cannula with an open tip. */
export function suction(): InstrumentModel {
  const g = new THREE.Group();
  const m = steel();
  g.add(cyl(0.75, 0.85, 22, m), cyl(0.85, 1.4, 70, m).translateY(22));
  const lumen = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  lumen.rotation.x = Math.PI / 2;
  lumen.position.y = -0.01;
  g.add(lumen);
  return { group: finish(g), setAction: () => {} };
}

/** Micro scissors: two short blades on a slim shaft. */
export function scissors(): InstrumentModel {
  const g = new THREE.Group();
  const m = steel();
  g.add(cyl(0.5, 0.7, 80, m).translateY(4.5));
  const blades: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.y = 4.5;
    const bg = new THREE.BoxGeometry(0.35, 4.5, 0.18);
    bg.translate(0, -2.25, 0);
    // Taper to a fine point.
    const p = bg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -4) p.setX(i, p.getX(i) * 0.25);
    bg.computeVertexNormals();
    const blade = new THREE.Mesh(bg, m);
    blade.position.x = s * 0.12;
    pivot.add(blade);
    pivot.userData.side = s;
    blades.push(pivot);
    g.add(pivot);
  }
  return {
    group: finish(g),
    setAction: (t) => blades.forEach((b) => (b.rotation.z = b.userData.side * (1 - t) * 0.22)),
  };
}

/** Bipolar forceps: two insulated tines with bare tips. */
export function bipolar(): InstrumentModel {
  const g = new THREE.Group();
  const tines: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const tine = new THREE.Group();
    tine.add(cyl(0.18, 0.3, 6, steel()));
    tine.add(cyl(0.3, 0.55, 70, insulation(0x2d4f8a)).translateY(6));
    tine.userData.side = s;
    tines.push(tine);
    g.add(tine);
  }
  return {
    group: finish(g),
    setAction: (t) =>
      tines.forEach((tn) => {
        const s = tn.userData.side as number;
        tn.position.x = s * (0.75 * (1 - t) + 0.12);
        tn.rotation.z = -s * 0.012 * (1 - t);
      }),
  };
}

/** Micro dissector: thin rod ending in a small blunt, angled tip. */
export function dissector(): InstrumentModel {
  const g = new THREE.Group();
  const m = steel();
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), m);
  g.add(tip);
  const neck = cyl(0.3, 0.38, 3.2, m);
  neck.rotation.z = 0.5;
  g.add(neck);
  const shaft = cyl(0.38, 0.75, 80, m);
  shaft.position.set(-1.5, 2.8, 0);
  g.add(shaft);
  return { group: finish(g), setAction: () => {} };
}

/** Brain spatula (small malleable blade). */
export function spatula(): InstrumentModel {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 0.35), steel());
  blade.position.y = 7;
  g.add(blade, cyl(0.6, 0.9, 60, darkSteel()).translateY(14));
  return { group: finish(g), setAction: () => {} };
}

/** Micro-Doppler probe: fine probe with a small rounded transducer tip. */
export function doppler(): InstrumentModel {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), steel()));
  g.add(cyl(0.5, 0.55, 18, steel()));
  g.add(cyl(0.55, 1.2, 70, insulation(0x2a2f36)).translateY(18));
  return { group: finish(g), setAction: () => {} };
}

/** Rigid endoscope (2.7 mm): rod with a glowing light-guide tip. */
export function endoscope(): InstrumentModel {
  const g = new THREE.Group();
  g.add(cyl(1.35, 1.35, 90, darkSteel(), 24));
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 24),
    new THREE.MeshBasicMaterial({ color: 0x2c3f4a }),
  );
  lens.rotation.x = Math.PI / 2;
  g.add(lens);
  return { group: finish(g), setAction: () => {} };
}

/** ICG has no physical instrument: a small reticle marks the cursor. */
export function reticle(): InstrumentModel {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.45, 32),
    new THREE.MeshBasicMaterial({ color: 0x5fe0c8, transparent: true, opacity: 0.8, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  g.add(ring);
  return { group: finish(g), setAction: () => {} };
}
