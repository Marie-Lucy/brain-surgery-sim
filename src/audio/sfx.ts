import { audio } from './engine';

/** Short synthesized instrument sounds. */

function noiseBurst(duration: number, filterType: BiquadFilterType, freq: number, q: number, gain: number): void {
  const a = audio();
  if (!a) return;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  const f = a.ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.ctx.createGain();
  const t = a.ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(f).connect(g).connect(a.master);
  src.start(t, Math.random());
  src.stop(t + duration + 0.05);
}

/** Micro-scissors snip. */
export function playSnip(): void {
  noiseBurst(0.06, 'bandpass', 4200, 2.5, 0.35);
}

/** Bipolar coagulation sizzle. */
export function playSizzle(duration = 0.45): void {
  noiseBurst(duration, 'highpass', 3000, 0.7, 0.18);
}

/** Soft click when choosing an instrument or seating a clip. */
export function playClick(freq = 1800): void {
  const a = audio();
  if (!a) return;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  const t = a.ctx.currentTime;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(a.master);
  o.start(t);
  o.stop(t + 0.06);
}

/** Continuous suction hiss while the suction is active. */
export class SuctionSound {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;

  set(active: boolean, wet = 0): void {
    const a = audio();
    if (!a) return;
    if (active && !this.src) {
      this.src = a.ctx.createBufferSource();
      this.src.buffer = a.noise;
      this.src.loop = true;
      const f = a.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.6;
      this.gain = a.ctx.createGain();
      this.gain.gain.value = 0;
      this.src.connect(f).connect(this.gain).connect(a.master);
      this.src.start();
    }
    if (this.gain) {
      const target = active ? 0.08 + 0.12 * wet : 0;
      this.gain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.05);
    }
    if (!active && this.src) {
      const s = this.src;
      this.src = null;
      setTimeout(() => s.stop(), 200);
    }
  }
}

/** Gentle two-note chime when a stage is completed. */
export function playChime(): void {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = t0 + i * 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(a.master);
    o.start(t);
    o.stop(t + 0.65);
  });
}
