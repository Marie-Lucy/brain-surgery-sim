import { events } from '../core/events';
import { t } from './i18n';

/**
 * Short, calm messages above the toolbar. Repeated messages refresh rather than
 * stack.
 */
export class Toasts {
  private readonly root: HTMLDivElement;
  private readonly live = new Map<string, { el: HTMLDivElement; timer: number }>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'toasts';
    this.root.setAttribute('aria-live', 'polite');
    parent.appendChild(this.root);
    events.on('toast', ({ key, level, vars }) => this.show(key, level, vars));
  }

  show(key: string, level: 'info' | 'warn' | 'danger', vars?: Record<string, string>): void {
    let text = t(key);
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
    const existing = this.live.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.el.textContent = text;
      existing.timer = window.setTimeout(() => this.hide(key), 3800);
      return;
    }
    const el = document.createElement('div');
    el.className = `toast ${level}`;
    el.textContent = text;
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const timer = window.setTimeout(() => this.hide(key), level === 'danger' ? 5200 : 3800);
    this.live.set(key, { el, timer });
    // Keep at most 3 on screen.
    while (this.root.children.length > 3) {
      const first = this.root.firstElementChild as HTMLDivElement;
      for (const [k, v] of this.live) if (v.el === first) this.live.delete(k);
      first.remove();
    }
  }

  private hide(key: string): void {
    const item = this.live.get(key);
    if (!item) return;
    this.live.delete(key);
    item.el.classList.remove('in');
    setTimeout(() => item.el.remove(), 300);
  }
}
