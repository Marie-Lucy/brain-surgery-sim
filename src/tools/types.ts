import type * as THREE from 'three';
import type { Anatomy } from '../anatomy';
import type { BleedingSystem } from '../physics/bleeding';
import type { EndoscopeView } from '../scene/endoscope';
import type { IcgView } from '../scene/icg';
import type { Stage } from '../scene/stage';
import type { InstrumentModel } from './instruments';

/** A resolved pick: the hit plus the tagged structure it belongs to. */
export interface Pick {
  hit: THREE.Intersection;
  /** The object carrying `userData.kind` (a hit on a child resolves to its owner). */
  object: THREE.Object3D;
  kind: string;
  id: string;
  point: THREE.Vector3;
  /** World-space surface normal. */
  normal: THREE.Vector3;
}

export interface ToolContext {
  anatomy: Anatomy;
  stage: Stage;
  bleeding: BleedingSystem;
  icg: IcgView;
  endoscope: EndoscopeView;
}

/**
 * Interaction contract for every instrument.
 * The ToolManager owns pointer routing, picking, hover highlight and the cursor model.
 */
export abstract class Tool {
  abstract readonly id: string;
  /** Keyboard shortcut ('1'..'9', '0'). */
  abstract readonly key: string;
  /** Mode tools (ICG) act on selection rather than on the field. */
  readonly modeOnly: boolean = false;
  /** False for instruments that arrive in a later milestone. */
  readonly available: boolean = true;
  model: InstrumentModel | null = null;
  protected ctx!: ToolContext;

  init(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  /** Which picks this tool cares about. Also drives the hover highlight. */
  accepts(_p: Pick): boolean {
    return false;
  }
  /** Kinds the ray should pass through when searching (e.g. ignore arachnoid for the Doppler). */
  passThrough(_kind: string): boolean {
    return false;
  }

  activate(): void {}
  deactivate(): void {}
  onPress(_p: Pick | null, _e: PointerEvent): void {}
  /** Called while the button is held. `dragMm` is the distance the tip moved this frame (mm). */
  onDrag(_p: Pick | null, _dragMm: number, _e: PointerEvent): void {}
  onRelease(): void {}
  /** Return true to consume the key. */
  onKey(_e: KeyboardEvent): boolean {
    return false;
  }
  /** Return true to consume the wheel (so it does not zoom the microscope). */
  onWheel(_e: WheelEvent): boolean {
    return false;
  }
  /** Per-frame update with the current hover pick. */
  update(_dt: number, _p: Pick | null, _pressed: boolean): void {}
  /** Return false to hide the instrument model (e.g. while a ghost clip is the cursor). */
  showModel(_p: Pick | null): boolean {
    return true;
  }
}
