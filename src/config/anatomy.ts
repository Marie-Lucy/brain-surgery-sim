/**
 * ANATOMY CONFIGURATION — the single place to tune sizes and positions.
 *
 * Units: 1 scene unit = 1 millimetre (MM = 1).
 *
 * Coordinate frame (right pterional approach, the view through the microscope):
 *   +x  lateral: toward the patient's right side and the sylvian fissure's superficial opening (screen right)
 *   -x  medial: toward the midline, optic chiasm and the other carotid (screen left)
 *   +y  toward the FRONTAL lobe (screen up; roughly anterior-superior)
 *   -y  toward the TEMPORAL lobe (screen down; roughly posterior-inferior)
 *   +z  toward the surgeon / microscope (superficial)
 *   -z  deep, toward the skull base and basal cisterns
 *
 * The cortical surface at the fissure sits near z = 0. The carotid cistern lies
 * roughly 30–45 mm deep, which matches a typical working depth for a transsylvian
 * exposure.
 *
 * All values are stylized but keep textbook proportions. They are for
 * education, not for surgical planning.
 */

export const MM = 1;

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Lobes
// ---------------------------------------------------------------------------
export interface LobeConfig {
  /** Centre of the lobe mass when the fissure is closed (gap = 0). */
  center: Vec3;
  /** Half-extents along x and y (mm). */
  radii: [number, number];
  /** Height above the centre (toward the surgeon) and depth below it. */
  zTop: number;
  zBottom: number;
  /** Shape exponents: <1 = boxier (flatter opercular faces), >1 = rounder. */
  boxinessXY: number;
  boxinessTop: number;
  boxinessBottom: number;
  /** Gyral relief (mm) and sulcal pattern scale. */
  gyriDepth: number;
  gyriScale: number;
  color: number;
}

export const LOBES: { frontal: LobeConfig; temporal: LobeConfig } = {
  // The frontal operculum forms the upper lip of the sylvian fissure. Its
  // orbital (basal) surface sits over the optic nerve and the ICA.
  frontal: {
    center: [4, 30, -22],
    radii: [48, 30],
    zTop: 22,
    zBottom: 22,
    boxinessXY: 0.55,
    boxinessTop: 0.45,
    boxinessBottom: 1.1,
    gyriDepth: 1.5,
    gyriScale: 0.11,
    color: 0xcf8a78,
  },
  // The temporal operculum forms the lower lip. Medially, the uncus is
  // close to the PCom and the oculomotor nerve.
  temporal: {
    center: [12, -27, -24],
    radii: [42, 27],
    zTop: 24,
    zBottom: 20,
    boxinessXY: 0.55,
    boxinessTop: 0.45,
    boxinessBottom: 1.1,
    gyriDepth: 1.4,
    gyriScale: 0.12,
    color: 0xcc8270,
  },
};

/** Half-width of the sylvian fissure gap (mm). Closed = arachnoid intact; open = after dissection and retraction. */
export const FISSURE = {
  closedHalfGap: 0.35,
  openHalfGap: 10.5,
};

// ---------------------------------------------------------------------------
// Vessels (built as TubeGeometry along Catmull-Rom splines)
// ---------------------------------------------------------------------------
export type VesselId =
  | 'ica'
  | 'm1'
  | 'm2sup'
  | 'm2inf'
  | 'a1'
  | 'pcom'
  | 'acha'
  | 'ssv';

export interface VesselConfig {
  id: VesselId;
  /** Radius in mm (half the outer diameter). */
  radius: number;
  /** Radius at the distal end (tapering). Defaults to radius. */
  radiusEnd?: number;
  points: Vec3[];
  /** Arteries are red; veins are bluish purple. */
  kind: 'artery' | 'vein';
  /** Fraction of the artery's flow at baseline. Used later by the Doppler and ICG. */
  baselineFlow: number;
  /** Superficial vessels move with a lobe when the fissure opens. */
  followsLobe?: 'frontal' | 'temporal';
}

/*
 * ICA (internal carotid artery), supraclinoid segment: it leaves the distal dural
 * ring next to the anterior clinoid, runs lateral to the optic nerve and ends at
 * the terminal bifurcation into the MCA (M1) and ACA (A1).
 * Branches in order, proximal to distal: ophthalmic (not modelled), PCom, AChA.
 */
export const ICA_PATH: Vec3[] = [
  [-3.0, -7.0, -42.0], // proximal: distal dural ring
  [-2.0, -3.0, -38.5],
  [-0.6, 1.0, -35.3], // communicating segment: PCom and aneurysm here
  [0.6, 5.0, -32.4], // AChA origin
  [1.5, 9.0, -30.0], // terminal bifurcation
];

