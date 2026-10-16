import * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import { createTissueMaterial } from '../anatomy/materials';
import { events, toast } from '../core/events';
import { addRisk, state } from '../core/state';
import { globalUniforms } from '../core/uniforms';
import { flow } from './flow';

/**
 * Bleeding and haemostasis.
 *
 * Two kinds of source:
 *   OOZE      small venous or capillary bleeding (arachnoid vessels, cortex,
 *             a nicked vein). Slow, and stopped with the bipolar.
 *   ARTERIAL  intraoperative aneurysm rupture. Fast, pulsatile, scales with the
 *             flow in the ICA. The bipolar cannot stop it. The sequence is:
 *             suction to see → temporary clip on the ICA → definitive clip.
 *
 * Visuals: droplet particles leave each source. Blood collects in a pool whose
 * surface rises from the deep cisterns and hides the anatomy until it is
 * suctioned away.
 */
export interface BleedSource {
  id: string;
  kind: 'ooze' | 'arterial';
  position: THREE.Vector3;
  normal: THREE.Vector3;
  /** Base rate in ml/s (arterial: at full ICA flow). */
  rate: number;
  active: boolean;
  marker: THREE.Mesh | null;
}

const POOL_FLOOR = -48;
/** Pool rise per ml of pooled blood (mm/ml). Small volumes deep in the field look large. */
const POOL_MM_PER_ML = 1.6;
const POOL_MAX_Z = -16;
const SUCTION_RATE = 6; // ml/s
const MAX_PARTICLES = 700;

export class BleedingSystem {
  readonly sources: BleedSource[] = [];
  readonly pool: THREE.Mesh;
  private readonly particles: THREE.InstancedMesh;
  private readonly pPos: Float32Array;
  private readonly pVel: Float32Array;
  private readonly pLife: Float32Array;
  private pCount = 0;
  private emitAcc = new Map<string, number>();
  private suctionPoint: THREE.Vector3 | null = null;
  private suctionThisFrame = false;
  private poolBase: Float32Array;
  private oozeSeq = 0;
  private strainOozeDone = false;
  /** Total blood loss rate this frame (ml/s), read by the physiology model. */
  currentRate = 0;

