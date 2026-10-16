import { playSizzle } from '../audio/sfx';
import { events, toast } from '../core/events';
import { addRisk, state } from '../core/state';
import { bipolar } from './instruments';
import { Tool, type Pick } from './types';
import { CRITICAL_BRANCHES, MAJOR_ARTERIES } from './util';

/**
 * Bipolar forceps: precise coagulation between the two tips.
 * Use: small bleeding points and pial or arachnoid vessels.
 * Never: major arteries, perforators (PCom/AChA), nerves or the aneurysm dome.
 */
export class BipolarTool extends Tool {
  readonly id = 'bipolar';
  readonly key = '3';
  override model = bipolar();

  override accepts(p: Pick): boolean {
    return p.kind === 'bleed' || p.kind === 'lobe';
  }
  override passThrough(kind: string): boolean {
    return kind === 'arachnoid' || kind === 'adhesion';
  }

  override onPress(p: Pick | null): void {
    playSizzle();
    if (!p) return;
    const anatomy = this.ctx.anatomy;
    events.emit('coagulate', { kind: p.kind, id: p.id, point: p.point.toArray() as [number, number, number] });
    switch (p.kind) {
      case 'bleed':
        state.coagulations++;
        break; // the bleeding system stops the ooze
      case 'blood':
        toast('msg.suctionFirst', 'info');
        break;
      case 'lobe':
        state.coagulations++;
        anatomy.addCoagMark(p.object, p.point, p.normal);
        break;
      case 'vessel':
        if (MAJOR_ARTERIES.has(p.id) || CRITICAL_BRANCHES.has(p.id)) {
          state.injuries.push(`bipolar:${p.id}`);
          toast(CRITICAL_BRANCHES.has(p.id) ? 'msg.bipolarPerforator' : 'msg.bipolarArtery', 'danger');
        } else {
          toast('msg.bipolarVein', 'warn');
        }
        anatomy.addCoagMark(p.object, p.point, p.normal, 0.35);
        break;
      case 'aneurysm':
        addRisk(0.25, 'bipolar-dome');
        toast('msg.bipolarDome', 'danger');
        break;
      case 'nerve':
        state.injuries.push(`bipolar:${p.id}`);
        toast('msg.bipolarNerve', 'danger');
        break;
    }
  }
}
