import * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { ANEURYSM, type VesselId } from '../config/anatomy';
import { events } from '../core/events';
import { state, type ClipRecord } from '../core/state';
import { clipOcclusion, recomputeFlow } from '../physics/flow';

/**
 * Clip evaluation.
 *
 * A closed clip is modelled as its blade line: a short polyline along the
 * blade axis (curved blades bow toward the width axis). The two blades meet in
 * the "pinch plane", which contains the blade axis and the blade width; the
 * closing axis is its normal.
 *
 * What makes a good IC-PC clip:
 *  1. HEIGHT. The blades sit at the base of the sac, just off the ICA wall. Too
 *     high leaves a residual neck (a "dog ear" that can regrow). Too low bites
 *     into the ICA and narrows it.
 *  2. ORIENTATION. The blade axis runs across the neck, roughly perpendicular
 *     to the aneurysm's axis, which is usually close to parallel with the ICA.
 *  3. LENGTH. When the neck is flattened its width is about π × its radius. The
 *     blades must cover all of it, with the tips beyond the far side.
 *  4. BRANCHES. The PCom and AChA must lie outside the blades.
 *  5. DISSECTION. A neck that was not freed keeps the tips from passing fully
 *     across.
 */
export interface ClipResult {
  /** 0..1 fraction of the aneurysm excluded from the circulation. */
  neckClosure: number;
  /** 0..1 amount of neck left below the blades. */
  residualNeck: number;
  /** 0..1 narrowing of the ICA lumen. */
  icaStenosis: number;
  pcomOcclusion: number;
  achaOcclusion: number;
  /** Clip seated on the dome rather than the neck. */
  onDome: boolean;
  /** Height of the (most effective) clip above the neck centre, along the sac axis (mm). */
  height: number;
  verdict: 'none' | 'complete' | 'residual' | 'incomplete' | 'stenosis' | 'branch';
}

export const emptyResult = (): ClipResult => ({
  neckClosure: 0, residualNeck: 0, icaStenosis: 0, pcomOcclusion: 0, achaOcclusion: 0, onDome: false, height: 0, verdict: 'none',
});

const ICA_R = 2.25;
const BLADE_HALF_WIDTH = 1.25; // squeezed tissue tolerance around the blade plane (mm)

/** Radius of the sac's surface of revolution at height s along its axis (mirrors aneurysm.ts). */
function sacRadius(s: number): number {
  const R = ANEURYSM.domeDiameter / 2, neckR = ANEURYSM.neckDiameter / 2, c = ANEURYSM.domeOffset;
  const dome = Math.sqrt(Math.max(0, R * R - (s - c) * (s - c)));
  return Math.max(s < c ? neckR : 0, dome);
}

/** Sampled blade line in world space. */
function bladeLine(c: ClipRecord, n = 12): THREE.Vector3[] {
  const p = new THREE.Vector3(...c.position);
  const a = new THREE.Vector3(...c.bladeAxis).normalize();
  const close = new THREE.Vector3(...c.closeAxis).normalize();
  const w = new THREE.Vector3().crossVectors(a, close).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n; // 0 = heel, 1 = tip
    const x = -c.bladeLength / 2 + u * c.bladeLength;
    const bow = c.type === 'curved' ? 2.2 * u * u : 0;
    pts.push(p.clone().addScaledVector(a, x).addScaledVector(w, bow));
  }
  return pts;
}

function segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

function polyDist(p: THREE.Vector3, line: THREE.Vector3[]): number {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(p, line[i], line[i + 1]));
  return d;
}

/** How much a vessel is caught between the blades (0..1). */
function vesselCapture(anatomy: Anatomy, id: VesselId, line: THREE.Vector3[], skipStart = 0): number {
  const v = anatomy.vessels.get(id)!;
  const r = v.cfg.radius;
  let worst = 0;
  for (let i = 0; i <= 60; i++) {
    const t = skipStart + (1 - skipStart) * (i / 60);
    const d = polyDist(v.curve.getPointAt(t), line);
    worst = Math.max(worst, THREE.MathUtils.clamp(((r + 0.35 - d) / (r + 0.35)) * 2, 0, 1));
  }
  return worst;
}

