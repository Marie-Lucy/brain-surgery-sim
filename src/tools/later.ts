import { state } from '../core/state';
import { reticle } from './instruments';
import { Tool, type Pick } from './types';

/**
 * ICG videoangiography (7): selecting it injects the dye and switches the
 * microscope to its near-infrared view. Selecting any other instrument, or
 * pressing 7 / Esc again, returns to white light.
 */
export class IcgTool extends Tool {
  readonly id = 'icg';
  readonly key = '7';
  override readonly modeOnly = true;
  override model = reticle();

  override activate(): void {
    this.ctx.icg.start();
  }
  override deactivate(): void {
    this.ctx.icg.stop();
  }
  override onPress(): void {
    // A click re-injects: restart the dye run.
    this.ctx.icg.stop();
    this.ctx.icg.start();
  }
}

/**
 * Endoscope (9): a 30° scope placed behind the aneurysm, shown as a
 * picture-in-picture. Drag (or Q/E) to orbit around the neck; the wheel moves it
 * closer or further.
 */
export class EndoscopeTool extends Tool {
  readonly id = 'endoscope';
  readonly key = '9';
  private lastX: number | null = null;

  override accepts(_p: Pick): boolean {
    return false;
  }
  override showModel(): boolean {
    return false;
  }
  override activate(): void {
    this.ctx.endoscope.show();
    state.endoscopeUsed = true;
  }
  override deactivate(): void {
    this.ctx.endoscope.hide();
  }
  override onPress(_p: Pick | null, e: PointerEvent): void {
    this.lastX = e.clientX;
  }
  override onDrag(_p: Pick | null, _mm: number, e: PointerEvent): void {
    if (this.lastX === null) return;
    this.ctx.endoscope.orbit((e.clientX - this.lastX) * 0.01);
    this.lastX = e.clientX;
  }
  override onRelease(): void {
    this.lastX = null;
  }
  override onKey(e: KeyboardEvent): boolean {
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'e') {
      this.ctx.endoscope.orbit(k === 'q' ? 0.15 : -0.15);
      return true;
    }
    return false;
  }
  override onWheel(e: WheelEvent): boolean {
    this.ctx.endoscope.orbit(0, Math.sign(e.deltaY) * 0.5);
    return true;
  }
}
