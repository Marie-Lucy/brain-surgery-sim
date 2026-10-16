import * as THREE from 'three';
import { SPATULAS } from '../config/anatomy';
import { createSteelMaterial } from './materials';

/**
 * Self-retaining brain spatulas: thin, malleable steel blades that gently hold the
 * frontal and temporal opercula apart once the arachnoid has been opened.
 * Retraction pressure should be minimal. Most of the opening comes from sharp
 * arachnoid dissection and CSF release, not from force.
 */
export function createSpatula(side: 'frontal' | 'temporal'): THREE.Mesh {
  const s = side === 'frontal' ? 1 : -1;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, SPATULAS.tipDepth),
    new THREE.Vector3(0, 0, -3),
    new THREE.Vector3(0, 4 * s, 2.5),
    new THREE.Vector3(0, 14 * s, 9),
    new THREE.Vector3(0, SPATULAS.length * 0.85 * s, 28),
  ]);
  const hw = SPATULAS.width / 2, ht = SPATULAS.thickness / 2;
  // Blade cross-section; the rounded corners avoid razor-sharp highlights.
  const shape = new THREE.Shape();
  shape.moveTo(-ht, -hw + ht);
  shape.lineTo(-ht, hw - ht);
  shape.quadraticCurveTo(-ht, hw, 0, hw);
  shape.quadraticCurveTo(ht, hw, ht, hw - ht);
  shape.lineTo(ht, -hw + ht);
  shape.quadraticCurveTo(ht, -hw, 0, -hw);
  shape.quadraticCurveTo(-ht, -hw, -ht, -hw + ht);
  const geo = new THREE.ExtrudeGeometry(shape, { steps: 80, bevelEnabled: false, extrudePath: path });
  const mesh = new THREE.Mesh(geo, createSteelMaterial());
  mesh.name = `spatula-${side}`;
  mesh.userData = { kind: 'spatula', id: side };
  mesh.castShadow = true;
  return mesh;
}
