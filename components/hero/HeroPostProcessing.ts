import * as THREE from "three";

const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

// Original optical pipeline authored for this portfolio from a visual behavior
// specification. It is an inertial brush field, not a pressure/fluid solver:
// RG stores packed directional motion, B stores the slower wake and A stores
// the crest. Packing keeps the effect on the universally renderable RGBA8 path.
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
  uniform float uMotionDrag;
  uniform float uWakeDrag;
  uniform float uCrestDrag;
  varying vec2 vUv;

  vec2 decodeMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  vec2 encodeMotion(vec2 motion) {
    return motion / 1.1 + 0.5;
  }

  void main() {
    float frameTime = clamp(uFrameTime, 0.0, 0.05);
    vec4 seed = texture2D(uHistory, vUv);
    vec2 tracedUv = clamp(vUv - decodeMotion(seed.xy) * frameTime * 0.44, 0.002, 0.998);

    vec4 carried = texture2D(uHistory, tracedUv);
    vec4 neighborhood = (
      texture2D(uHistory, tracedUv + vec2(uTexelStep.x, 0.0))
      + texture2D(uHistory, tracedUv - vec2(uTexelStep.x, 0.0))
      + texture2D(uHistory, tracedUv + vec2(0.0, uTexelStep.y))
      + texture2D(uHistory, tracedUv - vec2(0.0, uTexelStep.y))
    ) * 0.25;
    float diffusion = min(0.28, frameTime * 6.0);
    vec4 state = mix(carried, neighborhood, diffusion);
    vec2 motion = decodeMotion(state.xy) * exp(-uMotionDrag * frameTime);
    float wake = state.z * exp(-uWakeDrag * frameTime);
    float crest = state.w * exp(-uCrestDrag * frameTime);

    vec2 fromPointer = vUv - uPointer;
    vec2 metricDelta = vec2(fromPointer.x * uAspect, fromPointer.y);
    float pointerDistance = length(metricDelta);
    float brush = 1.0 - smoothstep(uBrushRadius * 0.18, uBrushRadius, pointerDistance);
    vec2 orbit = normalize(vec2(-metricDelta.y, metricDelta.x) + vec2(0.00001));
    float impulseStrength = length(uImpulse);
    vec2 directionalPush = uImpulse * 18.0;
    vec2 curvedPush = orbit * impulseStrength * 1.7;
    motion += (directionalPush + curvedPush) * brush * uPointerOn;
    float injection = brush * uPointerOn * clamp(impulseStrength * 95.0, 0.35, 1.0);
    wake = max(wake, injection);
    float crestBrush = 1.0 - smoothstep(uBrushRadius * 0.28, uBrushRadius, pointerDistance);
    crest = max(crest, injection * crestBrush);

    gl_FragColor = vec4(
      encodeMotion(clamp(motion, vec2(-0.55), vec2(0.55))),
      clamp(wake, 0.0, 1.0),
      clamp(crest, 0.0, 1.0)
    );
  }
`;

const SURFACE_FEATURE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uMotionField;
  uniform vec2 uTexelStep;
  varying vec2 vUv;

  vec2 decodeMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  void main() {
    vec4 center = texture2D(uMotionField, vUv);
    vec4 left = texture2D(uMotionField, vUv - vec2(uTexelStep.x, 0.0));
    vec4 right = texture2D(uMotionField, vUv + vec2(uTexelStep.x, 0.0));
    vec4 down = texture2D(uMotionField, vUv - vec2(0.0, uTexelStep.y));
    vec4 up = texture2D(uMotionField, vUv + vec2(0.0, uTexelStep.y));

    vec2 wakeGradient = vec2(right.z - left.z, up.z - down.z) * 0.5;
    vec2 centerMotion = decodeMotion(center.xy);
    vec2 motionDx = (decodeMotion(right.xy) - decodeMotion(left.xy)) * 0.5;
    vec2 motionDy = (decodeMotion(up.xy) - decodeMotion(down.xy)) * 0.5;
    float curl = motionDx.y - motionDy.x;
    float shear = motionDx.x - motionDy.y;
    vec2 surfaceNormal = wakeGradient * 2.4 + vec2(motionDx.y, motionDy.x) * 0.28;
    float response = max(center.z, smoothstep(0.008, 0.22, length(centerMotion)) * 0.68);
    float curvature = clamp(
      length(wakeGradient) * 3.2 + abs(curl) * 1.4 + abs(shear) * 0.7 + center.w * 0.9,
      0.0,
      1.0
    );

    gl_FragColor = vec4(
      clamp(surfaceNormal, vec2(-1.0), vec2(1.0)) * 0.5 + 0.5,
      response,
      curvature
    );
  }
`;