export const VESSELS: VesselConfig[] = [
  { id: 'ica', radius: 2.25, points: ICA_PATH, kind: 'artery', baselineFlow: 1 },
  // M1 (sphenoidal segment of the MCA) runs laterally in the depth of the
  // fissure toward the limen insulae. Following M1 back medially leads you to the ICA.
  {
    id: 'm1',
    radius: 1.5,
    radiusEnd: 1.35,
    points: [
      [1.5, 9.0, -30.0],
      [6.0, 10.4, -29.2],
      [13.0, 10.2, -27.0],
      [20.0, 9.2, -24.0],
      [26.0, 8.0, -21.0],
    ],
    kind: 'artery',
    baselineFlow: 0.6,
  },
  // M2 trunks: the MCA bifurcates near the limen insulae into a superior trunk
  // (frontal side) and an inferior trunk (temporal side) that climb the insula.
  {
    id: 'm2sup',
    radius: 1.1,
    radiusEnd: 0.9,
    points: [
      [26.0, 8.0, -21.0],
      [30.0, 9.4, -17.5],
      [35.0, 9.6, -13.0],
      [41.0, 9.4, -8.0],
    ],
    kind: 'artery',
    baselineFlow: 0.3,
  },
  {
    id: 'm2inf',
    radius: 1.1,
    radiusEnd: 0.9,
    points: [
      [26.0, 8.0, -21.0],
      [30.0, 5.0, -17.5],
      [35.0, 2.0, -13.0],
      [41.0, 0.0, -8.0],
    ],
    kind: 'artery',
    baselineFlow: 0.3,
  },
  // A1 (precommunicating segment of the ACA) runs medially over the optic
  // nerve and chiasm toward the anterior communicating artery.
  {
    id: 'a1',
    radius: 1.0,
    points: [
      [1.5, 9.0, -30.0],
      [-3.0, 11.0, -31.0],
      [-9.0, 13.0, -32.5],
      [-15.0, 14.0, -34.0],
      [-21.0, 15.0, -36.0],
    ],
    kind: 'artery',
    baselineFlow: 0.3,
  },
  // PCom (posterior communicating artery) arises from the posterior/medial wall of
  // the ICA and runs back and medially to join the PCA. It passes *under* the
  // ICA as seen from a pterional view, which is why it is often hidden behind
  // the aneurysm and needs an endoscope or gentle mobilisation to see.
  {
    id: 'pcom',
    radius: 0.65,
    radiusEnd: 0.6,
    points: [
      [-0.8, 0.0, -35.8],
      [-1.8, -2.5, -39.5],
      [-3.8, -5.5, -42.5],
      [-7.0, -8.5, -44.8],
      [-11.0, -10.5, -46.0],
    ],
    kind: 'artery',
    baselineFlow: 0.1,
  },
  // AChA (anterior choroidal artery) arises a few mm distal to the PCom and runs
  // posterolaterally. It supplies the internal capsule, so it must stay patent.
  // A clip blade that catches the AChA can cause hemiplegia.
  {
    id: 'acha',
    radius: 0.42,
    radiusEnd: 0.36,
    points: [
      [0.4, 4.2, -32.9],
      [2.8, 2.5, -35.0],
      [5.6, 0.0, -37.8],
      [8.6, -3.5, -40.4],
      [11.0, -7.5, -42.5],
    ],
    kind: 'artery',
    baselineFlow: 0.05,
  },
  // Superficial sylvian vein: runs along the temporal side of the fissure surface.
  // In this approach the arachnoid is usually opened on its frontal side so the
  // vein stays with the temporal lobe.
  {
    id: 'ssv',
    radius: 0.95,
    points: [
      [48.0, -2.4, -0.6],
      [36.0, -1.9, -0.2],
      [24.0, -1.8, 0.0],
      [12.0, -2.1, -0.2],
      [2.0, -2.8, -0.8],
    ],
    kind: 'vein',
    baselineFlow: 0,
    followsLobe: 'temporal',
  },
];

// ---------------------------------------------------------------------------
// Cranial nerves
// ---------------------------------------------------------------------------
export interface NerveConfig {
  id: 'optic' | 'oculomotor';
  radius: number;
  points: Vec3[];
  color: number;
}

export const NERVES: NerveConfig[] = [
  // Optic nerve (CN II): medial to the ICA. The opticocarotid triangle
  // between them is a key landmark. Identifying the ICA and optic nerve
  // confirms you are deep in the right place.
  {
    id: 'optic',
    radius: 2.0,
    points: [
      [-8.0, -8.0, -38.0],
      [-11.0, -1.0, -38.6],
      [-14.0, 5.5, -39.0],
      [-18.0, 11.5, -39.5],
      [-24.0, 15.0, -40.0],
    ],
    color: 0xeee4cc,
  },
  // Oculomotor nerve (CN III): runs forward under the PCom toward the
  // cavernous sinus. An IC-PC aneurysm pointing down and back can compress it,
  // which is the classic cause of a third nerve palsy with a dilated pupil.
  {
    id: 'oculomotor',
    radius: 1.3,
    points: [
      [-10.0, -13.0, -47.0],
      [-4.0, -10.0, -46.4],
      [2.0, -7.5, -45.6],
      [8.0, -5.0, -45.0],
      [13.0, -3.0, -44.6],
    ],
    color: 0xe9dfc6,
  },
];

