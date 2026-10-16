import { events } from '../core/events';
import type { ClipTool, ToolManager } from '../tools';
import { applyTranslations, t } from './i18n';

/** Minimal line icons (24×24, stroke = currentColor). */
const ICONS: Record<string, string> = {
  suction: '<path d="M4 20 L13 11"/><path d="M13 11 L18 6" stroke-width="2.4"/><circle cx="19" cy="5" r="1.2"/>',
  scissors: '<circle cx="6" cy="18" r="2.4"/><circle cx="11" cy="20" r="2.4"/><path d="M7.5 16 L19 4"/><path d="M11.5 17.6 L17 6"/>',
  bipolar: '<path d="M5 21 L15.5 4.5"/><path d="M9 21 L17.5 5"/><path d="M15.5 4.5 L17.5 5" stroke-width="2.4"/>',
  dissector: '<path d="M4 20 L16 8"/><path d="M16 8 Q19 5 17.5 3.5"/><circle cx="17.3" cy="3.6" r="0.9"/>',
  spatula: '<path d="M4 20 L11 13"/><rect x="11" y="4" width="7" height="10" rx="1.5" transform="rotate(45 14.5 9)"/>',
  clip: '<circle cx="5.5" cy="12" r="2.2"/><path d="M7.5 11 L20 8"/><path d="M7.5 13 L20 16"/>',
  icg: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  doppler: '<path d="M4 20 L12 12"/><circle cx="13" cy="11" r="1.3"/><path d="M15.5 8.5 Q17.5 10.5 15.5 12.5"/><path d="M17.5 6.5 Q21 10.5 17.5 14.5"/>',
  endoscope: '<path d="M3 21 L14 10" stroke-width="2.6"/><path d="M14 10 L19 5"/><path d="M17 3 L21 7"/>',
  tempclip: '<circle cx="5.5" cy="12" r="2.2"/><path d="M7.5 11 L16 9"/><path d="M7.5 13 L16 15"/><circle cx="18.5" cy="17.5" r="3"/><path d="M18.5 16 V17.6 H20"/>',
};

/**
 * Bottom toolbar: one button per instrument, number-key shortcuts, and the
 * straight/curved option for the permanent clip.
 */
export class Toolbar {
  readonly root: HTMLDivElement;
  private buttons = new Map<string, HTMLButtonElement>();

  constructor(parent: HTMLElement, manager: ToolManager) {
    this.root = document.createElement('div');
    this.root.className = 'toolbar panel';
    for (const tool of manager.tools) {
      const b = document.createElement('button');
      b.className = 'tool-btn';
      if (!tool.available) b.classList.add('later');
      b.innerHTML = `
        <span class="key mono">${tool.key}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[tool.id] ?? ''}</svg>
        <span class="name" data-i18n="tool.${tool.id}"></span>`;
      b.addEventListener('click', () => manager.select(manager.active === tool ? null : tool.id));
      this.buttons.set(tool.id, b);
      this.root.appendChild(b);

      if (tool.id === 'clip') {
        const clipTool = tool as ClipTool;
        const v = document.createElement('span');
        v.className = 'variant mono';
        const sync = () => (v.textContent = `${t(`clip.${clipTool.type}`)} ${clipTool.bladeLength}`);
        v.addEventListener('click', (e) => {
          e.stopPropagation();
          clipTool.setType(clipTool.type === 'straight' ? 'curved' : 'straight');
        });
        clipTool.onTypeChange = sync;
        events.on('lang:changed', sync);
        sync();
        b.appendChild(v);
      }
    }
    parent.appendChild(this.root);
    applyTranslations(this.root);

    const syncTitles = () => {
      for (const [id, b] of this.buttons) b.title = `${t(`tool.${id}`)} — ${t(`tool.${id}.hint`)}`;
    };
    syncTitles();
    events.on('lang:changed', syncTitles);
    events.on('tool:selected', ({ id }) => {
      for (const [tid, b] of this.buttons) b.classList.toggle('active', tid === id);
    });
  }
}
