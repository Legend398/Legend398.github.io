import * as THREE from "three";

const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

// Original optical pipeline authored for this portfolio from a visual behavior
// specification. It uses a multiscale inertial flow field rather than a copied
// pressure solver: RG stores packed directional motion, B stores the slower
// wake and A stores the crest. Packing keeps the effect on the universally
// renderable RGBA8 path.
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
  uniform float uBroadRadius;
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
    vec4 leftState = texture2D(uHistory, tracedUv - vec2(uTexelStep.x, 0.0));
    vec4 rightState = texture2D(uHistory, tracedUv + vec2(uTexelStep.x, 0.0));
    vec4 downState = texture2D(uHistory, tracedUv - vec2(0.0, uTexelStep.y));
    vec4 upState = texture2D(uHistory, tracedUv + vec2(0.0, uTexelStep.y));
    vec4 neighborhood = (leftState + rightState + downState + upState) * 0.25;
    float diffusion = min(0.34, frameTime * 7.4);
    vec4 state = mix(carried, neighborhood, diffusion);
    vec2 motion = decodeMotion(state.xy) * exp(-uMotionDrag * frameTime);
    float wake = state.z * exp(-uWakeDrag * frameTime);
    float crest = state.w * exp(-uCrestDrag * frameTime);

    vec2 leftMotion = decodeMotion(leftState.xy);
    vec2 rightMotion = decodeMotion(rightState.xy);
    vec2 downMotion = decodeMotion(downState.xy);
    vec2 upMotion = decodeMotion(upState.xy);
    float curl = (rightMotion.y - leftMotion.y) - (upMotion.x - downMotion.x);
    float divergence = (rightMotion.x - leftMotion.x) + (upMotion.y - downMotion.y);
    vec2 wakeGradient = vec2(rightState.z - leftState.z, upState.z - downState.z);
    vec2 confinement = normalize(wakeGradient + vec2(0.00001));
    motion += vec2(confinement.y, -confinement.x) * curl * frameTime * 0.84;
    motion -= wakeGradient * divergence * frameTime * 0.26;

    vec2 fromPointer = vUv - uPointer;
    vec2 metricDelta = vec2(fromPointer.x * uAspect, fromPointer.y);
    vec2 metricImpulse = vec2(uImpulse.x * uAspect, uImpulse.y);
    vec2 pointFromPrevious = metricDelta + metricImpulse;
    float segmentProgress = clamp(
      dot(pointFromPrevious, metricImpulse)
        / max(dot(metricImpulse, metricImpulse), 0.00001),
      0.0,
      1.0
    );
    vec2 nearestSegmentDelta = pointFromPrevious - metricImpulse * segmentProgress;
    float pointerDistance = length(nearestSegmentDelta);
    float brush = 1.0 - smoothstep(uBrushRadius * 0.16, uBrushRadius, pointerDistance);
    float broadBrush = exp(
      -pointerDistance * pointerDistance / max(uBroadRadius * uBroadRadius * 0.46, 0.00001)
    );
    vec2 orbit = normalize(vec2(-metricDelta.y, metricDelta.x) + vec2(0.00001));
    float impulseStrength = length(uImpulse);
    vec2 directionalPush = uImpulse * 20.0;
    vec2 curvedPush = orbit * impulseStrength * 2.25;
    vec2 broadPush = uImpulse * 7.4 + orbit * impulseStrength * 0.72;
    motion += (
      (directionalPush + curvedPush) * brush
      + broadPush * broadBrush
    ) * uPointerOn;
    float impulseGate = clamp(impulseStrength * 108.0, 0.28, 1.0);
    float injection = brush * uPointerOn * impulseGate;
    float broadInjection = broadBrush * uPointerOn * min(0.72, impulseGate * 0.72);
    wake = max(wake, max(injection, broadInjection));
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
    float response = max(center.z, smoothstep(0.004, 0.18, length(centerMotion)) * 0.76);
    float curvature = clamp(
      length(wakeGradient) * 3.8 + abs(curl) * 1.65 + abs(shear) * 0.82 + center.w,
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
  uniform sampler2D uBaseScene;
  uniform sampler2D uFrameHistory;
  uniform sampler2D uMotionField;
  uniform sampler2D uSurfaceFeatures;
  uniform vec2 uResolution;
  uniform vec2 uFieldSize;
  uniform vec2 uPointer;
  uniform float uAspect;
  uniform float uEffectMix;
  uniform float uHistoryValid;
  uniform float uLensAmount;
  uniform float uPrismPixels;
  varying vec2 vUv;

  vec2 decodeMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  vec2 decodeNormal(vec2 packedNormal) {
    return packedNormal * 2.0 - 1.0;
  }

  float materialDifference(vec3 rendered, vec3 base) {
    vec3 difference = abs(rendered - base);
    return max(max(difference.r, difference.g), difference.b);
  }

  void main() {
    vec4 motionState = texture2D(uMotionField, vUv);
    vec4 features = texture2D(uSurfaceFeatures, vUv);
    float effectEnabled = step(0.5, uEffectMix);
    float response = smoothstep(0.006, 0.42, features.z) * effectEnabled;
    vec2 motion = decodeMotion(motionState.xy);
    vec2 normal = decodeNormal(features.xy);
    float curvature = features.w;
    float wake = motionState.z;
    float crest = motionState.w;
    vec2 flowDirection = normalize(motion + vec2(0.00001));
    vec2 tangent = vec2(-flowDirection.y, flowDirection.x);
    vec2 pointerDelta = vUv - uPointer;
    vec2 metricPointerDelta = vec2(pointerDelta.x * uAspect, pointerDelta.y);
    vec2 metricFlow = normalize(vec2(flowDirection.x * uAspect, flowDirection.y) + vec2(0.00001));
    vec2 metricTangent = vec2(-metricFlow.y, metricFlow.x);
    float bubbleAlong = dot(metricPointerDelta, metricFlow) * 0.84;
    float bubbleAcross = dot(metricPointerDelta, metricTangent) * 1.12;
    float pointerDistance = length(vec2(bubbleAlong, bubbleAcross));
    float normalizedBubbleDistance = clamp(pointerDistance / 0.166, 0.0, 1.0);
    float broadEnvelope = 1.0 - smoothstep(0.10, 0.44, length(metricPointerDelta));
    vec2 radialDirection = normalize(metricPointerDelta + vec2(0.00001));
    radialDirection.x /= max(uAspect, 0.0001);
    float pressureEnvelope = 1.0 - smoothstep(0.82, 1.0, normalizedBubbleDistance);
    float motionForce = smoothstep(0.025, 0.34, length(motion));
    float pressureDepth = max(crest, wake * 0.78);
    float sphereDepth = sqrt(max(0.0, 1.0 - normalizedBubbleDistance * normalizedBubbleDistance));
    float bubbleShell = pow(1.0 - sphereDepth, 0.72) * pressureEnvelope;
    float bubbleWobble = 1.0 + sin(
      atan(metricPointerDelta.y, metricPointerDelta.x) * 3.0
      + wake * 4.0
    ) * 0.09 * motionForce;
    float crestWave = sin(
      dot(vUv * uFieldSize, tangent) * 0.34
      + dot(vUv * uFieldSize, flowDirection) * 0.11
      + curvature * 4.0
    );
    vec2 pressureBulge = radialDirection
      * bubbleShell
      * pressureDepth
      * bubbleWobble
      * (0.042 + motionForce * 0.042);
    float broadRing = exp(-pow((length(metricPointerDelta) - 0.245) / 0.112, 2.0));
    float broadResponse = clamp(
      broadEnvelope * max(wake * 1.04, motionForce * 0.72),
      0.0,
      1.0
    );
    vec2 broadWarp = (
      radialDirection * (broadResponse * 0.033 + broadRing * crest * 0.011)
      + tangent * broadResponse * 0.018
    );
    response = max(response, broadResponse * effectEnabled);
    vec2 refractionVector = motion * 0.096
      + normal * uLensAmount
      + tangent * crestWave * curvature * 0.0038
      + pressureBulge
      + broadWarp;
    float warpLength = length(refractionVector);
    refractionVector *= min(1.0, 0.12 / max(warpLength, 0.00001));
    vec2 refractedUv = clamp(
      vUv - refractionVector * response,
      0.002,
      0.998
    );

    vec2 pixelSize = 1.0 / max(uResolution, vec2(1.0));
    vec2 prismAxis = normalize(normal + tangent * 0.36 + vec2(0.00001));
    vec2 prismOffset = prismAxis
      * pixelSize
      * uPrismPixels
      * (0.45 + curvature + bubbleShell * pressureDepth * 1.8)
      * response;

    vec4 original = texture2D(uFrameInput, vUv);
    vec4 baseAtSource = texture2D(uBaseScene, vUv);
    vec4 center = texture2D(uFrameInput, refractedUv);
    vec4 baseAtWarp = texture2D(uBaseScene, refractedUv);
    float sourceGlass = smoothstep(
      0.018,
      0.13,
      materialDifference(original.rgb, baseAtSource.rgb)
    );
    float warpedGlass = smoothstep(
      0.018,
      0.13,
      materialDifference(center.rgb, baseAtWarp.rgb)
    );
    float glassSilhouette = max(sourceGlass, warpedGlass);
    float deformationWeight = response * mix(0.77, 1.0, glassSilhouette);
    vec3 refracted = vec3(
      texture2D(uFrameInput, clamp(refractedUv + prismOffset * 1.15, 0.002, 0.998)).r,
      center.g,
      texture2D(uFrameInput, clamp(refractedUv - prismOffset * 0.92, 0.002, 0.998)).b
    );
    vec3 internalScatter = (
      texture2D(uFrameInput, clamp(refractedUv + normal * 0.0045, 0.002, 0.998)).rgb
      + texture2D(uFrameInput, clamp(refractedUv - normal * 0.0032, 0.002, 0.998)).rgb
    ) * 0.5;
    refracted = mix(refracted, internalScatter, deformationWeight * curvature * 0.18);

    float wakeBands = 0.5 + 0.5 * sin(
      dot(metricPointerDelta, metricTangent) * 42.0
      + dot(metricPointerDelta, metricFlow) * 11.0
      + curvature * 6.0
    );
    float broadSheen = smoothstep(0.58, 0.94, wakeBands)
      * broadResponse
      * (0.35 + curvature * 0.65);
    refracted += vec3(0.024, 0.041, 0.058) * broadSheen;

    vec2 historyUv = clamp(
      vUv + motion * 0.012 - normal * 0.004,
      0.002,
      0.998
    );
    vec3 historyColor = texture2D(uFrameHistory, historyUv).rgb;
    float historyWeight = uHistoryValid
      * effectEnabled
      * clamp(wake * 0.17 + curvature * 0.055, 0.0, 0.22)
      * mix(0.68, 1.0, glassSilhouette);
    refracted = mix(refracted, historyColor, historyWeight);

    gl_FragColor = vec4(mix(original.rgb, refracted, deformationWeight), original.a);
  }
`;

const CLEAR_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(0.5, 0.5, 0.0, 0.0);
  }
`;

const CLEAR_COLOR_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(0.0);
  }
