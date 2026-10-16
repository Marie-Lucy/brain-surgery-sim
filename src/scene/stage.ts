import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MICROSCOPE } from '../config/anatomy';
import { MicroscopeControls } from './microscopeControls';
import { PostFX } from './postfx';

/**
 * Owns the renderer, scene, camera, microscope light and post-processing.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: MicroscopeControls;
  readonly postfx: PostFX;
  /** Coaxial microscope light, attached to the optics. */
  readonly light: THREE.SpotLight;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.localClippingEnabled = true; // ICG shows only the residual neck below a clip
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in post
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'gl-canvas';

    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(MICROSCOPE.fov, 1, 5, 800);
    this.scene.add(this.camera);

    // Subtle reflections for the wet clear-coat highlights.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.2;
    pmrem.dispose();

    // Microscope illumination is nearly coaxial with the optics: a warm, bright
    // spot that falls off with depth, so deep structures sit in relative shadow.
    this.light = new THREE.SpotLight(0xffeedd, 58000, 0, THREE.MathUtils.degToRad(16), 0.55, 2);
    this.light.position.set(6, 10, 0); // slightly offset from the optical axis
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.camera.near = 40;
    this.light.shadow.camera.far = 400;
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.05;
    this.light.shadow.radius = 4;
    this.camera.add(this.light);
    this.camera.add(this.light.target);
    this.light.target.position.set(0, 0, -1);

    this.scene.add(new THREE.HemisphereLight(0xffe6d0, 0x301010, 0.25));

    this.controls = new MicroscopeControls(this.camera, this.renderer.domElement);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** 'low' trades shadows, depth of field and resolution for frame rate (laptops, phones). */
  quality: 'high' | 'low' = 'high';
  setQuality(q: 'high' | 'low'): void {
    this.quality = q;
    const low = q === 'low';
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !low;
    this.light.castShadow = !low;
    this.postfx.dof.bokehScale = low ? 0 : 2.6;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx.setSize(w, h);
  }

  render(dt: number): void {
    this.controls.update(dt);
    // Keep the light aimed at the optical target.
    this.light.target.position.set(0, 0, -this.camera.position.distanceTo(this.controls.target));
    this.postfx.render(dt);
  }
}