// ---------------------------------------------------------------------------
// Aneurysm (IC-PC, unruptured)
// ---------------------------------------------------------------------------
export const ANEURYSM = {
  /** Point on the ICA centreline where the neck is centred: just distal to the PCom origin. */
  neckCenterOnIca: [-0.7, 0.4, -35.6] as Vec3,
  /**
   * Projection: posterolateral (+x, -z) and downward (-y). Normalised at runtime.
   * It leaves the ICA wall at about 110° to the vessel, so the neck starts ~2.4 mm
   * from the ICA centreline. That is where the clip blades belong.
   */
  direction: [0.76, -0.36, -0.53] as Vec3,
  /** Maximal dome diameter (mm). */
  domeDiameter: 6.6,
  /** Neck width (mm). A dome-to-neck ratio > 2 usually means it is clippable. */
  neckDiameter: 3.6,
  /** Distance from the ICA centreline to the dome centre (mm). */
  domeOffset: 2.25 + 2.7,
  /** Small daughter sac (bleb) on the dome, the thinnest and most fragile part. */
  bleb: {
    diameter: 1.3,
    /** Direction relative to the dome axis (added then normalised). */
    tilt: [0.35, -0.2, 0.15] as Vec3,
  },
  color: 0xc0505a,
  blebColor: 0xa2323d,
};

// ---------------------------------------------------------------------------
// Arachnoid membranes (cuttable segments)
// ---------------------------------------------------------------------------
export interface ArachnoidSegmentConfig {
  id: string;
  /** 'fissure' segments stretch across the fissure gap; 'cistern' segments use an explicit y range. */
  layer: 'fissure' | 'cistern';
  x: [number, number];
  /** Only used for cistern segments. */
  y?: [number, number];
  z: number;
  opacity: number;
}

export const ARACHNOID: ArachnoidSegmentConfig[] = [
  // Superficial sylvian arachnoid, opened from lateral to medial.
  { id: 'sf1', layer: 'fissure', x: [34, 46], z: 0.2, opacity: 0.4 },
  { id: 'sf2', layer: 'fissure', x: [24, 34], z: 0.2, opacity: 0.4 },
  { id: 'sf3', layer: 'fissure', x: [14, 24], z: 0.2, opacity: 0.4 },
  { id: 'sf4', layer: 'fissure', x: [4, 14], z: 0.2, opacity: 0.4 },
  // Deep sylvian arachnoid around the M2 and M1.
  { id: 'ds1', layer: 'fissure', x: [22, 34], z: -14, opacity: 0.24 },
  { id: 'ds2', layer: 'fissure', x: [10, 22], z: -20, opacity: 0.24 },
  // Carotid cistern: covers the ICA. Opening it releases CSF and slackens the brain.
  { id: 'cc1', layer: 'cistern', x: [-5, 6], y: [-5, 12], z: -26.6, opacity: 0.22 },
  // Opticocarotid membrane between CN II and the ICA.
  { id: 'oc1', layer: 'cistern', x: [-17, -5], y: [-3, 15], z: -33.5, opacity: 0.2 },
  // Arachnoid bands over the aneurysm neck, PCom and AChA.
  { id: 'nk1', layer: 'cistern', x: [-4, 9], y: [-8, 3], z: -32.4, opacity: 0.2 },
];

// ---------------------------------------------------------------------------
// Brain spatulas (retractors)
// ---------------------------------------------------------------------------
export const SPATULAS = {
  /** Blade width and length (mm). */
  width: 9,
  length: 46,
  thickness: 0.4,
  /** x position along the fissure where each blade rests. */
  frontalX: 18,
  temporalX: 22,
  /** Depth of the blade tip below the cortical surface. */
  tipDepth: -16,
};

// ---------------------------------------------------------------------------
// Deep background: skull base, tentorial edge and basal cisterns
// ---------------------------------------------------------------------------
export const FLOOR = {
  z: -49,
  size: 140,
  color: 0x4a2422,
};

// ---------------------------------------------------------------------------
// Microscope defaults
// ---------------------------------------------------------------------------
export const MICROSCOPE = {
  /** Point the optics orbit around: the opened fissure, slightly above the ICA. */
  target: [6, 0, -24] as Vec3,
  /** Working distance range (scene units = mm, scaled for a comfortable field). */
  distance: 150,
  minDistance: 60,
  maxDistance: 260,
  /** Field of view (degrees). */
  fov: 22,
  /** Maximum tilt from the vertical (degrees). */
  maxTilt: 38,
};

// ---------------------------------------------------------------------------
// Physiology baseline (drives pulsation now and vitals later)
// ---------------------------------------------------------------------------
export const PHYSIOLOGY = {
  heartRate: 68,
  /** Pulsation amplitude (mm, displaced along the surface normal). */
  pulseAmplitude: {
    artery: 0.07,
    aneurysm: 0.11,
    brain: 0.06,
    vein: 0.02,
  },
};
