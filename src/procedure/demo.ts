import * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { events, toast } from '../core/events';
import { state } from '../core/state';
import type { BleedingSystem } from '../physics/bleeding';
import type { Stage } from '../scene/stage';
import type { ToolManager } from '../tools';

/**
 * Demo mode: an automated walk-through of the six stages.
 *
 * It drives the *same* instruments through a virtual pointer (ToolManager's
 * virtual API), so everything that happens, from arachnoid cuts and bleeding to
 * stage goals, clip evaluation, ICG and Doppler, is the real simulation. Any
 * click or key press by the user stops the demo and hands over control at
 * whatever point it has reached.
 */
class Cancelled extends Error {}

export class DemoRunner {
  running = false;
  private cancelled = false;
  private banner: HTMLDivElement;

  constructor(
    private readonly stage: Stage,
    private readonly anatomy: Anatomy,
    private readonly tools: ToolManager,
    private readonly bleeding: BleedingSystem,
    parent: HTMLElement,
    private readonly onFinished: () => void,
  ) {
    this.banner = document.createElement('div');
    this.banner.className = 'demo-banner mono';
    this.banner.style.display = 'none';
    parent.appendChild(this.banner);
    const takeOver = (e: Event) => {
      if (!this.running || !e.isTrusted) return;
      // The topbar Demo button toggles the demo itself.
      if ((e.target as HTMLElement | null)?.closest?.('#hud-demo')) return;
      this.stop(true);
    };
    window.addEventListener('pointerdown', takeOver, true);
    window.addEventListener('keydown', takeOver, true);
    window.addEventListener('wheel', takeOver, true);
  }

  setBannerText(text: string): void {
    this.banner.textContent = text;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;
    state.demo = true;
    this.tools.virtual = true;
    this.banner.style.display = '';
    events.emit('demo:changed', { running: true });
    this.script()
      .then(() => {
        this.stop(false);
        this.onFinished();
      })
      .catch((e) => {
        if (!(e instanceof Cancelled)) console.error(e);
      });
  }

  stop(byUser: boolean): void {
    if (!this.running) return;
    this.cancelled = true;
    this.running = false;
    state.demo = false;
    this.tools.virtualRelease();
    this.tools.virtual = false;
    this.banner.style.display = 'none';
    events.emit('demo:changed', { running: false });
    if (byUser) toast('msg.demoTakeOver', 'info');
  }

