import * as THREE from 'three';

/**
 * Lets a dense render mesh be ray-picked against a lighter stand-in geometry.
 * The cortex meshes have ~70k triangles each, and testing them every frame
 * would stall the tools. The proxy uses the same shape at lower resolution.
 */
export function useRaycastProxy(mesh: THREE.Mesh, proxyGeometry: THREE.BufferGeometry): void {
  proxyGeometry.computeBoundingSphere();
  proxyGeometry.computeBoundingBox();
  const proxy = new THREE.Mesh(proxyGeometry, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
  mesh.raycast = (raycaster, intersects) => {
    proxy.matrixWorld.copy(mesh.matrixWorld);
    const hits: THREE.Intersection[] = [];
    THREE.Mesh.prototype.raycast.call(proxy, raycaster, hits);
    for (const h of hits) {
      h.object = mesh;
      intersects.push(h);
    }
  };
}

/** Closest parameter t (0..1) on a curve to a point, by dense sampling. */
export function closestT(curve: THREE.Curve<THREE.Vector3>, p: THREE.Vector3, samples = 200): number {
  let best = 0, bestD = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    curve.getPointAt(t, v);
    const d = v.distanceToSquared(p);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
