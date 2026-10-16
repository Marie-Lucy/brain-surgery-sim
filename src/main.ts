import * as THREE from 'three';
import './ui/styles.css';
import { Anatomy } from './anatomy';
import { unlockAudio } from './audio/engine';
import { MonitorSound } from './audio/monitor';
import { FISSURE, PHYSIOLOGY } from './config/anatomy';
import { events } from './core/events';
import { state } from './core/state';
import { globalUniforms } from './core/uniforms';
import { BleedingSystem } from './physics/bleeding';
import { CardiacCycle } from './physics/cardiac';
import { recomputeFlow } from './physics/flow';
import { Physiology } from './physics/physiology';
import { ClipEvaluator } from './procedure/clipEval';
import { DemoRunner } from './procedure/demo';
import { StageManager } from './procedure/stageManager';
import { EndoscopeView } from './scene/endoscope';
import { IcgView } from './scene/icg';
import { Stage } from './scene/stage';
import { createTools, ToolManager } from './tools';
import { Hud } from './ui/hud';
import { Checklist } from './ui/checklist';
import { showDebrief } from './ui/debrief';
import { applyTranslations, getLang, setLang, t } from './ui/i18n';
import { Labels } from './ui/labels';
import { Mentor } from './ui/mentor';
import { showStartScreen } from './ui/startScreen';
import { Toasts } from './ui/toast';
import { Toolbar } from './ui/toolbar';
import { VitalsPanel } from './ui/vitals';

/**
 * App bootstrap: build the scene and anatomy, show the start screen, then run the loop.
 */
const app = document.getElementById('app')!;
setLang(getLang());

const stage = new Stage(app);
const anatomy = new Anatomy();
stage.scene.add(anatomy.root);
state.allowedHalfGap = FISSURE.closedHalfGap;
recomputeFlow(anatomy);

const heart = new CardiacCycle(PHYSIOLOGY.heartRate);
const bleeding = new BleedingSystem(anatomy);
const physiology = new Physiology();
const monitor = new MonitorSound();
const icg = new IcgView(stage, anatomy, app);
const endoscope = new EndoscopeView(stage, anatomy, app);
const clipEval = new ClipEvaluator(anatomy);
const tools = new ToolManager({ anatomy, stage, bleeding, icg, endoscope }, createTools());
tools.extraPickables = () => bleeding.pickables();
const stages = new StageManager(anatomy);

// --- Autofocus: the focal plane follows the tissue under the cursor (or the field centre). ---
const centerRay = new THREE.Raycaster();
let focusTimer = 0;
function updateFocus(dt: number): void {
  if (tools.surface) {
    stage.postfx.setFocusGoal(tools.surface.point);
    return;
  }
  focusTimer -= dt;
  if (focusTimer > 0) return;
  focusTimer = 0.25;
  centerRay.setFromCamera(new THREE.Vector2(0, 0), stage.camera);
  const hit = centerRay.intersectObjects(solidPickables(), true)[0];
  if (hit) stage.postfx.setFocusGoal(hit.point);
}
const solidPickables = () => anatomy.pickables().filter((o) => o.userData.kind !== 'arachnoid' && o.userData.kind !== 'adhesion');
stage.postfx.focusPoint.copy(stage.controls.target);
stage.postfx.setFocusGoal(stage.controls.target);

// --- UI ---
const labels = new Labels(app, anatomy.labels, stage.camera, solidPickables);
const hud = new Hud(app, {
  onLabels: (v) => labels.setVisible(v),
  onResetView: () => stage.controls.reset(),
  onDemo: () => (demo.running ? demo.stop(true) : demo.start()),
  onEndCase: () => endCase(),
  onQuality: () => {
    stage.setQuality(stage.quality === 'high' ? 'low' : 'high');
    return stage.quality;
  },
});
const demo = new DemoRunner(stage, anatomy, tools, bleeding, app, () => endCase());
demo.setBannerText(t('demo.banner'));
events.on('lang:changed', () => demo.setBannerText(t('demo.banner')));

let debriefOpen = false;
function endCase(): void {
  if (debriefOpen) return;
  if (demo.running) demo.stop(false);
  tools.select(null);
  debriefOpen = true;
  showDebrief(app, () => (debriefOpen = false));
}
events.on('case:end', () => endCase());

// Phones and touch tablets start in low quality.
if (window.matchMedia('(pointer: coarse)').matches) {
  stage.setQuality('low');
  hud.setQuality('low');
}
new Toasts(app);
const toolbar = new Toolbar(app, tools);
const checklist = new Checklist(app, stages);
const mentor = new Mentor(app, stages);
const vitals = new VitalsPanel(app, heart, physiology, monitor);
const panels = [toolbar.root, checklist.root, mentor.root, vitals.root];
panels.forEach((p) => (p.style.display = 'none'));
labels.setVisible(false);
applyTranslations();

// The landing page is opaque: skip 3D rendering until the user enters.
let started = false;
showStartScreen(app).then((mode) => {
  started = true;
  unlockAudio();
  hud.show();
  panels.forEach((p) => (p.style.display = ''));
  labels.setVisible(true);
  vitals.resize();
  physiology.running = true;
  events.emit('sim:start', {});
  if (mode === 'demo') setTimeout(() => demo.start(), 600);
});

// --- Main loop ---
const timer = new THREE.Timer();
timer.connect(document);
function frame(time: number): void {
  timer.update(time);
  if (!started) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(timer.getDelta(), 0.1);
  heart.heartRate = state.vitals.hr;
  heart.update(dt);
  globalUniforms.uPulse.value = heart.pulse;
  globalUniforms.uTime.value += dt;
  anatomy.update(dt);
  tools.update(dt);
  stages.update(dt);
  bleeding.update(dt);
  physiology.update(dt, bleeding.currentRate);
  monitor.update(dt);
  vitals.update(dt);
  icg.update(dt);
  updateFocus(dt);
  stage.render(dt);
  endoscope.render();
  labels.update(app.clientWidth, app.clientHeight);
  hud.setScopeReadout(stage.controls.magnification, stage.camera.position.distanceTo(stage.postfx.focusPoint));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for tinkering from the browser console.
Object.assign(window as unknown as Record<string, unknown>, { sim: { stage, anatomy, heart, tools, state, stages, events, bleeding, physiology, clipEval, icg, endoscope } });