  // ---------------------------------------------------------------- helpers
  private async wait(ms: number): Promise<void> {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (this.cancelled) throw new Cancelled();
      await new Promise((r) => setTimeout(r, 30));
    }
    if (this.cancelled) throw new Cancelled();
  }

  private ndcOf(p: THREE.Vector3): THREE.Vector2 {
    const v = p.clone().project(this.stage.camera);
    return new THREE.Vector2(v.x, v.y);
  }

  /** Glide the virtual pointer to a world point over `ms`. */
  private async moveTo(p: THREE.Vector3 | (() => THREE.Vector3), ms = 700): Promise<void> {
    const get = typeof p === 'function' ? p : () => p;
    const start = this.currentNdc.clone();
    const t0 = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = k * k * (3 - 2 * k);
      const target = this.ndcOf(get());
      const cur = start.clone().lerp(target, e);
      this.currentNdc.copy(cur);
      this.tools.virtualMove(cur.x, cur.y);
      if (k >= 1) break;
      await this.wait(16);
    }
  }
  private currentNdc = new THREE.Vector2(0, -0.3);

  private async click(p: THREE.Vector3 | (() => THREE.Vector3), dwell = 350): Promise<void> {
    await this.moveTo(p);
    await this.wait(dwell);
    this.tools.virtualPress();
    await this.wait(120);
    this.tools.virtualRelease();
    await this.wait(250);
  }

  /** Press at `a`, drag through the points, release. */
  private async drag(points: (THREE.Vector3 | (() => THREE.Vector3))[], msPerSegment = 450): Promise<void> {
    await this.moveTo(points[0]);
    await this.wait(200);
    this.tools.virtualPress();
    for (const p of points.slice(1)) await this.moveTo(p, msPerSegment);
    this.tools.virtualRelease();
    await this.wait(200);
  }

  private async hover(p: THREE.Vector3 | (() => THREE.Vector3), ms: number): Promise<void> {
    await this.moveTo(p);
    await this.wait(ms);
  }

  private select(id: string | null): void {
    this.tools.select(id);
  }

  private say(key: string): void {
    toast(key, 'info');
  }

  private segCenter(id: string): () => THREE.Vector3 {
    return () => this.anatomy.arachnoid.get(id)!.mesh.getWorldPosition(new THREE.Vector3());
  }
  private onVessel(id: Parameters<Anatomy['vessels']['get']>[0], t: number): () => THREE.Vector3 {
    return () => this.anatomy.vessels.get(id)!.curve.getPointAt(t);
  }

  // ----------------------------------------------------------------- script
  private async script(): Promise<void> {
    const an = this.anatomy.aneurysm;
    const controls = this.stage.controls;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    controls.reset();
    await this.wait(900);

    // Stage 1: open the sylvian fissure (lateral to medial), then retract.
    this.say('demo.s1');
    this.select('scissors');
    for (const id of ['sf1', 'sf2', 'sf3', 'sf4']) await this.click(this.segCenter(id));
    // Grip each operculum away from the fissure edge (clear of the sylvian vein) and pull gently.
    const retract = async () => {
      this.select('spatula');
      const g = this.anatomy.halfGap;
      await this.drag([V(26, -g - 6, -1), V(26, -g - 10, -1), V(26, -g - 14, -1), V(26, -g - 18, -1)], 450);
      await this.drag([V(14, g + 6, -1), V(14, g + 10, -1), V(14, g + 14, -1), V(14, g + 18, -1)], 450);
    };
    await retract();
    this.select('scissors');
    for (const id of ['ds1', 'ds2']) await this.click(this.segCenter(id));
    await retract();
    // Small ooze from the deep arachnoid: coagulate it.
    await this.coagulateOozes();

    // Stage 2: identify M1.
    this.say('demo.s2');
    controls.frame(V(4, 3, -30), 120);
    await this.wait(900);
    this.select('doppler');
    await this.hover(this.onVessel('m1', 0.5), 1600);

    // Stage 3: ICA and optic nerve.
    this.say('demo.s3');
    this.select('scissors');
    await this.click(this.segCenter('cc1'));
    await this.click(this.segCenter('oc1'));
    this.select('dissector');
    await this.click(this.onVessel('ica', 0.55));
    await this.click(() => this.anatomy.nerves.get('optic')!.curve.getPointAt(0.45));
    await this.coagulateOozes();

    // Stage 4: PCom, AChA and the neck.
    this.say('demo.s4');
    controls.frame(an.neckCenter.clone().addScaledVector(an.axis, 2), 95);
    await this.wait(900);
    this.select('scissors');
    await this.click(this.segCenter('nk1'));
    this.select('doppler');
    await this.hover(this.onVessel('pcom', 0.45), 1200);
    await this.hover(this.onVessel('acha', 0.5), 1200);
    this.select('tempclip');
    await this.click(this.onVessel('ica', 0.18));
    this.select('dissector');
    const neckPt = (side: number, k: number) => () =>
      an.neckCenter.clone().addScaledVector(an.axis, k).addScaledVector(this.anatomy.icaTangentAtNeck, side * 1.9);
    for (let pass = 0; pass < 6 && (state.neckDissection.proximal < 1 || state.neckDissection.distal < 1); pass++) {
      for (const side of [-1, 1]) {
        const key = side < 0 ? 'proximal' : 'distal';
        if (state.neckDissection[key] >= 1) continue;
        await this.drag([neckPt(side, 2.4), neckPt(side, 3.2), neckPt(side, 3.8), neckPt(side, 3.0), neckPt(side, 2.4)], 380);
      }
    }

    // Stage 5: clip, parallel to the ICA across the neck base.
    this.say('demo.s5');
    this.select('clip');
    const base = () => an.neckCenter.clone().addScaledVector(an.axis, 2.6);
    await this.click(base, 600); // fixes the position
    // Seat the fixed point exactly at the neck base (the pointer may have hit the ICA wall first).
    (this.tools.active as unknown as { lock: { point: THREE.Vector3 } }).lock.point.copy(base());
    // Rotate so the blades run across the sac (perpendicular to its axis in the view).
    const cam = this.stage.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const want = new THREE.Vector3().crossVectors(an.axis, fwd).normalize();
    const angle = Math.atan2(new THREE.Vector3().crossVectors(right, want).dot(fwd), right.dot(want));
    const steps = Math.round(angle / THREE.MathUtils.degToRad(10));
    for (let i = 0; i < Math.abs(steps); i++) {
      this.tools.virtualKey(steps > 0 ? 'q' : 'e');
      await this.wait(160);
    }
    await this.wait(500);
    this.tools.virtualPress(); // closes the clip
    await this.wait(120);
    this.tools.virtualRelease();
    await this.wait(900);
    this.select('tempclip');
    await this.click(this.onVessel('ica', 0.18));

    // Stage 6: verify.
    this.say('demo.s6');
    this.select('icg');
    await this.wait(7000);
    this.select('doppler');
    await this.hover(this.onVessel('pcom', 0.5), 1200);
    await this.hover(this.onVessel('acha', 0.6), 1200);
    await this.hover(this.onVessel('ica', 0.3), 1200);
    await this.hover(() => an.domeCenter.clone(), 1400);
    this.select('endoscope');
    await this.wait(3500);
    this.select(null);
    controls.reset();
    await this.wait(1500);
  }

  private async coagulateOozes(): Promise<void> {
    const active = this.bleeding.sources.filter((s) => s.active && s.kind === 'ooze' && s.marker);
    if (!active.length) return;
    if (state.poolVolume > 1) {
      this.select('suction');
      const m = active[0].marker!;
      await this.drag([() => m.getWorldPosition(new THREE.Vector3()), () => m.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1, 0, 0))], 1200);
    }
    this.select('bipolar');
    for (const s of active) await this.click(() => s.marker!.getWorldPosition(new THREE.Vector3()));
  }
}
