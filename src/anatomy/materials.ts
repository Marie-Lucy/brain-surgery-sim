import * as THREE from 'three';
import { globalUniforms } from '../core/uniforms';
import { GLSL_SNOISE } from './noise';

/**
 * Wet tissue materials.
 *
 * Every tissue uses MeshPhysicalMaterial with a clear-coat layer, which looks like
 * the thin film of CSF and moisture that makes tissue glisten under the microscope
 * light. Shader injections add:
 *   - pulsation: vertices move along their normal with the shared heartbeat uniform
 *   - surface patterns: pial vessels on cortex, vasa vasorum on arteries, nerve fibres
 *   - hover highlight: a soft bluish glow used by the tools
 */

export type SurfacePattern = 'none' | 'cortex' | 'artery' | 'vein' | 'nerve' | 'membrane' | 'floor';

export interface TissueOptions {
  color: number;
  pattern?: SurfacePattern;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: number;
  pulseAmp?: number;
  opacity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  envMapIntensity?: number;
}

export interface TissueUniforms {
  uPulseAmp: { value: number };
  uHighlight: { value: number };
}

export type TissueMaterial = THREE.MeshPhysicalMaterial & { userData: { tissue: TissueUniforms } };

const PATTERN_GLSL: Record<SurfacePattern, string> = {
  none: '',
  // Cortex: mottled pink with a network of small pial arteries and veins
  // running over the gyri and dipping into the sulci.
  cortex: /* glsl */ `
    {
      vec3 p = vObjPos * 0.16;
      float mask = smoothstep(-0.15, 0.35, snoise(p * 0.55 + 5.0));
      float vein = (1.0 - smoothstep(0.0, 0.03, abs(snoise(p)))) * mask;
      float cap  = 1.0 - smoothstep(0.0, 0.045, abs(snoise(p * 2.6 + 11.0)));
      float mott = snoise(vObjPos * 0.55) * 0.5 + 0.5;
      diffuseColor.rgb *= mix(0.9, 1.06, mott);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.05, 0.08), vein * 0.8);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.22, 0.22), cap * 0.3);
    }`,
  // Arteries: thin vasa vasorum and slight whitish wall variation.
  artery: /* glsl */ `
    {
      float vv = 1.0 - smoothstep(0.0, 0.05, abs(snoise(vObjPos * 1.4)));
      float wall = snoise(vObjPos * 0.9) * 0.5 + 0.5;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.02, 1.0) + 0.05, wall * 0.35);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.06, 0.08), vv * 0.45);
    }`,
  vein: /* glsl */ `
    {
      float m = snoise(vObjPos * 0.7) * 0.5 + 0.5;
      diffuseColor.rgb *= mix(0.85, 1.1, m);
    }`,
  // Nerves: longitudinal fascicles (stripes around the circumference).
  nerve: /* glsl */ `
    {
      float s = sin(vTUv.y * 6.2831 * 9.0 + snoise(vObjPos * 0.8) * 1.5) * 0.5 + 0.5;
      float vn = 1.0 - smoothstep(0.0, 0.04, abs(snoise(vObjPos * 0.9 + 3.0)));
      diffuseColor.rgb *= mix(0.86, 1.04, s);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.2, 0.2), vn * 0.35);
    }`,
  // Arachnoid: a thin veil with fine collagen strands and feathered edges.
  membrane: /* glsl */ `
    {
      float strands = 1.0 - smoothstep(0.0, 0.07, abs(snoise(vObjPos * vec3(0.45, 1.3, 0.45))));
      float strands2 = 1.0 - smoothstep(0.0, 0.05, abs(snoise(vObjPos * vec3(1.2, 0.5, 1.2) + 4.0)));
      float veil = snoise(vObjPos * 0.18 + 7.0) * 0.5 + 0.5;
      float ex = smoothstep(0.0, 0.12, vTUv.x) * smoothstep(1.0, 0.88, vTUv.x);
      float ey = smoothstep(0.0, 0.3, vTUv.y) * smoothstep(1.0, 0.7, vTUv.y);
      diffuseColor.a *= (0.3 + 0.3 * veil + 0.9 * max(strands, strands2 * 0.7)) * ex * ey;
    }`,
  // Deep background (basal cisterns, dura of the skull base): dark and mottled.
  floor: /* glsl */ `
    {
      float m = snoise(vObjPos * 0.12) * 0.5 + 0.5;
      float v = 1.0 - smoothstep(0.0, 0.04, abs(snoise(vObjPos * 0.2 + 2.0)));
      diffuseColor.rgb *= mix(0.6, 1.1, m);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.04, 0.05), v * 0.6);
    }`,
};

export function createTissueMaterial(opts: TissueOptions): TissueMaterial {
  const pattern = opts.pattern ?? 'none';
  const transparent = opts.opacity !== undefined && opts.opacity < 1;
  const mat = new THREE.MeshPhysicalMaterial({
    color: opts.color,
    roughness: opts.roughness ?? 0.42,
    metalness: 0,
    clearcoat: opts.clearcoat ?? 1,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.12,
    sheen: opts.sheen ?? 0.35,
    sheenColor: new THREE.Color(opts.sheenColor ?? 0xff9a8a),
    sheenRoughness: 0.45,
    transparent,
    opacity: opts.opacity ?? 1,
    depthWrite: !transparent,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
    envMapIntensity: opts.envMapIntensity ?? 0.3,
  }) as TissueMaterial;

  const tissue: TissueUniforms = {
    uPulseAmp: { value: opts.pulseAmp ?? 0 },
    uHighlight: { value: 0 },
  };
  mat.userData.tissue = tissue;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPulse = globalUniforms.uPulse;
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uPulseAmp = tissue.uPulseAmp;
    shader.uniforms.uHighlight = tissue.uHighlight;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uPulse;
         uniform float uPulseAmp;
         varying vec3 vObjPos;
         varying vec2 vTUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vObjPos = position;
         vTUv = uv;
         transformed += objectNormal * uPulse * uPulseAmp;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uHighlight;
         uniform float uTime;
         varying vec3 vObjPos;
         varying vec2 vTUv;
         ${pattern === 'none' ? '' : GLSL_SNOISE}`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PATTERN_GLSL[pattern]}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         {
           float rim = 1.0 - abs(dot(normalize(vViewPosition), normal));
           totalEmissiveRadiance += vec3(0.25, 0.55, 0.75) * uHighlight * (0.35 + 0.9 * rim);
         }`,
      );
  };
  mat.customProgramCacheKey = () => `tissue-${pattern}`;
  return mat;
}

/** Brushed surgical steel for spatulas and instruments. */
export function createSteelMaterial(color = 0xc9ccd1): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.85,
    roughness: 0.32,
    clearcoat: 0.3,
    envMapIntensity: 2.2,
  });
}
