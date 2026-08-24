"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { SCULPTED_WORD_PATH } from "@/components/SculptedWordPath";
import { createCleanroomHelloGeometry } from "@/components/hero/CleanroomHelloGeometry";
import { HeroFlarePass, HeroFluidPass } from "@/components/hero/HeroPostProcessing";

type HelloModelSource = "downloaded-gltf" | "cleanroom-v2";

const RIPPLE_COUNT = 4;
const BACKGROUND_SPLAT_COUNT = 4;
const STICKER_COUNT = 14;
const INITIAL_STICKER_BATCH = 3;
const HERO_SCENE_READY_EVENT = "hero-scene-ready";
const STICKER_CAPACITY = 84;
const STICKER_COLUMNS = 4;
const STICKER_ROWS = 4;
const GLASS_THEME_SETTINGS = {
  dark: {
    brightness: 0.6,
    contrast: 0.98,
    diffuseness: 0.05,
    fresnelPower: 3,
    fresnelStrength: 0.72,
    shininess: 100,
    tintThicknessMaxAlpha: 0.4,
    tintThicknessMinAlpha: 1,
  },
  light: {
    brightness: 0.74,
    contrast: 1.04,
    diffuseness: 0.035,
    fresnelPower: 1.45,
    fresnelStrength: 0.34,
    shininess: 156,
    tintThicknessMaxAlpha: 0.72,
    tintThicknessMinAlpha: 0.98,
  },
} as const;
const STICKER_PATHS = [
  "/sticker_img/original/holographic-floppy-comet.png",
  "/sticker_img/original/warped-404.png",
  "/sticker_img/original/printed-naughty-ghost.png",
  "/sticker_img/original/pixel-coffee-error.png",
  "/sticker_img/original/spiral-eye-badge.png",
  "/sticker_img/original/deadpan-frog.png",
  "/sticker_img/original/deadpan-duck.png",
  "/sticker_img/original/holographic-cd.png",
  "/sticker_img/original/ship-it.png",
  "/sticker_img/original/pixel-pizza-signal.png",
  "/sticker_img/original/cursor-matchbook.png",
  "/sticker_img/original/skateboard-snail.png",
  "/sticker_img/original/checkerboard-butterfly.png",
  "/sticker_img/original/pixel-mail-window.png",
] as const;

const GLASS_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vEyeVector;
  varying float vLocalY;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
    vEyeVector = normalize(worldPosition.xyz - cameraPosition);
    vLocalY = position.y;
  }
`;

const GLASS_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uMotionField;
  uniform vec2 uResolution;
  uniform vec2 uMotionTexelStep;
  uniform vec3 uLight;
  uniform vec2 uHoverUv;
  uniform float uHoverStrength;
  uniform vec2 uCursorVelocity;
  uniform float uCursorForce;
  uniform float uOpticalCoupling;
  uniform vec2 uRippleUv[${RIPPLE_COUNT}];
  uniform float uRippleAges[${RIPPLE_COUNT}];
  uniform vec2 uLocalYRange;
  uniform int uSampleCount;
  uniform float uTime;
  uniform vec3 uTintAccent;
  uniform vec3 uTintBase;
  uniform float uBrightness;
  uniform float uChromaticAberration;
  uniform float uContrast;
  uniform float uDiffuseness;
  uniform float uFresnelPower;
  uniform vec3 uFresnelSideDir;
  uniform float uFresnelStrength;
  uniform float uGamma;
  uniform float uRefractPower;
  uniform float uSaturation;
  uniform float uShininess;
  uniform float uSpecularStrength;
  uniform float uTintMix;
  uniform float uTintThicknessMaxAlpha;
  uniform float uTintThicknessMinAlpha;

  varying vec3 vWorldNormal;
  varying vec3 vEyeVector;
  varying float vLocalY;

  float random2d(vec2 value) {
    return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 decodeFieldMotion(vec2 packedMotion) {
    return packedMotion * 1.1 - 0.55;
  }

  vec3 adjustSaturation(vec3 rgb, float amount) {
    vec3 luminanceWeights = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(rgb, luminanceWeights));
    return mix(intensity, rgb, amount);
  }

  float glassFresnel(vec3 eyeDirection, vec3 normal, float power) {
    return pow(1.0 - abs(dot(eyeDirection, normal)), power);
  }

  float glassSpecular(vec3 light, vec3 normal, vec3 eyeDirection, float shininess, float diffuseness) {
    vec3 lightDirection = normalize(-light);
    vec3 halfDirection = normalize(eyeDirection + lightDirection);
    float diffuse = max(0.0, dot(normal, lightDirection));
    float highlight = pow(abs(dot(normal, halfDirection)), shininess);
    return highlight + diffuse * diffuseness;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 normal = normalize(vWorldNormal);
    vec3 eyeDirection = normalize(vEyeVector);
    float noise = random2d(uv) * 0.025;
    vec3 color = vec3(0.0);

    vec2 rippleOffset = vec2(0.0);
    float rippleHighlight = 0.0;
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);

    vec4 flowCenter = texture2D(uMotionField, uv);
    vec4 flowLeft = texture2D(uMotionField, uv - vec2(uMotionTexelStep.x, 0.0));
    vec4 flowRight = texture2D(uMotionField, uv + vec2(uMotionTexelStep.x, 0.0));
    vec4 flowDown = texture2D(uMotionField, uv - vec2(0.0, uMotionTexelStep.y));
    vec4 flowUp = texture2D(uMotionField, uv + vec2(0.0, uMotionTexelStep.y));
    vec2 fieldMotion = decodeFieldMotion(flowCenter.xy);
    vec2 fieldGradient = vec2(flowRight.z - flowLeft.z, flowUp.z - flowDown.z);
    float fieldResponse = smoothstep(0.06, 0.56, flowCenter.z) * uOpticalCoupling;
    vec2 fieldUvMotion = vec2(fieldMotion.x / screenAspect, fieldMotion.y);
    vec2 fieldUvNormal = vec2(fieldGradient.x / screenAspect, fieldGradient.y);
    normal = normalize(normal + vec3(
      (fieldUvNormal * 1.18 + fieldUvMotion * 0.28) * fieldResponse,
      flowCenter.w * fieldResponse * 0.14
    ));
    rippleOffset += (
      fieldUvMotion * 0.038
      + fieldUvNormal * 0.018
    ) * fieldResponse;
    rippleHighlight += fieldResponse * (length(fieldGradient) * 0.52 + flowCenter.w * 0.12);

    vec2 cursorDelta = uv - uHoverUv;
    cursorDelta.x *= screenAspect;
    vec2 cursorDirection = normalize(
      vec2(uCursorVelocity.x * screenAspect, uCursorVelocity.y) + vec2(0.00001)
    );
    vec2 cursorTangent = vec2(-cursorDirection.y, cursorDirection.x);
    float cursorAlong = dot(cursorDelta, cursorDirection) * 0.84;
    float cursorAcross = dot(cursorDelta, cursorTangent) * 1.12;
    float cursorDistance = length(vec2(cursorAlong, cursorAcross));
    float normalizedCursorDistance = clamp(cursorDistance / 0.1088, 0.0, 1.0);
    float cursorEnvelope = 1.0 - smoothstep(0.82, 1.0, normalizedCursorDistance);
    float bubbleDepth = sqrt(max(
      0.0,
      1.0 - normalizedCursorDistance * normalizedCursorDistance
    ));
    float bubbleShell = pow(1.0 - bubbleDepth, 0.7) * cursorEnvelope;
    vec2 cursorRadial = normalize(cursorDelta + vec2(0.00001));
    cursorRadial.x /= screenAspect;
    vec2 cursorFlowUv = vec2(cursorDirection.x / screenAspect, cursorDirection.y);
    float cursorWobble = 1.0 + sin(
      atan(cursorDelta.y, cursorDelta.x) * 3.0 + uTime * 7.0
    ) * 0.08;
    float bubbleCore = cursorEnvelope * bubbleDepth * uCursorForce;
    normal = normalize(normal + vec3(
      cursorRadial * bubbleShell * cursorWobble * uCursorForce * 1.34,
      bubbleCore * 0.31
    ));
    rippleOffset += (
      cursorRadial * bubbleShell * cursorWobble * 0.058
      + cursorFlowUv * bubbleShell * 0.021
    ) * uCursorForce;
    float bubbleRim = smoothstep(0.48, 0.92, normalizedCursorDistance)
      * (1.0 - smoothstep(0.90, 1.0, normalizedCursorDistance));
    rippleHighlight += bubbleRim * cursorEnvelope * uCursorForce * 0.18;
    for (int rippleIndex = 0; rippleIndex < ${RIPPLE_COUNT}; rippleIndex++) {
      float age = uRippleAges[rippleIndex];
      vec2 rippleDelta = uv - uRippleUv[rippleIndex];
      rippleDelta.x *= screenAspect;
      float distanceFromHit = length(rippleDelta);
      float ringRadius = 0.018 + age * 0.12;
      float ringEnvelope = exp(-age * 4.1) * exp(-abs(distanceFromHit - ringRadius) * 34.0);
      float ringWave = sin((distanceFromHit - ringRadius) * 72.0) * ringEnvelope;
      vec2 ringDirection = normalize(rippleDelta + vec2(0.00001));
      ringDirection.x /= screenAspect;
      rippleOffset += ringDirection * ringWave * 0.0062;
      rippleHighlight += abs(ringWave) * 0.18;
    }

    vec3 refractR = refract(eyeDirection, normal, 1.0 / 1.15);
    vec3 refractG = refract(eyeDirection, normal, 1.0 / 1.18);
    vec3 refractB = refract(eyeDirection, normal, 1.0 / 1.22);
    float loopCount = float(uSampleCount);

    if (uSampleCount <= 3) {
      for (int index = 0; index < 3; index++) {
        if (index < uSampleCount) {
          float slide = float(index) / loopCount * 0.1 + noise;
          float offset = (uRefractPower + slide) * uChromaticAberration;
          color.r += texture2D(uScene, uv + rippleOffset + refractR.xy * offset).r;
          color.g += texture2D(uScene, uv + rippleOffset + refractG.xy * offset).g;
          color.b += texture2D(uScene, uv + rippleOffset + refractB.xy * offset).b;
        }
      }
    } else {
      vec3 refractY = refract(eyeDirection, normal, 1.0 / 1.16);
      vec3 refractC = refract(eyeDirection, normal, 1.0 / 1.22);
      vec3 refractP = refract(eyeDirection, normal, 1.0 / 1.22);
      for (int index = 0; index < 6; index++) {
        if (index < uSampleCount) {
          float slide = float(index) / loopCount * 0.1 + noise;
          float offsetR = (uRefractPower + slide) * uChromaticAberration;
          float offsetY = (uRefractPower + slide) * uChromaticAberration;
          float offsetG = (uRefractPower + slide * 2.0) * uChromaticAberration;
          float offsetC = (uRefractPower + slide * 2.5) * uChromaticAberration;
          float offsetB = (uRefractPower + slide * 3.0) * uChromaticAberration;
          float offsetP = (uRefractPower + slide) * uChromaticAberration;

          float red = texture2D(uScene, uv + rippleOffset + refractR.xy * offsetR).r * 0.5;
          vec3 yellowSample = texture2D(uScene, uv + rippleOffset + refractY.xy * offsetY).rgb;
          float yellow = (yellowSample.r * 2.0 + yellowSample.g * 2.0 - yellowSample.b) / 6.0;
          float green = texture2D(uScene, uv + rippleOffset + refractG.xy * offsetG).g * 0.5;
          vec3 cyanSample = texture2D(uScene, uv + rippleOffset + refractC.xy * offsetC).rgb;
          float cyan = (cyanSample.g * 2.0 + cyanSample.b * 2.0 - cyanSample.r) / 6.0;
          float blue = texture2D(uScene, uv + rippleOffset + refractB.xy * offsetB).b * 0.5;
          vec3 purpleSample = texture2D(uScene, uv + rippleOffset + refractP.xy * offsetP).rgb;
          float purple = (purpleSample.b * 2.0 + purpleSample.r * 2.0 - purpleSample.g) / 6.0;

          color.r += red + (purple * 2.0 + yellow * 2.0 - cyan) / 3.0;
          color.g += green + (yellow * 2.0 + cyan * 2.0 - purple) / 3.0;
          color.b += blue + (cyan * 2.0 + purple * 2.0 - yellow) / 3.0;
        }
      }
    }
    color /= loopCount;
    color = mix(texture2D(uScene, uv + rippleOffset * 0.35).rgb, color, 0.84);

    vec2 hoverDelta = uv - uHoverUv;
    hoverDelta.x *= uResolution.x / max(uResolution.y, 1.0);
    float hoverMask = exp(-dot(hoverDelta, hoverDelta) * 59.375) * uHoverStrength;

    color = adjustSaturation(color, uSaturation);
    color *= uBrightness;
    color = (color - 0.5) * uContrast + 0.5;
    color = pow(max(color, 0.0), vec3(1.0 / max(uGamma, 0.0001)));

    float ySpan = max(uLocalYRange.y - uLocalYRange.x, 0.00001);
    float yMix = clamp((vLocalY - uLocalYRange.x) / ySpan, 0.0, 1.0);
    vec3 tint = mix(uTintBase, uTintAccent, yMix);
    float facing = abs(dot(normal, eyeDirection));
    float thicknessMask = clamp(1.0 - facing, 0.0, 1.0);
    float tintAlpha = mix(uTintThicknessMaxAlpha, uTintThicknessMinAlpha, thicknessMask);
    vec3 transmission = pow(clamp(tint, 0.001, 1.0), vec3(uTintMix));
    color = mix(color, color * transmission, tintAlpha * 0.9);

    float specularLight = glassSpecular(uLight, normal, eyeDirection, uShininess, uDiffuseness);
    color += specularLight * uSpecularStrength;
    float fresnel = glassFresnel(eyeDirection, normal, uFresnelPower);
    float sideMask = smoothstep(-0.5, 0.5, dot(normal, normalize(uFresnelSideDir)));
    vec3 rimTransmission = mix(
      vec3(0.48, 0.66, 0.84),
      vec3(0.68, 0.84, 0.98),
      sideMask
    );
    color = mix(color, color * rimTransmission, fresnel * 0.46);
    color += fresnel * sideMask * uFresnelStrength;
    color += hoverMask * (0.012 + fresnel * 0.035) * vec3(0.72, 0.9, 1.0);

    vec2 sparkleCell = floor(gl_FragCoord.xy / 2.5);
    float sparkleField = step(0.86, random2d(sparkleCell));
    float sparkleMask = smoothstep(0.16, 0.72, specularLight + fresnel * sideMask * 0.25);
    color += sparkleField * sparkleMask * (0.2 + hoverMask * 0.14);
    color += rippleHighlight * vec3(0.72, 0.9, 1.0);

    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

const STICKER_VERTEX_SHADER = `
  attribute vec4 aUvRect;
  attribute float aOpacity;
  varying vec2 vAtlasUv;
  varying float vOpacity;

  void main() {
    vAtlasUv = aUvRect.xy + uv * aUvRect.zw;
    vOpacity = aOpacity;
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
  }
