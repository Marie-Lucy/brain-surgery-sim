import * as THREE from 'three';
import { ARACHNOID, FISSURE, LOBES, NERVES, SPATULAS, VESSELS, type VesselId } from '../config/anatomy';
import { events } from '../core/events';
import { createNeckAdhesions, type AdhesionStrand } from './adhesions';
import { createAneurysm, type AneurysmRuntime } from './aneurysm';
import { createArachnoidSegment, fitToGap, type ArachnoidRuntime } from './arachnoid';
import { createFloor } from './floor';
import { createLobe } from './lobes';
import { closestT } from './raycastProxy';
import { createSpatula } from './spatulas';
import { createNerve, createVessel, type NerveRuntime, type VesselRuntime } from './vessels';

export interface LabelAnchor {
  key: string;
  /** Returns the current world position of the label anchor. */
  position: () => THREE.Vector3;
  /** Mesh used to check visibility (labels hide when the structure is hidden). */
  owner: THREE.Object3D;
}

/**
 * The whole surgical field. Other modules (tools, physics, UI) query this
 * object instead of reaching into the scene graph.
 */
export class Anatomy {
  readonly root = new THREE.Group();
  readonly lobes: { frontal: THREE.Mesh; temporal: THREE.Mesh };
  readonly vessels = new Map<VesselId, VesselRuntime>();
  readonly nerves = new Map<string, NerveRuntime>();
  readonly aneurysm: AneurysmRuntime;
  readonly arachnoid = new Map<string, ArachnoidRuntime>();
  readonly spatulas: { frontal: THREE.Mesh; temporal: THREE.Mesh };
  readonly floor: THREE.Mesh;
  readonly labels: LabelAnchor[] = [];
  readonly adhesions: AdhesionStrand[];
  /** ICA direction (proximal → distal) at the aneurysm neck. */
  readonly icaTangentAtNeck: THREE.Vector3;
  /** Parent for placed clips and other instruments left in the field. */
  readonly implants = new THREE.Group();
  private tweens: ((dt: number) => boolean)[] = [];
  /** Current half-width of the sylvian fissure opening (mm). */
  halfGap = FISSURE.closedHalfGap;

