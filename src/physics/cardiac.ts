import { events } from '../core/events';

/**
 * Simple cardiac cycle generator.
 * Produces an arterial-pressure-like waveform (fast systolic upstroke, dicrotic
 * notch, diastolic run-off) that drives vessel pulsation, Doppler and the ECG.
 */
export class CardiacCycle {
  heartRate: number;
  /** Phase within the current beat, 0..1. */
  phase = 0;
  /** Current waveform value 0..1. */
  pulse = 0;

  constructor(heartRate: number) {
    this.heartRate = heartRate;
  }

  update(dt: number): void {
    const beatDuration = 60 / Math.max(20, this.heartRate);
    this.phase += dt / beatDuration;
    if (this.phase >= 1) {
      this.phase %= 1;
      events.emit('heart:beat', { hr: this.heartRate });
    }
    this.pulse = CardiacCycle.arterialWave(this.phase);
  }

  /** Arterial pressure shape over one beat (phase 0 = R wave). */
  static arterialWave(p: number): number {
    // Pulse wave arrives ~0.08 of a cycle after the R wave.
    const t = (p - 0.08 + 1) % 1;
    const systole = Math.exp(-Math.pow((t - 0.12) / 0.07, 2));
    const notch = 0.35 * Math.exp(-Math.pow((t - 0.32) / 0.06, 2));
    const runoff = 0.25 * Math.exp(-t * 3.0);
    return Math.min(1, systole + notch + runoff);
  }
}
