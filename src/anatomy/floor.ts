import * as THREE from 'three';
import { FLOOR } from '../config/anatomy';
import { createTissueMaterial } from './materials';
import { fbm3 } from './noise';
import { useRaycastProxy } from './raycastProxy';

/**
 * Deep background: the floor of the basal cisterns, with the tentorial edge and
 * skull-base dura beyond. It sits in shadow and is only seen through the
 * opened fissure.
 */
function floorGeometry(seg: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(FLOOR.size, FLOOR.size, seg, seg);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    // Rises laterally and toward the frontal side (sphenoid ridge / orbital roof).
    const slope = 0.08 * x + 0.06 * Math.max(0, y);
    pos.setZ(i, slope + fbm3(x * 0.06, y * 0.06, 0.5, 3) * 4);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createFloor(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    floorGeometry(90),
    createTissueMaterial({
      color: FLOOR.color,
      pattern: 'floor',
      roughness: 0.6,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      sheen: 0.2,
      envMapIntensity: 0.08,
    }),
  );
  mesh.position.z = FLOOR.z;
  mesh.name = 'deep-floor';
  mesh.userData = { kind: 'floor', id: 'floor' };
  mesh.receiveShadow = true;
  useRaycastProxy(mesh, floorGeometry(36));
  return mesh;
}
