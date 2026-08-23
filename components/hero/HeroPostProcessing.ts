import * as THREE from "three";

const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

// This effect is intentionally implemented as a small motion field rather than
// a pressure-based fluid solver. The pointer writes direction into a decaying,
// diffused texture; the display pass turns that field into refraction.
const MOTION_FIELD_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uHistory;
  uniform vec2 uPointer;
  uniform vec2 uImpulse;
  uniform vec2 uTexelStep;
  uniform float uAspect;
  uniform float uFrameTime;
  uniform float uPointerOn;
  uniform float uBrushRadius;
  uniform float uDrag;
  varying vec2 vUv;

  void main() {
    float frameTime = clamp(uFrameTime, 0.0, 0.05);
    vec2 seed = texture2D(uHistory, vUv).xy;
    vec2 tracedUv = clamp(vUv - seed * frameTime * 0.42, 0.002, 0.998);

    vec2 carried = texture2D(uHistory, tracedUv).xy;
    vec2 neighborhood = (
      texture2D(uHistory, tracedUv + vec2(uTexelStep.x, 0.0)).xy
      + texture2D(uHistory, tracedUv - vec2(uTexelStep.x, 0.0)).xy
      + texture2D(uHistory, tracedUv + vec2(0.0, uTexelStep.y)).xy
      + texture2D(uHistory, tracedUv - vec2(0.0, uTexelStep.y)).xy
    ) * 0.25;
    vec2 motion = mix(carried, neighborhood, min(0.24, frameTime * 5.0));
    motion *= exp(-uDrag * frameTime);

    vec2 fromPointer = vUv - uPointer;
    vec2 metricDelta = vec2(fromPointer.x * uAspect, fromPointer.y);
    float pointerDistance = length(metricDelta);
    float brush = 1.0 - smoothstep(uBrushRadius * 0.18, uBrushRadius, pointerDistance);
    vec2 orbit = normalize(vec2(-metricDelta.y, metricDelta.x) + vec2(0.00001));
    vec2 directionalPush = uImpulse * 22.0;
    vec2 curvedPush = orbit * length(uImpulse) * 2.8;
    motion += (directionalPush + curvedPush) * brush * uPointerOn;

    gl_FragColor = vec4(clamp(motion, vec2(-0.65), vec2(0.65)), brush, 1.0);
  }
`;

const POINTER_REFRACTION_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uFrameInput;
  uniform sampler2D uMotionField;
  uniform vec2 uFieldSize;
  uniform float uEffectMix;
  uniform float uWarpAmount;
  uniform float uPrismAmount;
  varying vec2 vUv;

  vec2 readMotion(vec2 uv) {
    return texture2D(uMotionField, clamp(uv, 0.002, 0.998)).xy;
  }

  void main() {
    vec2 texel = 1.0 / max(uFieldSize, vec2(1.0));
    vec2 motion = readMotion(vUv);
    float speed = length(motion);
    float response = smoothstep(0.004, 0.16, speed) * step(0.5, uEffectMix);

    vec2 horizontalChange = readMotion(vUv + vec2(texel.x, 0.0))
      - readMotion(vUv - vec2(texel.x, 0.0));
    vec2 verticalChange = readMotion(vUv + vec2(0.0, texel.y))
      - readMotion(vUv - vec2(0.0, texel.y));
    vec2 bend = vec2(horizontalChange.y, -verticalChange.x);
    vec2 refractionVector = motion + bend * 0.32;
    vec2 refractedUv = clamp(
      vUv - refractionVector * uWarpAmount * (0.55 + response * 0.45),
      0.002,
      0.998
    );

    vec2 prismAxis = normalize(vec2(-refractionVector.y, refractionVector.x) + vec2(0.00001));
    vec2 prismOffset = prismAxis
      * (0.00035 + speed * 0.012)
      * uPrismAmount
      * response;

    vec4 original = texture2D(uFrameInput, vUv);
    vec4 center = texture2D(uFrameInput, refractedUv);
    vec3 refracted = vec3(
      texture2D(uFrameInput, clamp(refractedUv + prismOffset * 1.25, 0.002, 0.998)).r,
      center.g,
      texture2D(uFrameInput, clamp(refractedUv - prismOffset, 0.002, 0.998)).b
    );
    vec3 softened = (
      texture2D(uFrameInput, clamp(refractedUv + refractionVector * 0.008, 0.002, 0.998)).rgb
      + texture2D(uFrameInput, clamp(refractedUv - refractionVector * 0.006, 0.002, 0.998)).rgb
    ) * 0.5;
    refracted = mix(refracted, softened, response * 0.18);

    gl_FragColor = vec4(mix(original.rgb, refracted, response), original.a);
  }
`;

const CLEAR_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(0.0);
  }