  constructor() {
    this.root.name = 'anatomy';

    this.lobes = {
      frontal: createLobe(LOBES.frontal, 'frontal', 1.7),
      temporal: createLobe(LOBES.temporal, 'temporal', 4.3),
    };
    this.root.add(this.lobes.frontal, this.lobes.temporal);

    for (const cfg of VESSELS) {
      const v = createVessel(cfg);
      this.vessels.set(cfg.id, v);
      this.root.add(v.mesh);
    }
    // Smooth the ICA bifurcation with a small sphere so M1 and A1 blend into the ICA.
    const ica = this.vessels.get('ica')!;
    const bif = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 16), ica.material);
    bif.position.copy(ica.curve.getPointAt(1));
    bif.userData = ica.mesh.userData;
    ica.mesh.add(bif);

    for (const cfg of NERVES) {
      const n = createNerve(cfg);
      this.nerves.set(cfg.id, n);
      this.root.add(n.mesh);
    }

    this.aneurysm = createAneurysm();
    this.root.add(this.aneurysm.group);

    const icaT = closestT(ica.curve, this.aneurysm.neckCenter);
    this.icaTangentAtNeck = ica.curve.getTangentAt(icaT).normalize();
    const pcom = this.vessels.get('pcom')!.curve, acha = this.vessels.get('acha')!.curve;
    const temporalAnchor = new THREE.Vector3(9, -8, -38);
    this.adhesions = createNeckAdhesions(this.aneurysm.neckCenter, this.aneurysm.axis, this.icaTangentAtNeck, {
      proximal: [pcom.getPointAt(0.25), pcom.getPointAt(0.42), ica.curve.getPointAt(Math.max(0, icaT - 0.12)), new THREE.Vector3(-1, -6, -41)],
      distal: [acha.getPointAt(0.3), acha.getPointAt(0.5), temporalAnchor, ica.curve.getPointAt(Math.min(1, icaT + 0.14))],
    });
    for (const a of this.adhesions) this.root.add(a.mesh);
    this.implants.name = 'implants';
    this.root.add(this.implants);

    ARACHNOID.forEach((cfg, i) => {
      const seg = createArachnoidSegment(cfg, i * 1.37);
      this.arachnoid.set(cfg.id, seg);
      this.root.add(seg.mesh);
    });

    this.spatulas = { frontal: createSpatula('frontal'), temporal: createSpatula('temporal') };
    this.root.add(this.spatulas.frontal, this.spatulas.temporal);

    this.floor = createFloor();
    this.root.add(this.floor);

    this.buildLabels();
    this.setHalfGap(this.halfGap);
  }

  /** Open or close the sylvian fissure by moving the opercula apart. */
  setHalfGap(halfGap: number): void {
    this.halfGap = THREE.MathUtils.clamp(halfGap, FISSURE.closedHalfGap, FISSURE.openHalfGap);
    const f = LOBES.frontal.center, t = LOBES.temporal.center;
    this.lobes.frontal.position.set(f[0], f[1] + this.halfGap, f[2]);
    this.lobes.temporal.position.set(t[0], t[1] - this.halfGap, t[2]);
    for (const seg of this.arachnoid.values()) fitToGap(seg, this.halfGap);
    const shift = this.halfGap - FISSURE.closedHalfGap;
    for (const v of this.vessels.values()) {
      if (v.cfg.followsLobe) v.mesh.position.y = v.cfg.followsLobe === 'frontal' ? shift : -shift;
    }

    // Spatulas are only placed once there is room for them.
    const show = this.halfGap > 2.5;
    this.spatulas.frontal.visible = show;
    this.spatulas.temporal.visible = show;
    this.spatulas.frontal.position.set(SPATULAS.frontalX, this.halfGap - 0.6, 0);
    this.spatulas.temporal.position.set(SPATULAS.temporalX, -this.halfGap + 0.6, 0);
    events.emit('fissure:changed', { halfGap: this.halfGap });
  }

  /**
   * How far the fissure may be opened, 0..1, given the arachnoid already cut.
   * Superficial segments matter most. Deep sylvian bands release the rest.
   */
  fissureFreedom(cut: Set<string>): number {
    const weights: Record<string, number> = { sf1: 0.16, sf2: 0.16, sf3: 0.16, sf4: 0.16, ds1: 0.18, ds2: 0.18 };
    let f = 0;
    for (const id of cut) f += weights[id] ?? 0;
    return Math.min(1, f);
  }

  /** Open an arachnoid segment: the cut edges retract and the veil fades away. */
  cutArachnoid(id: string): boolean {
    const seg = this.arachnoid.get(id);
    if (!seg || seg.cut) return false;
    seg.cut = true;
    const startOpacity = seg.material.opacity;
    const z0 = seg.mesh.position.z;
    let t = 0;
    this.tweens.push((dt) => {
      t = Math.min(1, t + dt / 0.7);
      seg.material.opacity = startOpacity * (1 - t);
      seg.mesh.position.z = z0 - 0.8 * t;
      seg.mesh.scale.x = 1 - 0.35 * t;
      if (t >= 1) seg.mesh.visible = false;
      return t < 1;
    });
    return true;
  }

  /** Show neck adhesions according to dissection progress on each side. */
  setNeckDissection(progress: { proximal: number; distal: number }): void {
    for (const a of this.adhesions) {
      const freed = progress[a.side] >= a.threshold;
      if (freed && a.mesh.visible && !a.mesh.userData.fading) {
        a.mesh.userData.fading = true;
        const mat = (a.mesh.material as THREE.MeshPhysicalMaterial).clone();
        a.mesh.material = mat;
        let t = 0;
        this.tweens.push((dt) => {
          t = Math.min(1, t + dt / 0.4);
          mat.opacity = 0.75 * (1 - t);
          if (t >= 1) a.mesh.visible = false;
          return t < 1;
        });
      }
    }
  }

  /** Small blanched spot where bipolar coagulation touched tissue. */
  addCoagMark(target: THREE.Object3D, point: THREE.Vector3, normal: THREE.Vector3, radius = 0.55): void {
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd8c3a0,
        roughness: 0.8,
        transparent: true,
        opacity: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    const worldPos = point.clone().addScaledVector(normal, 0.16);
    mark.position.copy(target.worldToLocal(worldPos));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const parentQ = target.getWorldQuaternion(new THREE.Quaternion()).invert();
    mark.quaternion.copy(parentQ.multiply(q));
    mark.raycast = () => {}; // decals are not pickable
    target.add(mark);
  }

  update(dt: number): void {
    if (this.tweens.length) this.tweens = this.tweens.filter((fn) => fn(dt));
  }

  /** Meshes the tools can interact with. */
  pickables(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [this.lobes.frontal, this.lobes.temporal, this.floor];
    for (const v of this.vessels.values()) list.push(v.mesh);
    for (const n of this.nerves.values()) list.push(n.mesh);
    list.push(this.aneurysm.dome, this.aneurysm.bleb);
    for (const a of this.arachnoid.values()) if (!a.cut) list.push(a.mesh);
    for (const a of this.adhesions) if (a.mesh.visible) list.push(a.mesh);
    return list;
  }

  private buildLabels(): void {
    const onCurve = (curve: THREE.Curve<THREE.Vector3>, t: number, obj?: THREE.Object3D) => () =>
      obj ? obj.localToWorld(curve.getPointAt(t)) : curve.getPointAt(t);
    const lobe = (mesh: THREE.Mesh, local: THREE.Vector3) => () => mesh.localToWorld(local.clone());
    this.labels.push(
      { key: 'anat.frontal', position: lobe(this.lobes.frontal, new THREE.Vector3(14, -18, 22)), owner: this.lobes.frontal },
      { key: 'anat.temporal', position: lobe(this.lobes.temporal, new THREE.Vector3(10, 16, 24)), owner: this.lobes.temporal },
    );
    const vesselLabels: [VesselId, number, string][] = [
      ['ica', 0.15, 'anat.ica'],
      ['m1', 0.5, 'anat.m1'],
      ['m2sup', 0.7, 'anat.m2'],
      ['a1', 0.55, 'anat.a1'],
      ['pcom', 0.55, 'anat.pcom'],
      ['acha', 0.7, 'anat.acha'],
      ['ssv', 0.35, 'anat.ssv'],
    ];
    for (const [id, t, key] of vesselLabels) {
      const v = this.vessels.get(id)!;
      this.labels.push({ key, position: onCurve(v.curve, t, v.mesh), owner: v.mesh });
    }
    const on = this.nerves.get('optic')!, cn3 = this.nerves.get('oculomotor')!;
    this.labels.push(
      { key: 'anat.optic', position: onCurve(on.curve, 0.35), owner: on.mesh },
      { key: 'anat.cn3', position: onCurve(cn3.curve, 0.75), owner: cn3.mesh },
      { key: 'anat.aneurysm', position: () => this.aneurysm.domeCenter.clone(), owner: this.aneurysm.dome },
    );
  }
}
