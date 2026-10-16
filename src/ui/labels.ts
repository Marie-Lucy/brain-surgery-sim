import * as THREE from 'three';
import type { LabelAnchor } from '../anatomy';
import { events } from '../core/events';
import { t } from './i18n';

/**
 * Anatomy labels: HTML tags projected from 3D anchors.
 * A label fades out when its structure is hidden behind other tissue, checked
 * with a ray from the camera (a few labels per frame to stay cheap).
 */
export class Labels {
  private readonly root: HTMLDivElement;
  private readonly items: { anchor: LabelAnchor; el: HTMLDivElement; occluded: boolean }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private cursor = 0;
  visible = true;

  constructor(
    parent: HTMLElement,
    anchors: LabelAnchor[],
    private readonly camera: THREE.Camera,
    private readonly occluders: () => THREE.Object3D[],
  ) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    parent.appendChild(this.root);
    for (const anchor of anchors) {
      const el = document.createElement('div');
      el.className = 'label';
      el.innerHTML = `<span class="dot"></span><span class="txt"></span>`;
      this.root.appendChild(el);
      this.items.push({ anchor, el, occluded: false });
    }
    this.translate();
    events.on('lang:changed', () => this.translate());
  }

  private translate(): void {
    for (const it of this.items) it.el.querySelector('.txt')!.textContent = t(it.anchor.key);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
  }

  update(width: number, height: number): void {
    if (!this.visible) return;
    // Occlusion: test two labels per frame.
    const occ = this.occluders();
    for (let k = 0; k < 2 && this.items.length; k++) {
      const it = this.items[this.cursor++ % this.items.length];
      const p = it.anchor.position();
      const camPos = this.camera.getWorldPosition(new THREE.Vector3());
      const dir = p.clone().sub(camPos);
      const dist = dir.length();
      this.raycaster.set(camPos, dir.normalize());
      this.raycaster.far = dist;
      const hit = this.raycaster.intersectObjects(occ, true)[0];
      let owner: THREE.Object3D | null = hit?.object ?? null;
      let isOwner = false;
      while (owner) {
        if (owner === it.anchor.owner) { isOwner = true; break; }
        owner = owner.parent;
      }
      it.occluded = !!hit && !isOwner && hit.distance < dist - 2.5;
    }
    const v = new THREE.Vector3();
    // Labels outside the microscope's round field stop are hidden.
    const fieldR = 0.485 * Math.min(width, height) - 12;
    for (const it of this.items) {
      v.copy(it.anchor.position()).project(this.camera);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && it.anchor.owner.visible;
      if (!onScreen) {
        it.el.style.opacity = '0';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      if (Math.hypot(x - width / 2, y - height / 2) > fieldR) {
        it.el.style.opacity = '0';
        continue;
      }
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      it.el.style.opacity = it.occluded ? '0.18' : '1';
    }
  }
}