  constructor(private readonly anatomy: Anatomy) {
    // --- Pool surface ---
    const geo = new THREE.PlaneGeometry(76, 46, 60, 36);
    geo.translate(6, 0, 0);
    this.poolBase = Float32Array.from(geo.attributes.position.array as Float32Array);
    const mat = createTissueMaterial({
      color: 0x6e0309,
      roughness: 0.62,
      clearcoat: 0.35,
      clearcoatRoughness: 0.03,
      sheen: 0,
      envMapIntensity: 0.05,
    });
    // The pool faces the coaxial microscope light head-on: keep its broad specular
    // low so it reads as deep red with a few sharp clear-coat glints.
    mat.specularIntensity = 0.2;
    this.pool = new THREE.Mesh(geo, mat);
    this.pool.userData = { kind: 'blood', id: 'pool' };
    this.pool.position.z = POOL_FLOOR;
    this.pool.visible = false;
    this.pool.receiveShadow = true;
    this.pool.renderOrder = 1;
    anatomy.root.add(this.pool);

    // --- Droplets ---
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0x6a0408,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.4,
    });
    this.particles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), dropMat, MAX_PARTICLES);
    this.particles.count = 0;
    this.particles.frustumCulled = false;
    this.particles.raycast = () => {};
    anatomy.root.add(this.particles);
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);

    this.wireEvents();
  }

  private wireEvents(): void {
    events.on('rupture', () => this.startRupture());
    events.on('suction', ({ point, active }) => {
      if (!active) return;
      this.suctionPoint = new THREE.Vector3(...point);
      this.suctionThisFrame = true;
    });
    events.on('coagulate', ({ kind, id, point }) => this.coagulate(kind, id, new THREE.Vector3(...point)));
    // Small vessels in the deep arachnoid tend to ooze when it is opened.
    events.on('arachnoid:cut', ({ id }) => {
      if (id === 'ds2') this.addOozeOnSegment(id, 0.12);
      if (id === 'cc1' && Math.random() < 0.6) this.addOozeOnSegment(id, 0.1);
    });
    // The clip evaluator decides when the neck (and so the rupture) is closed.
    events.on('rupture:sealed', () => this.sealRupture());
  }

  /** Called by tools when an injury should bleed (e.g. scissors on a vein). */
  addOoze(position: THREE.Vector3, normal: THREE.Vector3, rate: number, parent?: THREE.Object3D): BleedSource {
    const id = `ooze-${++this.oozeSeq}`;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 14, 10),
      new THREE.MeshPhysicalMaterial({ color: 0x7a0a0e, roughness: 0.12, clearcoat: 1, envMapIntensity: 1.1 }),
    );
    marker.scale.set(1, 1, 0.55);
    marker.position.copy(position);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    marker.userData = { kind: 'bleed', id };
    (parent ?? this.anatomy.root).attach(marker);
    const src: BleedSource = { id, kind: 'ooze', position: position.clone(), normal: normal.clone(), rate, active: true, marker };
    this.sources.push(src);
    events.emit('bleed:started', { id, kind: 'ooze' });
    toast('msg.oozeStart', 'warn');
    return src;
  }

  private addOozeOnSegment(segId: string, rate: number): void {
    const seg = this.anatomy.arachnoid.get(segId);
    if (!seg) return;
    const p = seg.mesh.getWorldPosition(new THREE.Vector3());
    p.x += (Math.random() - 0.5) * 4;
    p.y += (Math.random() - 0.5) * 3;
    p.z -= 1.2;
    this.addOoze(p, new THREE.Vector3(0, 0, 1), rate);
  }

  private startRupture(): void {
    const a = this.anatomy.aneurysm;
    const src: BleedSource = {
      id: 'rupture',
      kind: 'arterial',
      position: a.blebPosition.clone(),
      normal: a.axis.clone().add(new THREE.Vector3(0, 0, 0.8)).normalize(),
      rate: 10,
      active: true,
      marker: null,
    };
    this.sources.push(src);
    state.rupture.time = state.vitals.opTime;
    a.blebMaterial.color.set(0x3a0004);
    events.emit('bleed:started', { id: 'rupture', kind: 'arterial' });
    toast('msg.rupture', 'danger');
  }

  private sealRupture(): void {
    const src = this.sources.find((s) => s.id === 'rupture');
    if (!src || !src.active) return;
    src.active = false;
    state.rupture.active = false;
    state.rupture.sealed = true;
    events.emit('bleed:stopped', { id: 'rupture', kind: 'arterial' });
    toast('msg.ruptureSealed', 'info');
  }

  private coagulate(kind: string, id: string, point: THREE.Vector3): void {
    if (kind === 'bleed' || kind === 'lobe' || kind === 'vessel' || kind === 'floor') {
      // Forgiving aim: the nearest active ooze within 3 mm is coagulated.
      let best: BleedSource | null = null;
      let bestD = 3;
      for (const s of this.sources) {
        if (!s.active || s.kind !== 'ooze') continue;
        const d = s.id === id ? 0 : s.position.distanceTo(point);
        if (d < bestD) { best = s; bestD = d; }
      }
      if (best) this.stopOoze(best);
    }
    if (state.rupture.active && point.distanceTo(this.anatomy.aneurysm.blebPosition) < 4) {
      addRisk(0.05, 'bipolar-rupture');
      toast('msg.bipolarRupture', 'danger');
    }
  }

  private stopOoze(s: BleedSource): void {
    s.active = false;
    if (s.marker) {
      (s.marker.material as THREE.MeshPhysicalMaterial).color.set(0x5a3020);
      (s.marker.material as THREE.MeshPhysicalMaterial).roughness = 0.6;
      s.marker.scale.multiplyScalar(0.8);
      s.marker.userData = {};
      s.marker.raycast = () => {};
    }
    events.emit('bleed:stopped', { id: s.id, kind: 'ooze' });
    toast('msg.oozeStopped', 'info');
  }

  get poolLevel(): number {
    return Math.min(POOL_MAX_Z, POOL_FLOOR + state.poolVolume * POOL_MM_PER_ML);
  }

  /** Objects the tools can hit (pool surface, bleeding points). */
  pickables(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    if (this.pool.visible) list.push(this.pool);
    for (const s of this.sources) if (s.active && s.marker) list.push(s.marker);
    return list;
  }

  /** Source rate right now (arterial bleeding follows ICA flow and blood pressure). */
  private rateOf(s: BleedSource): number {
    if (!s.active) return 0;
    if (s.kind === 'ooze') return s.rate;
    const pressure = Math.max(0.2, state.vitals.map / 89);
    return s.rate * Math.max(0.12, flow.aneurysm) * pressure;
  }

  update(dt: number): void {
    const pulse = globalUniforms.uPulse.value;
    // Late spatula strain bruises the cortex once.
    if (!this.strainOozeDone && state.retractionStrain > 1.5) {
      this.strainOozeDone = true;
      const s = this.anatomy.spatulas.temporal;
      const p = s.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.6, -6));
      this.addOoze(p, new THREE.Vector3(0, 0.6, 0.8).normalize(), 0.1, this.anatomy.lobes.temporal);
    }

    // Bleeding into the pool.
    let rate = 0;
    for (const s of this.sources) {
      const r = this.rateOf(s);
      rate += r;
      if (r > 0) this.emit(s, r, pulse, dt);
      if (s.marker && s.active) s.marker.scale.setScalar(0.9 + 0.25 * pulse).multiply(new THREE.Vector3(1, 1, 0.55));
    }
    this.currentRate = rate;
    state.poolVolume += rate * dt;

    // Suction removes pooled blood when the tip is in or near the pool.
    if (this.suctionThisFrame && this.suctionPoint) {
      const nearSurface = this.suctionPoint.z <= this.poolLevel + 2.5;
      if (nearSurface && state.poolVolume > 0) {
        state.poolVolume = Math.max(0, state.poolVolume - SUCTION_RATE * dt);
        if (state.rupture.active) state.rupture.suctioned = true;
      }
    }
    this.suctionThisFrame = false;

    this.updatePool(dt, pulse);
    this.updateParticles(dt);
  }

  private emit(s: BleedSource, rate: number, pulse: number, dt: number): void {
    const arterial = s.kind === 'arterial';
    const perSec = arterial ? 40 + 22 * rate * (0.4 + pulse) : 6 + 30 * rate;
    const acc = (this.emitAcc.get(s.id) ?? 0) + perSec * dt;
    let n = Math.floor(acc);
    this.emitAcc.set(s.id, acc - n);
    // Ooze sources sit on tissue that may move (lobes): read the marker position.
    const origin = s.marker ? s.marker.getWorldPosition(new THREE.Vector3()) : s.position;
    while (n-- > 0 && this.pCount < MAX_PARTICLES) {
      const i = this.pCount++;
      const speed = arterial ? (18 + 40 * pulse) * Math.min(1.5, 0.4 + rate / 8) : 2 + Math.random() * 2;
      const spread = arterial ? 0.35 : 0.8;
      const dir = s.normal
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread))
        .normalize();
      this.pPos.set([origin.x, origin.y, origin.z], i * 3);
      this.pVel.set([dir.x * speed, dir.y * speed, dir.z * speed], i * 3);
      this.pLife[i] = 0;
    }
  }

  private updateParticles(dt: number): void {
    const g = 160; // mm/s², toward the depth of the field
    const level = this.pool.visible ? this.poolLevel : POOL_FLOOR;
    const m = new THREE.Matrix4();
    let w = 0;
    for (let i = 0; i < this.pCount; i++) {
      const o = i * 3;
      this.pVel[o + 2] -= g * dt;
      this.pPos[o] += this.pVel[o] * dt;
      this.pPos[o + 1] += this.pVel[o + 1] * dt;
      this.pPos[o + 2] += this.pVel[o + 2] * dt;
      this.pLife[i] += dt;
      const dead = this.pLife[i] > 1.6 || this.pPos[o + 2] < level;
      if (dead) continue;
      // Compact the live particles to the front of the arrays.
      if (w !== i) {
        this.pPos.copyWithin(w * 3, o, o + 3);
        this.pVel.copyWithin(w * 3, o, o + 3);
        this.pLife[w] = this.pLife[i];
      }
      const s = 0.7 + 0.6 * (1 - this.pLife[w] / 1.6);
      m.makeScale(s, s, s).setPosition(this.pPos[w * 3], this.pPos[w * 3 + 1], this.pPos[w * 3 + 2]);
      this.particles.setMatrixAt(w, m);
      w++;
    }
    this.pCount = w;
    this.particles.count = w;
    this.particles.instanceMatrix.needsUpdate = true;
  }

  private updatePool(dt: number, pulse: number): void {
    const vol = state.poolVolume;
    this.pool.visible = vol > 0.15;
    if (!this.pool.visible) return;
    const target = this.poolLevel;
    this.pool.position.z += (target - this.pool.position.z) * Math.min(1, dt * 4);
    // Gentle ripples, plus welling above an active arterial source.
    const pos = this.pool.geometry.attributes.position as THREE.BufferAttribute;
    const t = globalUniforms.uTime.value;
    const rupture = this.sources.find((s) => s.kind === 'arterial' && s.active);
    for (let i = 0; i < pos.count; i++) {
      const x = this.poolBase[i * 3], y = this.poolBase[i * 3 + 1];
      // Irregular, low ripples (three crossing wave trains).
      let z =
        0.035 * Math.sin(x * 0.31 + y * 0.12 + t * 1.3) +
        0.025 * Math.sin(-x * 0.17 + y * 0.43 + t * 1.9) +
        0.02 * Math.sin(x * 0.53 - y * 0.29 - t * 2.3);
      if (rupture) {
        const d = Math.hypot(x - rupture.position.x, y - rupture.position.y);
        z += Math.exp(-d * d / 18) * (0.6 + 1.4 * pulse);
      }
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    this.pool.geometry.computeVertexNormals();
  }
}
