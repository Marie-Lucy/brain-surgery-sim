/**
 * Tiny typed event bus so modules (tools, physics, UI, audio) stay decoupled.
 * Add new events to `EventMap` as features grow.
 */
export interface EventMap {
  'lang:changed': { lang: 'en' | 'es' };
  'sim:start': Record<string, never>;
  'heart:beat': { hr: number };
  'fissure:changed': { halfGap: number };
  'tool:selected': { id: string | null };
  /** Any tool touched a named structure (used by the stage system to confirm identification). */
  'structure:touched': { kind: string; id: string; tool: string };
  'arachnoid:cut': { id: string };
  'neck:dissect': { side: 'proximal' | 'distal'; progress: number };
  'risk:changed': { value: number; reason: string };
  'coagulate': { kind: string; id: string; point: [number, number, number] };
  'suction': { point: [number, number, number]; active: boolean };
  'clip:applied': { index: number };
  'clip:removed': { index: number };
  'tempclip:changed': { on: boolean };
  'flow:changed': Record<string, never>;
  'doppler:reading': { id: string | null; flow: number };
  'stage:changed': { index: number; completed: number };
  'stage:progress': Record<string, never>;
  'rupture': { reason: string };
  'rupture:sealed': Record<string, never>;
  'bleed:started': { id: string; kind: 'ooze' | 'arterial' };
  'bleed:stopped': { id: string; kind: 'ooze' | 'arterial' };
  'alarm': { level: 0 | 1 | 2; keys: string[] };
  'icg:run': { index: number };
  'endoscope:used': Record<string, never>;
  'demo:changed': { running: boolean };
  'case:end': Record<string, never>;
  'toast': { key: string; level: 'info' | 'warn' | 'danger'; vars?: Record<string, string> };
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(type: K, fn: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    this.handlers.get(type)?.forEach((fn) => fn(payload));
  }
}

export const events = new EventBus();

/** Shorthand for user-facing messages (keys are i18n keys). */
export function toast(key: string, level: 'info' | 'warn' | 'danger' = 'info', vars?: Record<string, string>): void {
  events.emit('toast', { key, level, vars });
}
