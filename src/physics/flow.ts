import type { Anatomy } from '../anatomy';
import type { VesselId } from '../config/anatomy';
import { events } from '../core/events';
import { state } from '../core/state';

/**
 * Very small "network" flow model.
 *
 * Each vessel gets a relative flow from 0 to 1 (1 = normal for that vessel).
 * Drives the Doppler, and later the ICG and the MEP.
 *
 * Collateral teaching points:
 *   - A temporary clip on the proximal ICA does not stop everything. The A1
 *     fills across the anterior communicating artery and the PCom fills
 *     backwards from the posterior circulation, so distal stumps keep some flow.
 *   - The aneurysm sac still fills unless the clip excludes the neck.
 */
export type FlowMap = Record<VesselId | 'aneurysm', number>;

export const flow: FlowMap = {
  ica: 1, m1: 1, m2sup: 1, m2inf: 1, a1: 1, pcom: 1, acha: 1, ssv: 0.6, aneurysm: 1,
};

/** Occlusions imposed by clips (filled by the clip evaluator in M5). */
export const clipOcclusion: Partial<Record<VesselId | 'aneurysm', number>> = {};

export function recomputeFlow(anatomy: Anatomy): void {
  const ica = state.tempClip.on ? 0.06 : 1;
  const occ = (id: VesselId | 'aneurysm') => 1 - (clipOcclusion[id] ?? 0);

  flow.ica = ica * occ('ica');
  flow.m1 = Math.max(0.12, flow.ica) * occ('m1');
  flow.m2sup = flow.m1 * occ('m2sup');
  flow.m2inf = flow.m1 * occ('m2inf');
  flow.a1 = Math.max(0.55, flow.ica) * occ('a1'); // cross-flow via ACom
  flow.pcom = Math.max(0.45, flow.ica) * occ('pcom'); // retrograde from the PCA
  flow.acha = flow.ica * occ('acha');
  flow.aneurysm = Math.max(flow.ica, state.tempClip.on ? 0.15 : 0) * occ('aneurysm');
  flow.ssv = 0.6;

  for (const [id, v] of anatomy.vessels) v.flow = flow[id];
  events.emit('flow:changed', {});
}