`;

const STICKER_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uAtlas;
  varying vec2 vAtlasUv;
  varying float vOpacity;

  void main() {
    vec4 sticker = texture2D(uAtlas, vAtlasUv);
    if (sticker.a < 0.025 || vOpacity < 0.01) discard;
    gl_FragColor = vec4(sticker.rgb, sticker.a * vOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Disposable = { dispose: () => void };

type StickerParticle = {
  active: boolean;
  emitAt: number;
  fallDistance: number;
  fallSpeed: number;
  isOneShot: boolean;
  originX: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  startY: number;
  textureIndex: number;
  windAmplitude: number;
  windPhase: number;
  x: number;
  y: number;
  z: number;
};

type StickerField = {
  addSticker: (textureIndex: number, image: HTMLImageElement) => void;
  burst: (elapsed: number) => void;
  dispose: () => void;
  mesh: THREE.InstancedMesh;
  resize: (camera: THREE.PerspectiveCamera) => void;
  update: (elapsed: number, delta: number) => number;
};

function loadStickerImage(path: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    new THREE.ImageLoader().load(path, (image) => resolve(image as HTMLImageElement), undefined, reject);
  });
}

function createStickerField(camera: THREE.PerspectiveCamera): StickerField {
  const atlasCanvas = document.createElement("canvas");
  const cellSize = 512;
  atlasCanvas.width = STICKER_COLUMNS * cellSize;
  atlasCanvas.height = STICKER_ROWS * cellSize;
  const context = atlasCanvas.getContext("2d");
  if (!context) throw new Error("Could not create the sticker atlas");

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.generateMipmaps = false;
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(1, 1);
  const uvRects = new Float32Array(STICKER_CAPACITY * 4);
  const opacities = new Float32Array(STICKER_CAPACITY);
  const uvRectAttribute = new THREE.InstancedBufferAttribute(uvRects, 4);
  const opacityAttribute = new THREE.InstancedBufferAttribute(opacities, 1);
  geometry.setAttribute("aUvRect", uvRectAttribute);
  geometry.setAttribute("aOpacity", opacityAttribute);

  const material = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlasTexture } },
    vertexShader: STICKER_VERTEX_SHADER,
    fragmentShader: STICKER_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, STICKER_CAPACITY);
  mesh.count = STICKER_CAPACITY;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  const particles: StickerParticle[] = Array.from({ length: STICKER_CAPACITY }, (_, index) => ({
    active: false,
    emitAt: 0,
    fallDistance: 1,
    fallSpeed: 1,
    isOneShot: index >= STICKER_COUNT,
    opacity: 0,
    originX: 0,
    rotation: 0,
    rotationSpeed: 0,
    size: 0,
    startY: 0,
    textureIndex: 0,
    windAmplitude: 0,
    windPhase: 0,
    x: 0,
    y: 0,
    z: 0,
  }));
  const dummy = new THREE.Object3D();
  let halfHeight = 3;
  let halfWidth = 5;
  let nextBurstSlot = STICKER_COUNT;
  const loadedTextureIndices: number[] = [];
  const loadedTextureSet = new Set<number>();

  const setUvRect = (index: number, textureIndex: number) => {
    const column = textureIndex % STICKER_COLUMNS;
    const row = Math.floor(textureIndex / STICKER_COLUMNS);
    const offset = index * 4;
    uvRects[offset] = column / STICKER_COLUMNS;
    uvRects[offset + 1] = 1 - (row + 1) / STICKER_ROWS;
    uvRects[offset + 2] = 1 / STICKER_COLUMNS;
    uvRects[offset + 3] = 1 / STICKER_ROWS;
  };

  const getRandomLoadedTexture = () => (
    loadedTextureIndices[Math.floor(Math.random() * loadedTextureIndices.length)] ?? 0
  );

  const resetNormal = (
    particle: StickerParticle,
    index: number,
    initial: boolean,
    initialTextureIndex?: number,
  ) => {
    const travel = halfHeight * 5.2;
    particle.active = true;
    particle.isOneShot = false;
    particle.originX = THREE.MathUtils.randFloatSpread(halfWidth * 2.65);
    particle.startY = halfHeight * 1.4 + Math.random() * halfHeight * 1.1;
    particle.y = initial
      ? particle.startY - Math.random() * travel * 0.94
      : particle.startY;
    particle.x = particle.originX;
    particle.z = 0.24 + THREE.MathUtils.randFloatSpread(0.42);
    particle.fallDistance = travel;
    particle.fallSpeed = THREE.MathUtils.randFloat(0.48, 0.86);
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotationSpeed = THREE.MathUtils.randFloatSpread(1.6);
    particle.size = THREE.MathUtils.randFloat(0.52, 0.76);
    particle.windPhase = Math.random() * Math.PI * 2;
    particle.windAmplitude = THREE.MathUtils.randFloat(0.12, 0.38);
    particle.textureIndex = initial
      ? (initialTextureIndex ?? getRandomLoadedTexture())
      : getRandomLoadedTexture();
    setUvRect(index, particle.textureIndex);
  };

  const resize = (nextCamera: THREE.PerspectiveCamera) => {
    const distance = Math.abs(nextCamera.position.z - 0.24);
    halfHeight = Math.tan(THREE.MathUtils.degToRad(nextCamera.fov * 0.5)) * distance;
    halfWidth = halfHeight * nextCamera.aspect;
  };

  resize(camera);
  particles.forEach((particle, index) => setUvRect(index, particle.textureIndex));
  uvRectAttribute.needsUpdate = true;

  const addSticker = (textureIndex: number, image: HTMLImageElement) => {
    if (
      textureIndex < 0
      || textureIndex >= STICKER_COUNT
      || loadedTextureSet.has(textureIndex)
    ) return;

    const column = textureIndex % STICKER_COLUMNS;
    const row = Math.floor(textureIndex / STICKER_COLUMNS);
    const inset = 18;
    const maxWidth = cellSize - inset * 2;
    const maxHeight = cellSize - inset * 2;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    context.drawImage(
      image,
      column * cellSize + (cellSize - width) / 2,
      row * cellSize + (cellSize - height) / 2,
      width,
      height,
    );
    atlasTexture.needsUpdate = true;
    loadedTextureSet.add(textureIndex);
    loadedTextureIndices.push(textureIndex);
    resetNormal(particles[textureIndex], textureIndex, true, textureIndex);
    uvRectAttribute.needsUpdate = true;
  };

  const burst = (elapsed: number) => {
    if (loadedTextureIndices.length === 0) return;
    const horizontalPadding = Math.min(halfWidth * 0.1, 0.34);
    const verticalPadding = Math.min(halfHeight * 0.1, 0.28);
    for (let index = 0; index < loadedTextureIndices.length; index += 1) {
      const slot = nextBurstSlot;
      nextBurstSlot += 1;
      if (nextBurstSlot >= STICKER_CAPACITY) nextBurstSlot = STICKER_COUNT;
      const particle = particles[slot];
      particle.active = true;
      particle.isOneShot = true;
      particle.emitAt = elapsed + Math.random() * 0.24;
      particle.originX = THREE.MathUtils.randFloat(
        -halfWidth + horizontalPadding,
        halfWidth - horizontalPadding,
      );
      particle.x = particle.originX;
      particle.startY = THREE.MathUtils.randFloat(
        -halfHeight + verticalPadding,
        halfHeight - verticalPadding,
      );
      particle.y = particle.startY;
      particle.z = 0.5 + THREE.MathUtils.randFloatSpread(0.3);
      particle.fallDistance = halfHeight * 2.35;
      particle.fallSpeed = THREE.MathUtils.randFloat(0.7, 1.18);
      particle.rotation = Math.random() * Math.PI * 2;
      particle.rotationSpeed = THREE.MathUtils.randFloatSpread(2.2);
      particle.size = THREE.MathUtils.randFloat(0.56, 0.82);
      particle.windPhase = Math.random() * Math.PI * 2;
      particle.windAmplitude = THREE.MathUtils.randFloat(0.22, 0.66);
      particle.textureIndex = getRandomLoadedTexture();
      particle.opacity = 0;
      setUvRect(slot, particle.textureIndex);
    }
    uvRectAttribute.needsUpdate = true;
  };

  const update = (elapsed: number, delta: number) => {
    let visible = 0;
    particles.forEach((particle, index) => {
      if (!particle.active || elapsed < particle.emitAt) {
        opacities[index] = 0;
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        return;
      }

      particle.y -= particle.fallSpeed * delta;
      particle.x = particle.originX + Math.sin(elapsed * 0.3 + particle.windPhase) * particle.windAmplitude;
      particle.rotation += particle.rotationSpeed * delta;
      const progress = THREE.MathUtils.clamp((particle.startY - particle.y) / particle.fallDistance, 0, 1);
      const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.05);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.9, 1);
      particle.opacity = fadeIn * fadeOut;

      if (progress >= 1) {
        if (particle.isOneShot) {
          particle.active = false;
          particle.opacity = 0;
        } else {
          resetNormal(particle, index, false);
          uvRectAttribute.needsUpdate = true;
        }
      }

      opacities[index] = particle.opacity;
      if (particle.opacity > 0.01) visible += 1;
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.set(0, 0, particle.rotation);
      dummy.scale.set(particle.size, particle.size, particle.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    opacityAttribute.needsUpdate = true;
    return visible;
  };

  return {
    addSticker,
    burst,
    dispose: () => {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      atlasTexture.dispose();
    },
    mesh,
    resize,
    update,
  };
}

function createSculptedGeometry() {
  const svg = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path fill="#fff" fill-rule="evenodd" d="${SCULPTED_WORD_PATH}"/></svg>`,
  );
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
  const rawGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 66,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 20,
    bevelSize: 18,
    bevelOffset: 0,
    bevelSegments: 12,
  });

  rawGeometry.center();
  rawGeometry.rotateX(Math.PI);
  rawGeometry.deleteAttribute("normal");
  rawGeometry.deleteAttribute("uv");
  const geometry = mergeVertices(rawGeometry, 0.001);
  rawGeometry.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const width = geometry.boundingBox
    ? geometry.boundingBox.max.x - geometry.boundingBox.min.x
    : 1;
  const scale = 6.35 / Math.max(width, 1);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createDownloadedGeometry(scene: THREE.Object3D, targetWidth: number) {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const part = child.geometry.clone();
    part.applyMatrix4(child.matrixWorld);
    parts.push(part);
  });

  if (parts.length === 0) {
    throw new Error("The downloaded hello model has no mesh geometry");
  }

  let geometry: THREE.BufferGeometry;
  if (parts.length === 1) {
    geometry = parts[0];
  } else {
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!merged) throw new Error("The downloaded hello model could not be merged");
    geometry = merged;
  }

  geometry.center();
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const width = geometry.boundingBox
    ? geometry.boundingBox.max.x - geometry.boundingBox.min.x
    : 1;
  const scale = targetWidth / Math.max(width, 0.00001);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createDownloadedHelloGeometry(scene: THREE.Object3D) {
  return createDownloadedGeometry(scene, 6.35);
}

