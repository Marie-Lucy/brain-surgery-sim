import { events } from '../core/events';
import { state } from '../core/state';
import type { StageManager } from '../procedure/stageManager';
import { t } from './i18n';

/**
 * Mentor panel (bottom right): short, calm guidance for the current step, its
 * sub-task checkboxes and a progress percentage. Collapsible (button or M key).
 */
export class Mentor {
  readonly root: HTMLDivElement;
  private collapsed = false;

  constructor(parent: HTMLElement, private readonly stages: StageManager) {
    this.root = document.createElement('div');
    this.root.className = 'mentor panel';
    parent.appendChild(this.root);
    events.on('stage:progress', () => this.render());
    events.on('stage:changed', () => {
      this.root.classList.remove('pulse');
      void this.root.offsetWidth; // restart the highlight animation
      this.root.classList.add('pulse');
      this.render();
    });
    events.on('lang:changed', () => this.render());
    events.on('neck:dissect', () => this.render());
    for (const e of ['rupture', 'rupture:sealed', 'tempclip:changed', 'structure:touched', 'flow:changed', 'icg:run'] as const)
      events.on(e, () => this.render());
    // Refresh the emergency checklist while the field is being cleared.
    setInterval(() => state.rupture.active && this.render(), 700);
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && (e.target as HTMLElement)?.tagName !== 'INPUT') this.toggle();
    });
    this.render();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.render();
  }

  /** Rupture protocol, shown above the normal step while the bleeding is uncontrolled. */
  private emergency(): string {
    const steps: [string, boolean][] = [
      ['emg.suction', state.rupture.suctioned && state.poolVolume < 6],
      ['emg.temp', state.tempClip.on],
      ['emg.clip', state.rupture.sealed],
    ];
    return `<div class="mentor-emergency">
      <div class="emg-title">${t('emg.title')}</div>
      <p>${t('emg.text')}</p>
      <ol>${steps.map(([k, d]) => `<li class="${d ? 'ok' : ''}">${d ? '✓ ' : ''}${t(k)}</li>`).join('')}</ol>
    </div>`;
  }

  render(): void {
    const i = state.stage;
    const stage = this.stages.stages[i];
    const pct = stage ? Math.round(this.stages.stageProgress(i) * 100) : 100;
    const head = `
      <div class="mentor-head">
        <span class="mentor-badge mono">${t('ui.mentor')}</span>
        <span class="mentor-stage">${stage ? `${i + 1}/${this.stages.stages.length} · ${t(`stage.${stage.id}.title`)}` : t('ui.allDoneShort')}</span>
        <span class="mono mentor-pct">${pct}%</span>
        <button class="mentor-toggle" title="M">${this.collapsed ? '▴' : '▾'}</button>
      </div>
      <div class="mentor-bar"><div style="width:${pct}%"></div></div>`;
    let body = '';
    if (state.rupture.active) body += this.emergency();
    if (!this.collapsed) {
      if (stage) {
        body += `<p class="mentor-text">${t(`stage.${stage.id}.instr`)}</p><ul class="mentor-tasks">`;
        for (const task of stage.tasks) {
          const d = this.stages.isDone(i, task.id);
          const c = task.count?.(this.stages.anatomy);
          const counter = c && !d ? ` <span class="mono muted">${c[0]}/${c[1]}</span>` : '';
          const failed = !d && task.fail?.(this.stages.anatomy);
          body += `<li class="${d ? 'ok' : ''} ${task.optional ? 'opt' : ''} ${failed ? 'fail' : ''}"><span class="box">${d ? '✓' : failed ? '✕' : ''}</span><span>${t(task.key)}${counter}${failed ? `<em class="fail-msg">${t(task.failKey!)}</em>` : ''}</span></li>`;
        }
        body += '</ul>';
      } else {
        body += `<p class="mentor-text">${t('ui.allDone')}</p><button class="btn-primary small-btn" id="mentor-debrief">${t('hud.endCase')}</button>`;
      }
    }
    this.root.innerHTML = head + body;
    this.root.classList.toggle('collapsed', this.collapsed);
    this.root.querySelector('.mentor-toggle')!.addEventListener('click', () => this.toggle());
    this.root.querySelector('#mentor-debrief')?.addEventListener('click', () => events.emit('case:end', {}));
  }
}
