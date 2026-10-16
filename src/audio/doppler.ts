import { audio } from './engine';

/**
 * Micro-Doppler sound.
 *
 * A real Doppler probe turns the frequency shift of moving red cells into
 * sound. Fast systolic flow gives a high-pitched "whoosh" and slow diastolic flow
 * a low one, so a patent artery sounds pulsatile. No flow means silence.
 * Here: band-passed noise whose centre frequency and loudness follow the
 * arterial waveform scaled by the vessel's flow.
 */
export class DopplerSound {
  private src: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private filter2: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;

  private ensure(): boolean {
    const a = audio();
    if (!a) return false;
    if (this.src) return true;
    this.src = a.ctx.createBufferSource();
    this.src.buffer = a.noise;
    this.src.loop = true;
    this.filter = a.ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.Q.value = 5;
    this.filter2 = a.ctx.createBiquadFilter();
    this.filter2.type = 'bandpass';
    this.filter2.Q.value = 3;
    this.gain = a.ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filter).connect(this.filter2).connect(this.gain).connect(a.master);
    this.src.start();
    return true;
  }

  /**
   * @param flow 0..1 relative flow under the probe (0 = silent)
   * @param pulse 0..1 current arterial waveform value
   * @param size vessel calibre factor (bigger vessels are louder)
   */
  update(flow: number, pulse: number, size = 1): void {
    if (!this.ensure()) return;
    const a = audio()!;
    const t = a.ctx.currentTime;
    const f = 250 + (300 + 1500 * pulse) * Math.max(0.2, flow);
    this.filter!.frequency.setTargetAtTime(f, t, 0.01);
    this.filter2!.frequency.setTargetAtTime(f * 1.15, t, 0.01);
    const g = flow < 0.03 ? 0 : 0.6 * Math.min(1, flow) * (0.25 + 0.75 * pulse) * Math.min(1.2, size);
    this.gain!.gain.setTargetAtTime(g, t, 0.015);
  }

  silence(): void {
    if (!this.gain) return;
    const a = audio()!;
    this.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.03);
  }
}
