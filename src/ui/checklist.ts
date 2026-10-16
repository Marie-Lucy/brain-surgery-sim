import { events } from '../core/events';
import { state } from '../core/state';
import type { StageManager } from '../procedure/stageManager';
import { t } from './i18n';

/**
 * Left panel: the six procedure stages with done / active / locked state.
 * Clicking the active or a completed stage expands its sub-tasks.
 */
export class Checklist {
  readonly root: HTMLDivElement;
  private expanded = -1;

  constructor(parent: HTMLElement, private readonly stages: StageManager) {
    this.root = document.createElement('div');
    this.root.className = 'checklist panel';
    parent.appendChild(this.root);
    events.on('stage:progress', () => this.render());
    events.on('stage:changed', () => {
      this.expanded = -1;
      this.render();
    });
    events.on('lang:changed', () => this.render());
    this.render();
  }

  render(): void {
    const cur = state.stage;
    const total = this.stages.stages.length;
    const overall = Math.round(this.stages.overallProgress() * 100);
    let html = `<div class="panel-title"><span>${t('ui.procedure')}</span><span class="mono">${overall}%</span></div>`;
    this.stages.stages.forEach((s, i) => {
      const status = i < cur ? 'done' : i === cur ? 'active' : 'locked';
      const icon = status === 'done' ? '✓' : status === 'active' ? '▸' : '🔒︎';
      const pct = Math.round(this.stages.stageProgress(i) * 100);
      html += `<div class="stage ${status}" data-i="${i}">
        <span class="st-icon">${icon}</span>
        <span class="st-num mono">${i + 1}</span>
        <span class="st-title">${t(`stage.${s.id}.title`)}</span>
        ${status === 'active' ? `<span class="st-pct mono">${pct}%</span>` : ''}
      </div>`;
      if ((status === 'active' && this.expanded === -1) || this.expanded === i) {
        if (status !== 'locked') {
          html += '<ul class="st-tasks">';
          for (const task of s.tasks) {
            const d = this.stages.isDone(i, task.id);
            const failed = !d && task.fail?.(this.stages.anatomy);
            html += `<li class="${d ? 'ok' : ''} ${task.optional ? 'opt' : ''} ${failed ? 'fail' : ''}">${d ? '☑' : failed ? '☒' : '☐'} ${t(task.key)}</li>`;
          }
          html += '</ul>';
        }
      }
    });
    if (cur >= total) html += `<div class="st-finished">${t('ui.allDone')}</div>`;
    this.root.innerHTML = html;
    this.root.querySelectorAll<HTMLElement>('.stage').forEach((el) =>
      el.addEventListener('click', () => {
        const i = Number(el.dataset.i);
        if (i > state.stage) return;
        this.expanded = this.expanded === i ? -2 : i;
        this.render();
      }),
    );
  }
}
