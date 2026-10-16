import * as THREE from 'three';
import { MICROSCOPE } from '../config/anatomy';

/**
 * Operating-microscope style camera rig.
 *
 * The microscope pivots around a point in the surgical field (like the
 * mouth-switch or handle on a real scope):
 *   - tilt:  orbit within a cone around the vertical axis (max MICROSCOPE.maxTilt)
 *   - pan:   slide the optical axis across the field
 *   - zoom:  change working distance / magnification
 * All motion is damped so the view never jumps.
 */
export class MicroscopeControls {
  readonly target = new THREE.Vector3(...MICROSCOPE.target);
  private readonly home = new THREE.Vector3(...MICROSCOPE.target);
  private distance = MICROSCOPE.distance;
  private tilt = THREE.MathUtils.degToRad(8); // polar angle from +z
  private azimuth = THREE.MathUtils.degToRad(-90); // tilt toward the temporal side by default

  private goal = { target: this.target.clone(), distance: this.distance, tilt: this.tilt, azimuth: this.azimuth };
  private drag: { mode: 'rotate' | 'pan'; x: number; y: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  /** Return true when a plain left-drag should move the scope (no tool active). */
  allowLeftDrag: () => boolean = () => true;
  /** Return true to consume a wheel event (e.g. a clip tool adjusting blade depth). */
  interceptWheel: (e: WheelEvent) => boolean = () => false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
  ) {
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    this.apply();
  }

  /** Approximate optical magnification shown on the HUD. */
  get magnification(): number {
    return 900 / this.distance;
  }

  /** Smoothly frame a point of the field at a given working distance (used by demo mode). */
  frame(target: THREE.Vector3, distance: number, tiltDeg = 8): void {
    this.goal.target.copy(target);
    this.goal.distance = THREE.MathUtils.clamp(distance, MICROSCOPE.minDistance, MICROSCOPE.maxDistance);
    this.goal.tilt = THREE.MathUtils.degToRad(tiltDeg);
    this.goal.azimuth = THREE.MathUtils.degToRad(-90);
  }

  reset(): void {
    this.goal.target.copy(this.home);
    this.goal.distance = MICROSCOPE.distance;
    this.goal.tilt = THREE.MathUtils.degToRad(8);
    this.goal.azimuth = THREE.MathUtils.degToRad(-90);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.target.lerp(this.goal.target, k);
    this.distance += (this.goal.distance - this.distance) * k;
    this.tilt += (this.goal.tilt - this.tilt) * k;
    let dAz = this.goal.azimuth - this.azimuth;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    this.azimuth += dAz * k;
    this.apply();
  }

  private apply(): void {
    const s = Math.sin(this.tilt);
    this.camera.position.set(
      this.target.x + this.distance * s * Math.cos(this.azimuth),
      this.target.y + this.distance * s * Math.sin(this.azimuth),
      this.target.z + this.distance * Math.cos(this.tilt),
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
  }

  private rotateBy(dx: number, dy: number): void {
    // Convert the drag into a 2D offset of the tilt vector (x/y on the "tilt disc").
    const maxTilt = THREE.MathUtils.degToRad(MICROSCOPE.maxTilt);
    let tx = this.goal.tilt * Math.cos(this.goal.azimuth);
    let ty = this.goal.tilt * Math.sin(this.goal.azimuth);
    tx -= dx * 0.004;
    ty += dy * 0.004;
    let len = Math.hypot(tx, ty);
    if (len > maxTilt) {
      tx *= maxTilt / len;
      ty *= maxTilt / len;
      len = maxTilt;
    }
    this.goal.tilt = len;
    if (len > 1e-4) this.goal.azimuth = Math.atan2(ty, tx);
  }

  private panBy(dx: number, dy: number): void {
    const scale = (this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 2) / this.dom.clientHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.goal.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    // Keep the field of view on the surgical corridor.
    const off = this.goal.target.clone().sub(this.home);
    off.z = THREE.MathUtils.clamp(off.z, -12, 12);
    const xy = Math.hypot(off.x, off.y);
    if (xy > 32) {
      off.x *= 32 / xy;
      off.y *= 32 / xy;
    }
    this.goal.target.copy(this.home).add(off);
  }

  private zoomBy(factor: number): void {
    this.goal.distance = THREE.MathUtils.clamp(this.goal.distance * factor, MICROSCOPE.minDistance, MICROSCOPE.maxDistance);
  }

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.drag = { mode: 'pan', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }
    let mode: 'rotate' | 'pan' | null = null;
    if (e.button === 1 || (e.button === 2 && e.shiftKey) || (e.button === 0 && e.shiftKey && this.allowLeftDrag())) mode = 'pan';
    else if (e.button === 2 || (e.button === 0 && this.allowLeftDrag())) mode = 'rotate';
    if (mode) {
      this.drag = { mode, x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!this.drag) return;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.zoomBy(this.pinchDist / d);
      this.pinchDist = d;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      this.panBy(cx - this.drag.x, cy - this.drag.y);
      this.drag.x = cx;
      this.drag.y = cy;
      return;
    }
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    if (this.drag.mode === 'rotate') this.rotateBy(dx, dy);
    else this.panBy(dx, dy);
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) this.drag = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!e.shiftKey && this.interceptWheel(e)) return;
    this.zoomBy(Math.exp(e.deltaY * 0.0012));
  };

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const step = 18;
    switch (e.key) {
      case 'ArrowLeft': this.rotateBy(-step, 0); break;
      case 'ArrowRight': this.rotateBy(step, 0); break;
      case 'ArrowUp': this.rotateBy(0, -step); break;
      case 'ArrowDown': this.rotateBy(0, step); break;
      case '+': case '=': this.zoomBy(0.88); break;
      case '-': case '_': this.zoomBy(1.14); break;
      default: return;
    }
    e.preventDefault();
  };
}
