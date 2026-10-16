import type { Anatomy } from '../anatomy';
import { playChime } from '../audio/sfx';
import { events, toast } from '../core/events';
import { state } from '../core/state';
import { t } from '../ui/i18n';
import { STAGES, type StageDef } from './stages';

/**
 * Tracks progress through the procedure.
 *
 * Sub-task checks are polled a few times per second. A stage completes once all
 * its required sub-tasks are done, and only then does the next stage unlock. Work
 * done ahead of time (e.g. opening the carotid cistern during stage 1) still
 * counts when its stage becomes active.
 */
export class StageManager {
  readonly stages = STAGES;
  /** Completion state of every sub-task, refreshed on each poll. */
  readonly done = new Map<string, boolean>();
  private timer = 0;

  constructor(readonly anatomy: Anatomy) {
    events.on('structure:touched', ({ id, tool }) => {
      state.touched.add(id);
      state.touched.add(`${tool}:${id}`);
      if (state.clips.length > 0) state.touchedAfterClip.add(`${tool}:${id}`);
      this.poll();
    });
    events.on('clip:applied', () => {
      state.touchedAfterClip.clear();
      if (state.stage < 4) toast('msg.clipEarly', 'warn');
    });
    events.on('clip:removed', () => state.touchedAfterClip.clear());
    events.on('flow:changed', () => events.emit('stage:progress', {}));
    this.poll();
  }

  get current(): StageDef | null {
    return this.stages[state.stage] ?? null;
  }

  isDone(stageIndex: number, taskId: string): boolean {
    return this.done.get(`${this.stages[stageIndex].id}.${taskId}`) ?? false;
  }

  /** Fraction (0..1) of required sub-tasks done in a stage. */
  stageProgress(i: number): number {
    const req = this.stages[i].tasks.filter((t) => !t.optional);
    return req.filter((t) => this.isDone(i, t.id)).length / req.length;
  }

  overallProgress(): number {
    const total = this.stages.reduce((n, s) => n + s.tasks.filter((t) => !t.optional).length, 0);
    let done = 0;
    this.stages.forEach((s, i) => {
      if (i > state.stage) return;
      done += s.tasks.filter((t) => !t.optional && this.isDone(i, t.id)).length;
    });
    return state.stage >= this.stages.length ? 1 : done / total;
  }

  poll(): void {
    let changed = false;
    this.stages.forEach((s) => {
      for (const t of s.tasks) {
        const key = `${s.id}.${t.id}`;
        const v = t.check(this.anatomy);
        if (this.done.get(key) !== v) {
          this.done.set(key, v);
          changed = true;
        }
      }
    });
    // Advance through every stage whose goals are already met.
    while (state.stage < this.stages.length && this.stageProgress(state.stage) >= 1) {
      const finished = this.stages[state.stage];
      state.stage++;
      changed = true;
      playChime();
      events.emit('stage:changed', { index: state.stage, completed: state.stage });
      toast(state.stage >= this.stages.length ? 'msg.procedureDone' : 'msg.stageDone', 'info', {
        stage: t(`stage.${finished.id}.title`),
      });
    }
    if (changed) events.emit('stage:progress', {});
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    this.poll();
  }
}
