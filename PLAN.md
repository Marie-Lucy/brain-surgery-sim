# IC-PC Aneurysm Clipping Simulator — Plan

Browser-based **educational** simulator of microsurgical clipping of a right
internal carotid–posterior communicating artery (IC-PC) aneurysm through a
pterional, transsylvian approach. It is for education and demonstration only,
not for clinical training or medical advice. The start screen says so in EN and ES.

## Stack
- Vite + TypeScript (strict) + Three.js
- `postprocessing` (pmndrs) for the microscope look: vignette, depth of field, bloom, warm tone
- Web Audio API (synthesized, no audio files) for Doppler, alarms and monitor beeps
- No backend. All state lives in memory.
- Deployed to GitHub Pages with GitHub Actions

## Folder layout
```
src/
  main.ts                 app bootstrap, start screen, game loop
  config/anatomy.ts       ALL anatomy sizes/positions (1 unit = 1 mm) <- tune here
  scene/                  renderer, microscope camera + controls, postprocessing, lighting
  anatomy/                lobes, fissure, arachnoid, vessels (TubeGeometry), nerves, aneurysm, spatulas, materials
  tools/                  tool base class, one file per tool, cursor models, toolbar binding
  procedure/              stage machine, goals/sub-tasks, demo-mode scripts, clip evaluation
  physics/                bleeding model, blood particles + pooling layer, rupture risk, flow model
  audio/                  Doppler synth, alarms, ECG beep
  ui/                     panels (checklist, mentor, vitals/ECG, toolbar, debrief), i18n (en/es), styles
  core/                   event bus, simulation state store, clock
```
Modules talk through a small typed event bus (`core/events.ts`) and one shared
state store, so tools, physics, vitals and the UI stay loosely coupled.

## Key design decisions
- **Scale:** `MM = 1` in `config/anatomy.ts`. The ICA is about 4.5 mm wide, M1 about 3 mm, A1 about 2 mm, PCom about 1.2 mm and AChA about 0.8 mm. The aneurysm dome is 6.6 mm with a neck of about 3.5 mm and a 1.2 mm bleb. These are typical textbook values that you can tune.
- **Orientation:** a right pterional view through the microscope, as the surgeon sees it. Frontal lobe at the top of the field, temporal lobe at the bottom, sylvian fissure between them. Deep in the field: optic nerve medially, the ICA lateral to it, and the PCom and aneurysm behind the ICA, with the dome pointing posterolaterally and downward toward the tentorium and CN III.
- **Vessels:** Catmull-Rom splines → `TubeGeometry`, with per-vessel radius and flow state. Each vessel carries a `flow` value from 0 to 1, computed by a simple network model (`physics/flow.ts`). That one value drives the Doppler, ICG, ischemia and MEP.
- **Arachnoid:** split into individually cuttable segments (thin, semi-transparent, with a fresnel sheen). Cutting a segment removes it and loosens the fissure, which lets the spatulas retract further.
- **Materials:** `MeshPhysicalMaterial` with clearcoat for wet tissue, procedural normal noise, and vertex pulsation driven by a shared `heartPhase` uniform.
- **Camera:** an orbit-style "microscope" camera with a limited cone. Right-drag to tilt, wheel to zoom/focus, middle-drag to pan. Depth-of-field focus follows the cursor hit point. The tool is controlled with the left mouse button.
- **Tools:** each tool implements `onHover / onPress / onDrag / onRelease / update` against a raycast target with tags (`arachnoid`, `vessel`, `aneurysm-dome`, `aneurysm-neck`, `blood-pool`, `bleed-point`, `lobe`). Keys 1–0 select tools. The clip tool has its own sub-mode: position → rotate (Q/E) → blade depth (wheel) → apply (click), with straight and curved variants (C).
- **Bleeding:** bleed sources include ooze (rate is low, bipolar stops it) and arterial rupture (rate is high and scales with ICA flow, so a temporary clip cuts it to a trickle). They emit GPU-instanced droplets plus a pooling plane whose height rises with the uncleared volume and obscures the anatomy below it. Suction lowers the pool locally. EBL builds up over time.
- **Rupture risk:** a hidden 0–1 value. It rises with dome contact, forceful dissector drags on the dome, clip blades closing on the dome, and high BP. Once it passes a threshold (with some randomness), the sac ruptures at the bleb.
- **Vitals:** a lightweight physiology model with smooth random drift. Blood loss → BP falls and HR rises. Temporary occlusion time → MEP declines after about 5 min, faster after 10. Vessels left occluded after the clip → MEP falls. The ECG is drawn on a canvas from a synthetic PQRST template at the current HR.
- **Clip evaluation:** a geometric test of where the blades sit against the neck plane. It measures neck coverage and residual neck, whether the ICA lumen is narrowed (clip intrudes into the parent vessel), and whether the PCom or AChA is caught between the blades. Results feed the flow model, so ICG and Doppler show them directly: a filling dome means residual aneurysm, and a dark PCom means it is occluded.
- **ICG:** swaps every material for a fluorescence shader. Background is black and vessels glow green-white in proportion to `flow`, with an arterial→venous fill animation over a few seconds.
- **Endoscope:** a second camera rendered to a picture-in-picture viewport and placed behind the aneurysm. It shows the back wall of the neck and the PCom/AChA relationship.
- **Demo mode:** each stage has a scripted sequence of tool actions that run through the same tool API. Any user click or key press hands control back to the user.
- **i18n:** a flat key → `{en, es}` dictionary with a toggle on the start screen and in the header.

