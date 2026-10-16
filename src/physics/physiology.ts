import { PHYSIOLOGY } from '../config/anatomy';
import { events } from '../core/events';
import { state } from '../core/state';
import { clipOcclusion } from './flow';

/**
 * Lightweight physiology model behind the vitals panel.
 *
 * Teaching relationships (deliberately simplified):
 *   - Blood loss → falling arterial pressure and a compensatory rise in heart rate.
 *     The anaesthetist replaces volume after a short delay, so a controlled bleed
 *     recovers while an uncontrolled rupture overwhelms replacement.
 *   - Temporary ICA occlusion is usually tolerated for a few minutes thanks to
 *     collaterals. Beyond about 5 min the motor evoked potentials (MEP) start to
 *     fall, and beyond about 10 min they fall quickly. Anaesthesia raises the
 *     blood pressure a little during occlusion to support collateral flow.
 *   - A clip that compromises the AChA or PCom lowers the MEP (wired up in M5).
 *   - Values drift gently, as real monitors never sit still.
 */
const BASE = { hr: PHYSIOLOGY.heartRate, map: 89, pulsePressure: 52, spo2: 99 };

/** Ornstein-Uhlenbeck noise: smooth, mean-reverting random drift. */
class Drift {
  value = 0;
  constructor(private readonly sigma: number, private readonly theta = 0.25) {}
  step(dt: number): number {
    this.value += -this.theta * this.value * dt + this.sigma * Math.sqrt(dt) * (Math.random() * 2 - 1) * 1.7;
    return this.value;
  }
}

export class Physiology {
  private hrDrift = new Drift(1.2);
  private mapDrift = new Drift(1.4);
  private spo2Drift = new Drift(0.25, 0.6);
  private mepDrift = new Drift(1.5, 0.5);
  /** Volume replaced by anaesthesia so far (ml). */
  private replaced = 0;
  /** Recent bleeding intensity, used for the acute sympathetic response. */
  private acute = 0;
  private alarmTimer = 0;
  private lastAlarmKey = '';
  running = false;

  constructor() {
    events.on('rupture', () => (this.acute = 1));
  }

  /** @param bleedRate current total blood loss rate (ml/s) */
  update(dt: number, bleedRate: number): void {
    const v = state.vitals;
    if (!this.running) return;
    v.opTime += dt;
    v.ebl += bleedRate * dt;

    // Volume replacement: starts once the deficit is noticed, up to 4 ml/s.
    const deficit = Math.max(0, v.ebl - this.replaced);
    if (deficit > 80) this.replaced += Math.min(deficit - 60, 4 * dt * Math.min(1, deficit / 400));
    const net = Math.max(0, v.ebl - this.replaced);

    this.acute = Math.max(0, this.acute - dt / 40);
    this.acute = Math.max(this.acute, Math.min(1, bleedRate / 8));

    // Temporary occlusion bookkeeping.
    if (state.tempClip.on) {
      v.occlusion += dt;
      v.occlusionTotal += dt;
      v.occlusionMax = Math.max(v.occlusionMax, v.occlusion);
    } else v.occlusion = 0;

    // Haemodynamics.
    const supportMap = state.tempClip.on ? 10 : 0; // induced mild hypertension
    const mapTarget = BASE.map + supportMap - 0.04 * net - 10 * this.acute + this.mapDrift.step(dt);
    const hrTarget = BASE.hr + 0.045 * net + 22 * this.acute + this.hrDrift.step(dt);
    v.map += (mapTarget - v.map) * Math.min(1, dt * 0.6);
    v.hr += (hrTarget - v.hr) * Math.min(1, dt * 0.5);
    v.map = Math.max(25, v.map);
    v.hr = Math.min(175, Math.max(40, v.hr));
    const pp = BASE.pulsePressure * Math.max(0.45, v.map / BASE.map);
    v.sbp = v.map + (2 / 3) * pp;
    v.dbp = v.map - (1 / 3) * pp;
    v.mapMin = Math.min(v.mapMin, v.map);

    // Oxygen saturation only falls in profound shock.
    const spo2Target = BASE.spo2 - Math.max(0, 55 - v.map) * 0.35 + this.spo2Drift.step(dt);
    v.spo2 += (Math.min(100, spo2Target) - v.spo2) * Math.min(1, dt * 0.3);

    // Motor evoked potentials.
    let mepRate = 0; // %/s
    const occ = v.occlusion;
    if (state.tempClip.on) {
      if (occ > 600) mepRate -= 10 / 60;
      else if (occ > 300) mepRate -= 4 / 60;
    }
    if ((clipOcclusion.acha ?? 0) > 0.7) mepRate -= 12 / 60; // clip on the AChA: internal capsule ischaemia
    if ((clipOcclusion.pcom ?? 0) > 0.7) mepRate -= 3 / 60; // PCom perforators feed the thalamus and internal capsule
    if ((clipOcclusion.ica ?? 0) > 0.3) mepRate -= 5 / 60; // significant ICA narrowing
    if (v.map < 60) mepRate -= ((60 - v.map) / 20) * (5 / 60);
    // Recovery toward a ceiling that drops after prolonged ischaemia.
    const ceiling = 100 - Math.max(0, v.occlusionMax - 900) / 30;
    if (mepRate === 0 && v.mep < ceiling) mepRate = 3 / 60;
    v.mep = Math.min(ceiling, Math.max(0, v.mep + mepRate * dt));
    v.mepMin = Math.min(v.mepMin, v.mep);

    this.checkAlarms(dt);
  }

  /** Drifting displayed MEP (the stored value is the underlying trend). */
  displayMep(dt: number): number {
    return Math.max(0, Math.min(110, state.vitals.mep + this.mepDrift.step(dt)));
  }

  private checkAlarms(dt: number): void {
    this.alarmTimer -= dt;
    if (this.alarmTimer > 0) return;
    this.alarmTimer = 0.5;
    const v = state.vitals;
    const keys: string[] = [];
    let level: 0 | 1 | 2 = 0;
    const raise = (k: string, l: 1 | 2) => {
      keys.push(k);
      level = Math.max(level, l) as 0 | 1 | 2;
    };
    if (state.rupture.active) raise('alarm.rupture', 2);
    if (v.map < 50) raise('alarm.mapLow', 2);
    else if (v.map < 60) raise('alarm.mapLow', 1);
    if (v.hr > 130) raise('alarm.hrHigh', 2);
    else if (v.hr > 110) raise('alarm.hrHigh', 1);
    if (v.spo2 < 90) raise('alarm.spo2', 2);
    if (v.mep < 50) raise('alarm.mep', 2);
    else if (v.mep < 75) raise('alarm.mep', 1);
    if (v.occlusion > 600) raise('alarm.occlusion', 2);
    else if (v.occlusion > 300) raise('alarm.occlusion', 1);
    const key = `${level}:${keys.join(',')}`;
    if (key !== this.lastAlarmKey) {
      this.lastAlarmKey = key;
      events.emit('alarm', { level, keys });
    }
  }
}
