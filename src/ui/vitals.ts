import { events } from '../core/events';
import { state } from '../core/state';
import { CardiacCycle } from '../physics/cardiac';
import type { Physiology } from '../physics/physiology';
import type { MonitorSound } from '../audio/monitor';
import { applyTranslations, t } from './i18n';

/** Synthetic ECG (lead II-like). Phase 0 = R wave. */
function ecgAt(phase: number): number {
  const u = (phase + 0.25) % 1;
  const g = (c: number, w: number, a: number) => a * Math.exp(-Math.pow((u - c) / w, 2));
  return g(0.1, 0.028, 0.12) + g(0.225, 0.008, -0.12) + g(0.25, 0.009, 1) + g(0.275, 0.01, -0.22) + g(0.5, 0.05, 0.28);
}

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h > 0 ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** A monitor-style sweeping trace (the cursor moves right and erases ahead of itself). */
class SweepTrace {
  private x = 0;
  private lastY: number | null = null;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly color: string,
    private readonly speed = 70,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** @param v normalised value, 0 (bottom) .. 1 (top) */
  push(v: number, dt: number): void {
    const { width: w, height: h } = this.canvas;
    const dpr = w / this.canvas.clientWidth || 1;
    const dx = this.speed * dt * dpr;
    const x0 = this.x;
    let x1 = x0 + dx;
    const y = h - (0.12 + 0.76 * v) * h;
    const c = this.ctx;
    c.clearRect(x0, 0, dx + 10 * dpr, h);
    if (this.lastY !== null) {
      c.strokeStyle = this.color;
      c.lineWidth = 1.4 * dpr;
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(x0, this.lastY);
      c.lineTo(x1, y);
      c.stroke();
    }
    this.lastY = y;
    if (x1 >= w) {
      x1 = 0;
      this.lastY = null;
    }
    this.x = x1;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    this.x = 0;
    this.lastY = null;
  }
}

/**
 * Vitals panel (top right): live ECG and arterial line, HR, ABP, SpO2, MEP,
 * EBL, operation time and the temporary occlusion timer. Values flash on alarm.
 */
export class VitalsPanel {
  readonly root: HTMLDivElement;
  private ecg: SweepTrace;
  private art: SweepTrace;
  private el: Record<string, HTMLElement> = {};
  private textTimer = 0;
  private alarmKeys = new Set<string>();
  private alarmLevel = 0;

  constructor(
    parent: HTMLElement,
    private readonly heart: CardiacCycle,
    private readonly phys: Physiology,
    private readonly monitor: MonitorSound,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'vitals panel';
    this.root.innerHTML = `
      <div class="v-head">
        <span class="panel-title" data-i18n="vit.title"></span>
        <span class="v-alarm mono" id="v-alarm"></span>
        <button class="chip" id="v-mute" title="Mute"></button>
      </div>
      <div class="v-row">
        <div class="v-wave"><span class="v-lbl">II</span><canvas id="v-ecg"></canvas></div>
        <div class="v-num hr"><span class="v-lbl">HR</span><span class="mono big" id="v-hr">--</span></div>
      </div>
      <div class="v-row">
        <div class="v-wave"><span class="v-lbl">ART</span><canvas id="v-art"></canvas></div>
        <div class="v-num art"><span class="v-lbl">ABP</span><span class="mono mid" id="v-abp">--/--</span><span class="mono small" id="v-map">(--)</span></div>
      </div>
      <div class="v-grid">
        <div class="v-cell spo2"><span class="v-lbl">SpO₂</span><span class="mono mid" id="v-spo2">--</span></div>
        <div class="v-cell mep"><span class="v-lbl">MEP</span><span class="mono mid" id="v-mep">--</span></div>
        <div class="v-cell ebl"><span class="v-lbl" data-i18n="vit.ebl"></span><span class="mono mid" id="v-ebl">0</span></div>
        <div class="v-cell time"><span class="v-lbl" data-i18n="vit.opTime"></span><span class="mono mid" id="v-time">00:00</span></div>
        <div class="v-cell occ"><span class="v-lbl" data-i18n="vit.occlusion"></span><span class="mono mid" id="v-occ">--:--</span><span class="mono small muted" id="v-occt"></span></div>
      </div>`;
    parent.appendChild(this.root);
    applyTranslations(this.root);
    for (const id of ['hr', 'abp', 'map', 'spo2', 'mep', 'ebl', 'time', 'occ', 'occt', 'alarm', 'mute']) {
      this.el[id] = this.root.querySelector(`#v-${id}`)!;
    }
    this.ecg = new SweepTrace(this.root.querySelector('#v-ecg')!, '#059669');
    this.art = new SweepTrace(this.root.querySelector('#v-art')!, '#e11d48');
    requestAnimationFrame(() => this.resize());
    window.addEventListener('resize', () => this.resize());

    const mute = this.el.mute;
    const syncMute = () => (mute.textContent = this.monitor.muted ? t('vit.unmute') : t('vit.mute'));
    syncMute();
    mute.addEventListener('click', () => {
      this.monitor.muted = !this.monitor.muted;
      syncMute();
    });
    events.on('lang:changed', () => {
      syncMute();
      this.renderAlarm();
    });
    events.on('alarm', ({ level, keys }) => {
      this.alarmLevel = level;
      this.alarmKeys = new Set(keys);
      this.renderAlarm();
    });
  }

  resize(): void {
    this.ecg.resize();
    this.art.resize();
  }

  private renderAlarm(): void {
    const keys = [...this.alarmKeys];
    this.el.alarm.textContent = keys.length ? keys.map((k) => t(k)).join(' · ') : '';
    this.el.alarm.className = `v-alarm mono l${this.alarmLevel}`;
    const map: Record<string, string> = {
      'alarm.mapLow': 'art', 'alarm.hrHigh': 'hr', 'alarm.spo2': 'spo2', 'alarm.mep': 'mep', 'alarm.occlusion': 'occ', 'alarm.rupture': 'ebl',
    };
    this.root.querySelectorAll('.alarm1, .alarm2').forEach((e) => e.classList.remove('alarm1', 'alarm2'));
    for (const k of keys) {
      const cls = map[k];
      if (cls) this.root.querySelector(`.${cls}`)?.classList.add(`alarm${this.alarmLevel}`);
    }
  }

  update(dt: number): void {
    const v = state.vitals;
    const phase = this.heart.phase;
    this.ecg.push(0.25 + 0.6 * ecgAt(phase), dt);
    const p = CardiacCycle.arterialWave(phase);
    const pressure = v.dbp + (v.sbp - v.dbp) * p;
    this.art.push(Math.max(0, Math.min(1, (pressure - 20) / 180)), dt);

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.5;
    this.el.hr.textContent = Math.round(v.hr).toString();
    this.el.abp.textContent = `${Math.round(v.sbp)}/${Math.round(v.dbp)}`;
    this.el.map.textContent = `(${Math.round(v.map)})`;
    this.el.spo2.textContent = Math.round(v.spo2).toString();
    this.el.mep.textContent = `${Math.round(this.phys.displayMep(0.5))}%`;
    this.el.ebl.textContent = `${Math.round(v.ebl)} ml`;
    this.el.time.textContent = fmtTime(v.opTime);
    this.el.occ.textContent = state.tempClip.on ? fmtTime(v.occlusion) : '--:--';
    this.el.occt.textContent = v.occlusionTotal > 0 ? `Σ ${fmtTime(v.occlusionTotal)}` : '';
  }
}