## Stages and goals
1. **Open the sylvian fissure** — cut at least N of the superficial and deep arachnoid segments, then place the spatulas.
2. **Identify M1** — hover or Doppler-touch M1 and confirm.
3. **Identify the ICA and optic nerve** — cut the carotid/optic cisternal arachnoid, then touch the ICA and the optic nerve.
4. **Confirm the PCom and dissect the neck** — identify the PCom and AChA, then free the proximal and distal neck with the dissector. A temporary clip is optional.
5. **Clip the aneurysm** — apply a definitive clip and remove any temporary clip.
6. **Confirm PCom patency** — run ICG and Doppler on the PCom, AChA and dome. Reposition the clip if needed.

## Milestones (each one builds and deploys)
- **M1** — Vite/TS scaffold, GitHub Actions → Pages, start screen with disclaimer and EN/ES toggle, microscope camera, postprocessing, all procedural anatomy from the config, pulsation
- **M2** — toolbar with keys 1–0, cursor models, hover highlight, raycast interaction rules for all 10 tools (some only as stubs until M4/M5)
- **M3** — stage machine, left checklist, mentor panel (collapsible, sub-tasks, %)
- **M4** — vitals panel with ECG, physiology model, bleeding/ooze/rupture, suction, bipolar, temporary clip timer, alarms
- **M5** — full clip tool, clip evaluation, flow model, ICG view, Doppler audio, endoscope PiP
- **M6** — debrief screen with tips, demo mode, polish and performance pass

After each milestone I run `npm run build`, fix any errors, commit, push, and tell you what to test.

## Deployment
- `vite.config.ts`: `base: '/brain-surgery-sim/'`
- `.github/workflows/deploy.yml`: on push to `main` → `npm ci` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- Live URL: **https://marie-lucy.github.io/brain-surgery-sim/**
- **One-time setup you need to do:** Repo → Settings → Pages → Source: **GitHub Actions**.

## Open questions for you
1. **Branch → main.** I have to work on `claude/inspiring-newton-oz5t89`, but the deploy runs on pushes to `main`, and the repo is empty, so `main` doesn't exist yet. Options:
   (a) after each milestone I open a PR to `main`, and you merge it to deploy (**recommended**), or
   (b) the workflow also deploys from my branch, so every push goes live without a merge.
2. Is the realism level OK: stylized procedural anatomy, no textures or imported models, with anatomical accuracy in proportions and relationships rather than photorealism?
3. Any tool or stage you'd like to drop or simplify to reach a playable build sooner?