export function evaluateClip(anatomy: Anatomy, c: ClipRecord): ClipResult {
  const res = emptyResult();
  const an = anatomy.aneurysm;
  const p = new THREE.Vector3(...c.position);
  const a = new THREE.Vector3(...c.bladeAxis).normalize();
  const close = new THREE.Vector3(...c.closeAxis).normalize();
  const line = bladeLine(c);

  // 1. Height of the blades along the aneurysm axis.
  const h = p.clone().sub(an.neckCenter).dot(an.axis);
  const r = sacRadius(h);
  res.onDome = h > ICA_R + 1.6;
  res.height = h;

  // 2. Orientation: the blade must run across the sac.
  const tilt = Math.abs(a.dot(an.axis));
  const orient = tilt < 0.55 ? 1 : THREE.MathUtils.clamp(1 - (tilt - 0.55) / 0.3, 0, 1);

  // 3. Coverage of the flattened neck. Its chord in the pinch plane, widened to
  //    the flattened width (π·r ≈ 1.57 × diameter), must lie inside the blades.
  const center = an.neckCenter.clone().addScaledVector(an.axis, h);
  const dPlane = Math.abs(center.clone().sub(p).dot(close));
  let coverage = 0;
  if (dPlane < r * 0.95 && h > ICA_R - 1.2) {
    // Chord direction: inside the pinch plane and perpendicular to the sac axis.
    const chordDir = new THREE.Vector3().crossVectors(close, an.axis);
    if (chordDir.lengthSq() < 1e-6) chordDir.copy(a);
    chordDir.normalize();
    const chordCenter = center.clone().addScaledVector(close, -center.clone().sub(p).dot(close));
    const half = Math.sqrt(Math.max(0, r * r - dPlane * dPlane)) * (Math.PI / 2);
    const N = 21;
    let inside = 0;
    for (let i = 0; i < N; i++) {
      const q = chordCenter.clone().addScaledVector(chordDir, -half + (2 * half * i) / (N - 1));
      if (polyDist(q, line) <= BLADE_HALF_WIDTH) inside++;
    }
    coverage = inside / N;
  }
  const dissection = (state.neckDissection.proximal + state.neckDissection.distal) / 2;
  res.neckClosure = THREE.MathUtils.clamp(coverage * orient * (0.7 + 0.3 * dissection), 0, 1);

  // Residual neck: sac tissue left between the ICA wall and the blades.
  res.residualNeck = res.neckClosure > 0.2 ? THREE.MathUtils.clamp((h - (ICA_R + 0.7)) / 1.6, 0, 1) : 0;

  // 4. ICA narrowing: blades too low, or crossing the ICA lumen anywhere.
  let sten = THREE.MathUtils.clamp((ICA_R + 0.15 - h) / 1.6, 0, 1) * (res.neckClosure > 0 || h < ICA_R ? 1 : 0);
  const ica = anatomy.vessels.get('ica')!;
  for (let i = 0; i <= 80; i++) {
    const d = polyDist(ica.curve.getPointAt(i / 80), line);
    sten = Math.max(sten, THREE.MathUtils.clamp((ICA_R * 0.85 - d) / (ICA_R * 0.85), 0, 1));
  }
  res.icaStenosis = sten;

  // 5. Branches caught in the blades (skip the origin hidden inside the ICA).
  res.pcomOcclusion = vesselCapture(anatomy, 'pcom', line, 0.12);
  res.achaOcclusion = vesselCapture(anatomy, 'acha', line, 0.12);
  return res;
}

/** Combine every clip in place: occlusions add up, the sac is excluded if any clip excludes it. */
export function evaluateAll(anatomy: Anatomy): ClipResult {
  if (!state.clips.length) return emptyResult();
  const all = state.clips.map((c) => evaluateClip(anatomy, c));
  const res = emptyResult();
  res.neckClosure = 1 - all.reduce((acc, r) => acc * (1 - r.neckClosure), 1);
  // Residual neck is set by the lowest effective clip.
  const effective = all.filter((r) => r.neckClosure > 0.5);
  res.residualNeck = effective.length ? Math.min(...effective.map((r) => r.residualNeck)) : 0;
  res.height = (effective.length ? effective : all).reduce((m, r) => Math.min(m, r.height), Infinity);
  res.icaStenosis = Math.max(...all.map((r) => r.icaStenosis));
  res.pcomOcclusion = Math.max(...all.map((r) => r.pcomOcclusion));
  res.achaOcclusion = Math.max(...all.map((r) => r.achaOcclusion));
  res.onDome = all.every((r) => r.onDome);
  res.verdict =
    res.pcomOcclusion > 0.5 || res.achaOcclusion > 0.5
      ? 'branch'
      : res.icaStenosis > 0.35
        ? 'stenosis'
        : res.neckClosure < 0.9
          ? 'incomplete'
          : res.residualNeck > 0.3
            ? 'residual'
            : 'complete';
  return res;
}

/** Re-evaluate after any clip change and push the result into the flow model. */
export class ClipEvaluator {
  result: ClipResult = emptyResult();

  constructor(private readonly anatomy: Anatomy) {
    events.on('clip:applied', () => this.refresh());
    events.on('clip:removed', () => this.refresh());
    events.on('neck:dissect', () => state.clips.length && this.refresh());
  }

  refresh(): void {
    this.result = evaluateAll(this.anatomy);
    state.clipResult = this.result;
    const r = this.result;
    // A residual neck still fills on ICG but the dome itself is excluded.
    clipOcclusion.aneurysm = r.neckClosure;
    clipOcclusion.ica = r.icaStenosis > 0.5 ? (r.icaStenosis - 0.5) * 1.6 : 0;
    clipOcclusion.pcom = r.pcomOcclusion;
    clipOcclusion.acha = r.achaOcclusion;
    recomputeFlow(this.anatomy);
    if (state.rupture.active && r.neckClosure >= 0.85) events.emit('rupture:sealed', {});
  }
}
