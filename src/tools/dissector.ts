import { events, toast } from '../core/events';
import { addRisk } from '../core/state';
import { advanceNeck, neckZone, onArachnoidOpened } from './fieldState';
import { dissector } from './instruments';
import { Tool, type Pick } from './types';
import { toastThrottled } from './util';

/**
 * Micro dissector: blunt dissection.
 *  - Sweep along the aneurysm NECK (proximal and distal sides) to release adhesions.
 *  - Open the thin cisternal arachnoid bluntly.
 *  - Avoid the DOME, and above all the BLEB: pressure there raises the rupture risk.
 */
export class DissectorTool extends Tool {
  readonly id = 'dissector';
  readonly key = '4';
  override model = dissector();

  override accepts(p: Pick): boolean {
    if (p.kind === 'arachnoid') return this.ctx.anatomy.arachnoid.get(p.id)?.cfg.layer === 'cistern';
    return p.kind === 'adhesion' || p.kind === 'aneurysm' || p.kind === 'vessel';
  }

  override onPress(p: Pick | null): void {
    if (!p) return;
    const anatomy = this.ctx.anatomy;
    switch (p.kind) {
      case 'arachnoid': {
        const seg = anatomy.arachnoid.get(p.id);
        if (seg?.cfg.layer === 'cistern') {
          if (anatomy.cutArachnoid(p.id)) onArachnoidOpened(anatomy, p.id);
        } else toast('msg.useScissorsSylvian', 'info');
        break;
      }
      case 'adhesion':
        advanceNeck(anatomy, p.id.startsWith('proximal') ? 'proximal' : 'distal', 0.08);
        break;
      case 'aneurysm': {
        const z = neckZone(anatomy, p.point, p.id);
        if (z.zone === 'bleb') {
          addRisk(0.12, 'dissector-bleb');
          toast('msg.blebTouch', 'danger');
        } else if (z.zone === 'dome') {
          addRisk(0.03, 'dissector-dome');
          toastThrottled('msg.domeTouch', 'warn');
        } else {
          advanceNeck(anatomy, z.side, 0.04);
        }
        break;
      }
      case 'vessel':
      case 'nerve':
        events.emit('structure:touched', { kind: p.kind, id: p.id, tool: this.id });
        break;
    }
  }

  override onDrag(p: Pick | null, dragMm: number): void {
    if (!p || dragMm <= 0) return;
    const anatomy = this.ctx.anatomy;
    if (p.kind === 'adhesion') {
      advanceNeck(anatomy, p.id.startsWith('proximal') ? 'proximal' : 'distal', dragMm / 10);
    } else if (p.kind === 'aneurysm') {
      const z = neckZone(anatomy, p.point, p.id);
      if (z.zone === 'neck') advanceNeck(anatomy, z.side, dragMm / 14);
      else if (z.zone === 'bleb') {
        addRisk(dragMm * 0.05, 'dissector-bleb-drag');
        toastThrottled('msg.blebTouch', 'danger', 2);
      } else {
        addRisk(dragMm * 0.012, 'dissector-dome-drag');
        toastThrottled('msg.domeTouch', 'warn');
      }
    }
  }
}
