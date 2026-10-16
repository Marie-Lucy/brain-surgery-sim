import * as THREE from 'three';
import { playClick } from '../audio/sfx';
import { events, toast } from '../core/events';
import { state } from '../core/state';
import { createClip, type ClipModel } from './clipModel';
import { Tool, type Pick } from './types';

/**
 * Permanent aneurysm clip.
 *
 *   1. AIM     the open clip follows the cursor. Click to fix its position.
 *   2. ADJUST  Q/E rotate the blades around the line of sight; the mouse wheel
 *              advances or withdraws the blades (blade depth); C switches
 *              straight/curved. Esc returns to aiming.
 *   3. APPLY   click again to close the clip.
 *
 * Goal: blades parallel to the ICA, across the whole neck, without narrowing the
 * ICA and without catching the PCom or AChA. Evaluation comes in M5.
 * X removes the last clip.
 */
export class ClipTool extends Tool {
  readonly id = 'clip';
  readonly key = '6';
  type: 'straight' | 'curved' = 'straight';
  /** Blade length in mm: [ and ] cycle through the available sizes. */
  bladeLength = 7;
  static readonly LENGTHS = [5, 7, 9];
  private ghost: ClipModel;
  private mode: 'aim' | 'locked' = 'aim';
  private angle = 0;
  private depth = 0;
  private lock = { point: new THREE.Vector3(), forward: new THREE.Vector3(), right: new THREE.Vector3() };
  private readonly applied: ClipModel[] = [];
  private closing: { model: ClipModel; t: number }[] = [];
  /** Lets the UI show the current variant. */
  onTypeChange: (type: 'straight' | 'curved') => void = () => {};

  constructor() {
    super();
    this.ghost = this.makeGhost();
  }

  private makeGhost(): ClipModel {
    const g = createClip(this.type, this.bladeLength);
    g.setGhost(true);
    g.group.visible = false;
    return g;
  }

  override init(ctx: Parameters<Tool['init']>[0]): void {
    super.init(ctx);
    ctx.stage.scene.add(this.ghost.group);
  }

  override accepts(p: Pick): boolean {
    return p.kind === 'aneurysm';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }
  override showModel(): boolean {
    return false;
  }

  override activate(): void {
    this.mode = 'aim';
  }
  override deactivate(): void {
    this.ghost.group.visible = false;
    this.mode = 'aim';
  }

  setType(type: 'straight' | 'curved', length = this.bladeLength): void {
    if (type === this.type && length === this.bladeLength) return;
    this.type = type;
    this.bladeLength = length;
    const visible = this.ghost.group.visible;
    this.ghost.group.removeFromParent();
    this.ghost.dispose();
    this.ghost = this.makeGhost();
    this.ghost.group.visible = visible;
    this.ctx.stage.scene.add(this.ghost.group);
    this.onTypeChange(type);
  }

  /** Orient a clip: blade axis = camera right rotated by `angle` around the view axis. */
  private pose(model: ClipModel, point: THREE.Vector3, forward: THREE.Vector3, right: THREE.Vector3): void {
    const blade = right.clone().applyAxisAngle(forward, this.angle).normalize();
    const close = new THREE.Vector3().crossVectors(forward, blade).normalize();
    const width = new THREE.Vector3().crossVectors(blade, close).normalize();
    const m = new THREE.Matrix4().makeBasis(blade, close, width);
    model.group.quaternion.setFromRotationMatrix(m);
    model.group.position.copy(point).addScaledVector(blade, this.depth);
  }

  override update(dt: number, p: Pick | null): void {
    // Animate applied clips closing.
    if (this.closing.length) {
      this.closing = this.closing.filter((c) => {
        c.t = Math.min(1, c.t + dt / 0.22);
        c.model.setClosure(c.t);
        return c.t < 1;
      });
    }
    const cam = this.ctx.stage.camera;
    if (this.mode === 'aim') {
      this.ghost.group.visible = !!p;
      if (p) {
        const forward = cam.getWorldDirection(new THREE.Vector3());
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        this.pose(this.ghost, p.point, forward, right);
      }
    } else {
      this.ghost.group.visible = true;
      this.pose(this.ghost, this.lock.point, this.lock.forward, this.lock.right);
    }
  }

  override onPress(p: Pick | null): void {
    if (this.mode === 'aim') {
      if (!p) return;
      const cam = this.ctx.stage.camera;
      this.lock.point.copy(p.point);
      this.lock.forward.copy(cam.getWorldDirection(new THREE.Vector3()));
      this.lock.right.setFromMatrixColumn(cam.matrixWorld, 0);
      this.mode = 'locked';
      playClick(1300);
      toast('msg.clipLocked', 'info');
      return;
    }
    this.apply();
  }

  private apply(): void {
    if (this.applied.length >= 3) {
      toast('msg.clipMax', 'warn');
      return;
    }
    const clip = createClip(this.type, this.bladeLength);
    clip.group.position.copy(this.ghost.group.position);
    clip.group.quaternion.copy(this.ghost.group.quaternion);
    this.ctx.anatomy.implants.add(clip.group);
    this.applied.push(clip);
    this.closing.push({ model: clip, t: 0 });

    const q = clip.group.quaternion;
    state.clips.push({
      type: this.type,
      position: clip.group.position.toArray() as [number, number, number],
      bladeAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(q).toArray() as [number, number, number],
      closeAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray() as [number, number, number],
      bladeLength: this.bladeLength,
    });
    playClick(700);
    this.mode = 'aim';
    this.angle = 0;
    this.depth = 0;
    events.emit('clip:applied', { index: state.clips.length - 1 });
    toast('msg.clipApplied', 'info');
  }

  removeLast(): void {
    const clip = this.applied.pop();
    if (!clip) return;
    clip.group.removeFromParent();
    clip.dispose();
    state.clips.pop();
    events.emit('clip:removed', { index: state.clips.length });
    toast('msg.clipRemoved', 'info');
  }

  override onKey(e: KeyboardEvent): boolean {
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'e') {
      this.angle += (k === 'q' ? 1 : -1) * THREE.MathUtils.degToRad(e.shiftKey ? 2 : 10);
      return true;
    }
    if (k === 'c') {
      this.setType(this.type === 'straight' ? 'curved' : 'straight');
      return true;
    }
    if (k === '[' || k === ']') {
      const L = ClipTool.LENGTHS;
      const i = L.indexOf(this.bladeLength) + (k === ']' ? 1 : -1);
      this.setType(this.type, L[Math.max(0, Math.min(L.length - 1, i))]);
      return true;
    }
    if (k === 'x') {
      this.removeLast();
      return true;
    }
    if (k === 'escape' && this.mode === 'locked') {
      this.mode = 'aim';
      return true;
    }
    return false;
  }

  override onWheel(e: WheelEvent): boolean {
    this.depth = THREE.MathUtils.clamp(this.depth - Math.sign(e.deltaY) * 0.4, -4, 4);
    return true;
  }
}
