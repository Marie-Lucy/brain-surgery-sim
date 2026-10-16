/**
 * Uniforms shared by every tissue material. Updating `uPulse` once per frame
 * makes the whole field pulsate in sync with the heartbeat.
 */
export const globalUniforms = {
  /** 0..1 arterial pressure waveform (0 = diastole, 1 = systolic peak). */
  uPulse: { value: 0 },
  /** Seconds since start. */
  uTime: { value: 0 },
};
