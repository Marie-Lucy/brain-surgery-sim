/**
 * Shared Web Audio context. Browsers only allow audio after a user gesture, so
 * `unlockAudio()` is called from the start-screen button.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    // Two seconds of white noise, reused by every noise-based sound.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function audio(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  if (!ctx || !master || !noise) return null;
  return { ctx, master, noise };
}

export function setMasterVolume(v: number): void {
  if (master) master.gain.value = v;
}
