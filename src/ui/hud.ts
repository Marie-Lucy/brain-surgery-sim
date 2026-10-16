import { events } from '../core/events';
import { state } from '../core/state';
import { applyTranslations, createLangToggle, t } from './i18n';

export interface HudCallbacks {
  onLabels: (visible: boolean) => void;
  onResetView: () => void;
  onDemo: () => void;
  onEndCase: () => void;
  onQuality: () => 'high' | 'low';
}

/**
 * Heads-up display: scope status bar and the instrument hint panel.
 * The checklist, mentor and vitals panels are added by later milestones.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly magEl: HTMLElement;
  private readonly focusEl: HTMLElement;
  private readonly dopplerEl: HTMLElement;
  private readonly tempEl: HTMLElement;
  private readonly hintTitle: HTMLElement;
  private readonly hintBody: HTMLElement;
  private labelsOn = true;
  setQuality: (q: 'high' | 'low') => void = () => {};
  /** Camera help is shown until the first instrument is picked (H shows it again). */
  private showControls = true;
  private currentTool: string | null = null;

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="topbar panel">
        <span class="brand mono">IC-PC · SIM</span>
        <span class="sep"></span>
        <span class="muted" data-i18n="hud.mag"></span><span class="mono val" id="hud-mag">×6.0</span>
        <span class="muted" data-i18n="hud.focus"></span><span class="mono val" id="hud-focus">— mm</span>
        <span class="doppler-read mono" id="hud-doppler"></span>
        <span class="temp-read mono" id="hud-temp"></span>
        <span class="sep"></span>
        <button class="chip" id="hud-labels" data-i18n="hud.labelsShort"></button>
        <button class="chip" id="hud-reset" data-i18n="hud.resetShort"></button>
        <button class="chip" id="hud-quality"></button>
        <button class="chip" id="hud-demo" data-i18n="hud.demo"></button>
        <button class="chip end" id="hud-end" data-i18n="hud.endCase"></button>
        <span class="lang-slot"></span>
      </div>
      <div class="help panel">
        <div class="panel-title" id="hint-title"></div>
        <div class="small hint-body" id="hint-body"></div>
      </div>
      <div class="footer-note small muted" data-i18n="hud.notMedical"></div>`;
    parent.appendChild(this.root);
    this.root.querySelector('.lang-slot')!.appendChild(createLangToggle());
    applyTranslations(this.root);

    this.magEl = this.root.querySelector('#hud-mag')!;
    this.focusEl = this.root.querySelector('#hud-focus')!;
    this.dopplerEl = this.root.querySelector('#hud-doppler')!;
    this.tempEl = this.root.querySelector('#hud-temp')!;
    this.hintTitle = this.root.querySelector('#hint-title')!;
    this.hintBody = this.root.querySelector('#hint-body')!;

    const labelsBtn = this.root.querySelector<HTMLButtonElement>('#hud-labels')!;
    const toggleLabels = () => {
      this.labelsOn = !this.labelsOn;
      labelsBtn.classList.toggle('on', this.labelsOn);
      cb.onLabels(this.labelsOn);
    };
    labelsBtn.classList.add('on');
    labelsBtn.addEventListener('click', toggleLabels);
    this.root.querySelector('#hud-reset')!.addEventListener('click', cb.onResetView);
    this.root.querySelector('#hud-demo')!.addEventListener('click', cb.onDemo);
    this.root.querySelector('#hud-end')!.addEventListener('click', cb.onEndCase);
    const q = this.root.querySelector<HTMLButtonElement>('#hud-quality')!;
    let quality: 'high' | 'low' = 'high';
    const syncQ = () => (q.textContent = t(quality === 'high' ? 'hud.qualityHigh' : 'hud.qualityLow'));
    q.addEventListener('click', () => {
      quality = cb.onQuality();
      syncQ();
    });
    this.setQuality = (v) => {
      quality = v;
      syncQ();
    };
    syncQ();
    events.on('lang:changed', syncQ);
    events.on('demo:changed', ({ running }) => this.root.querySelector('#hud-demo')!.classList.toggle('on', running));

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'l' || e.key === 'L') toggleLabels();
      else if (e.key === 'h' || e.key === 'H') {
        this.showControls = !this.showControls;
        this.renderHint();
      }
      else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) cb.onResetView();
    });

    events.on('tool:selected', ({ id }) => {
      this.currentTool = id;
      if (id) this.showControls = false;
      this.renderHint();
    });
    events.on('lang:changed', () => this.renderHint());
    events.on('doppler:reading', ({ id, flow }) => this.setDoppler(id, flow));
    events.on('tempclip:changed', ({ on }) => {
      this.tempEl.textContent = on ? `⏱ ${t('hud.tempOn')}` : '';
      this.tempEl.classList.toggle('on', on);
    });
    this.renderHint();
  }

  private renderHint(): void {
    const id = this.currentTool;
    const panel = this.hintTitle.parentElement!;
    panel.style.display = id || this.showControls ? '' : 'none';
    if (!id) {
      this.hintTitle.textContent = t('ctl.title');
      this.hintBody.innerHTML = ['ctl.tilt', 'ctl.pan', 'ctl.zoom', 'ctl.focus', 'ctl.tools', 'ctl.mentor', 'ctl.help']
        .map((k) => `<div>${t(k)}</div>`)
        .join('');
      return;
    }
    this.hintTitle.textContent = t(`tool.${id}`);
    const extra = t(`tool.${id}.keys`);
    this.hintBody.innerHTML =
      `<div>${t(`tool.${id}.hint`)}</div>` +
      (extra !== `tool.${id}.keys` ? `<div class="keys mono">${extra}</div>` : '') +
      `<div class="muted">${t('ctl.toolCamera')}</div>`;
  }

  private setDoppler(id: string | null, flow: number): void {
    if (!id) {
      this.dopplerEl.textContent = '';
      return;
    }
    const bars = Math.round(Math.min(1, flow) * 8);
    const name = id === 'aneurysm' ? t('anat.aneurysm') : t(`anat.${id === 'm2sup' || id === 'm2inf' ? 'm2' : id}`);
    this.dopplerEl.textContent = `DOPPLER ${name} ${'▮'.repeat(bars)}${'▯'.repeat(8 - bars)}`;
    this.dopplerEl.classList.toggle('silent', flow < 0.03);
  }

  setScopeReadout(mag: number, focusMm: number): void {
    if (state.tempClip.on) {
      const s = Math.floor(state.vitals.occlusion);
      this.tempEl.textContent = `⏱ ${t('hud.tempOn')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    this.magEl.textContent = `×${mag.toFixed(1)}`;
    this.focusEl.textContent = `${focusMm.toFixed(0)} mm`;
  }

  show(): void {
    this.root.classList.add('visible');
  }
}
