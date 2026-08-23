import * as THREE from "three";

const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const POINTER_FORCE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uVelocity;
  uniform vec2 uPointer;
  uniform vec2 uPointerDelta;
  uniform float uAspect;
  uniform float uActive;
  uniform float uSplatForce;
  uniform float uSplatRadius;
  varying vec2 vUv;

  void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 diff = vUv - uPointer;
    diff.x *= uAspect;
    float pointerMask = exp(-dot(diff, diff) / max(uSplatRadius, 0.0001));
    velocity += uPointerDelta * pointerMask * uSplatForce * uActive;
    velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const DIVERGENCE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    float divergence = 0.5 * (right - left + top - bottom);
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`;

const PRESSURE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (left + right + top + bottom - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(right - left, top - bottom);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const ADVECTION_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  uniform float uDelta;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    float stepTime = min(max(uDelta, 0.0), 0.05);
    vec2 coord = clamp(vUv - velocity * uTexelSize * stepTime, 0.0, 1.0);
    vec2 advected = texture2D(uVelocity, coord).xy;
    advected /= 1.0 + uDissipation * stepTime;
    gl_FragColor = vec4(advected, 0.0, 1.0);
  }
`;

const FLUID_DISPLAY_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uVelocity;
  uniform vec2 uSimSize;
  uniform float uEffectEnabled;
  uniform float uDisplacementStrength;
  uniform float uChromaticBoost;
  varying vec2 vUv;

  vec3 spectrum(float x) {
    return cos((x - vec3(0.0, 0.5, 1.0)) * vec3(0.6, 1.0, 0.5) * 3.14);
  }

  vec4 getFluidDisplayColor(vec2 uv) {
    vec2 velocity = texture2D(uVelocity, uv).xy;
    float effectEnabled = step(0.5, uEffectEnabled);
    vec2 displacement = velocity / max(uSimSize, vec2(1.0))
      * uDisplacementStrength
      * effectEnabled;
    float velocityMagnitude = length(displacement);

    const int samples = 4;
    vec4 color = vec4(0.0);
    vec3 weightSum = vec3(0.0);

    for (int index = 0; index < samples; index++) {
      float t = float(index) / float(samples - 1);
      vec3 weight = max(
        vec3(0.0),
        cos((t - vec3(0.0, 0.5, 1.0)) * 3.14159 * 0.5)
      );
      vec4 sampleColor = texture2D(
        uScene,
        clamp(
          uv - displacement * 0.3 * (t + 0.3) * velocityMagnitude,
          0.0,
          1.0
        )
      );
      color.rgb += sampleColor.rgb * weight;
      color.a += sampleColor.a * (weight.r + weight.g + weight.b) / 3.0;
      weightSum += weight;
    }

    color.rgb /= max(weightSum, vec3(0.0001));
    color.a /= max(
      (weightSum.r + weightSum.g + weightSum.b) / 3.0,
      0.0001
    );

    vec3 spectralHighlight = spectrum(sin(velocityMagnitude * 2.0) * 0.4 + 0.6);
    color.rgb += spectralHighlight
      * smoothstep(0.2, 0.8, velocityMagnitude)
      * 0.5
      * uChromaticBoost
      * effectEnabled;

    return color;
  }

  void main() {
    gl_FragColor = getFluidDisplayColor(vUv);
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
  private velocityRead = createDataTarget();
  private velocityWrite = createDataTarget();
  private readonly divergenceTarget = createDataTarget();
  private pressureRead = createDataTarget();
  private pressureWrite = createDataTarget();
  private readonly projectedVelocityTarget = createDataTarget();
  private readonly simSize = new THREE.Vector2(1, 1);
  private readonly texelSize = new THREE.Vector2(1, 1);
  private readonly forceMaterial = createFullscreenMaterial(POINTER_FORCE_FRAGMENT_SHADER, {
    uVelocity: { value: null },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPointerDelta: { value: new THREE.Vector2() },
    uAspect: { value: 1 },
    uActive: { value: 0 },
    uSplatForce: { value: 3000 },
    uSplatRadius: { value: 0.003 },
  });
  private readonly divergenceMaterial = createFullscreenMaterial(DIVERGENCE_FRAGMENT_SHADER, {
    uVelocity: { value: null },
    uTexelSize: { value: this.texelSize },
  });
  private readonly pressureMaterial = createFullscreenMaterial(PRESSURE_FRAGMENT_SHADER, {
    uPressure: { value: null },
    uDivergence: { value: this.divergenceTarget.texture },
    uTexelSize: { value: this.texelSize },
  });
  private readonly gradientMaterial = createFullscreenMaterial(GRADIENT_FRAGMENT_SHADER, {
    uVelocity: { value: null },
    uPressure: { value: null },
    uTexelSize: { value: this.texelSize },
  });
  private readonly advectionMaterial = createFullscreenMaterial(ADVECTION_FRAGMENT_SHADER, {
    uVelocity: { value: this.projectedVelocityTarget.texture },
    uTexelSize: { value: this.texelSize },
    uDelta: { value: 0 },
    uDissipation: { value: 3 },
  });
  private readonly displayMaterial = createFullscreenMaterial(FLUID_DISPLAY_FRAGMENT_SHADER, {
    uScene: { value: null },
    uVelocity: { value: this.velocityRead.texture },
    uSimSize: { value: this.simSize },
    uEffectEnabled: { value: 0 },
    uDisplacementStrength: { value: 1 },
    uChromaticBoost: { value: 0.5 },
  });
  private readonly clearMaterial = createFullscreenMaterial(CLEAR_FRAGMENT_SHADER, {});

  constructor() {
    this.quad = new THREE.Mesh(this.geometry, this.forceMaterial);
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

  private swapVelocity() {
    const previousRead = this.velocityRead;
    this.velocityRead = this.velocityWrite;
    this.velocityWrite = previousRead;
  }

  private swapPressure() {
    const previousRead = this.pressureRead;
    this.pressureRead = this.pressureWrite;
    this.pressureWrite = previousRead;
  }

  resize(renderWidth: number, renderHeight: number) {
    const aspect = renderWidth / Math.max(renderHeight, 1);
    const simHeight = 160;
    const simWidth = Math.max(96, Math.round(simHeight * aspect));
    this.simSize.set(simWidth, simHeight);
    this.texelSize.set(1 / simWidth, 1 / simHeight);
    this.forceMaterial.uniforms.uAspect.value = aspect;
    [
      this.velocityRead,
      this.velocityWrite,
      this.divergenceTarget,
      this.pressureRead,
      this.pressureWrite,
      this.projectedVelocityTarget,
    ].forEach((target) => target.setSize(simWidth, simHeight));
  }

  update(
    renderer: THREE.WebGLRenderer,
    delta: number,
    pointerUv: THREE.Vector2,
    pointerDeltaUv: THREE.Vector2,
    injectPointer: boolean,
  ) {
    this.forceMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.forceMaterial.uniforms.uPointer.value.copy(pointerUv);
    this.forceMaterial.uniforms.uPointerDelta.value.copy(pointerDeltaUv);
    this.forceMaterial.uniforms.uActive.value = injectPointer ? 1 : 0;
    this.renderMaterial(renderer, this.forceMaterial, this.velocityWrite);
    this.swapVelocity();

    this.divergenceMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.renderMaterial(renderer, this.divergenceMaterial, this.divergenceTarget);

    this.renderMaterial(renderer, this.clearMaterial, this.pressureRead);
    for (let iteration = 0; iteration < 4; iteration += 1) {
      this.pressureMaterial.uniforms.uPressure.value = this.pressureRead.texture;
      this.renderMaterial(renderer, this.pressureMaterial, this.pressureWrite);
      this.swapPressure();
    }

    this.gradientMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.gradientMaterial.uniforms.uPressure.value = this.pressureRead.texture;
    this.renderMaterial(renderer, this.gradientMaterial, this.projectedVelocityTarget);

    this.advectionMaterial.uniforms.uVelocity.value = this.projectedVelocityTarget.texture;
    this.advectionMaterial.uniforms.uDelta.value = delta;
    this.renderMaterial(renderer, this.advectionMaterial, this.velocityWrite);
    this.swapVelocity();
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget,
    enabled: boolean,
  ) {
    this.displayMaterial.uniforms.uScene.value = inputTexture;
    this.displayMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.displayMaterial.uniforms.uEffectEnabled.value = enabled ? 1 : 0;
    this.renderMaterial(renderer, this.displayMaterial, outputTarget);
  }

  reset(renderer: THREE.WebGLRenderer) {
    [
      this.velocityRead,
      this.velocityWrite,
      this.divergenceTarget,
      this.pressureRead,
      this.pressureWrite,
      this.projectedVelocityTarget,
    ].forEach((target) => this.renderMaterial(renderer, this.clearMaterial, target));
  }

  dispose() {
    this.geometry.dispose();
    [
      this.forceMaterial,
      this.divergenceMaterial,
      this.pressureMaterial,
      this.gradientMaterial,
      this.advectionMaterial,
      this.displayMaterial,
      this.clearMaterial,
    ].forEach((material) => material.dispose());
    [
      this.velocityRead,
      this.velocityWrite,
      this.divergenceTarget,
      this.pressureRead,
      this.pressureWrite,
      this.projectedVelocityTarget,
    ].forEach((target) => target.dispose());
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