`;

const COPY_FRAGMENT_SHADER = `
  uniform sampler2D uInput;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(uInput, vUv);
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
  private readonly historyTarget = createColorTarget();
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
    uBrushRadius: { value: 0.13 },
    uBroadRadius: { value: 0.42 },
    uMotionDrag: { value: 4.1 },
    uWakeDrag: { value: 0.72 },
    uCrestDrag: { value: 6.4 },
  });
  private readonly featureMaterial = createFullscreenMaterial(SURFACE_FEATURE_FRAGMENT_SHADER, {
    uMotionField: { value: this.motionRead.texture },
    uTexelStep: { value: this.texelStep },
  });
  private readonly displayMaterial = createFullscreenMaterial(COMPOUND_REFRACTION_FRAGMENT_SHADER, {
    uFrameInput: { value: null },
    uBaseScene: { value: null },
    uFrameHistory: { value: this.historyTarget.texture },
    uMotionField: { value: this.motionRead.texture },
    uSurfaceFeatures: { value: this.featureTarget.texture },
    uResolution: { value: this.resolution },
    uFieldSize: { value: this.fieldSize },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uEffectMix: { value: 0 },
    uHistoryValid: { value: 0 },
    uLensAmount: { value: 0.031 },
    uPrismPixels: { value: 2.45 },
  });
  private readonly clearMaterial = createFullscreenMaterial(CLEAR_FRAGMENT_SHADER, {});
  private readonly clearColorMaterial = createFullscreenMaterial(CLEAR_COLOR_FRAGMENT_SHADER, {});
  private readonly copyMaterial = createFullscreenMaterial(COPY_FRAGMENT_SHADER, {
    uInput: { value: null },
  });
  private hasHistory = false;

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
    this.displayMaterial.uniforms.uAspect.value = aspect;
    [this.motionRead, this.motionWrite, this.featureTarget]
      .forEach((target) => target.setSize(fieldWidth, fieldHeight));
    this.historyTarget.setSize(
      Math.max(1, Math.round(renderWidth * 0.35)),
      Math.max(1, Math.round(renderHeight * 0.35)),
    );
    this.hasHistory = false;
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
    this.displayMaterial.uniforms.uPointer.value.copy(pointerUv);
    this.motionMaterial.uniforms.uImpulse.value.copy(pointerDeltaUv);
    this.motionMaterial.uniforms.uFrameTime.value = delta;
    this.motionMaterial.uniforms.uPointerOn.value = injectPointer ? 1 : 0;
    this.renderMaterial(renderer, this.motionMaterial, this.motionWrite);
    this.swapMotionTargets();
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    baseTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget,
    enabled: boolean,
  ) {
    this.featureMaterial.uniforms.uMotionField.value = this.motionRead.texture;
    this.renderMaterial(renderer, this.featureMaterial, this.featureTarget);

    this.displayMaterial.uniforms.uFrameInput.value = inputTexture;
    this.displayMaterial.uniforms.uBaseScene.value = baseTexture;
    this.displayMaterial.uniforms.uFrameHistory.value = this.historyTarget.texture;
    this.displayMaterial.uniforms.uMotionField.value = this.motionRead.texture;
    this.displayMaterial.uniforms.uSurfaceFeatures.value = this.featureTarget.texture;
    this.displayMaterial.uniforms.uEffectMix.value = enabled ? 1 : 0;
    this.displayMaterial.uniforms.uHistoryValid.value = this.hasHistory && enabled ? 1 : 0;
    this.renderMaterial(renderer, this.displayMaterial, outputTarget);

    this.copyMaterial.uniforms.uInput.value = outputTarget.texture;
    this.renderMaterial(renderer, this.copyMaterial, this.historyTarget);
    this.hasHistory = enabled;
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
    [this.motionRead, this.motionWrite, this.featureTarget, this.historyTarget].forEach((target) => {
      renderer.setRenderTarget(target);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("WebGL optical framebuffer is incomplete");
      }
    });
  }

  reset(renderer: THREE.WebGLRenderer) {
    [this.motionRead, this.motionWrite, this.featureTarget]
      .forEach((target) => this.renderMaterial(renderer, this.clearMaterial, target));
    this.renderMaterial(renderer, this.clearColorMaterial, this.historyTarget);
    this.hasHistory = false;
  }

  dispose() {
    this.geometry.dispose();
    [
      this.motionMaterial,
      this.featureMaterial,
      this.displayMaterial,
      this.clearMaterial,
      this.clearColorMaterial,
      this.copyMaterial,
    ]
      .forEach((material) => material.dispose());
    [this.motionRead, this.motionWrite, this.featureTarget, this.historyTarget]
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
    uIntensity: { value: 0.82 },
    uThreshold: { value: 0.968 },
    uStreakScale: { value: 8 },
    uHotspotPower: { value: 12 },
    uGate: { value: 0.68 },
    uHaloIntensity: { value: 0.76 },
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
