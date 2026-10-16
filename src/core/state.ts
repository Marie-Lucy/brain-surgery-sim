import { events } from './events';

/**
 * In-memory simulation state shared by tools, physics, procedure and UI.
 * Nothing is persisted: reloading the page starts a fresh case.
 */
export interface ClipRecord {
  type: 'straight' | 'curved';
  /** World position of the blade midpoint, blade axis and closing axis. */
  position: [number, number, number];
  bladeAxis: [number, number, number];
  closeAxis: [number, number, number];
  bladeLength: number;
}

export const state = {
  /** Arachnoid segments that have been opened. */
  arachnoidCut: new Set<string>(),
  /** 0..1 freedom of the neck on each side (adhesions released). */
  neckDissection: { proximal: 0, distal: 0 },
  /**
   * Hidden rupture risk, 0..1. Rough handling of the dome, especially the bleb,
   * raises it. M4 turns it into an intraoperative rupture.
   */
  ruptureRisk: 0,
  /** Maximal fissure half-gap allowed by the arachnoid already opened. */
  allowedHalfGap: 0,
  /** Seconds spent retracting against tethering arachnoid (debrief stat). */
  retractionStrain: 0,
  clips: [] as ClipRecord[],
  tempClip: { on: false, t: 0 },
  /** Structures confirmed by touch or Doppler (stage goals): "<id>" and "<tool>:<id>". */
  touched: new Set<string>(),
  /** Same, but only touches made after the most recent clip was applied. */
  touchedAfterClip: new Set<string>(),
  /** Index of the active procedure stage (0-based); equals the stage count when finished. */
  stage: 0,
  coagulations: 0,
  injuries: [] as string[],

  /** Random per case: the rupture-risk level at which the dome gives way. */
  ruptureThreshold: 0.55 + Math.random() * 0.25,
  /** Where the rupture risk came from (tool-target → total), for the debrief. */
  riskLog: {} as Record<string, number>,
  /** True once the case has been ended and the debrief shown. */
  finished: false,
  demo: false,
  rupture: { active: false, happened: false, sealed: false, suctioned: false, time: 0 },
  /** Latest combined clip evaluation (see procedure/clipEval.ts). */
  clipResult: null as null | import('../procedure/clipEval').ClipResult,
  /** Number of ICG videoangiography runs, and whether one was done after the latest clip. */
  icgRuns: 0,
  icgAfterClip: false,
  endoscopeUsed: false,
  /** Volume of blood currently pooled in the field (ml). */
  poolVolume: 0,
  /** Live vitals (written by the physiology model). */
  vitals: {
    hr: 68,
    sbp: 124,
    dbp: 72,
    map: 89,
    spo2: 99,
    mep: 100,
    /** Estimated blood loss (ml). */
    ebl: 0,
    /** Seconds since the start of the case. */
    opTime: 0,
    /** Current and cumulative temporary occlusion (s). */
    occlusion: 0,
    occlusionTotal: 0,
    occlusionMax: 0,
    mepMin: 100,
    mapMin: 89,
  },
};

export function addRisk(amount: number, reason: string): void {
  state.ruptureRisk = Math.min(1, Math.max(0, state.ruptureRisk + amount));
  if (amount > 0) {
    const key = reason.split('-')[0] + '-' + (reason.includes('bleb') ? 'bleb' : 'dome');
    state.riskLog[key] = (state.riskLog[key] ?? 0) + amount;
  }
  events.emit('risk:changed', { value: state.ruptureRisk, reason });
  if (amount > 0 && !state.rupture.happened && state.ruptureRisk >= state.ruptureThreshold) {
    state.rupture.active = true;
    state.rupture.happened = true;
    events.emit('rupture', { reason });
  }
}