const COMPOUND_REFRACTION_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uFrameInput;
  uniform sampler2D uMotionField;
  uniform sampler2D uSurfaceFeatures;
  uniform vec2 uResolution;
  uniform vec2 uFieldSize;
  uniform float uEffectMix;
  uniform float uLensAmount;
  uniform float uPrismPixels;
  varying vec2 vUv;

  vec2 decodeMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  vec2 decodeNormal(vec2 packedNormal) {
    return packedNormal * 2.0 - 1.0;
  }

  void main() {
    vec4 motionState = texture2D(uMotionField, vUv);
    vec4 features = texture2D(uSurfaceFeatures, vUv);
    float effectEnabled = step(0.5, uEffectMix);
    float response = smoothstep(0.012, 0.5, features.z) * effectEnabled;
    vec2 motion = decodeMotion(motionState.xy);
    vec2 normal = decodeNormal(features.xy);
    float curvature = features.w;
    vec2 flowDirection = normalize(motion + vec2(0.00001));
    vec2 tangent = vec2(-flowDirection.y, flowDirection.x);
    float crestWave = sin(
      dot(vUv * uFieldSize, tangent) * 0.34
      + dot(vUv * uFieldSize, flowDirection) * 0.11
      + curvature * 4.0
    );
    vec2 refractionVector = motion * 0.032
      + normal * uLensAmount
      + tangent * crestWave * curvature * 0.0014;
    vec2 refractedUv = clamp(
      vUv - refractionVector * response,
      0.002,
      0.998
    );

    vec2 pixelSize = 1.0 / max(uResolution, vec2(1.0));
    vec2 prismAxis = normalize(normal + tangent * 0.36 + vec2(0.00001));
    vec2 prismOffset = prismAxis * pixelSize * uPrismPixels * (0.45 + curvature) * response;

    vec4 original = texture2D(uFrameInput, vUv);
    vec4 center = texture2D(uFrameInput, refractedUv);
    vec3 refracted = vec3(
      texture2D(uFrameInput, clamp(refractedUv + prismOffset * 1.15, 0.002, 0.998)).r,
      center.g,
      texture2D(uFrameInput, clamp(refractedUv - prismOffset * 0.92, 0.002, 0.998)).b
    );
    vec3 internalScatter = (
      texture2D(uFrameInput, clamp(refractedUv + normal * 0.0045, 0.002, 0.998)).rgb
      + texture2D(uFrameInput, clamp(refractedUv - normal * 0.0032, 0.002, 0.998)).rgb
    ) * 0.5;
    refracted = mix(refracted, internalScatter, response * curvature * 0.16);

    gl_FragColor = vec4(mix(original.rgb, refracted, response * 0.94), original.a);
  }
`;

const CLEAR_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(0.5, 0.5, 0.0, 0.0);
  }
`;

