import * as THREE from 'three';
import { closestT } from '../anatomy/raycastProxy';
import { playClick } from '../audio/sfx';
import { events, toast } from '../core/events';
import { state } from '../core/state';
import { recomputeFlow } from '../physics/flow';
import { createClip, type ClipModel } from './clipModel';
import { Tool, type Pick } from './types';

/**
 * Temporary clip on the proximal ICA (proximal control).
 *
 * It lowers the pressure in the aneurysm, which softens the dome for final
 * dissection and slows bleeding after a rupture. Every minute counts: the
 * occlusion timer starts when it is applied (M4), and long occlusion threatens
 * the territory downstream.
 * Rule: place it on the ICA PROXIMAL to the PCom and aneurysm. Click again to remove.
 */
export class TempClipTool extends Tool {
  readonly id = 'tempclip';
  readonly key = '0';
  private ghost: ClipModel;
  private placed: ClipModel | null = null;
  private anim: { t: number; dir: 1 | -1 } | null = null;
  /** Maximum ICA curve parameter that is still proximal to the PCom origin. */
  private readonly maxT = 0.33;

  constructor() {
    super();
    this.ghost = createClip('straight', 5.5, true);
    this.ghost.setGhost(true);
    this.ghost.group.visible = false;
  }

  override init(ctx: Parameters<Tool['init']>[0]): void {
    super.init(ctx);
    ctx.stage.scene.add(this.ghost.group);
  }

  override accepts(p: Pick): boolean {
    return p.kind === 'vessel' && p.id === 'ica';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }
  override showModel(): boolean {
    return false;
  }
  override deactivate(): void {
    this.ghost.group.visible = false;
  }

  /** Pose a clip across the ICA at curve parameter t. */
  private pose(model: ClipModel, t: number): void {
    const curve = this.ctx.anatomy.vessels.get('ica')!.curve;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const forward = this.ctx.stage.camera.getWorldDirection(new THREE.Vector3());
    const blade = new THREE.Vector3().crossVectors(tangent, forward).normalize();
    const close = tangent.clone().sub(blade.clone().multiplyScalar(tangent.dot(blade))).normalize();
    const width = new THREE.Vector3().crossVectors(blade, close);
    model.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(blade, close, width));
    model.group.position.copy(center);
  }

  override update(dt: number, p: Pick | null): void {
    if (this.anim && this.placed) {
      this.anim.t = Math.min(1, this.anim.t + dt / 0.25);
      this.placed.setClosure(this.anim.dir > 0 ? this.anim.t : 1 - this.anim.t);
      if (this.anim.t >= 1) {
        if (this.anim.dir < 0) {
          this.placed.group.removeFromParent();
          this.placed.dispose();
          this.placed = null;
        }
        this.anim = null;
      }
    }
    const onIca = !!p && this.accepts(p) && !state.tempClip.on;
    this.ghost.group.visible = onIca;
    if (onIca && p) {
      const t = Math.min(this.maxT, closestT(this.ctx.anatomy.vessels.get('ica')!.curve, p.point));
      this.pose(this.ghost, t);
    }
  }

  override onPress(p: Pick | null): void {
    if (state.tempClip.on) {
      this.remove();
      return;
    }
    if (!p || !this.accepts(p)) {
      toast('msg.tempOnlyIca', 'info');
      return;
    }
    const t = closestT(this.ctx.anatomy.vessels.get('ica')!.curve, p.point);
    if (t > this.maxT + 0.05) {
      toast('msg.tempTooDistal', 'warn');
      return;
    }
    const clip = createClip('straight', 5.5, true);
    this.pose(clip, Math.min(t, this.maxT));
    this.ctx.anatomy.implants.add(clip.group);
    this.placed = clip;
    this.anim = { t: 0, dir: 1 };
    state.tempClip.on = true;
    state.tempClip.t = Math.min(t, this.maxT);
    recomputeFlow(this.ctx.anatomy);
    playClick(800);
    events.emit('tempclip:changed', { on: true });
    toast('msg.tempOn', 'warn');
  }

  remove(): void {
    if (!state.tempClip.on || !this.placed) return;
    state.tempClip.on = false;
    this.anim = { t: 0, dir: -1 };
    recomputeFlow(this.ctx.anatomy);
    playClick(1000);
    events.emit('tempclip:changed', { on: false });
    toast('msg.tempOff', 'info');
  }
}
