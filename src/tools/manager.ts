import * as THREE from 'three';
import { events, toast } from '../core/events';
import { playClick } from '../audio/sfx';
import type { TissueMaterial } from '../anatomy/materials';
import { Tool, type Pick, type ToolContext } from './types';

/**
 * Routes pointer input to the active instrument, resolves what is under the
 * cursor, highlights valid targets and moves the instrument model so its tip
 * rests on the tissue.
 */
export class ToolManager {
  readonly tools: Tool[];
  active: Tool | null = null;
  /** Latest pick under the cursor for the active tool (null if none). */
  hover: Pick | null = null;
  /** First solid surface under the cursor, regardless of tool (used for autofocus). */
  surface: Pick | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private pointerInside = false;
  private pressed = false;
  private lastTip = new THREE.Vector3();
  private lastPressEvent: PointerEvent | null = null;
  private readonly highlighted = new Map<TissueMaterial, number>();
  private readonly modelRoot = new THREE.Group();
  private actionT = 0;
  extraPickables: () => THREE.Object3D[] = () => [];

  constructor(
    private readonly ctx: ToolContext,
    tools: Tool[],
  ) {
    this.tools = tools;
    for (const t of tools) {
      t.init(ctx);
      if (t.model) {
        t.model.group.visible = false;
        this.modelRoot.add(t.model.group);
      }
    }
    ctx.stage.scene.add(this.modelRoot);

    const dom = ctx.stage.renderer.domElement;
    dom.addEventListener('pointermove', (e) => {
      if (this.virtual) return;
      const r = dom.getBoundingClientRect();
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerInside = true;
      if (this.pressed) this.lastPressEvent = e;
    });
    dom.addEventListener('pointerleave', () => !this.virtual && (this.pointerInside = false));
    dom.addEventListener('pointerdown', (e) => {
      if (this.virtual || !this.active || e.button !== 0 || e.shiftKey) return;
      this.press(e);
    });
    window.addEventListener('pointerup', (e) => {
      if (this.virtual || e.button !== 0) return;
      this.release();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    ctx.stage.controls.allowLeftDrag = () => !this.active;
    ctx.stage.controls.interceptWheel = (e) => !!this.active?.onWheel(e);
  }

  /** True while demo mode drives the instruments; real pointer input is ignored. */
  virtual = false;

  private press(e: PointerEvent): void {
    if (!this.active) return;
    this.pressed = true;
    this.lastPressEvent = e;
    this.refreshPick();
    if (this.hover) this.lastTip.copy(this.hover.point);
    this.active.onPress(this.hover, e);
  }

  private release(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.active?.onRelease();
  }

  /** Demo mode: place the virtual pointer (normalised device coordinates). */
  virtualMove(ndcX: number, ndcY: number): void {
    this.ndc.set(ndcX, ndcY);
    this.pointerInside = true;
    if (this.pressed) this.lastPressEvent = this.fakeEvent();
  }

  virtualPress(): void {
    this.press(this.fakeEvent());
  }

  virtualRelease(): void {
    this.release();
  }

  /** Synthetic pointer event at the virtual pointer, in client pixels. */
  private fakeEvent(): PointerEvent {
    const r = this.ctx.stage.renderer.domElement.getBoundingClientRect();
    return {
      clientX: r.left + ((this.ndc.x + 1) / 2) * r.width,
      clientY: r.top + ((1 - this.ndc.y) / 2) * r.height,
      button: 0,
      shiftKey: false,
    } as PointerEvent;
  }

  /** Demo mode: send a key to the active tool. */
  virtualKey(key: string): void {
    this.active?.onKey({ key, shiftKey: false } as KeyboardEvent);
  }

  select(id: string | null): void {
    const next = id ? this.tools.find((t) => t.id === id) ?? null : null;
    if (next === this.active) return;
    if (next && !next.available) {
      toast('msg.comingLater', 'info');
      return;
    }
    if (this.active) {
      this.active.deactivate();
      if (this.active.model) this.active.model.group.visible = false;
    }
    this.pressed = false;
    this.active = next;
    next?.activate();
    playClick(next ? 1600 : 1100);
    events.emit('tool:selected', { id: next?.id ?? null });
  }

  private onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (this.active?.onKey(e)) {
      e.preventDefault();
      return;
    }
    const tool = this.tools.find((t) => t.key === e.key);
    if (tool) {
      this.select(this.active === tool ? null : tool.id);
      e.preventDefault();
    } else if (e.key === 'Escape' && this.active) {
      this.select(null);
    }
  }

  /** Resolve a raw intersection to its tagged owner. */
  private resolve(hit: THREE.Intersection): Pick | null {
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o) return null;
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : this.raycaster.ray.direction.clone().negate();
    // Make the normal face the viewer (double-sided membranes, inner faces).
    if (normal.dot(this.raycaster.ray.direction) > 0) normal.negate();
    return { hit, object: o, kind: o.userData.kind, id: o.userData.id, point: hit.point.clone(), normal };
  }

