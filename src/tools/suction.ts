import { SuctionSound } from '../audio/sfx';
import { events } from '../core/events';
import { addRisk } from '../core/state';
import { suction } from './instruments';
import { Tool, type Pick } from './types';
import { toastThrottled } from './util';

/**
 * Suction: keeps the field dry (CSF, blood).
 * Rule: never apply suction directly on the cortex or the aneurysm dome. Work over
 * a cottonoid patty or in the pool of fluid.
 */
export class SuctionTool extends Tool {
  readonly id = 'suction';
  readonly key = '1';
  override model = suction();
  private sound = new SuctionSound();
  private onCortex = 0;

  override accepts(p: Pick): boolean {
    return p.kind === 'blood' || p.kind === 'bleed';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }

  override update(dt: number, p: Pick | null, pressed: boolean): void {
    this.sound.set(pressed, p?.kind === 'blood' || p?.kind === 'bleed' ? 1 : 0);
    if (!pressed || !p) {
      this.onCortex = 0;
      return;
    }
    events.emit('suction', { point: p.point.toArray() as [number, number, number], active: true });
    if (p.kind === 'lobe') {
      this.onCortex += dt;
      if (this.onCortex > 1.2) toastThrottled('msg.suctionCortex', 'warn', 6);
    } else if (p.kind === 'aneurysm') {
      addRisk(dt * 0.25, 'suction-dome');
      toastThrottled('msg.suctionDome', 'danger', 3);
    }
  }

  override deactivate(): void {
    this.sound.set(false);
  }
}