`;

const FLARE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform vec2 uResolution;
  uniform vec3 uTailColor;
  uniform float uIntensity;
  uniform float uThreshold;
  uniform float uStreakScale;
  uniform float uHotspotPower;
  uniform float uGate;
  uniform float uHaloIntensity;
  varying vec2 vUv;

  float luma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  float interleavedGradientNoise(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  float brightMask(float luminance) {
    float normalized = max(luminance - uThreshold, 0.0)
      / max(1.0 - uThreshold, 0.00001);
    normalized = clamp(normalized, 0.0, 1.0);
    normalized = normalized * normalized * (3.0 - 2.0 * normalized);
    normalized = pow(normalized, max(uHotspotPower, 1.0));

    float gated = (normalized - uGate) / max(1.0 - uGate, 0.00001);
    return normalized * clamp(gated, 0.0, 1.0);
  }

  vec3 sampleBright(vec2 uv) {
    vec3 color = texture2D(uScene, clamp(uv, 0.002, 0.998)).rgb;
    return color * brightMask(luma(color));
  }

  vec3 streak(vec2 directionUv, float phase) {
    vec3 accumulation = vec3(0.0);
    for (int stepIndex = 1; stepIndex <= 8; stepIndex++) {
      float distanceStep = float(stepIndex) * 1.5 + phase;
      float weight = 1.0 / (1.0 + distanceStep * 0.22);
      weight *= weight;
      float tailMix = pow(clamp(distanceStep / 12.5, 0.0, 1.0), 0.5);
      vec3 ramp = mix(vec3(1.0), uTailColor, tailMix);
      vec2 offset = directionUv * distanceStep;
      accumulation += sampleBright(vUv + offset) * weight * ramp;
      accumulation += sampleBright(vUv - offset) * weight * ramp;
    }
    return accumulation;
  }

  vec3 causticHalo(float noisePhase) {
    vec3 accumulation = vec3(0.0);
    const float goldenAngle = 2.39996323;

    for (int sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
      float indexValue = float(sampleIndex) + 0.5;
      float progress = indexValue / 16.0;
      float angle = indexValue * goldenAngle + noisePhase * 6.2831853;
      float radiusPx = mix(3.5, 34.0, progress * progress);
      vec2 offset = vec2(
        cos(angle) * radiusPx / max(uResolution.x, 1.0),
        sin(angle) * radiusPx / max(uResolution.y, 1.0)
      );
      float weight = pow(1.0 - progress, 1.35);
      accumulation += sampleBright(vUv + offset) * weight;
    }

    return accumulation / 4.8;
  }

  void main() {
    vec2 pixel = floor(gl_FragCoord.xy);
    float noise = interleavedGradientNoise(pixel);
    float phase = step(0.5, noise) * 0.5;
    vec2 pixelStep = vec2(
      uStreakScale / max(uResolution.x, 1.0),
      uStreakScale / max(uResolution.y, 1.0)
    );

    vec3 base = texture2D(uScene, vUv).rgb;
    vec3 flare = base * brightMask(luma(base)) * 1.2;

    const float cosine30 = 0.8660254;
    const float sine30 = 0.5;
    flare += streak(vec2(0.0, pixelStep.y), phase);
    flare += streak(vec2(pixelStep.x * cosine30, pixelStep.y * sine30), phase);
    flare += streak(vec2(pixelStep.x * cosine30, -pixelStep.y * sine30), phase);

    vec3 halo = causticHalo(noise);
    float haloStrength = clamp(luma(halo) * 3.4, 0.0, 0.94);
    float stipple = step(1.0 - haloStrength, interleavedGradientNoise(pixel + 17.0));
    float patternedHalo = haloStrength * 0.16 + stipple * 1.18;
    vec3 haloTint = mix(uTailColor, vec3(1.0), 0.24);
    flare += halo * haloTint * patternedHalo * uHaloIntensity;

    gl_FragColor = vec4(flare * (uIntensity * 0.75), 1.0);
  }
`;

const FINAL_COMPOSITE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uFlare;
  uniform float uFlareEnabled;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uScene, vUv).rgb;
    color += texture2D(uFlare, vUv).rgb * uFlareEnabled;
    gl_FragColor = vec4(max(color, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createDataTarget() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
}

function createColorTarget() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  return target;
}

