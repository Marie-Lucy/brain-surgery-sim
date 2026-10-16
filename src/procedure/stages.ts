import type { Anatomy } from '../anatomy';
import { FISSURE } from '../config/anatomy';
import { state } from '../core/state';
import { flow } from '../physics/flow';

/**
 * The six stages of the operation and their goals.
 *
 * Each sub-task is a pure check on the shared simulation state, so the stage
 * manager can poll it and demo mode (M6) can drive the same goals.
 */
export interface SubTask {
  id: string;
  /** i18n key of the label. */
  key: string;
  check: (a: Anatomy) => boolean;
  /** Optional progress counter shown next to the label, e.g. 2/4. */
  count?: (a: Anatomy) => [number, number];
  /** Optional tasks are suggested but not required to finish the stage. */
  optional?: boolean;
  /** When true the check was attempted but the result is wrong; shows `failKey`. */
  fail?: (a: Anatomy) => boolean;
  failKey?: string;
}

export interface StageDef {
  id: string;
  /** i18n keys: `stage.<id>.title`, `stage.<id>.instr`. */
  tasks: SubTask[];
}

const cut = (...ids: string[]) => ids.filter((id) => state.arachnoidCut.has(id)).length;
const touched = (id: string, tool?: string) => state.touched.has(tool ? `${tool}:${id}` : id);
const afterClip = (id: string) => state.touchedAfterClip.has(`doppler:${id}`);

export const STAGES: StageDef[] = [
  {
    id: 'fissure',
    tasks: [
      {
        id: 'superficial',
        key: 'task.superficial',
        check: () => cut('sf1', 'sf2', 'sf3', 'sf4') === 4,
        count: () => [cut('sf1', 'sf2', 'sf3', 'sf4'), 4],
      },
      { id: 'deep', key: 'task.deepBands', check: () => cut('ds1', 'ds2') === 2, count: () => [cut('ds1', 'ds2'), 2] },
      {
        id: 'retract',
        key: 'task.retract',
        check: (a) => a.halfGap >= FISSURE.openHalfGap * 0.7,
      },
    ],
  },
  {
    id: 'm1',
    tasks: [
      { id: 'touchM1', key: 'task.touchM1', check: () => touched('m1') },
      { id: 'dopplerM1', key: 'task.dopplerM1', check: () => touched('m1', 'doppler') },
    ],
  },
  {
    id: 'ica',
    tasks: [
      { id: 'carotidCistern', key: 'task.carotidCistern', check: () => cut('cc1') === 1 },
      { id: 'touchIca', key: 'task.touchIca', check: () => touched('ica') },
      { id: 'ocMembrane', key: 'task.ocMembrane', check: () => cut('oc1') === 1 },
      { id: 'touchOptic', key: 'task.touchOptic', check: () => touched('optic') },
    ],
  },
  {
    id: 'neck',
    tasks: [
      { id: 'neckArachnoid', key: 'task.neckArachnoid', check: () => cut('nk1') === 1 },
      { id: 'pcom', key: 'task.pcom', check: () => touched('pcom') },
      { id: 'acha', key: 'task.acha', check: () => touched('acha') },
      {
        id: 'proxNeck',
        key: 'task.proxNeck',
        check: () => state.neckDissection.proximal >= 1,
        count: () => [Math.round(state.neckDissection.proximal * 100), 100],
      },
      {
        id: 'distNeck',
        key: 'task.distNeck',
        check: () => state.neckDissection.distal >= 1,
        count: () => [Math.round(state.neckDissection.distal * 100), 100],
      },
      { id: 'tempOptional', key: 'task.tempOptional', check: () => state.tempClip.on || state.clips.length > 0, optional: true },
    ],
  },
  {
    id: 'clip',
    tasks: [
      { id: 'applyClip', key: 'task.applyClip', check: () => state.clips.length > 0 },
      { id: 'tempRemoved', key: 'task.tempRemoved', check: () => state.clips.length > 0 && !state.tempClip.on },
    ],
  },
  {
    id: 'patency',
    tasks: [
      { id: 'icg', key: 'task.icgAfterClip', check: () => state.icgAfterClip },
      {
        id: 'dopplerPcom',
        key: 'task.dopplerPcom',
        check: () => afterClip('pcom') && flow.pcom > 0.3,
        fail: () => afterClip('pcom') && flow.pcom <= 0.3,
        failKey: 'fail.pcom',
      },
      {
        id: 'dopplerAcha',
        key: 'task.dopplerAcha',
        check: () => afterClip('acha') && flow.acha > 0.3,
        fail: () => afterClip('acha') && flow.acha <= 0.3,
        failKey: 'fail.acha',
      },
      {
        id: 'dopplerDome',
        key: 'task.dopplerDome',
        check: () => (afterClip('aneurysm') || afterClip('dome')) && flow.aneurysm < 0.1,
        fail: () => (afterClip('aneurysm') || afterClip('dome')) && flow.aneurysm >= 0.1,
        failKey: 'fail.dome',
      },
      {
        id: 'icaPatent',
        key: 'task.icaPatent',
        check: () => afterClip('ica') && flow.ica > 0.6,
        fail: () => afterClip('ica') && flow.ica <= 0.6 && !state.tempClip.on,
        failKey: 'fail.ica',
      },
      { id: 'endo', key: 'task.endoOptional', check: () => state.endoscopeUsed, optional: true },
    ],
  },
];
