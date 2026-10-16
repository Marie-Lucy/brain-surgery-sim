import * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { events } from '../core/events';
import { state } from '../core/state';
import { globalUniforms } from '../core/uniforms';
import { flow } from '../physics/flow';
import type { Stage } from './stage';

/**
 * ICG videoangiography.
 *
 * Indocyanine green is injected intravenously and fluoresces in near-infrared
 * light. The microscope switches to its NIR camera, the tissue goes dark, and
 * vessels light up as the dye arrives:
 *   arterial phase  ICA → M1/A1 and PCom/AChA → M2 branches   (~1–2 s)
 *   venous phase    the sylvian veins, a few seconds later
 * After clipping: a dome that stays dark means it is excluded. A bright "dog
 * ear" at the base means a residual neck. A branch that never lights up is
 * occluded.
 */
const DELAYS: Record<string, number> = {
  ica: 0.6, m1: 1.0, a1: 1.05, pcom: 1.15, acha: 1.2, m2sup: 1.45, m2inf: 1.5, aneurysm: 1.4, ssv: 4.5,
};

export class IcgView {
  active = false;
  t = 0;
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private glow = new Map<string, THREE.MeshBasicMaterial>();
  private dark = new THREE.MeshBasicMaterial({ color: 0x141917 });
  private steel = new THREE.MeshBasicMaterial({ color: 0x020303 });
  /** Keeps only the part of the sac below the clip (the residual neck) in the glow pass. */
  private readonly neckPlane = new THREE.Plane();
  private overlay: HTMLDivElement;

  constructor(
    private readonly stage: Stage,
    private readonly anatomy: Anatomy,
    parent: HTMLElement,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'icg-overlay mono';
    this.overlay.style.display = 'none';
    parent.appendChild(this.overlay);
    events.on('clip:applied', () => (state.icgAfterClip = false));
    events.on('clip:removed', () => (state.icgAfterClip = false));
  }

  private glowMat(key: string): THREE.MeshBasicMaterial {
    let m = this.glow.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: 0x000000 });
      this.glow.set(key, m);
    }
    return m;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.t = 0;
    state.icgRuns++;
    if (state.clips.length) state.icgAfterClip = true;
    this.anatomy.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.originals.set(mesh, mesh.material);
      let owner: THREE.Object3D | null = o;
      while (owner && !owner.userData.kind) owner = owner.parent;
      const kind = owner?.userData.kind;
      if (kind === 'vessel') mesh.material = this.glowMat(owner!.userData.id);
      else if (kind === 'aneurysm') mesh.material = this.glowMat('aneurysm');
      else if (o.userData.clip) mesh.material = this.steel; // clips are dark silhouettes in NIR
      else mesh.material = this.dark;
    });
    this.stage.postfx.microscope.setMono(1);
    this.stage.postfx.bloom.intensity = 1.1;
    this.overlay.style.display = '';
    events.emit('icg:run', { index: state.icgRuns });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const [mesh, mat] of this.originals) mesh.material = mat;
    this.originals.clear();
    this.stage.postfx.microscope.setMono(0);
    this.stage.postfx.bloom.intensity = 0.55;
    this.overlay.style.display = 'none';
  }

  /** Dye intensity (0..1) of a territory at the current time. */
  private intensity(key: string, f: number): number {
    const d = DELAYS[key] ?? 1.2;
    const fill = THREE.MathUtils.smoothstep(this.t, d, d + 1.3);
    const wash = this.t > d + 9 ? Math.max(0.35, 1 - (this.t - d - 9) / 12) : 1;
    return f * fill * wash;
  }

  /**
   * Dye in the sac. Once a clip excludes the dome, only the part below the
   * blades can still fill: a residual neck that communicates with the ICA.
   */
  private sacFill(mat: THREE.MeshBasicMaterial): number {
    const r = state.clipResult;
    if (!r || r.neckClosure < 0.5) {
      mat.clippingPlanes = null;
      return flow.aneurysm;
    }
    const an = this.anatomy.aneurysm;
    this.neckPlane.normal.copy(an.axis).negate();
    this.neckPlane.constant = r.height + an.axis.dot(an.neckCenter);
    mat.clippingPlanes = [this.neckPlane];
    return r.residualNeck > 0.15 ? flow.ica * 0.9 : 0;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    const pulse = globalUniforms.uPulse.value;
    const flicker = 0.9 + 0.1 * pulse;
    const base = new THREE.Color(0.75, 1.0, 0.82);
    for (const [key, mat] of this.glow) {
      let f = 0;
      if (key === 'aneurysm') f = this.sacFill(mat);
      else if (key === 'ssv') f = 0.5 * Math.max(0.2, flow.m2sup);
      else f = flow[key as keyof typeof flow] ?? 0;
      const k = this.intensity(key, Math.min(1, f)) * flicker * 1.6;
      mat.color.copy(base).multiplyScalar(k);
    }
    const s = Math.floor(this.t);
    this.overlay.textContent = `ICG · NIR 800 nm   T+${String(s).padStart(2, '0')} s`;
  }
}
