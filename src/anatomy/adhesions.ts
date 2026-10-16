import * as THREE from 'three';
import { createTaperedTube } from './vessels';

/**
 * Arachnoid adhesions around the aneurysm neck.
 *
 * Before clipping, the neck has to be freed on both sides so the clip blades can
 * pass fully across it without catching the PCom, the AChA or perforators:
 *   proximal side - between the neck and the PCom origin / ICA wall
 *   distal side   - between the neck and the AChA
 * Each strand disappears as the dissection on its side progresses.
 */
export interface AdhesionStrand {
  mesh: THREE.Mesh;
  side: 'proximal' | 'distal';
  /** Dissection progress (0..1) at which this strand is released. */
  threshold: number;
}

export function createNeckAdhesions(
  neckCenter: THREE.Vector3,
  axis: THREE.Vector3,
  icaTangent: THREE.Vector3,
  anchors: { proximal: THREE.Vector3[]; distal: THREE.Vector3[] },
): AdhesionStrand[] {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf2ece4,
    roughness: 0.4,
    transparent: true,
    opacity: 0.75,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffffff),
  });
  const strands: AdhesionStrand[] = [];
  const side = new THREE.Vector3().crossVectors(axis, icaTangent).normalize();
  for (const s of ['proximal', 'distal'] as const) {
    const sign = s === 'distal' ? 1 : -1;
    const list = anchors[s];
    list.forEach((anchor, i) => {
      // Start on the neck wall, on the matching side of the ICA axis.
      const wobble = (i - (list.length - 1) / 2) * 0.9;
      const start = neckCenter
        .clone()
        .addScaledVector(axis, 3.0 + (i % 2) * 0.6)
        .addScaledVector(icaTangent, sign * 1.7)
        .addScaledVector(side, wobble);
      const mid = start.clone().lerp(anchor, 0.5).addScaledVector(axis, 0.4);
      const { geometry } = createTaperedTube([start, mid, anchor], 0.11, 0.07, 6);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.userData = { kind: 'adhesion', id: `${s}-${i}` };
      strands.push({ mesh, side: s, threshold: (i + 0.6) / (list.length + 0.2) });
    });
  }
  return strands;
}
