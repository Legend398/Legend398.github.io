"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { SCULPTED_WORD_PATH } from "@/components/SculptedWordPath";

const RIPPLE_COUNT = 4;
const BACKGROUND_SPLAT_COUNT = 4;

type Disposable = { dispose: () => void };

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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerNdc = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    const smoothPointer = new THREE.Vector2();
    const pointerUv = new THREE.Vector2(0.5, 0.5);
    const previousPointerUv = new THREE.Vector2(0.5, 0.5);
    const backgroundSplatPoints = Array.from(
      { length: BACKGROUND_SPLAT_COUNT },
      () => new THREE.Vector2(-2, -2),
    );
    const backgroundSplatAges = Array.from({ length: BACKGROUND_SPLAT_COUNT }, () => 9);
    let backgroundSplatSlot = 0;
    let lastBackgroundSplat = -10;
    let pointerDirty = false;
    let forceSplash = false;
    let pointerOverGlass = false;
    let hoverStrength = 0;
    let scrollProgress = 0;
    let baseScale = 0.75;
    let baseY = 0.42;
    let verticalScale = 0.78;
    const hero = root.closest<HTMLElement>("[data-v8-hero]");

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry?.isIntersecting ?? true;
      if (heroVisible) activeUntil = performance.now() + 160;
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
        root.dataset.pointerContact = "false";
        pointerOverGlass = false;
        pointerDirty = true;
        activeUntil = performance.now() + 320;
        wakeAnimation();
        return;
      }

      const nextUv = new THREE.Vector2(
        THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
        THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1),
      );
      const now = performance.now() / 1000;
      const movement = nextUv.distanceTo(previousPointerUv);
      pointerUv.copy(nextUv);
      pointerNdc.set(nextUv.x * 2 - 1, nextUv.y * 2 - 1);
      targetPointer.copy(pointerNdc);
      pointerDirty = true;
      activeUntil = performance.now() + 1400;

      if (!reducedMotion.matches && movement > 0.008 && now - lastBackgroundSplat > 0.07) {
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
      forceSplash = true;
      pointerDirty = true;
      activeUntil = performance.now() + 1100;
      wakeAnimation();
    };
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", pressPointer, { passive: true });

    const setFallback = () => {
      root.dataset.renderer = "fallback";
      root.dataset.sceneMode = "fallback";
      root.dataset.renderState = "ready";
      root.dataset.activeRipples = "0";
      root.dataset.pointerContact = "false";
      root.classList.add("isReady");
    };

    const startFallbackAnimation = () => {
      setFallback();
      wakeAnimation = () => {};
    };

    if (reducedMotion.matches) {
      startFallbackAnimation();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
      };
    }

    let renderer: THREE.WebGLRenderer | undefined;
    let removeWebGLEvents = () => {};
    let removeScrollEvent = () => {};
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
      const pointerLightWorld = new THREE.Vector3(0, 0, 3.6);
      const pointerLightView = new THREE.Vector3(0, 0, -4);
      const clock = new THREE.Clock();
      const drawingBufferSize = new THREE.Vector2(1, 1);
      let previousElapsed = 0;
      let rippleSlot = 0;
      let lastWordSplash = -10;

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
      const backfaceTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
      });
      backfaceTarget.texture.colorSpace = THREE.NoColorSpace;
      disposables.push(sceneTarget, backfaceTarget);

      const backgroundResolution = new THREE.Vector2(1, 1);
      const backgroundMaterial = new THREE.ShaderMaterial({
        uniforms: {
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
            vec3 sky = vec3(0.13, 0.42, 0.68);
            vec3 paleSky = vec3(0.38, 0.66, 0.84);
            vec3 cream = vec3(1.0, 0.95, 0.86);
            float centerGlow = exp(-dot(centered, centered) * 1.9);
            vec3 color = mix(sky, paleSky, centerGlow * 0.78);

            float ribbonA = exp(-pow(abs(centered.y + centered.x * 0.56 + 0.02), 2.0) * 46.0);
            float ribbonB = exp(-pow(abs(centered.y + centered.x * 0.56 - 0.46), 2.0) * 62.0);
            float ribbonC = exp(-pow(abs(centered.y + centered.x * 0.56 + 0.52), 2.0) * 58.0);
            float caustic = clamp(ribbonA * 0.74 + ribbonB * 0.48 + ribbonC * 0.42, 0.0, 1.0);
            color = mix(color, cream, caustic * 0.9);

            float fluid = 0.0;
            for (int i = 0; i < ${BACKGROUND_SPLAT_COUNT}; i++) {
              vec2 delta = uv - uSplatPoints[i];
              delta.x *= aspect;
              float d = length(delta);
              float age = uSplatAges[i];
              float ring = sin(d * 44.0 - age * 5.8);
              fluid += ring * exp(-d * 7.4) * exp(-age * 1.45);
            }
            vec2 pointerDelta = uv - uPointer;
            pointerDelta.x *= aspect;
            float cursorHalo = exp(-dot(pointerDelta, pointerDelta) * 40.0);
            color += vec3(0.16, 0.24, 0.28) * fluid * 0.014;
            color += vec3(1.0, 0.97, 0.9) * cursorHalo * 0.018;

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

      const backfaceMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vViewPosition;
          varying vec3 vViewNormal;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = viewPosition.xyz;
            vViewNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vViewPosition;
          varying vec3 vViewNormal;

          vec3 packDepth(float value) {
            vec3 encoded = fract(value * vec3(1.0, 255.0, 65025.0));
            encoded -= encoded.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
            return encoded;
          }

          void main() {
            float depth = clamp(-vViewPosition.z / 20.0, 0.0, 1.0);
            gl_FragColor = vec4(packDepth(depth), 1.0);
          }
        `,
        side: THREE.BackSide,
        depthTest: true,
        depthWrite: true,
        toneMapped: false,
        blending: THREE.NoBlending,
      });

      const glassResolution = new THREE.Vector2(1, 1);
      const glassMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: sceneTarget.texture },
          uBackface: { value: backfaceTarget.texture },
          uResolution: { value: glassResolution },
          uPointerLightVS: { value: pointerLightView },
          uHoverUv: { value: pointerUv },
          uHoverStrength: { value: 0 },
          uRippleUv: { value: rippleUv },
          uRippleAge: { value: rippleAges },
        },
        vertexShader: `
          varying vec3 vViewPosition;
          varying vec3 vViewNormal;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = viewPosition.xyz;
            vViewNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform sampler2D uScene;
          uniform sampler2D uBackface;
          uniform vec2 uResolution;
          uniform vec3 uPointerLightVS;
          uniform vec2 uHoverUv;
          uniform float uHoverStrength;
          uniform vec2 uRippleUv[${RIPPLE_COUNT}];
          uniform float uRippleAge[${RIPPLE_COUNT}];
          varying vec3 vViewPosition;
          varying vec3 vViewNormal;

          vec2 refractSlope(vec3 incident, vec3 normal, float eta) {
            vec3 transmission = refract(incident, normal, eta);
            return transmission.xy / max(0.22, -transmission.z)
              - incident.xy / max(0.22, -incident.z);
          }

          float unpackDepth(vec3 encoded) {
            return dot(encoded, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / uResolution;
            vec3 incident = normalize(vViewPosition);
            vec3 normal = faceforward(normalize(vViewNormal), incident, normalize(vViewNormal));
            vec3 viewDirection = -incident;
            vec4 backface = texture2D(uBackface, uv);
            float frontDepth = -vViewPosition.z;
            float backDepth = unpackDepth(backface.rgb) * 20.0;
            float thickness = mix(0.16, clamp(backDepth - frontDepth, 0.035, 0.72), step(0.001, backface.a));

            vec2 rippleWarp = vec2(0.0);
            float splashHighlight = 0.0;
            for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
              vec2 delta = uv - uRippleUv[i];
              delta.x *= uResolution.x / max(uResolution.y, 1.0);
              float distanceToRipple = length(delta);
              float age = uRippleAge[i];
              float radius = age * 0.13;
              float ringDistance = abs(distanceToRipple - radius);
              float ring = 1.0 - smoothstep(0.006, 0.02, ringDistance);
              float fade = exp(-age * 2.4);
              rippleWarp += normalize(delta + vec2(0.0001)) * ring * fade * 0.0038;
              splashHighlight += ring * fade;
            }

            vec2 slopeR = refractSlope(incident, normal, 1.0 / 1.455);
            vec2 slopeG = refractSlope(incident, normal, 1.0 / 1.470);
            vec2 slopeB = refractSlope(incident, normal, 1.0 / 1.492);
            vec2 hoverDelta = uv - uHoverUv;
            hoverDelta.x *= uResolution.x / max(uResolution.y, 1.0);
            float hoverMask = exp(-dot(hoverDelta, hoverDelta) * 86.0) * uHoverStrength;
            vec2 hoverWarp = normalize(hoverDelta + vec2(0.0001)) * hoverMask * 0.012;
            vec2 uvR = clamp(uv + slopeR * thickness * 0.052 + rippleWarp + hoverWarp, 0.003, 0.997);
            vec2 uvG = clamp(uv + slopeG * thickness * 0.052 + rippleWarp + hoverWarp, 0.003, 0.997);
            vec2 uvB = clamp(uv + slopeB * thickness * 0.052 + rippleWarp + hoverWarp, 0.003, 0.997);
            vec3 refracted = vec3(
              texture2D(uScene, uvR).r,
              texture2D(uScene, uvG).g,
              texture2D(uScene, uvB).b
            );
            vec2 texel = 1.0 / uResolution;
            vec3 softened = (
              texture2D(uScene, uvG + vec2(texel.x * 7.0, 0.0)).rgb
              + texture2D(uScene, uvG - vec2(texel.x * 7.0, 0.0)).rgb
              + texture2D(uScene, uvG + vec2(0.0, texel.y * 7.0)).rgb
              + texture2D(uScene, uvG - vec2(0.0, texel.y * 7.0)).rgb
              + texture2D(uScene, uvG).rgb * 2.0
            ) / 6.0;
            refracted = mix(refracted, softened, hoverMask * 0.82);
            refracted *= exp(-vec3(0.035, 0.018, 0.008) * thickness * 0.42);
            float density = 1.0 - exp(-thickness * 0.9);
            float glassBody = clamp(0.24 + density * 0.62, 0.0, 0.52);
            refracted = mix(refracted, vec3(0.16, 0.48, 0.86), glassBody);

            float normalView = clamp(dot(normal, viewDirection), 0.0, 1.0);
            float fresnel = 0.038 + 0.962 * pow(1.0 - normalView, 5.0);
            vec3 lightDirection = normalize(uPointerLightVS - vViewPosition);
            vec3 halfwayDirection = normalize(lightDirection + viewDirection);
            float pointerSpecular = pow(max(dot(normal, halfwayDirection), 0.0), 128.0) * (0.62 + hoverMask * 0.8);
            float edgeRim = pow(1.0 - normalView, 2.7);
            vec3 reflectedDirection = reflect(-viewDirection, normalize(vViewNormal));
            float studioBandA = pow(max(0.0, dot(reflectedDirection, normalize(vec3(-0.72, 0.62, 0.31)))), 18.0);
            float studioBandB = pow(max(0.0, dot(reflectedDirection, normalize(vec3(0.76, -0.18, 0.62)))), 26.0);
            vec3 reflection = vec3(1.0, 0.99, 0.96) * (studioBandA * 1.18 + pointerSpecular)
              + vec3(0.58, 0.82, 1.0) * studioBandB * 0.44;
            vec3 color = mix(refracted, reflection, clamp(fresnel * 0.62, 0.0, 0.52));
            float broadSheen = pow(max(dot(normal, normalize(vec3(-0.38, 0.72, 0.58))), 0.0), 5.0);
            float causticBandA = exp(-pow(uv.y + uv.x * 0.34 - 0.74, 2.0) * 980.0);
            float causticBandB = exp(-pow(uv.y + uv.x * 0.34 - 0.49, 2.0) * 1320.0);
            float microCaustic = pow(max(0.0,
              sin(uv.x * 118.0 + sin(uv.y * 31.0) * 3.0)
              * sin(uv.y * 91.0 - uv.x * 12.0)
            ), 18.0);
            color = mix(color, vec3(0.12, 0.42, 0.82), edgeRim * 0.26);
            color += vec3(0.34, 0.67, 0.94) * edgeRim * 0.26;
            color += vec3(1.0, 0.98, 0.92) * broadSheen * 0.32;
            color += vec3(1.0, 0.97, 0.88) * (causticBandA * 0.42 + causticBandB * 0.28);
            color += vec3(0.92, 0.98, 1.0) * microCaustic * (0.16 + edgeRim * 0.22);
            color += vec3(0.06, 0.18, 0.44) * density * 0.08;
            color += vec3(1.0, 0.98, 0.93) * studioBandA * 0.16;
            color += vec3(1.0, 0.98, 0.93) * min(splashHighlight, 1.0) * 0.07;
            color += vec3(1.0) * hoverMask * pointerSpecular * 0.18;
            gl_FragColor = vec4(color, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,
        transparent: false,
        toneMapped: true,
      });
      disposables.push(backfaceMaterial, glassMaterial);

      const geometry = createSculptedGeometry();
      const sculpture = new THREE.Mesh(geometry, glassMaterial);
      sculpture.renderOrder = 2;
      const heroGroup = new THREE.Group();
      heroGroup.rotation.set(-0.035, 0.035, -0.018);
      heroGroup.add(sculpture);
      glassScene.add(heroGroup);
      disposables.push(geometry);

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
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        depthTest: false,
        depthWrite: false,
        toneMapped: true,
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1.25 : 1.5));
        renderer.setSize(width, height, false);
        renderer.getDrawingBufferSize(drawingBufferSize);
        const targetScale = narrow ? 0.64 : 0.74;
        const targetWidth = Math.max(1, Math.round(drawingBufferSize.x * targetScale));
        const targetHeight = Math.max(1, Math.round(drawingBufferSize.y * targetScale));
        sceneTarget.setSize(targetWidth, targetHeight);
        backfaceTarget.setSize(targetWidth, targetHeight);
        glassResolution.copy(drawingBufferSize);
        backgroundResolution.set(targetWidth, targetHeight);
        camera.aspect = width / height;
        camera.position.z = narrow ? 9.4 : 7.9;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        baseScale = narrow ? 0.47 : THREE.MathUtils.clamp(width / 2050, 0.66, 0.78);
        verticalScale = narrow ? 0.92 : 0.78;
        baseY = narrow ? -0.06 : 0.1;
        heroGroup.scale.set(baseScale, baseScale * verticalScale, baseScale);
        heroGroup.position.set(narrow ? 0 : 0.05, baseY, 0);
        activeUntil = performance.now() + 180;
        wakeAnimation();
      };
      resize();

      const renderGlassPasses = () => {
        if (!renderer) return;
        renderer.setRenderTarget(sceneTarget);
        renderer.setClearColor(0x000000, 1);
        renderer.clear(true, true, true);
        renderer.render(backgroundScene, camera);

        sculpture.material = backfaceMaterial;
        renderer.setRenderTarget(backfaceTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(glassScene, camera);
        sculpture.material = glassMaterial;

        renderer.setRenderTarget(null);
        renderer.setClearColor(0xb9d9ec, 1);
        renderer.clear(true, true, true);
        renderer.render(copyScene, copyCamera);
        renderer.clearDepth();
        renderer.render(glassScene, camera);
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
        assertFramebuffer(backfaceTarget);
        renderGlassPasses();
      } finally {
        renderer.debug.onShaderError = previousShaderErrorHandler;
        renderer.setRenderTarget(null);
        sculpture.material = glassMaterial;
      }

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
        frame = 0;
        startFallbackAnimation();
      };
      canvas.addEventListener("webglcontextlost", handleContextLost, false);
      window.addEventListener("resize", resize, { passive: true });
      const updateScroll = () => {
        if (!hero || reducedMotion.matches) return;
        const rect = hero.getBoundingClientRect();
        scrollProgress = THREE.MathUtils.clamp(-rect.top / Math.max(rect.height * 0.82, 1), 0, 1);
        hero.style.setProperty("--hero-progress", scrollProgress.toFixed(4));
        activeUntil = performance.now() + 260;
        wakeAnimation();
      };
      window.addEventListener("scroll", updateScroll, { passive: true });
      updateScroll();
      removeScrollEvent = () => window.removeEventListener("scroll", updateScroll);
      removeWebGLEvents = () => {
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("webglcontextlost", handleContextLost);
      };

      root.dataset.renderer = "webgl";
      root.dataset.sceneMode = "webgl";
      root.dataset.renderState = "ready";
      requestAnimationFrame(() => root.classList.add("isReady"));

      const animate = () => {
        frame = 0;
        if (disposed || contextLost || !renderer) return;
        if (heroVisible) {
          const elapsed = reducedMotion.matches ? 0 : clock.getElapsedTime();
          const delta = reducedMotion.matches ? 0 : Math.min(0.05, Math.max(0, elapsed - previousElapsed));
          previousElapsed = elapsed;
          rippleAges.forEach((age, index) => { rippleAges[index] = Math.min(9, age + delta); });
          backgroundSplatAges.forEach((age, index) => { backgroundSplatAges[index] = Math.min(9, age + delta); });
          backgroundMaterial.uniforms.uTime.value = elapsed;
          smoothPointer.lerp(reducedMotion.matches ? new THREE.Vector2() : targetPointer, reducedMotion.matches ? 1 : 0.072);
          hoverStrength = THREE.MathUtils.lerp(hoverStrength, pointerOverGlass ? 1 : 0, pointerOverGlass ? 0.16 : 0.1);
          glassMaterial.uniforms.uHoverStrength.value = hoverStrength;

          const scrollScale = baseScale * (1 - scrollProgress * 0.08);
          heroGroup.scale.set(scrollScale, scrollScale * verticalScale, scrollScale);
          heroGroup.rotation.x = -0.025 - smoothPointer.y * 0.032 + scrollProgress * 0.1;
          heroGroup.rotation.y = 0.025 + smoothPointer.x * 0.045 + scrollProgress * 0.17;
          heroGroup.rotation.z = -0.012 + smoothPointer.x * 0.008;
          heroGroup.position.y = baseY + scrollProgress * 0.46;

          raycaster.setFromCamera(smoothPointer, camera);
          if (raycaster.ray.intersectPlane(pointerPlane, pointerLightWorld)) {
            pointerLightWorld.z = 3.6;
            const targetLightView = pointerLightWorld.clone().applyMatrix4(camera.matrixWorldInverse);
            pointerLightView.lerp(targetLightView, 0.1);
          }

          if (pointerDirty && !reducedMotion.matches) {
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
          }

          root.dataset.activeRipples = String(rippleAges.filter((age) => age < 1.05).length);

          renderGlassPasses();
        }

        if (!reducedMotion.matches && pageVisible && heroVisible && performance.now() < activeUntil) {
          frame = requestAnimationFrame(animate);
        }
      };
      wakeAnimation = () => {
        if (!frame && !disposed && !contextLost && pageVisible && heroVisible && performance.now() < activeUntil) {
          frame = requestAnimationFrame(animate);
        }
      };
      if (reducedMotion.matches) animate();
      else wakeAnimation();

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        removeWebGLEvents();
        removeScrollEvent();
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
        disposables.forEach((item) => item.dispose());
        renderer?.dispose();
      };
    } catch {
      startFallbackAnimation();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        removeWebGLEvents();
        removeScrollEvent();
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", pressPointer);
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
      data-glass-stage
      data-glass-word="hello"
      data-pointer-contact="false"
      data-render-state="loading"
      data-scene-mode="loading"
      ref={rootRef}
    >
      <canvas ref={canvasRef} />
      <div className="glassFallback" data-glass-fallback>
          <svg viewBox="0 -980 2180 1080" role="presentation">
            <defs>
              <linearGradient id="fallback-glass-face" x1="0" y1="0" x2="0.75" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.78" />
                <stop offset="0.24" stopColor="#e9f7ff" stopOpacity="0.48" />
                <stop offset="0.64" stopColor="#9dcae4" stopOpacity="0.28" />
                <stop offset="1" stopColor="#d7effa" stopOpacity="0.5" />
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
      <div className="sceneLoader"><i /></div>
    </div>
  );
}
