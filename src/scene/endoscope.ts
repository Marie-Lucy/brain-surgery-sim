import * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { endoscope as endoscopeModel } from '../tools/instruments';
import { t } from '../ui/i18n';
import { events } from '../core/events';
import type { Stage } from './stage';

/**
 * Endoscope-assisted inspection.
 *
 * A 30° rigid endoscope slipped behind the aneurysm shows what the microscope
 * cannot: the far wall of the neck, the PCom origin under the sac and the AChA.
 * It is the classic way to confirm that the clip blades have not caught a
 * branch on the hidden side.
 *
 * Rendered as a picture-in-picture: after the main microscope frame, the same
 * scene is drawn from the endoscope camera into a small viewport.
 */
export class EndoscopeView {
  active = false;
  readonly camera = new THREE.PerspectiveCamera(78, 4 / 3, 0.3, 160);
  /** Orbit of the scope tip around the neck (radians) and distance (mm). */
  theta = 0;
  distance = 9;
  private readonly light = new THREE.PointLight(0xfff1e0, 0, 60, 1.6);
  private readonly model = endoscopeModel();
  private readonly frame: HTMLDivElement;
  private readonly u = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(
    private readonly stage: Stage,
    private readonly anatomy: Anatomy,
    parent: HTMLElement,
  ) {
    stage.scene.add(this.light);
    this.model.group.visible = false;
    this.model.group.traverse((o) => (o.raycast = () => {}));
    stage.scene.add(this.model.group);

    const an = anatomy.aneurysm;
    this.target.copy(an.neckCenter).addScaledVector(an.axis, 2.3);
    // Orbit basis perpendicular to the sac axis.
    this.u.crossVectors(an.axis, new THREE.Vector3(0, 0, 1)).normalize();
    this.v.crossVectors(an.axis, this.u).normalize();

    this.frame = document.createElement('div');
    this.frame.className = 'endo-frame';
    this.frame.innerHTML = `<div class="endo-label mono"></div><div class="endo-hint small"></div>`;
    this.frame.style.display = 'none';
    parent.appendChild(this.frame);
    const label = () => {
      this.frame.querySelector('.endo-label')!.textContent = t('endo.label');
      this.frame.querySelector('.endo-hint')!.textContent = t('endo.hint');
    };
    label();
    events.on('lang:changed', label);
  }

  show(): void {
    this.active = true;
    // Start on the side hidden from the microscope.
    const fwd = this.stage.camera.getWorldDirection(new THREE.Vector3());
    let best = 0, bestDot = -Infinity;
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const dir = this.u.clone().multiplyScalar(Math.cos(th)).addScaledVector(this.v, Math.sin(th));
      const d = dir.dot(fwd);
      if (d > bestDot) { bestDot = d; best = th; }
    }
    this.theta = best;
    this.frame.style.display = '';
    this.model.group.visible = true;
    events.emit('endoscope:used', {});
  }

  hide(): void {
    this.active = false;
    this.frame.style.display = 'none';
    this.model.group.visible = false;
  }

  orbit(dTheta: number, dDist = 0): void {
    this.theta += dTheta;
    this.distance = THREE.MathUtils.clamp(this.distance + dDist, 4, 12);
  }

  private place(): void {
    const an = this.anatomy.aneurysm;
    const dir = this.u.clone().multiplyScalar(Math.cos(this.theta)).addScaledVector(this.v, Math.sin(this.theta));
    // Sit beside the neck, slightly below the dome, looking at the neck base.
    const eye = this.target.clone().addScaledVector(dir, this.distance).addScaledVector(an.axis, -2.6);
    this.camera.position.copy(eye);
    this.camera.up.copy(an.axis);
    this.camera.lookAt(this.target.clone().addScaledVector(an.axis, 0.6));
    this.light.position.copy(eye);
    // The visible instrument: the scope shaft runs from its tip back toward the surgeon.
    // Enters from the surgeon's side, like the other instruments (not along the optical axis).
    const cam = this.stage.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const hand = cam.position.clone().addScaledVector(right, -60).addScaledVector(up, -50);
    const toHand = hand.sub(eye).normalize();
    this.model.group.position.copy(eye);
    this.model.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toHand);
  }

  /** Draw the picture-in-picture after the main frame. */
  render(): void {
    if (!this.active) return;
    this.place();
    const r = this.stage.renderer;
    const rect = this.frame.getBoundingClientRect();
    const host = r.domElement.getBoundingClientRect();
    const x = rect.left - host.left, y = host.bottom - rect.bottom;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.model.group.visible = false; // the scope does not see itself
    this.light.intensity = 70;
    r.setScissorTest(true);
    r.setScissor(x, y, rect.width, rect.height);
    r.setViewport(x, y, rect.width, rect.height);
    r.setClearColor(0x000000, 1);
    r.clear();
    // Rendered straight to the screen (no post-processing), so tone-map here.
    const tm = r.toneMapping;
    r.toneMapping = THREE.AgXToneMapping;
    r.render(this.stage.scene, this.camera);
    r.toneMapping = tm;
    r.setScissorTest(false);
    r.setViewport(0, 0, host.width, host.height);
    this.light.intensity = 0;
    this.model.group.visible = true;
  }
}
