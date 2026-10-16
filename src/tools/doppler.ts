import { DopplerSound } from '../audio/doppler';
import { VESSELS } from '../config/anatomy';
import { events } from '../core/events';
import { globalUniforms } from '../core/uniforms';
import { flow } from '../physics/flow';
import { doppler } from './instruments';
import { Tool, type Pick } from './types';

/**
 * Micro-Doppler probe: rest the tip on a vessel to hear its flow.
 * A pulsatile "whoosh" means the vessel is patent. Silence means no flow.
 * After clipping, it confirms that the PCom and AChA are still open and the
 * dome is no longer filling.
 */
export class DopplerTool extends Tool {
  readonly id = 'doppler';
  readonly key = '8';
  override model = doppler();
  private sound = new DopplerSound();
  private contact = { id: '', since: 0, reported: false };

  override accepts(p: Pick): boolean {
    return p.kind === 'vessel' || p.kind === 'aneurysm';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }

  override update(_dt: number, p: Pick | null): void {
    if (!p || !this.accepts(p)) {
      this.sound.silence();
      if (this.contact.id) events.emit('doppler:reading', { id: null, flow: 0 });
      this.contact = { id: '', since: 0, reported: false };
      return;
    }
    const id = p.kind === 'aneurysm' ? 'aneurysm' : p.id;
    const f = flow[id as keyof typeof flow] ?? 0;
    const radius = VESSELS.find((v) => v.id === id)?.radius ?? 2;
    this.sound.update(f, globalUniforms.uPulse.value, 0.5 + radius / 2.5);
    // Contact time is measured in wall-clock time, so slow frames do not delay confirmation.
    if (this.contact.id !== id) this.contact = { id, since: performance.now(), reported: false };
    events.emit('doppler:reading', { id, flow: f });
    if (!this.contact.reported && performance.now() - this.contact.since > 600) {
      this.contact.reported = true;
      events.emit('structure:touched', { kind: p.kind, id: p.id, tool: this.id });
    }
  }

  override deactivate(): void {
    this.sound.silence();
    events.emit('doppler:reading', { id: null, flow: 0 });
  }
}