function createFullscreenMaterial(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export class HeroFluidPass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private motionRead = createDataTarget();
  private motionWrite = createDataTarget();
  private readonly fieldSize = new THREE.Vector2(1, 1);
  private readonly texelStep = new THREE.Vector2(1, 1);
  private readonly motionMaterial = createFullscreenMaterial(MOTION_FIELD_FRAGMENT_SHADER, {
    uHistory: { value: null },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uImpulse: { value: new THREE.Vector2() },
    uTexelStep: { value: this.texelStep },
    uAspect: { value: 1 },
    uFrameTime: { value: 0 },
    uPointerOn: { value: 0 },
    uBrushRadius: { value: 0.072 },
    uDrag: { value: 4.6 },
  });
  private readonly displayMaterial = createFullscreenMaterial(POINTER_REFRACTION_FRAGMENT_SHADER, {
    uFrameInput: { value: null },
    uMotionField: { value: this.motionRead.texture },
    uFieldSize: { value: this.fieldSize },
    uEffectMix: { value: 0 },
    uWarpAmount: { value: 0.055 },
    uPrismAmount: { value: 0.9 },
  });
  private readonly clearMaterial = createFullscreenMaterial(CLEAR_FRAGMENT_SHADER, {});

  constructor() {
    this.quad = new THREE.Mesh(this.geometry, this.motionMaterial);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private renderMaterial(
    renderer: THREE.WebGLRenderer,
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
  }

  private swapMotionTargets() {
    const previousRead = this.motionRead;
    this.motionRead = this.motionWrite;
    this.motionWrite = previousRead;
  }

  resize(renderWidth: number, renderHeight: number) {
    const aspect = renderWidth / Math.max(renderHeight, 1);
    const fieldHeight = 144;
    const fieldWidth = Math.max(96, Math.round(fieldHeight * aspect));
    this.fieldSize.set(fieldWidth, fieldHeight);
    this.texelStep.set(1 / fieldWidth, 1 / fieldHeight);
    this.motionMaterial.uniforms.uAspect.value = aspect;
    [this.motionRead, this.motionWrite]
      .forEach((target) => target.setSize(fieldWidth, fieldHeight));
  }

  update(
    renderer: THREE.WebGLRenderer,
    delta: number,
    pointerUv: THREE.Vector2,
    pointerDeltaUv: THREE.Vector2,
    injectPointer: boolean,
  ) {
    this.motionMaterial.uniforms.uHistory.value = this.motionRead.texture;
    this.motionMaterial.uniforms.uPointer.value.copy(pointerUv);
    this.motionMaterial.uniforms.uImpulse.value.copy(pointerDeltaUv);
    this.motionMaterial.uniforms.uFrameTime.value = delta;
    this.motionMaterial.uniforms.uPointerOn.value = injectPointer ? 1 : 0;
    this.renderMaterial(renderer, this.motionMaterial, this.motionWrite);
    this.swapMotionTargets();
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget,
    enabled: boolean,
  ) {
    this.displayMaterial.uniforms.uFrameInput.value = inputTexture;
    this.displayMaterial.uniforms.uMotionField.value = this.motionRead.texture;
    this.displayMaterial.uniforms.uEffectMix.value = enabled ? 1 : 0;
    this.renderMaterial(renderer, this.displayMaterial, outputTarget);
  }

  reset(renderer: THREE.WebGLRenderer) {
    [this.motionRead, this.motionWrite]
      .forEach((target) => this.renderMaterial(renderer, this.clearMaterial, target));
  }

  dispose() {
    this.geometry.dispose();
    [this.motionMaterial, this.displayMaterial, this.clearMaterial]
      .forEach((material) => material.dispose());
    [this.motionRead, this.motionWrite]
      .forEach((target) => target.dispose());
  }
}

export class HeroFlarePass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly flareTarget = createColorTarget();
  private readonly resolution = new THREE.Vector2(1, 1);
  private frame = 0;
  private wasEnabled = false;

  private readonly flareMaterial = createFullscreenMaterial(FLARE_FRAGMENT_SHADER, {
    uScene: { value: null },
    uResolution: { value: this.resolution },
    uTailColor: { value: new THREE.Color(0x009dff) },
    uIntensity: { value: 0.74 },
    uThreshold: { value: 0.985 },
    uStreakScale: { value: 8 },
    uHotspotPower: { value: 18 },
    uGate: { value: 0.82 },
    uHaloIntensity: { value: 0.92 },
  });
  private readonly compositeMaterial = createFullscreenMaterial(FINAL_COMPOSITE_FRAGMENT_SHADER, {
    uScene: { value: null },
    uFlare: { value: this.flareTarget.texture },
    uFlareEnabled: { value: 0 },
  });

  constructor() {
    this.quad = new THREE.Mesh(this.geometry, this.flareMaterial);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  resize(renderWidth: number, renderHeight: number) {
    this.resolution.set(renderWidth, renderHeight);
    this.flareTarget.setSize(
      Math.max(1, Math.round(renderWidth * 0.5)),
      Math.max(1, Math.round(renderHeight * 0.5)),
    );
    this.frame = 0;
  }

  setTailColor(color: THREE.Color) {
    this.flareMaterial.uniforms.uTailColor.value.copy(color);
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    enabled: boolean,
    realtime = false,
  ) {
    if (enabled && (realtime || !this.wasEnabled || this.frame % 2 === 0)) {
      this.flareMaterial.uniforms.uScene.value = inputTexture;
      this.quad.material = this.flareMaterial;
      renderer.setRenderTarget(this.flareTarget);
      renderer.clear(true, false, false);
      renderer.render(this.scene, this.camera);
    }

    this.compositeMaterial.uniforms.uScene.value = inputTexture;
    this.compositeMaterial.uniforms.uFlareEnabled.value = enabled ? 1 : 0;
    this.quad.material = this.compositeMaterial;
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);

    this.wasEnabled = enabled;
    this.frame += 1;
  }

  dispose() {
    this.geometry.dispose();
    this.flareMaterial.dispose();
    this.compositeMaterial.dispose();
    this.flareTarget.dispose();
  }
}
