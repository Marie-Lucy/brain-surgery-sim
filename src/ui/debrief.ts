import { state } from '../core/state';
import { emptyResult } from '../procedure/clipEval';
import { flow } from '../physics/flow';
import { t } from './i18n';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Builds the personalised improvement tips from what actually happened.
 * Each rule is a teaching point; the most important ones come first.
 */
function tips(): string[] {
  const out: string[] = [];
  const r = state.clipResult ?? emptyResult();
  const v = state.vitals;
  const risk = state.riskLog;

  if (state.rupture.happened) {
    const bleb = Object.entries(risk).filter(([k]) => k.endsWith('bleb')).reduce((s, [, x]) => s + x, 0);
    out.push(t(bleb > 0.1 ? 'tip.ruptureBleb' : 'tip.ruptureDome'));
    if (!state.tempClip.on && v.occlusionTotal === 0) out.push(t('tip.proximalControl'));
  } else if (state.ruptureRisk > 0.3) {
    out.push(t('tip.riskyHandling'));
  }
  if (!state.clips.length) out.push(t('tip.noClip'));
  else {
    switch (r.verdict) {
      case 'residual': out.push(t('tip.residual')); break;
      case 'incomplete': out.push(t('tip.incomplete')); break;
      case 'stenosis': out.push(t('tip.stenosis')); break;
      case 'branch': out.push(t(r.achaOcclusion > 0.5 ? 'tip.achaCaught' : 'tip.pcomCaught')); break;
    }
    if (r.verdict !== 'stenosis' && r.icaStenosis > 0.15) out.push(t('tip.mildStenosis'));
    if (r.verdict !== 'complete' && (state.neckDissection.proximal < 1 || state.neckDissection.distal < 1)) out.push(t('tip.dissection'));
    if (!state.icgAfterClip && state.icgRuns === 0) out.push(t('tip.icg'));
    if (!state.endoscopeUsed) out.push(t('tip.endoscope'));
  }
  if (v.occlusionMax > 300) out.push(t('tip.occlusion'));
  if (state.retractionStrain > 1) out.push(t('tip.retraction'));
  if (state.injuries.length) out.push(`${t('tip.injuries')} ${[...new Set(state.injuries)].join(', ')}.`);
  if (v.ebl > 300) out.push(t('tip.ebl'));
  if (state.tempClip.on) out.push(t('tip.tempLeft'));
  if (state.clips.length && r.verdict === 'complete' && !state.rupture.happened) out.unshift(t('tip.excellent'));
  else if (!out.length) out.push(t('tip.excellent'));
  return out.slice(0, 6);
}

/** Full-screen debrief shown when the case ends. */
export function showDebrief(parent: HTMLElement, onClose: () => void): void {
  state.finished = true;
  const v = state.vitals;
  const r = state.clipResult ?? emptyResult();
  const verdict = state.clips.length ? r.verdict : 'none';
  const verdictCls = verdict === 'complete' ? 'good' : verdict === 'residual' || verdict === 'incomplete' ? 'warn' : 'bad';
  const tile = (label: string, value: string, cls = '') =>
    `<div class="db-tile ${cls}"><span class="db-lbl">${label}</span><span class="mono db-val">${value}</span></div>`;

  const el = document.createElement('div');
  el.className = 'debrief';
  el.innerHTML = `
    <div class="debrief-card panel">
      <div class="eyebrow mono">${t('db.eyebrow')}</div>
      <h2>${t('db.title')}</h2>
      <div class="db-grid">
        ${tile(t('db.time'), fmt(v.opTime))}
        ${tile(t('db.ebl'), `${Math.round(v.ebl)} ml`, v.ebl > 300 ? 'bad' : v.ebl > 100 ? 'warn' : '')}
        ${tile(t('db.occlusion'), `${fmt(v.occlusionTotal)} (max ${fmt(v.occlusionMax)})`, v.occlusionMax > 600 ? 'bad' : v.occlusionMax > 300 ? 'warn' : '')}
        ${tile(t('db.rupture'), state.rupture.happened ? t(state.rupture.sealed ? 'db.ruptureYesSealed' : 'db.ruptureYes') : t('db.no'), state.rupture.happened ? 'bad' : 'good')}
        ${tile(t('db.minMap'), `${Math.round(v.mapMin)} mmHg`, v.mapMin < 60 ? 'bad' : '')}
        ${tile(t('db.minMep'), `${Math.round(v.mepMin)}%`, v.mepMin < 50 ? 'bad' : v.mepMin < 75 ? 'warn' : '')}
      </div>
      <div class="db-clip">
        <div class="db-clip-head"><span>${t('db.clipResult')}</span><span class="db-verdict ${verdictCls}">${t(`verdict.${verdict}`)}</span></div>
        ${state.clips.length ? `<div class="db-clip-grid mono">
          <span>${t('db.neckClosure')}</span><span>${pct(r.neckClosure)}</span>
          <span>${t('db.residual')}</span><span>${r.residualNeck > 0.15 ? t('db.yes') : t('db.no')}</span>
          <span>${t('db.icaNarrowing')}</span><span>${pct(r.icaStenosis)}</span>
          <span>${t('db.pcom')}</span><span>${flow.pcom > 0.3 ? t('db.patent') : t('db.occluded')}</span>
          <span>${t('db.acha')}</span><span>${flow.acha > 0.3 ? t('db.patent') : t('db.occluded')}</span>
          <span>${t('db.clips')}</span><span>${state.clips.map((c) => `${t(`clip.${c.type}`)} ${c.bladeLength} mm`).join(' + ')}</span>
        </div>` : ''}
      </div>
      <div class="db-tips">
        <div class="panel-title">${t('db.tips')}</div>
        <ul>${tips().map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>
      <p class="muted small">${t('db.disclaimer')}</p>
      <div class="db-actions">
        <button class="btn" id="db-back">${t('db.back')}</button>
        <button class="btn-primary" id="db-restart">${t('db.restart')}</button>
      </div>
    </div>`;
  parent.appendChild(el);
  el.querySelector('#db-restart')!.addEventListener('click', () => location.reload());
  el.querySelector('#db-back')!.addEventListener('click', () => {
    el.remove();
    onClose();
  });
}
