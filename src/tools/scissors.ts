import { playSnip } from '../audio/sfx';
import { events, toast } from '../core/events';
import { addRisk, state } from '../core/state';
import { advanceNeck, onArachnoidOpened } from './fieldState';
import { scissors } from './instruments';
import { Tool, type Pick } from './types';
import { CRITICAL_BRANCHES, MAJOR_ARTERIES } from './util';

/**
 * Micro scissors: sharp opening of the arachnoid.
 * Rule: cut only membranes and adhesion bands, never vessels, nerves or the sac.
 */
export class ScissorsTool extends Tool {
  readonly id = 'scissors';
  readonly key = '2';
  override model = scissors();

  override accepts(p: Pick): boolean {
    return p.kind === 'arachnoid' || p.kind === 'adhesion';
  }

  override onPress(p: Pick | null): void {
    playSnip();
    if (!p) return;
    switch (p.kind) {
      case 'arachnoid':
        if (this.ctx.anatomy.cutArachnoid(p.id)) onArachnoidOpened(this.ctx.anatomy, p.id);
        break;
      case 'adhesion':
        // Sharp division of a band releases it at once.
        advanceNeck(this.ctx.anatomy, p.id.startsWith('proximal') ? 'proximal' : 'distal', 0.3);
        break;
      case 'vessel':
        if (MAJOR_ARTERIES.has(p.id) || CRITICAL_BRANCHES.has(p.id)) {
          state.injuries.push(`scissors:${p.id}`);
          toast('msg.scissorsArtery', 'danger');
          this.ctx.bleeding.addOoze(p.point, p.normal, 0.7, p.object);
        } else {
          toast('msg.scissorsVein', 'warn');
          this.ctx.bleeding.addOoze(p.point, p.normal, 0.35, p.object);
        }
        events.emit('structure:touched', { kind: p.kind, id: p.id, tool: this.id });
        break;
      case 'aneurysm':
        addRisk(0.6, 'scissors-dome');
        toast('msg.scissorsDome', 'danger');
        break;
      case 'nerve':
        state.injuries.push(`scissors:${p.id}`);
        toast('msg.scissorsNerve', 'danger');
        break;
      default:
        toast('msg.scissorsOnlyArachnoid', 'info');
    }
  }
}