  private refreshPick(): void {
    this.hover = null;
    this.surface = null;
    if (!this.pointerInside) return;
    this.raycaster.setFromCamera(this.ndc, this.ctx.stage.camera);
    const objects = [...this.ctx.anatomy.pickables(), ...this.extraPickables()];
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const h of hits) {
      const p = this.resolve(h);
      if (!p) continue;
      const transparent = p.kind === 'arachnoid' || p.kind === 'adhesion';
      if (!this.surface && !transparent) this.surface = p;
      if (this.active && !this.hover) {
        if (this.active.passThrough(p.kind)) continue;
        this.hover = p;
      }
      if (this.surface && (this.hover || !this.active)) break;
    }
  }

  update(dt: number): void {
    this.refreshPick();
    const tool = this.active;
    const p = this.hover;

    if (tool) {
      if (this.pressed && this.lastPressEvent) {
        const drag = p ? p.point.distanceTo(this.lastTip) : 0;
        if (p) this.lastTip.copy(p.point);
        tool.onDrag(p, drag, this.lastPressEvent);
      }
      tool.update(dt, p, this.pressed);
    }

    // Hover highlight on valid targets only.
    const target = tool && p && tool.accepts(p) ? p.object : null;
    const targetMat = target ? ((target as THREE.Mesh).material as TissueMaterial) : null;
    if (targetMat?.userData?.tissue && !this.highlighted.has(targetMat)) this.highlighted.set(targetMat, 0);
    for (const [mat, v] of this.highlighted) {
      const goal = mat === targetMat ? 0.55 : 0;
      const nv = v + (goal - v) * (1 - Math.exp(-dt * 12));
      mat.userData.tissue.uHighlight.value = nv;
      if (goal === 0 && nv < 0.005) {
        mat.userData.tissue.uHighlight.value = 0;
        this.highlighted.delete(mat);
      } else this.highlighted.set(mat, nv);
    }

    // Instrument model: tip on the surface, shaft toward the surgeon's hand.
    const dom = this.ctx.stage.renderer.domElement;
    const model = tool?.model;
    if (model) {
      const show = !!p && tool!.showModel(p);
      model.group.visible = show;
      if (show && p) {
        const cam = this.ctx.stage.camera;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        const hand = cam.position.clone().addScaledVector(right, 55).addScaledVector(up, -45);
        const tip = p.point.clone().addScaledVector(p.normal, 0.25);
        const dir = hand.sub(tip).normalize();
        model.group.position.copy(tip);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        // Roll so the jaws open across the screen.
        const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const want = right.clone().sub(dir.clone().multiplyScalar(right.dot(dir))).normalize();
        const roll = Math.atan2(localX.clone().cross(want).dot(dir), localX.dot(want));
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, roll));
        model.group.quaternion.copy(q);
      }
      this.actionT += ((this.pressed ? 1 : 0) - this.actionT) * (1 - Math.exp(-dt * 18));
      model.setAction(this.actionT);
      dom.style.cursor = show ? 'none' : tool ? 'crosshair' : '';
    } else {
      dom.style.cursor = tool ? 'crosshair' : '';
    }
  }
}
