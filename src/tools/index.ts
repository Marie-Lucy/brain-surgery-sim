import { BipolarTool } from './bipolar';
import { ClipTool } from './clip';
import { DissectorTool } from './dissector';
import { DopplerTool } from './doppler';
import { EndoscopeTool, IcgTool } from './later';
import { ScissorsTool } from './scissors';
import { SpatulaTool } from './spatula';
import { SuctionTool } from './suction';
import { TempClipTool } from './tempClip';
import type { Tool } from './types';

export { ToolManager } from './manager';
export { ClipTool, TempClipTool };

/** Instruments in toolbar order (keys 1..9, 0). */
export function createTools(): Tool[] {
  return [
    new SuctionTool(),
    new ScissorsTool(),
    new BipolarTool(),
    new DissectorTool(),
    new SpatulaTool(),
    new ClipTool(),
    new IcgTool(),
    new DopplerTool(),
    new EndoscopeTool(),
    new TempClipTool(),
  ];
}