const FLARE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uMotionField;
  uniform sampler2D uSurfaceFeatures;
  uniform vec2 uResolution;
  uniform vec2 uFieldSize;
  uniform vec3 uTailColor;
  uniform float uIntensity;
  uniform float uThreshold;
  uniform float uStreakScale;
  uniform float uHotspotPower;
  uniform float uGate;
  uniform float uHaloIntensity;
  uniform float uMotionCoupling;
  varying vec2 vUv;

  float luma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  float interleavedGradientNoise(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  vec2 decodeMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  vec2 decodeNormal(vec2 packedNormal) {
    return packedNormal * 2.0 - 1.0;
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
    for (int stepIndex = 1; stepIndex <= 5; stepIndex++) {
      float distanceStep = float(stepIndex) * 1.8 + phase;
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

    for (int sampleIndex = 0; sampleIndex < 8; sampleIndex++) {
      float indexValue = float(sampleIndex) + 0.5;
      float progress = indexValue / 8.0;
      float angle = indexValue * goldenAngle + noisePhase * 6.2831853;
      float radiusPx = mix(3.5, 34.0, progress * progress);
      vec2 offset = vec2(
        cos(angle) * radiusPx / max(uResolution.x, 1.0),
        sin(angle) * radiusPx / max(uResolution.y, 1.0)
      );
      float weight = pow(1.0 - progress, 1.35);
      accumulation += sampleBright(vUv + offset) * weight;
    }

    return accumulation / 3.25;
  }

  vec3 motionCaustic(vec2 pixel, float noise) {
    vec4 motionState = texture2D(uMotionField, vUv);
    vec4 features = texture2D(uSurfaceFeatures, vUv);
    float response = smoothstep(0.015, 0.48, features.z) * uMotionCoupling;
    float curvature = features.w;
    vec2 motion = decodeMotion(motionState.xy);
    vec2 surfaceNormal = decodeNormal(features.xy);
    vec2 direction = normalize(motion + vec2(0.00001));
    vec2 tangent = vec2(-direction.y, direction.x);
    vec2 fieldCoord = vUv * uFieldSize;

    float longitudinal = 0.5 + 0.5 * sin(dot(fieldCoord, direction) * 0.92 + curvature * 5.2);
    float transverse = 0.5 + 0.5 * sin(dot(fieldCoord, tangent) * 1.74 - curvature * 3.6);
    float wovenRidge = smoothstep(0.42, 0.88, longitudinal * transverse + noise * 0.28);
    float microDots = step(0.70, interleavedGradientNoise(floor(pixel * 0.72) + features.z * 19.0));
    float edgeNeedle = pow(clamp(curvature, 0.0, 1.0), 1.7)
      * pow(max(dot(direction, normalize(vec2(0.82, 0.57))), 0.0), 4.0);
    float surfaceGate = smoothstep(0.26, 0.76, curvature)
      * smoothstep(0.08, 0.42, length(surfaceNormal) + curvature * 0.2);
    float caustic = response * surfaceGate * (
      wovenRidge * (0.34 + curvature * 0.88)
      + microDots * curvature * 0.46
      + edgeNeedle * 0.68
    );
    vec3 causticTint = mix(vec3(1.0, 0.99, 0.94), uTailColor, 0.38);
    return causticTint * caustic;
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
    float patternedHalo = haloStrength * 0.1 + stipple * 0.62;
    vec3 haloTint = mix(uTailColor, vec3(1.0), 0.24);
    flare += halo * haloTint * patternedHalo * uHaloIntensity;
    flare += motionCaustic(pixel, noise) * 1.45;

    gl_FragColor = vec4(flare * (uIntensity * 0.75), 1.0);
  }
`;

const FINAL_COMPOSITE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uFlare;
  uniform sampler2D uSurfaceFeatures;
  uniform float uFlareEnabled;
  uniform float uMotionCoupling;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uScene, vUv).rgb;
    float localResponse = smoothstep(
      0.02,
      0.64,
      texture2D(uSurfaceFeatures, vUv).z
    ) * uMotionCoupling;
    vec3 locallyGraded = (color - 0.5) * 1.045 + 0.5;
    color = mix(color, locallyGraded, localResponse * 0.34);
    color += texture2D(uFlare, vUv).rgb * uFlareEnabled;
    gl_FragColor = vec4(max(color, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createDataTarget() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.UnsignedByteType,
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
  private readonly featureTarget = createDataTarget();
  private readonly resolution = new THREE.Vector2(1, 1);
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
    uBrushRadius: { value: 0.062 },
    uMotionDrag: { value: 7.2 },
    uWakeDrag: { value: 2.35 },
    uCrestDrag: { value: 10.5 },
  });
  private readonly featureMaterial = createFullscreenMaterial(SURFACE_FEATURE_FRAGMENT_SHADER, {
    uMotionField: { value: this.motionRead.texture },
    uTexelStep: { value: this.texelStep },
  });
  private readonly displayMaterial = createFullscreenMaterial(COMPOUND_REFRACTION_FRAGMENT_SHADER, {
    uFrameInput: { value: null },
    uMotionField: { value: this.motionRead.texture },
    uSurfaceFeatures: { value: this.featureTarget.texture },
    uResolution: { value: this.resolution },
    uFieldSize: { value: this.fieldSize },
    uEffectMix: { value: 0 },
    uLensAmount: { value: 0.013 },
    uPrismPixels: { value: 1.6 },
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
    const fieldHeight = 168;
    const fieldWidth = Math.max(96, Math.round(fieldHeight * aspect));
    this.resolution.set(renderWidth, renderHeight);
    this.fieldSize.set(fieldWidth, fieldHeight);
    this.texelStep.set(1 / fieldWidth, 1 / fieldHeight);
    this.motionMaterial.uniforms.uAspect.value = aspect;
    [this.motionRead, this.motionWrite, this.featureTarget]
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
    this.featureMaterial.uniforms.uMotionField.value = this.motionRead.texture;
    this.renderMaterial(renderer, this.featureMaterial, this.featureTarget);

    this.displayMaterial.uniforms.uFrameInput.value = inputTexture;
    this.displayMaterial.uniforms.uMotionField.value = this.motionRead.texture;
    this.displayMaterial.uniforms.uSurfaceFeatures.value = this.featureTarget.texture;
    this.displayMaterial.uniforms.uEffectMix.value = enabled ? 1 : 0;
    this.renderMaterial(renderer, this.displayMaterial, outputTarget);
  }

  getMotionTexture() {
    return this.motionRead.texture;
  }

  getFeatureTexture() {
    return this.featureTarget.texture;
  }

  getFieldSize() {
    return this.fieldSize;
  }

  validateTargets(renderer: THREE.WebGLRenderer) {
    const gl = renderer.getContext();
    [this.motionRead, this.motionWrite, this.featureTarget].forEach((target) => {
      renderer.setRenderTarget(target);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("WebGL optical framebuffer is incomplete");
      }
    });
  }

  reset(renderer: THREE.WebGLRenderer) {
    [this.motionRead, this.motionWrite, this.featureTarget]
      .forEach((target) => this.renderMaterial(renderer, this.clearMaterial, target));
  }

  dispose() {
    this.geometry.dispose();
    [this.motionMaterial, this.featureMaterial, this.displayMaterial, this.clearMaterial]
      .forEach((material) => material.dispose());
    [this.motionRead, this.motionWrite, this.featureTarget]
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
  private readonly fieldSize = new THREE.Vector2(1, 1);
  private frame = 0;
  private wasEnabled = false;

  private readonly flareMaterial = createFullscreenMaterial(FLARE_FRAGMENT_SHADER, {
    uScene: { value: null },
    uMotionField: { value: null },
    uSurfaceFeatures: { value: null },
    uResolution: { value: this.resolution },
    uFieldSize: { value: this.fieldSize },
    uTailColor: { value: new THREE.Color(0x009dff) },
    uIntensity: { value: 0.74 },
    uThreshold: { value: 0.985 },
    uStreakScale: { value: 8 },
    uHotspotPower: { value: 18 },
    uGate: { value: 0.82 },
    uHaloIntensity: { value: 0.55 },
    uMotionCoupling: { value: 0 },
  });
  private readonly compositeMaterial = createFullscreenMaterial(FINAL_COMPOSITE_FRAGMENT_SHADER, {
    uScene: { value: null },
    uFlare: { value: this.flareTarget.texture },
    uSurfaceFeatures: { value: null },
    uFlareEnabled: { value: 0 },
    uMotionCoupling: { value: 0 },
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

  setOpticalField(
    motionTexture: THREE.Texture,
    featureTexture: THREE.Texture,
    fieldSize: THREE.Vector2,
    active: boolean,
  ) {
    this.fieldSize.copy(fieldSize);
    this.flareMaterial.uniforms.uMotionField.value = motionTexture;
    this.flareMaterial.uniforms.uSurfaceFeatures.value = featureTexture;
    this.flareMaterial.uniforms.uMotionCoupling.value = active ? 1 : 0;
    this.compositeMaterial.uniforms.uSurfaceFeatures.value = featureTexture;
    this.compositeMaterial.uniforms.uMotionCoupling.value = active ? 1 : 0;
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
