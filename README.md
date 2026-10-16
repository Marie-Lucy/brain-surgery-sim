# IC-PC Aneurysm Clipping Simulator (educational)

A browser-based 3D simulator of microsurgical clipping of a right internal carotid–posterior communicating artery (IC-PC) aneurysm through a pterional, transsylvian approach. The view imitates an operating microscope.

> **Educational demonstration only.** It is not a clinical training device and not medical advice.

**Live:** https://marie-lucy.github.io/brain-surgery-sim/

## What it does
- **Microscope view:** round field stop, warm light, shallow depth of field with autofocus, bloom, and pulsating wet tissue.
- **Procedural anatomy** (1 unit = 1 mm, all sizes and positions in `src/config/anatomy.ts`):
  - frontal and temporal lobes with the sylvian fissure and cuttable arachnoid
  - ICA, M1, M2, A1, PCom, AChA and the superficial sylvian vein
  - optic and oculomotor nerves
  - a 6.6 mm aneurysm with a bleb on the dome
  - brain spatulas
- **10 instruments** (keys 1–0): suction, micro scissors, bipolar, dissector, spatula, clip (straight or curved, 5/7/9 mm), ICG, micro-Doppler, endoscope and temporary clip.
- **6 procedure stages** with a checklist and a mentor panel. Demo mode plays the whole case, and a click takes over.
- **Vitals:** ECG and arterial line, HR, ABP, SpO₂, MEP, EBL, op time and temporary occlusion timer, with alarms.
- **Bleeding:** ooze that the bipolar stops, intraoperative rupture driven by a hidden risk value, and a blood pool that suction clears.
- **Clip evaluation:** neck closure, residual neck, ICA narrowing and PCom/AChA capture. The result shows through Doppler and ICG.
- **Debrief** with personalised tips. English/Spanish toggle.

## Controls
- Drag or right-drag tilts the microscope. Middle-drag or Shift+drag pans. The wheel or a pinch zooms; with an instrument in hand, use Shift+wheel.
- 1–0 pick an instrument and Esc puts it down.
- L toggles labels, R resets the view, M collapses the mentor panel and H shows the help.
- Clip: click to fix the position, Q/E rotate, the wheel sets blade depth, [ ] change blade length, C switches straight/curved, click to close, X removes the last clip.

## Development
```
npm install
npm run dev     # local dev server
npm run build   # type-check + production build
```
Every push to the deploy branch triggers a GitHub Pages deployment (`.github/workflows/deploy.yml`).

Code layout: `src/scene`, `anatomy`, `tools`, `procedure`, `physics`, `audio`, `ui`, `core`. See [PLAN.md](PLAN.md).
