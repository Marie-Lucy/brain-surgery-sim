import { events } from '../core/events';
import { state } from '../core/state';
import { audio } from './engine';

/**
 * Anaesthesia monitor sounds.
 *   - Pulse-oximeter beep on every heartbeat. Its pitch falls with the saturation,
 *     so you can "hear" desaturation without looking.
 *   - Alarms in the IEC 60601-1-8 spirit: medium priority = 3 tones, high
 *     priority = 5 fast tones, repeated while the condition persists.
 */
export class MonitorSound {
  muted = false;
  beepOn = true;
  private level: 0 | 1 | 2 = 0;
  private alarmTimer = 0;

  constructor() {
    events.on('heart:beat', () => this.beep());
    events.on('alarm', ({ level }) => {
      if (level > this.level) this.alarmTimer = 0; // sound immediately when it escalates
      this.level = level;
    });
  }

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
    const a = audio();
    if (!a) return;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = a.ctx.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.setValueAtTime(gain, t + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(a.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private beep(): void {
    if (this.muted || !this.beepOn) return;
    const spo2 = state.vitals.spo2;
    this.tone(660 + (spo2 - 85) * 18, 0, 0.07, 0.045);
  }

  update(dt: number): void {
    if (this.muted || this.level === 0) return;
    this.alarmTimer -= dt;
    if (this.alarmTimer > 0) return;
    if (this.level === 2) {
      [0, 0.13, 0.26, 0.52, 0.65].forEach((t, i) => this.tone(i % 2 ? 880 : 988, t, 0.11, 0.07, 'triangle'));
      this.alarmTimer = 3;
    } else {
      [0, 0.22, 0.44].forEach((t) => this.tone(660, t, 0.18, 0.05, 'triangle'));
      this.alarmTimer = 8;
    }
  }
}