export function GlassWordScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let frame = 0;
    let disposed = false;
    let contextLost = false;
    let heroVisible = true;
    let pageVisible = !document.hidden;
    let activeUntil = performance.now() + 160;
    let wakeAnimation = () => {};
    const disposables: Disposable[] = [];
    let shaderPassesReady = false;
    let modelReady = false;
    let stickerLoadStarted = false;
    let stickerLoadTimer = 0;
    let startStickerLoad = () => {};
    let sceneReadyNotified = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointerNdc = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    const smoothPointer = new THREE.Vector2();
    const pointerUv = new THREE.Vector2(0.5, 0.5);
    const previousPointerUv = new THREE.Vector2(0.5, 0.5);
    const pointerEventDelta = new THREE.Vector2();
    const fluidPointerDelta = new THREE.Vector2();
    const backgroundSplatPoints = Array.from(
      { length: BACKGROUND_SPLAT_COUNT },
      () => new THREE.Vector2(-2, -2),
    );
    const backgroundSplatAges = Array.from({ length: BACKGROUND_SPLAT_COUNT }, () => 9);
    let backgroundSplatSlot = 0;
    let lastBackgroundSplat = -10;
    let pointerDirty = false;
    let forceSplash = false;
    let burstRequested = false;
    let pointerInsideHero = false;
    let pointerOverGlass = false;
    let hoverStrength = 0;
    let glassForce = 0;
    const glassVelocity = new THREE.Vector2(1, 0);
    let fluidEnergy = 0;
    let lastPointerMoveAt = -10_000;
    let scrollProgress = 0;
    let handoffActive = false;
    let baseScale = 0.75;
    let baseY = 0.42;
    let verticalScale = 0.78;
    const hero = root.closest<HTMLElement>("[data-v8-hero]");

    const resetPointer = () => {
      pointerInsideHero = false;
      pointerOverGlass = false;
      pointerDirty = false;
      forceSplash = false;
      burstRequested = false;
      fluidPointerDelta.set(0, 0);
      targetPointer.set(0, 0);
      root.dataset.pointerContact = "false";
      root.dataset.pointerInside = "false";
      if (root.dataset.renderer === "fallback") {
        root.style.setProperty("--pointer-x", "0");
        root.style.setProperty("--pointer-y", "0");
      }
      activeUntil = performance.now() + 3000;
      wakeAnimation();
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry?.isIntersecting ?? true;
      if (heroVisible) activeUntil = performance.now() + 160;
      else resetPointer();
      wakeAnimation();
    }, { rootMargin: "120px 0px" });
    visibilityObserver.observe(root);

    const handleVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) activeUntil = performance.now() + 160;
      wakeAnimation();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const updatePointer = (event: PointerEvent) => {
      if (!heroVisible) return;
      const rect = root.getBoundingClientRect();
      const insideHero =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!insideHero) {
        resetPointer();
        return;
      }

      pointerInsideHero = true;
      root.dataset.pointerInside = "true";

      const nextUv = new THREE.Vector2(
        THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
        THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1),
      );
      const now = performance.now() / 1000;
      pointerEventDelta.copy(nextUv).sub(pointerUv);
      const movement = nextUv.distanceTo(previousPointerUv);
      if (!reducedMotion.matches && pointerEventDelta.lengthSq() > 0.000001) {
        fluidPointerDelta.add(pointerEventDelta);
        lastPointerMoveAt = performance.now();
      }
      pointerUv.copy(nextUv);
      pointerNdc.set(nextUv.x * 2 - 1, nextUv.y * 2 - 1);
      targetPointer.copy(pointerNdc);
      pointerDirty = true;
      activeUntil = performance.now() + 3600;

      if (
        root.dataset.qaFreezeAmbient !== "true"
        && !reducedMotion.matches
        && movement > 0.008
        && now - lastBackgroundSplat > 0.07
      ) {
        backgroundSplatPoints[backgroundSplatSlot].copy(nextUv);
        backgroundSplatAges[backgroundSplatSlot] = 0;
        backgroundSplatSlot = (backgroundSplatSlot + 1) % BACKGROUND_SPLAT_COUNT;
        lastBackgroundSplat = now;
      }
      previousPointerUv.lerp(nextUv, 0.58);
      if (root.dataset.renderer === "fallback") {
        root.style.setProperty("--pointer-x", targetPointer.x.toFixed(3));
        root.style.setProperty("--pointer-y", targetPointer.y.toFixed(3));
      }
      wakeAnimation();
    };
    const pressPointer = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (
        event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom
      ) return;
      updatePointer(event);
      forceSplash = true;
      burstRequested = true;
      pointerDirty = true;
      activeUntil = performance.now() + 3000;
      wakeAnimation();
    };
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", pressPointer, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.documentElement.addEventListener("pointerleave", resetPointer, { passive: true });

    const notifySceneReady = (mode: "webgl" | "fallback") => {
      if (sceneReadyNotified || disposed) return;
      sceneReadyNotified = true;
      root.dataset.renderState = "ready";
      if (mode === "fallback") {
        root.classList.add("isReady");
      } else if (!root.classList.contains("isReady")) {
        requestAnimationFrame(() => {
          if (!disposed) root.classList.add("isReady");
        });
      }
      window.dispatchEvent(new CustomEvent(HERO_SCENE_READY_EVENT, {
        detail: { mode, modelSource: root.dataset.modelSource },
      }));
      if (mode === "webgl" && !stickerLoadTimer) {
        stickerLoadTimer = window.setTimeout(() => {
          stickerLoadTimer = 0;
          startStickerLoad();
        }, 450);
      }
    };

    const tryMarkSceneReady = () => {
      if (shaderPassesReady && modelReady) notifySceneReady("webgl");
    };

    const setFallback = () => {
      if (stickerLoadTimer) {
        window.clearTimeout(stickerLoadTimer);
        stickerLoadTimer = 0;
      }
      root.dataset.renderer = "fallback";
      root.dataset.sceneMode = "fallback";
      root.dataset.activeRipples = "0";
      root.dataset.pointerContact = "false";
      root.dataset.flareState = "static";
      root.dataset.fluidState = "static";
      root.dataset.shimmerState = "static";
      root.dataset.postfxProfile = "static";
      root.dataset.postfxPasses = "0";
      root.dataset.postfxStorage = "none";
      root.dataset.stickerCount = "0";
      root.dataset.stickerState = "static";
      notifySceneReady("fallback");
    };

    const startFallbackAnimation = () => {
      setFallback();
      wakeAnimation = () => {};
    };

    const markModelReady = (modelSource: HelloModelSource) => {
      if (disposed) return;
      root.dataset.modelSource = modelSource;
      root.dataset.modelState = "ready";
      modelReady = true;
      tryMarkSceneReady();
    };

    const markModelFailed = () => {
      if (disposed) return;
      root.dataset.modelSource = "failed";
      root.dataset.modelState = "failed";
    };

    if (reducedMotion.matches) {
      startFallbackAnimation();
      return () => {
        disposed = true;
        window.clearTimeout(stickerLoadTimer);
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
        window.removeEventListener("blur", resetPointer);
        document.documentElement.removeEventListener("pointerleave", resetPointer);
      };
    }

    let renderer: THREE.WebGLRenderer | undefined;
    let removeWebGLEvents = () => {};
    let removeScrollEvent = () => {};
    let removeThemeEvents = () => {};
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.autoClear = false;

      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 0.08, 7.7);
      const backgroundScene = new THREE.Scene();
      const glassScene = new THREE.Scene();
      const copyScene = new THREE.Scene();
      const copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const raycaster = new THREE.Raycaster();
      const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const pointerLightWorld = new THREE.Vector3(4, 9, 0.5);
      const pointerLightHit = new THREE.Vector3();
      const defaultLightAngle = Math.atan2(9, 4);
      const pointerLightRadius = Math.hypot(4, 9);
      let pointerLightAngle = defaultLightAngle;
      const clock = new THREE.Clock();
      const drawingBufferSize = new THREE.Vector2(1, 1);
      let previousElapsed = 0;
      let rippleSlot = 0;
      let lastWordSplash = -10;
      let isNarrow = false;
      let stickerField: StickerField | undefined;
      let motionFrame = 0;

      const rippleUv = Array.from({ length: RIPPLE_COUNT }, () => new THREE.Vector2(-2, -2));
      const rippleAges = Array.from({ length: RIPPLE_COUNT }, () => 9);

      const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
      sceneTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const compositeTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
      });
      compositeTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const fluidTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
      fluidTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const fluidPass = new HeroFluidPass();
      const flarePass = new HeroFlarePass();
      root.dataset.postfxStorage = "rgba8-packed";
      let fluidVisible = false;
      let fluidWasVisible = false;
      let flareVisible = true;
      disposables.push(sceneTarget, compositeTarget, fluidTarget, fluidPass, flarePass);

      const backgroundResolution = new THREE.Vector2(1, 1);
      const backgroundPointer = new THREE.Vector2(0.5, 0.5);
      const backgroundMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uFieldCenter: { value: backgroundPointer },
          uTime: { value: 0 },
          uPointer: { value: pointerUv },
          uResolution: { value: backgroundResolution },
          uSplatPoints: { value: backgroundSplatPoints },
          uSplatAges: { value: backgroundSplatAges },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.9999, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv;
          uniform vec2 uFieldCenter;
          uniform float uTime;
          uniform vec2 uPointer;
          uniform vec2 uResolution;
          uniform vec2 uSplatPoints[${BACKGROUND_SPLAT_COUNT}];
          uniform float uSplatAges[${BACKGROUND_SPLAT_COUNT}];

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 345.45));
            p += dot(p, p + 34.345);
            return fract(p.x * p.y);
          }

          float lineAt(float value, float position, float width) {
            return 1.0 - smoothstep(width, width * 2.0, abs(value - position));
          }

          float crossMark(vec2 uv, vec2 center, float px) {
            vec2 d = abs(uv - center);
            float vertical = (1.0 - smoothstep(px, px * 2.0, d.x)) * (1.0 - smoothstep(0.012, 0.015, d.y));
            float horizontal = (1.0 - smoothstep(px, px * 2.0, d.y)) * (1.0 - smoothstep(0.012, 0.015, d.x));
            return max(vertical, horizontal);
          }

          void main() {
            vec2 uv = vUv;
            vec2 centered = uv - 0.5;
            float aspect = uResolution.x / max(uResolution.y, 1.0);
            centered.x *= aspect;
            vec2 fieldCenter = uFieldCenter - 0.5;
            fieldCenter.x *= aspect;
            vec2 fieldDelta = centered - fieldCenter;
            float fieldDistance = length(fieldDelta);
            float fieldMask = 1.0 - smoothstep(0.02, 0.176, fieldDistance);
            float fieldAngle = fieldMask * 0.10 + sin(uTime * 0.05) * 0.018;
            mat2 fieldRotation = mat2(
              cos(fieldAngle), -sin(fieldAngle),
              sin(fieldAngle), cos(fieldAngle)
            );
            vec2 warped = mix(centered, fieldRotation * fieldDelta + fieldCenter, fieldMask * 0.34);
            warped.x += sin((warped.y + uFieldCenter.y) * 7.0 + uTime * 0.25) * 0.025;

            vec3 sky = vec3(0.52, 0.72, 0.82);
            vec3 paleSky = vec3(0.62, 0.78, 0.87);
            vec3 cream = vec3(1.0, 0.95, 0.86);
            float centerGlow = exp(-dot(warped, warped) * 1.9);
            vec3 color = mix(sky, paleSky, centerGlow * 0.78);

            float mobileLayout = 1.0 - smoothstep(0.72, 1.0, aspect);
            float pointerShift = fieldCenter.x * 0.12 - fieldCenter.y * 0.10;
            float diagonal = warped.y + warped.x * (0.7 + fieldCenter.x * 0.05)
              + mobileLayout * 0.45 + pointerShift;
            float targetA = mix(-0.22, 0.18, mobileLayout);
            float targetB = mix(0.35, -0.55, mobileLayout);
            float targetC = mix(0.86, 1.4, mobileLayout);
            float ribbonA = exp(-pow(abs(diagonal - targetA), 2.0) * 72.0);
            float ribbonB = exp(-pow(abs(diagonal - targetB), 2.0) * 88.0);
            float ribbonC = exp(-pow(abs(diagonal - targetC), 2.0) * 82.0);
            float caustic = smoothstep(0.12, 0.58, ribbonA + ribbonB * 0.82 + ribbonC * 0.76);
            color = mix(color, cream, caustic * 0.96);

            float fluid = 0.0;
            for (int i = 0; i < ${BACKGROUND_SPLAT_COUNT}; i++) {
              vec2 delta = uv - uSplatPoints[i];
              delta.x *= aspect;
              float d = length(delta);
              float age = uSplatAges[i];
              float ring = sin(d * 44.0 - age * 5.8);
              fluid += ring * exp(-d * 15.625) * exp(-age * 1.45);
            }
            vec2 pointerDelta = uv - uPointer;
            pointerDelta.x *= aspect;
            float cursorHalo = exp(-dot(pointerDelta, pointerDelta) * 224.609375);
            color += vec3(0.16, 0.24, 0.28) * fluid * 0.01;
            color += vec3(1.0, 0.97, 0.9) * cursorHalo * 0.014;

            float px = max(1.0 / uResolution.x, 1.0 / uResolution.y);
            float grid = 0.0;
            grid = max(grid, lineAt(uv.x, 0.04, px));
            grid = max(grid, lineAt(uv.x, 0.3333, px));
            grid = max(grid, lineAt(uv.x, 0.6666, px));
            grid = max(grid, lineAt(uv.x, 0.96, px));
            grid = max(grid, lineAt(uv.y, 0.3333, px));
            grid = max(grid, lineAt(uv.y, 0.676, px));
            float crosses = crossMark(uv, vec2(0.3333, 0.3333), px)
              + crossMark(uv, vec2(0.6666, 0.3333), px)
              + crossMark(uv, vec2(0.3333, 0.676), px)
              + crossMark(uv, vec2(0.6666, 0.676), px);
            color = mix(color, vec3(0.08, 0.18, 0.23), grid * 0.1);
            color = mix(color, vec3(0.06, 0.15, 0.2), min(crosses, 1.0) * 0.17);

            float vignette = smoothstep(1.18, 0.18, length(centered));
            color *= 0.94 + vignette * 0.06;
            color += (hash21(gl_FragCoord.xy + uTime * 13.0) - 0.5) * 0.0015;
            gl_FragColor = vec4(max(color, 0.0), 1.0);
          }
        `,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const screenGeometry = new THREE.PlaneGeometry(2, 2);
      const background = new THREE.Mesh(screenGeometry, backgroundMaterial);
      background.frustumCulled = false;
      background.renderOrder = -1000;
      backgroundScene.add(background);
      disposables.push(backgroundMaterial, screenGeometry);

      const glassResolution = new THREE.Vector2(1, 1);
      const glassMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: sceneTarget.texture },
          uMotionField: { value: fluidPass.getMotionTexture() },
          uResolution: { value: glassResolution },
          uMotionTexelStep: { value: new THREE.Vector2(1, 1) },
          uLight: { value: pointerLightWorld },
          uHoverUv: { value: pointerUv },
          uHoverStrength: { value: 0 },
          uCursorVelocity: { value: glassVelocity },
          uCursorForce: { value: 0 },
          uOpticalCoupling: { value: 0 },
          uRippleUv: { value: rippleUv },
          uRippleAges: { value: rippleAges },
          uLocalYRange: { value: new THREE.Vector2(0, 1) },
          uSampleCount: { value: 3 },
          uTime: { value: 0 },
          uTintAccent: { value: new THREE.Color() },
          uTintBase: { value: new THREE.Color() },
          uBrightness: { value: GLASS_THEME_SETTINGS.light.brightness },
          uChromaticAberration: { value: 0.09 },
          uContrast: { value: GLASS_THEME_SETTINGS.light.contrast },
          uDiffuseness: { value: GLASS_THEME_SETTINGS.light.diffuseness },
          uFresnelPower: { value: GLASS_THEME_SETTINGS.light.fresnelPower },
          uFresnelSideDir: { value: new THREE.Vector3(-1, 1, -1) },
          uFresnelStrength: { value: GLASS_THEME_SETTINGS.light.fresnelStrength },
          uGamma: { value: 1 },
          uRefractPower: { value: 0.54 },
          uSaturation: { value: 1.2 },
          uShininess: { value: GLASS_THEME_SETTINGS.light.shininess },
          uSpecularStrength: { value: 0.94 },
          uTintMix: { value: 1 },
          uTintThicknessMaxAlpha: { value: GLASS_THEME_SETTINGS.light.tintThicknessMaxAlpha },
          uTintThicknessMinAlpha: { value: GLASS_THEME_SETTINGS.light.tintThicknessMinAlpha },
        },
        vertexShader: GLASS_VERTEX_SHADER,
        fragmentShader: GLASS_FRAGMENT_SHADER,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,
        transparent: false,
        toneMapped: false,
      });
      disposables.push(glassMaterial);

      const themePreference = window.matchMedia("(prefers-color-scheme: dark)");
      const syncThemeColors = () => {
        const styles = window.getComputedStyle(root);
        const base = styles.getPropertyValue("--hero-glass-tint-base").trim();
        const accent = styles.getPropertyValue("--hero-glass-tint-accent").trim();
        if (base && CSS.supports("color", base)) {
          glassMaterial.uniforms.uTintBase.value.setStyle(base);
          root.dataset.glassTintBase = `#${glassMaterial.uniforms.uTintBase.value.getHexString()}`;
        }
        if (accent && CSS.supports("color", accent)) {
          glassMaterial.uniforms.uTintAccent.value.setStyle(accent);
          root.dataset.glassTintAccent = `#${glassMaterial.uniforms.uTintAccent.value.getHexString()}`;
        }
        const explicitTheme = document.documentElement.dataset.theme;
        const classTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : document.documentElement.classList.contains("light")
            ? "light"
            : undefined;
        const resolvedTheme = explicitTheme === "dark" || explicitTheme === "light"
          ? explicitTheme
          : classTheme ?? (themePreference.matches ? "dark" : "light");
        const settings = GLASS_THEME_SETTINGS[resolvedTheme];
        glassMaterial.uniforms.uBrightness.value = settings.brightness;
        glassMaterial.uniforms.uContrast.value = settings.contrast;
        glassMaterial.uniforms.uDiffuseness.value = settings.diffuseness;
        glassMaterial.uniforms.uFresnelPower.value = settings.fresnelPower;
        glassMaterial.uniforms.uFresnelStrength.value = settings.fresnelStrength;
        glassMaterial.uniforms.uShininess.value = settings.shininess;
        glassMaterial.uniforms.uTintThicknessMaxAlpha.value = settings.tintThicknessMaxAlpha;
        glassMaterial.uniforms.uTintThicknessMinAlpha.value = settings.tintThicknessMinAlpha;
        root.dataset.glassTheme = resolvedTheme;
        activeUntil = performance.now() + 900;
        wakeAnimation();
      };
      const themeObserver = new MutationObserver(syncThemeColors);
      themeObserver.observe(document.documentElement, {
        attributeFilter: ["class", "data-theme", "style"],
        attributes: true,
      });
      themePreference.addEventListener("change", syncThemeColors);
      removeThemeEvents = () => {
        themeObserver.disconnect();
        themePreference.removeEventListener("change", syncThemeColors);
      };
      syncThemeColors();

      const helloVariant = new URLSearchParams(window.location.search).get("hello");
      const useCleanroomPreview = helloVariant === "cleanroom-v2";
      root.dataset.helloVariant = useCleanroomPreview ? "cleanroom-v2" : "current";

      let activeGeometry = useCleanroomPreview
        ? createCleanroomHelloGeometry()
        : createSculptedGeometry();
      if (useCleanroomPreview) root.dataset.modelSource = "cleanroom-v2";
      const updateLocalYRange = (geometry: THREE.BufferGeometry) => {
        geometry.computeBoundingBox();
        if (!geometry.boundingBox) return;
        glassMaterial.uniforms.uLocalYRange.value.set(
          geometry.boundingBox.min.y,
          geometry.boundingBox.max.y,
        );
      };
      updateLocalYRange(activeGeometry);
      const sculpture = new THREE.Mesh(activeGeometry, glassMaterial);
      sculpture.renderOrder = 2;
      const heroGroup = new THREE.Group();
      heroGroup.rotation.set(-0.035, 0.035, -0.018);
      heroGroup.add(sculpture);
      glassScene.add(heroGroup);
      disposables.push({ dispose: () => activeGeometry.dispose() });

      const copyMaterial = new THREE.ShaderMaterial({
        uniforms: { uScene: { value: sceneTarget.texture } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uScene;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(uScene, vUv);
          }
        `,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const copyGeometry = new THREE.PlaneGeometry(2, 2);
      const copyMesh = new THREE.Mesh(copyGeometry, copyMaterial);
      copyMesh.frustumCulled = false;
      copyScene.add(copyMesh);
      disposables.push(copyMaterial, copyGeometry);

      const resize = () => {
        if (!renderer) return;
        const rect = root.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        const narrow = width < 760;
        isNarrow = narrow;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1.25 : 1.5));
        renderer.setSize(width, height, false);
        renderer.getDrawingBufferSize(drawingBufferSize);
        const targetScale = narrow ? 0.76 : 1;
        const unboundedWidth = Math.max(1, Math.round(drawingBufferSize.x * targetScale));
        const unboundedHeight = Math.max(1, Math.round(drawingBufferSize.y * targetScale));
        const pixelBudget = narrow ? 1_100_000 : 3_400_000;
        const budgetScale = Math.min(
          1,
          Math.sqrt(pixelBudget / Math.max(unboundedWidth * unboundedHeight, 1)),
        );
        const targetWidth = Math.max(1, Math.round(unboundedWidth * budgetScale));
        const targetHeight = Math.max(1, Math.round(unboundedHeight * budgetScale));
        sceneTarget.setSize(targetWidth, targetHeight);
        compositeTarget.samples = 0;
        compositeTarget.setSize(targetWidth, targetHeight);
        fluidTarget.setSize(targetWidth, targetHeight);
        glassResolution.set(targetWidth, targetHeight);
        backgroundResolution.set(targetWidth, targetHeight);
        fluidPass.resize(targetWidth, targetHeight);
        const motionFieldSize = fluidPass.getFieldSize();
        glassMaterial.uniforms.uMotionTexelStep.value.set(
          1 / Math.max(motionFieldSize.x, 1),
          1 / Math.max(motionFieldSize.y, 1),
        );
        flarePass.resize(targetWidth, targetHeight);
        fluidPass.reset(renderer);
        root.dataset.postfxProfile = narrow || !finePointer.matches
          ? "static-optical"
          : "multiscale-temporal-optical";
        glassMaterial.uniforms.uSampleCount.value = narrow ? 2 : 3;
        camera.aspect = width / height;
        camera.position.z = narrow ? 9.4 : 7.9;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        const viewHalfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
        const desiredHelloWidth = width * 0.78;
        const desiredHelloWorldWidth = desiredHelloWidth * (viewHalfHeight * 2) / height;
        baseScale = narrow
          ? 0.39
          : THREE.MathUtils.clamp(desiredHelloWorldWidth / 6.35, 0.82, 1.12);
        verticalScale = 1;
        const shortViewportLift = narrow
          ? 0
          : THREE.MathUtils.clamp((1000 - height) / 180, 0, 1) * 0.2;
        baseY = narrow ? 0.05 : 0.12 + shortViewportLift;
        heroGroup.scale.set(baseScale, baseScale * verticalScale, baseScale);
        heroGroup.position.set(narrow ? 0 : 0.05, baseY, 0);
        stickerField?.resize(camera);
        activeUntil = performance.now() + 180;
        wakeAnimation();
      };
      resize();

      root.dataset.shimmerState = "animated";
      root.dataset.stickerCount = String(STICKER_COUNT);
      root.dataset.stickersLoaded = "0";
      root.dataset.stickerState = "deferred";
      startStickerLoad = () => {
        if (disposed || contextLost || stickerLoadStarted) return;
        stickerLoadStarted = true;
        root.dataset.stickerState = "loading";
        let completedStickerRequests = 0;
        const loadedStickers = new Map<number, HTMLImageElement>();
        const appliedStickers = new Set<number>();

        const updateStickerState = () => {
          root.dataset.stickersLoaded = String(loadedStickers.size);
          if (!stickerField) return;
          root.dataset.stickerState = completedStickerRequests === STICKER_COUNT
            ? "falling"
            : "streaming";
        };

        const startStickerField = (force = false) => {
          if (
            stickerField
            || disposed
            || contextLost
            || (!force && loadedStickers.size < INITIAL_STICKER_BATCH)
          ) return;

          if (loadedStickers.size === 0) {
            root.dataset.stickerCount = "0";
            root.dataset.stickerState = "failed";
            return;
          }

          const field = createStickerField(camera);
          stickerField = field;
          backgroundScene.add(field.mesh);
          field.resize(camera);
          disposables.push(field);
          loadedStickers.forEach((image, textureIndex) => {
            field.addSticker(textureIndex, image);
            appliedStickers.add(textureIndex);
          });
          updateStickerState();
          wakeAnimation();
        };

        const settleStickerRequest = () => {
          completedStickerRequests += 1;
          startStickerField(completedStickerRequests === STICKER_COUNT);
          updateStickerState();
        };

        STICKER_PATHS.forEach((path, textureIndex) => {
          void loadStickerImage(path)
            .then((image) => {
              if (disposed || contextLost) return;
              loadedStickers.set(textureIndex, image);
              startStickerField();
              if (stickerField && !appliedStickers.has(textureIndex)) {
                stickerField.addSticker(textureIndex, image);
                appliedStickers.add(textureIndex);
                wakeAnimation();
              }
              settleStickerRequest();
            })
            .catch(() => {
              if (disposed || contextLost) return;
              settleStickerRequest();
            });
        });
      };

      if (!useCleanroomPreview) {
        const modelLoader = new GLTFLoader();
        // Third-party asset credit: the local hello.gltf model is attributed to
        // Haoqi Wen (https://haoqi.design/). Attribution does not imply
        // affiliation, endorsement, or a licence to redistribute the asset.
        modelLoader.load(
          "/model/hello.gltf",
          (gltf) => {
            if (disposed) return;
            try {
              const downloadedGeometry = createDownloadedHelloGeometry(gltf.scene);
              const previousGeometry = activeGeometry;
              activeGeometry = downloadedGeometry;
              sculpture.geometry = downloadedGeometry;
              previousGeometry.dispose();
              updateLocalYRange(downloadedGeometry);
              markModelReady("downloaded-gltf");
              resize();
              activeUntil = performance.now() + 900;
              wakeAnimation();
            } catch {
              markModelFailed();
            }
          },
          undefined,
          () => {
            markModelFailed();
          },
        );
      }

      const renderGlassPasses = () => {
        if (!renderer) return;
        const bubbleOnly = root.dataset.qaBubbleOnly === "true";
        const opticalFieldVisible = fluidVisible && !bubbleOnly;
        glassMaterial.uniforms.uMotionField.value = fluidPass.getMotionTexture();
        glassMaterial.uniforms.uOpticalCoupling.value = opticalFieldVisible ? 1 : 0;
        renderer.setRenderTarget(sceneTarget);
        renderer.setClearColor(0x000000, 1);
        renderer.clear(true, true, true);
        renderer.render(backgroundScene, camera);

        renderer.setRenderTarget(compositeTarget);
        renderer.setClearColor(0xb9d9ec, 1);
        renderer.clear(true, true, true);
        renderer.render(copyScene, copyCamera);
        renderer.clearDepth();
        renderer.render(glassScene, camera);

        let finalTexture = compositeTarget.texture;
        if (opticalFieldVisible) {
          fluidPass.render(
            renderer,
            compositeTarget.texture,
            sceneTarget.texture,
            fluidTarget,
            true,
          );
          finalTexture = fluidTarget.texture;
        }
        flarePass.setOpticalField(
          fluidPass.getMotionTexture(),
          fluidPass.getFeatureTexture(),
          fluidPass.getFieldSize(),
          opticalFieldVisible,
        );
        flarePass.setTailColor(glassMaterial.uniforms.uTintAccent.value);
        flarePass.render(renderer, finalTexture, flareVisible, fluidVisible);
      };

      const gl = renderer.getContext();
      const assertFramebuffer = (target: THREE.WebGLRenderTarget) => {
        renderer?.setRenderTarget(target);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("WebGL framebuffer is incomplete");
        }
      };
      const previousShaderErrorHandler = renderer.debug.onShaderError;
      renderer.debug.onShaderError = () => {
        throw new Error("WebGL shader compile failed");
      };
      try {
        assertFramebuffer(sceneTarget);
        fluidPass.validateTargets(renderer);
        fluidPass.update(renderer, 0, pointerUv, fluidPointerDelta, false);
        fluidPass.render(
          renderer,
          compositeTarget.texture,
          sceneTarget.texture,
          fluidTarget,
          false,
        );
        fluidPass.reset(renderer);
        renderGlassPasses();
      } finally {
        renderer.debug.onShaderError = previousShaderErrorHandler;
        renderer.setRenderTarget(null);
      }
      shaderPassesReady = true;
      if (useCleanroomPreview) markModelReady("cleanroom-v2");
      tryMarkSceneReady();

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
        frame = 0;
        startFallbackAnimation();
      };
      canvas.addEventListener("webglcontextlost", handleContextLost, false);
      window.addEventListener("resize", resize, { passive: true });
      let scrollFrame = 0;
      const updateScroll = () => {
        scrollFrame = 0;
        if (!hero || reducedMotion.matches) return;
        const rect = hero.getBoundingClientRect();
        scrollProgress = THREE.MathUtils.clamp(-rect.top / Math.max(rect.height * 0.82, 1), 0, 1);
        hero.style.setProperty("--hero-progress", scrollProgress.toFixed(4));
        const nextHandoffActive = scrollProgress > 0.08;
        if (nextHandoffActive && !handoffActive && renderer && !contextLost) {
          fluidVisible = false;
          fluidWasVisible = false;
          fluidEnergy = 0;
          glassForce = 0;
          glassMaterial.uniforms.uCursorForce.value = 0;
          fluidPass.reset(renderer);
          renderGlassPasses();
          root.dataset.fluidState = "idle";
          root.dataset.postfxPasses = "0";
        }
        handoffActive = nextHandoffActive;
        root.dataset.handoffRender = handoffActive ? "frozen" : "live";
        if (!handoffActive) {
          activeUntil = performance.now() + 260;
          wakeAnimation();
        }
      };
      const scheduleScrollUpdate = () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
      };
      window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
      updateScroll();
      removeScrollEvent = () => {
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        window.removeEventListener("scroll", scheduleScrollUpdate);
      };
      removeWebGLEvents = () => {
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("webglcontextlost", handleContextLost);
      };

      root.dataset.renderer = "webgl";
      root.dataset.sceneMode = "webgl";
      root.dataset.fluidState = "idle";
      root.dataset.flareState = "active";

      const animate = () => {
        frame = 0;
        if (disposed || contextLost || !renderer) return;
        if (heroVisible && !handoffActive) {
          const elapsed = reducedMotion.matches ? 0 : clock.getElapsedTime();
          const rawDelta = reducedMotion.matches ? 0 : Math.max(0, elapsed - previousElapsed);
          const delta = Math.min(0.05, rawDelta);
          const energyDelta = Math.min(0.25, rawDelta);
          const freezeAmbient = root.dataset.qaFreezeAmbient === "true";
          const postFxOnly = root.dataset.qaPostFxOnly === "true";
          const hideStickers = root.dataset.qaHideStickers === "true";
          const visualElapsed = freezeAmbient ? 0 : elapsed;
          previousElapsed = elapsed;
          rippleAges.forEach((age, index) => { rippleAges[index] = Math.min(9, age + delta); });
          backgroundSplatAges.forEach((age, index) => { backgroundSplatAges[index] = Math.min(9, age + delta); });
          backgroundMaterial.uniforms.uTime.value = visualElapsed;
          glassMaterial.uniforms.uTime.value = visualElapsed;
          const pointerDamping = reducedMotion.matches ? 1 : 1 - Math.exp(-6 * delta);
          smoothPointer.lerp(reducedMotion.matches ? new THREE.Vector2() : targetPointer, pointerDamping);
          backgroundPointer.set(
            postFxOnly ? 0.5 : smoothPointer.x * 0.5 + 0.5,
            postFxOnly ? 0.5 : smoothPointer.y * 0.5 + 0.5,
          );
          const hoverTarget = !postFxOnly && pointerOverGlass ? 1 : 0;
          hoverStrength = THREE.MathUtils.lerp(hoverStrength, hoverTarget, hoverTarget > 0 ? 0.22 : 0.09);
          glassMaterial.uniforms.uHoverStrength.value = hoverStrength;

          const pointerParallax = isNarrow || postFxOnly ? 0 : 1;
          camera.position.x = smoothPointer.x * 0.1 * pointerParallax;
          camera.position.y = 0.08 + smoothPointer.y * 0.06 * pointerParallax;
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld(true);

          const scrollScale = baseScale * (1 - scrollProgress * 0.08);
          const floatingY = isNarrow
            ? 0
            : Math.sin(visualElapsed * 1.2) * 0.055 + Math.sin(visualElapsed * 0.6) * 0.018;
          heroGroup.scale.set(scrollScale, scrollScale * verticalScale, scrollScale);
          heroGroup.rotation.x = -0.025 - smoothPointer.y * 0.032 * pointerParallax + scrollProgress * 0.1;
          heroGroup.rotation.y = 0.025 + smoothPointer.x * 0.045 * pointerParallax + scrollProgress * 0.17;
          heroGroup.rotation.z = -0.012 + smoothPointer.x * 0.008 * pointerParallax;
          heroGroup.position.y = baseY + floatingY + scrollProgress * 0.46;
          let desiredLightAngle = defaultLightAngle;
          if (!isNarrow && !postFxOnly && pointerInsideHero) {
            raycaster.setFromCamera(smoothPointer, camera);
            if (
              raycaster.ray.intersectPlane(pointerPlane, pointerLightHit)
              && pointerLightHit.lengthSq() > 0.0001
            ) {
              desiredLightAngle = Math.atan2(-pointerLightHit.y, -pointerLightHit.x);
            }
          }
          const lightAngleDelta = Math.atan2(
            Math.sin(desiredLightAngle - pointerLightAngle),
            Math.cos(desiredLightAngle - pointerLightAngle),
          );
          const lightDamping = 1 - Math.exp(-6 * delta);
          pointerLightAngle += lightAngleDelta * lightDamping;
          pointerLightWorld.set(
            Math.cos(pointerLightAngle) * pointerLightRadius,
            Math.sin(pointerLightAngle) * pointerLightRadius,
            0.5,
          );

          if (!postFxOnly && burstRequested && stickerField) {
            if (!isNarrow) {
              stickerField.burst(elapsed);
            }
            burstRequested = false;
          }

          if (pointerDirty && pointerInsideHero && !reducedMotion.matches && !postFxOnly) {
            const splashInterval = forceSplash ? 0.02 : 0.08;
            if (elapsed - lastWordSplash > splashInterval) {
              glassScene.updateMatrixWorld(true);
              raycaster.setFromCamera(pointerNdc, camera);
              const hit = raycaster.intersectObject(sculpture, false)[0];
              if (hit) {
                pointerOverGlass = true;
                rippleUv[rippleSlot].copy(pointerUv);
                rippleAges[rippleSlot] = 0;
                rippleSlot = (rippleSlot + 1) % RIPPLE_COUNT;
                lastWordSplash = elapsed;
                root.dataset.pointerContact = "true";
              } else {
                pointerOverGlass = false;
                root.dataset.pointerContact = "false";
              }
            }
            pointerDirty = false;
            forceSplash = false;
          } else if (postFxOnly && pointerDirty) {
            pointerDirty = false;
            forceSplash = false;
            pointerOverGlass = false;
            root.dataset.pointerContact = "false";
          }

          root.dataset.activeRipples = String(rippleAges.filter((age) => age < 1.05).length);
          const visibleStickerCount = stickerField?.update(
            visualElapsed,
            freezeAmbient ? 0 : delta,
          ) ?? 0;
          if (stickerField) stickerField.mesh.visible = !hideStickers;
          const instantForce = THREE.MathUtils.clamp(fluidPointerDelta.length() * 62, 0, 1);
          const pointerIdleMs = performance.now() - lastPointerMoveAt;
          const energyDecay = Math.exp(-1.28 * energyDelta);
          fluidEnergy = Math.max(fluidEnergy * energyDecay, instantForce);
          if (lastPointerMoveAt > 0 && instantForce < 0.001) {
            fluidEnergy = Math.min(
              fluidEnergy,
              Math.exp(-1.28 * Math.max(pointerIdleMs, 0) / 1000),
            );
          }
          if (root.dataset.qaHoldFluid === "true") fluidEnergy = Math.max(fluidEnergy, 0.88);
          const pointerEffectsEnabled = !isNarrow && finePointer.matches && !reducedMotion.matches;
          fluidVisible = pointerEffectsEnabled && (
            root.dataset.qaHoldFluid === "true"
            || pointerIdleMs <= 2600
            || fluidEnergy > 0.028
          );
          flareVisible = true;
          const liveForceTarget = fluidVisible ? Math.max(instantForce, fluidEnergy * 0.58) : 0;
          const forceTarget = root.dataset.qaHoldBubble === "true"
            ? Math.max(liveForceTarget, glassForce)
            : liveForceTarget;
          const forceResponse = 1 - Math.exp(-(forceTarget > glassForce ? 24 : 3.6) * delta);
          glassForce = THREE.MathUtils.lerp(glassForce, forceTarget, forceResponse);
          if (fluidPointerDelta.lengthSq() > 0.000001) {
            glassVelocity.lerp(fluidPointerDelta, 0.48);
          }
          glassMaterial.uniforms.uCursorForce.value = glassForce;
          root.dataset.cursorForce = glassForce.toFixed(3);
          root.dataset.fieldEnergy = fluidEnergy.toFixed(3);
          if (fluidVisible) {
            fluidPass.update(
              renderer,
              delta,
              pointerUv,
              fluidPointerDelta,
              fluidPointerDelta.lengthSq() > 0.000001,
            );
          } else if (fluidWasVisible) {
            fluidPass.reset(renderer);
          }
          fluidWasVisible = fluidVisible;
          fluidPointerDelta.set(0, 0);
          root.dataset.fluidState = fluidVisible ? "active" : "idle";
          root.dataset.flareState = "active";
          root.dataset.postfxPasses = fluidVisible && root.dataset.qaBubbleOnly !== "true"
            ? "6"
            : "2";
          motionFrame += 1;
          if (motionFrame % 5 === 0) {
            root.dataset.cameraParallaxX = camera.position.x.toFixed(4);
            root.dataset.cameraParallaxY = (camera.position.y - 0.08).toFixed(4);
            root.dataset.lightAngle = pointerLightAngle.toFixed(4);
            root.dataset.lightX = pointerLightWorld.x.toFixed(4);
            root.dataset.lightY = pointerLightWorld.y.toFixed(4);
            root.dataset.cursorFieldX = backgroundPointer.x.toFixed(4);
            root.dataset.cursorFieldY = backgroundPointer.y.toFixed(4);
          }
          if (motionFrame % 20 === 0) {
            root.dataset.motionTick = String(motionFrame);
            root.dataset.visibleStickers = String(visibleStickerCount);
          }

          renderGlassPasses();
        }

        const ambientMotionActive = root.dataset.shimmerState === "animated" || root.dataset.stickerState === "falling";
        if (
          !handoffActive && !reducedMotion.matches && pageVisible && heroVisible &&
          (ambientMotionActive || performance.now() < activeUntil)
        ) {
          frame = requestAnimationFrame(animate);
        }
      };
      wakeAnimation = () => {
        const ambientMotionActive = root.dataset.shimmerState === "animated" || root.dataset.stickerState === "falling";
        if (
          !handoffActive && !frame && !disposed && !contextLost && pageVisible && heroVisible &&
          (ambientMotionActive || performance.now() < activeUntil)
        ) {
          frame = requestAnimationFrame(animate);
        }
      };
      if (reducedMotion.matches) animate();
      else wakeAnimation();

      return () => {
        disposed = true;
        window.clearTimeout(stickerLoadTimer);
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        removeWebGLEvents();
        removeScrollEvent();
        removeThemeEvents();
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
        window.removeEventListener("blur", resetPointer);
        document.documentElement.removeEventListener("pointerleave", resetPointer);
        disposables.forEach((item) => item.dispose());
        renderer?.dispose();
      };
    } catch {
      startFallbackAnimation();
      return () => {
        disposed = true;
        window.clearTimeout(stickerLoadTimer);
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        removeWebGLEvents();
        removeScrollEvent();
        removeThemeEvents();
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
        window.removeEventListener("blur", resetPointer);
        document.documentElement.removeEventListener("pointerleave", resetPointer);
        disposables.forEach((item) => item.dispose());
        renderer?.dispose();
      };
    }
  }, []);

  return (
    <div
      aria-hidden="true"
      className="glassScene"
      data-active-ripples="0"
      data-camera-parallax-x="0"
      data-camera-parallax-y="0"
      data-cursor-field-x="0.5"
      data-cursor-field-y="0.5"
      data-flare-state="loading"
      data-fluid-state="loading"
      data-glass-stage
      data-glass-theme="loading"
      data-glass-tint-accent="loading"
      data-glass-tint-base="loading"
      data-glass-word="hello"
      data-hello-variant="loading"
      data-light-angle="0"
      data-light-x="4"
      data-light-y="9"
      data-model-source="loading"
      data-model-state="loading"
      data-motion-tick="0"
      data-pointer-contact="false"
      data-pointer-inside="false"
      data-postfx-passes="0"
      data-postfx-profile="loading"
      data-postfx-storage="pending"
      data-deformation-profile="gel-bubble"
      data-cursor-force="0.000"
      data-field-energy="0.000"
      data-render-state="loading"
      data-render-layers="background+stickers|multiscale-motion|glass+ripples+flow|surface|refraction+dispersion|temporal-afterglow|caustics|composite"
      data-scene-mode="loading"
      data-shimmer-state="loading"
      data-sticker-count="0"
      data-sticker-state="loading"
      data-stickers-loaded="0"
      data-visible-stickers="0"
      ref={rootRef}
    >
      <canvas ref={canvasRef} />
      <div className="glassFallback" data-glass-fallback>
          <svg viewBox="0 -980 2180 1080" role="presentation">
            <defs>
              <linearGradient id="fallback-glass-face" x1="0" y1="0" x2="0.75" y2="1">
                <stop offset="0" stopColor="var(--hero-glass-tint-base)" stopOpacity="0.78" />
                <stop offset="0.24" stopColor="var(--hero-glass-tint-soft)" stopOpacity="0.48" />
                <stop offset="0.64" stopColor="var(--hero-glass-tint-accent)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--hero-glass-tint-soft)" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="fallback-glass-sheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.48" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="0.58" stopColor="#c5eaff" stopOpacity="0.42" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="fallback-glass-clip">
                <path d={SCULPTED_WORD_PATH} />
              </clipPath>
            </defs>
            <path className="glassFallbackDepth" d={SCULPTED_WORD_PATH} />
            <path className="glassFallbackFace" d={SCULPTED_WORD_PATH} />
            <g className="glassFallbackSheen" clipPath="url(#fallback-glass-clip)">
              <rect x="300" y="-1200" width="220" height="1600" fill="url(#fallback-glass-sheen)" transform="rotate(-14 410 -400)" />
              <rect x="1290" y="-1200" width="310" height="1600" fill="url(#fallback-glass-sheen)" transform="rotate(-14 1445 -400)" />
            </g>
          </svg>
      </div>
    </div>
  );
}
