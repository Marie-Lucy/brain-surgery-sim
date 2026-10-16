import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';

/**
 * Final "eyepiece" effect: round field stop, light falloff toward the edge, warm
 * halogen/xenon tint, faint chromatic fringe and sensor grain. Together these sell
 * the feeling of looking down binocular microscope optics.
 */
class MicroscopeEffect extends Effect {
  constructor() {
    super(
      'MicroscopeEffect',
      /* glsl */ `
      uniform float uAspect;
      uniform float uAperture;
      uniform float uSoft;
      uniform vec3 uTint;
      uniform float uGrain;
      uniform float uTime;
      uniform float uEnabled;
      uniform float uMono;

      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) / min(uAspect, 1.0);
        float d = length(p);
        float field = 1.0 - smoothstep(uAperture - uSoft, uAperture, d);
        float fall = mix(1.04, 0.5, smoothstep(0.05, uAperture, d));

        // Lateral chromatic aberration grows toward the field stop.
        vec2 dir = d > 0.0 ? (uv - 0.5) / max(d, 1e-4) : vec2(0.0);
        float ca = 0.0016 * smoothstep(0.15, uAperture, d);
        vec3 c;
        c.r = texture2D(inputBuffer, uv + dir * ca).r;
        c.g = inputColor.g;
        c.b = texture2D(inputBuffer, uv - dir * ca).b;

        c *= mix(uTint, vec3(1.0), uMono) * fall;
        // Near-infrared (ICG) mode: monochrome, slightly green, like the video channel of the scope.
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(lum) * vec3(0.82, 1.0, 0.86), uMono);
        float n = fract(sin(dot(uv * vec2(12.9898, 78.233) + fract(uTime) * 7.0, vec2(1.0, 1.0))) * 43758.5453);
        c += (n - 0.5) * uGrain;
        // Faint reflection on the field stop ring.
        float ring = smoothstep(uAperture - uSoft * 1.6, uAperture - uSoft * 0.6, d) * (1.0 - smoothstep(uAperture - uSoft * 0.6, uAperture, d));
        c += vec3(0.05, 0.035, 0.02) * ring * (1.0 - uMono);
        // Outside the field stop: the light blue-grey backdrop of the app (start-screen palette),
        // with a soft shadow hugging the eyepiece ring. Colours are linear (sRGB^2.2).
        vec2 q = (uv - vec2(0.5, 0.88)) * vec2(uAspect, 1.0);
        float g = smoothstep(0.0, 1.15, length(q));
        vec3 bgTop = pow(vec3(0.80, 0.90, 0.99), vec3(2.2));
        vec3 bgEdge = pow(vec3(0.39, 0.50, 0.59), vec3(2.2));
        vec3 bg = mix(bgTop, bgEdge, g);
        float shadow = 1.0 - 0.45 * (1.0 - smoothstep(uAperture, uAperture + 0.09, d));
        vec3 outside = bg * shadow;
        vec3 outC = mix(inputColor.rgb, c * field + outside * (1.0 - field), uEnabled);
        outputColor = vec4(outC, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        // Samples neighbouring pixels (chromatic fringe), so it needs its own pass.
        attributes: EffectAttribute.CONVOLUTION,
        uniforms: new Map<string, THREE.Uniform>([
          ['uAspect', new THREE.Uniform(1)],
          ['uAperture', new THREE.Uniform(0.485)],
          ['uSoft', new THREE.Uniform(0.03)],
          ['uTint', new THREE.Uniform(new THREE.Vector3(1.06, 0.98, 0.86))],
          ['uGrain', new THREE.Uniform(0.018)],
          ['uTime', new THREE.Uniform(0)],
          ['uEnabled', new THREE.Uniform(1)],
          ['uMono', new THREE.Uniform(0)],
        ]),
      },
    );
  }

  setMono(v: number): void {
    this.uniforms.get('uMono')!.value = v;
    this.uniforms.get('uGrain')!.value = 0.018 + 0.012 * v;
  }

  setAspect(a: number): void {
    this.uniforms.get('uAspect')!.value = a;
  }

  override update(_r: THREE.WebGLRenderer, _i: THREE.WebGLRenderTarget, dt = 0): void {
    this.uniforms.get('uTime')!.value += dt;
  }
}

export class PostFX {
  readonly composer: EffectComposer;
  readonly dof: DepthOfFieldEffect;
  readonly bloom: BloomEffect;
  readonly microscope: MicroscopeEffect;
  /** World point the optics try to keep in focus (smoothly followed). */
  readonly focusPoint = new THREE.Vector3();
  private readonly focusGoal = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(4, renderer.capabilities.maxSamples),
    });
    this.composer.addPass(new RenderPass(scene, camera));

    // Shallow depth of field: only a few millimetres around the focus plane are crisp,
    // like a real operating microscope at high magnification.
    this.dof = new DepthOfFieldEffect(camera, {
      focusDistance: 150,
      focusRange: 22,
      bokehScale: 2.6,
      resolutionScale: 0.5,
    });
    this.dof.target = this.focusPoint;

    this.bloom = new BloomEffect({
      intensity: 0.55,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
      radius: 0.6,
    });
    this.microscope = new MicroscopeEffect();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });

    // DoF is a convolution effect and must live in its own pass.
    this.composer.addPass(new EffectPass(camera, this.dof));
    this.composer.addPass(new EffectPass(camera, this.bloom, tone));
    this.composer.addPass(new EffectPass(camera, this.microscope));
  }

  setFocusGoal(p: THREE.Vector3): void {
    this.focusGoal.copy(p);
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.microscope.setAspect(w / h);
  }

  render(dt: number): void {
    this.focusPoint.lerp(this.focusGoal, 1 - Math.exp(-dt * 6));
    this.composer.render(dt);
  }
}
