import { toast } from '../core/events';

const last = new Map<string, number>();

/** Show a message at most once per `cooldown` seconds (avoids spamming while dragging). */
export function toastThrottled(key: string, level: 'info' | 'warn' | 'danger', cooldown = 4): void {
  const now = performance.now() / 1000;
  if ((last.get(key) ?? -Infinity) + cooldown > now) return;
  last.set(key, now);
  toast(key, level);
}

/** Major arteries that must never be cut or coagulated. */
export const MAJOR_ARTERIES = new Set(['ica', 'm1', 'm2sup', 'm2inf', 'a1']);
/** Small but critical branches. */
export const CRITICAL_BRANCHES = new Set(['pcom', 'acha']);
