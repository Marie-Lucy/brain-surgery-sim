import type * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { FISSURE } from '../config/anatomy';
import { events, toast } from '../core/events';
import { state } from '../core/state';

/** Shared rules used by several instruments. */

export function onArachnoidOpened(anatomy: Anatomy, id: string): void {
  state.arachnoidCut.add(id);
  const freedom = anatomy.fissureFreedom(state.arachnoidCut);
  state.allowedHalfGap = FISSURE.closedHalfGap + (FISSURE.openHalfGap - FISSURE.closedHalfGap) * freedom;
  events.emit('arachnoid:cut', { id });
  if (id === 'cc1') toast('msg.csfRelease', 'info');
}

export type NeckZone = { zone: 'neck' | 'dome' | 'bleb'; side: 'proximal' | 'distal' };

/** Classify a point on the aneurysm: neck (and which side of it) vs dome vs bleb. */
export function neckZone(anatomy: Anatomy, point: THREE.Vector3, id: string): NeckZone {
  const a = anatomy.aneurysm;
  const rel = point.clone().sub(a.neckCenter);
  const s = rel.dot(a.axis);
  const side = rel.dot(anatomy.icaTangentAtNeck) > 0 ? 'distal' : 'proximal';
  if (id === 'bleb') return { zone: 'bleb', side };
  return { zone: s < 2.25 + 1.7 ? 'neck' : 'dome', side };
}

export function advanceNeck(anatomy: Anatomy, side: 'proximal' | 'distal', amount: number): void {
  const before = state.neckDissection[side];
  if (before >= 1) return;
  const after = Math.min(1, before + amount);
  state.neckDissection[side] = after;
  anatomy.setNeckDissection(state.neckDissection);
  events.emit('neck:dissect', { side, progress: after });
  if (after >= 1) toast(side === 'proximal' ? 'msg.neckFreeProx' : 'msg.neckFreeDist', 'info');
}
