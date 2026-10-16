import * as THREE from 'three';
import { FISSURE } from '../config/anatomy';
import { state } from '../core/state';
import { spatula } from './instruments';
import { Tool, type Pick } from './types';
import { toastThrottled } from './util';

/**
 * Brain spatula: press on the frontal or temporal operculum and drag away from
 * the fissure to widen the corridor.
 * Rule: retraction can only follow the arachnoid you have already opened. Pulling
 * against intact arachnoid tears bridging veins and bruises the cortex.
 */
export class SpatulaTool extends Tool {
  readonly id = 'spatula';
  readonly key = '5';
  override model = spatula();
  private grab: { side: 'frontal' | 'temporal'; y: number } | null = null;

  override accepts(p: Pick): boolean {
    return p.kind === 'lobe';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }

  override onPress(p: Pick | null, e: PointerEvent): void {
    if (p?.kind !== 'lobe') return;
    this.grab = { side: p.id as 'frontal' | 'temporal', y: e.clientY };
    if (state.allowedHalfGap <= FISSURE.closedHalfGap + 0.01) toastThrottled('msg.spatulaClosed', 'warn');
  }

  override onDrag(_p: Pick | null, _mm: number, e: PointerEvent): void {
    if (!this.grab) return;
    const dy = e.clientY - this.grab.y;
    this.grab.y = e.clientY;
    // Frontal lobe is up on screen: dragging it upward opens the fissure.
    const sign = this.grab.side === 'frontal' ? -1 : 1;
    const anatomy = this.ctx.anatomy;
    const allowed = Math.max(FISSURE.closedHalfGap, state.allowedHalfGap);
    // Convert the pointer movement to millimetres at the working distance, so the
    // feel does not depend on the window size.
    const cam = this.ctx.stage.camera;
    const dist = cam.position.distanceTo(this.ctx.stage.controls.target);
    const mmPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / this.ctx.stage.renderer.domElement.clientHeight;
    const wanted = anatomy.halfGap + sign * dy * mmPerPx * 0.7;
    if (wanted > allowed + 0.15) {
      state.retractionStrain += 1 / 60;
      toastThrottled('msg.spatulaTethered', 'warn');
    }
    anatomy.setHalfGap(Math.min(wanted, allowed));
  }

  override onRelease(): void {
    this.grab = null;
  }
}
