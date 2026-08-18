"use client";

// Adapted from React Bits Halftone Reveal; see THIRD_PARTY_NOTICES.md.

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

import styles from "./HalftoneReveal.module.css";

type HalftoneMode = "mono" | "duotone" | "color";
type HalftoneShape = "circle" | "square" | "diamond" | "line";
type HalftoneTrigger = "off" | "hover" | "always";
type RenderMode = "webgl" | "fallback";

export type HalftoneRevealProps = {
  printSrc: string;
  revealSrc?: string;
  inkColor?: string;
  paperColor?: string;
  mode?: HalftoneMode;
  dotSize?: number;
  dotDensity?: number;
  angle?: number;
  shape?: HalftoneShape;
  contrast?: number;
  invert?: boolean;
  revealRadius?: number;
  revealMix?: number;
  edge?: number;
  follow?: number;
  idleReveal?: number;
  trigger?: HalftoneTrigger;
  className?: string;
  style?: CSSProperties;
};

type Uniform<T> = { value: T };

type HalftoneUniforms = {
  tPrint: Uniform<Texture>;
  tReveal: Uniform<Texture>;
  iResolution: Uniform<[number, number]>;
  uPrintSize: Uniform<[number, number]>;
  uRevealSize: Uniform<[number, number]>;
  uMouse: Uniform<[number, number]>;
  uActivity: Uniform<number>;
  uDotSize: Uniform<number>;
  uDensity: Uniform<number>;
  uAngle: Uniform<number>;
  uShape: Uniform<number>;
  uInk: Uniform<[number, number, number]>;
  uPaper: Uniform<[number, number, number]>;
  uMode: Uniform<number>;
  uContrast: Uniform<number>;
  uInvert: Uniform<number>;
  uRevealRadius: Uniform<number>;
  uRevealMix: Uniform<number>;
  uEdge: Uniform<number>;
  uIdleReveal: Uniform<number>;
  uTrigger: Uniform<number>;
  [key: string]: Uniform<unknown>;
};

const MODES: Record<HalftoneMode, number> = { mono: 0, duotone: 1, color: 2 };
const SHAPES: Record<HalftoneShape, number> = { circle: 0, square: 1, diamond: 2, line: 3 };
const TRIGGERS: Record<HalftoneTrigger, number> = { off: 0, hover: 1, always: 2 };

const vertex = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

uniform sampler2D tPrint;
uniform sampler2D tReveal;
uniform vec2 iResolution;
uniform vec2 uPrintSize;
uniform vec2 uRevealSize;
uniform vec2 uMouse;
uniform float uActivity;

uniform float uDotSize;
uniform float uDensity;
uniform float uAngle;
uniform int uShape;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform int uMode;
uniform float uContrast;
uniform float uInvert;

uniform float uRevealRadius;
uniform float uRevealMix;
uniform float uEdge;
uniform float uIdleReveal;
uniform int uTrigger;

in vec2 vUv;
out vec4 fragColor;

vec2 uAspect() {
  return vec2(iResolution.x / max(iResolution.y, 1.0), 1.0);
}

vec2 coverUv(vec2 uv, vec2 imageSize) {
  float ia = imageSize.x / max(imageSize.y, 1.0);
  float pa = iResolution.x / max(iResolution.y, 1.0);
  vec2 s = pa > ia ? vec2(1.0, ia / pa) : vec2(pa / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}

vec3 gradeRGB(vec3 color) {
  color = clamp((color - 0.5) * uContrast + 0.5, 0.0, 1.0);
  return mix(color, 1.0 - color, uInvert);
}

float shapeDist(vec2 field) {
  if (uShape == 1) return max(abs(field.x), abs(field.y));
  if (uShape == 2) return abs(field.x) + abs(field.y);
  if (uShape == 3) return abs(field.y);
  return length(field);
}

mat2 rot(float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return mat2(cosine, -sine, sine, cosine);
}

vec4 sampleCell(vec2 st, float density, float angle) {
  vec2 rotated = rot(angle) * st * density;
  vec2 center = floor(rotated) + 0.5;
  vec2 cell = rot(-angle) * (center / density);
  vec2 uv = cell / uAspect();
  return texture(tPrint, clamp(coverUv(uv, uPrintSize), 0.0, 1.0));
}

float coverage(vec2 st, float density, float angle, float ink, float radiusScale) {
  vec2 rotated = rot(angle) * st * density;
  vec2 field = fract(rotated) - 0.5;
  float distanceToShape = shapeDist(field);
  float radius = sqrt(clamp(ink, 0.0, 1.0)) * 0.72 * radiusScale * uDotSize;
  float feather = length(fwidth(rotated)) * 0.6 + 1e-4;
  return smoothstep(radius + feather, radius - feather, distanceToShape);
}

void main() {
  vec2 aspect = uAspect();
  vec2 st = vUv * aspect;
  float angle = radians(uAngle);

  vec2 delta = (vUv - uMouse) * aspect;
  float distanceToPointer = length(delta);
  float activity = uTrigger == 2 ? 1.0 : (uTrigger == 0 ? 0.0 : uActivity);
  float radius = max(uRevealRadius, 1e-4) * mix(0.4, 1.0, activity);

  float pixel = 1.4 / max(iResolution.y, 1.0);
  float band = max(pixel, radius * (1.0 - clamp(uEdge, 0.0, 1.0)) * 0.45);
  float loupe = 1.0 - smoothstep(radius - band, radius + band, distanceToPointer);
  float focus = clamp(max(loupe * activity, uIdleReveal), 0.0, 1.0);
  float density = uDensity;

  vec3 printColor;
  if (uMode == 2) {
    vec3 cyanGrade = gradeRGB(sampleCell(st, density, angle + radians(15.0)).rgb);
    vec3 magentaGrade = gradeRGB(sampleCell(st, density, angle + radians(75.0)).rgb);
    vec3 yellowGrade = gradeRGB(sampleCell(st, density, angle).rgb);
    vec3 blackGrade = gradeRGB(sampleCell(st, density, angle + radians(45.0)).rgb);
    float cyan = 1.0 - cyanGrade.r;
    float magenta = 1.0 - magentaGrade.g;
    float yellow = 1.0 - yellowGrade.b;
    float black = 1.0 - dot(blackGrade, vec3(0.299, 0.587, 0.114));
    float grayComponent = min(min(cyan, magenta), yellow) * 0.5;
    cyan = clamp(cyan - grayComponent, 0.0, 1.0);
    magenta = clamp(magenta - grayComponent, 0.0, 1.0);
    yellow = clamp(yellow - grayComponent, 0.0, 1.0);
    black = clamp(max(grayComponent, black * black * 0.9), 0.0, 1.0);
    float cyanCoverage = coverage(st, density, angle + radians(15.0), cyan, 0.82);
    float magentaCoverage = coverage(st, density, angle + radians(75.0), magenta, 0.82);
    float yellowCoverage = coverage(st, density, angle, yellow, 0.82);
    float blackCoverage = coverage(st, density, angle + radians(45.0), black, 0.78);
    printColor = uPaper;
    printColor = mix(printColor, printColor * vec3(0.10, 0.72, 0.90), cyanCoverage);
    printColor = mix(printColor, printColor * vec3(0.92, 0.10, 0.52), magentaCoverage);
    printColor = mix(printColor, printColor * vec3(0.98, 0.86, 0.10), yellowCoverage);
    printColor = mix(printColor, printColor * vec3(0.08), blackCoverage);
  } else if (uMode == 1) {
    vec3 secondInk = mix(uInk.gbr, vec3(0.90, 0.24, 0.30), 0.7);
    float luminanceA = dot(gradeRGB(sampleCell(st, density, angle).rgb), vec3(0.299, 0.587, 0.114));
    float luminanceB = dot(gradeRGB(sampleCell(st, density, angle + radians(38.0)).rgb), vec3(0.299, 0.587, 0.114));
    float coverageA = coverage(st, density, angle, 1.0 - luminanceA, 1.0);
    float coverageB = coverage(st, density, angle + radians(38.0), pow(1.0 - luminanceB, 1.4), 0.92);
    printColor = uPaper;
    printColor = mix(printColor, secondInk, coverageB * 0.85);
    printColor = mix(printColor, uInk, coverageA);
  } else {
    float luminance = dot(gradeRGB(sampleCell(st, density, angle).rgb), vec3(0.299, 0.587, 0.114));
    float dotCoverage = coverage(st, density, angle, 1.0 - luminance, 1.0);
    printColor = mix(uPaper, uInk, dotCoverage);
  }

  float normalizedDistance = clamp(distanceToPointer / radius, 0.0, 1.0);
  float bend = normalizedDistance * normalizedDistance * normalizedDistance * normalizedDistance;
  vec2 direction = distanceToPointer > 1e-5 ? delta / distanceToPointer : vec2(0.0);
  vec2 offset = direction * bend * radius * 0.22 / aspect;
  vec2 chromaticOffset = direction * bend * 0.0045 / aspect;
  vec3 primarySharp = gradeRGB(vec3(
    texture(tPrint, clamp(coverUv(vUv - offset - chromaticOffset, uPrintSize), 0.0, 1.0)).r,
    texture(tPrint, clamp(coverUv(vUv - offset, uPrintSize), 0.0, 1.0)).g,
    texture(tPrint, clamp(coverUv(vUv - offset + chromaticOffset, uPrintSize), 0.0, 1.0)).b
  ));
  vec3 secondarySharp = gradeRGB(vec3(
    texture(tReveal, clamp(coverUv(vUv - offset - chromaticOffset, uRevealSize), 0.0, 1.0)).r,
    texture(tReveal, clamp(coverUv(vUv - offset, uRevealSize), 0.0, 1.0)).g,
    texture(tReveal, clamp(coverUv(vUv - offset + chromaticOffset, uRevealSize), 0.0, 1.0)).b
  ));
  vec3 sharpColor = mix(primarySharp, secondarySharp, clamp(uRevealMix, 0.0, 1.0));

  fragColor = vec4(mix(printColor, sharpColor, focus), 1.0);
}
`;

let cachedWebGL2Support: boolean | undefined;

function canUseWebGL2() {
  if (cachedWebGL2Support !== undefined) return cachedWebGL2Support;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    cachedWebGL2Support = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cachedWebGL2Support = false;
  }
  return cachedWebGL2Support;
}

function getRenderMode(): RenderMode {
  if (typeof window === "undefined") return "fallback";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  return !reduceMotion && finePointer && canUseWebGL2() ? "webgl" : "fallback";
}

function subscribeToRenderMode(onStoreChange: () => void) {
  const queries = [
    window.matchMedia("(prefers-reduced-motion: reduce)"),
    window.matchMedia("(hover: hover) and (pointer: fine)"),
  ];
  queries.forEach((query) => query.addEventListener("change", onStoreChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onStoreChange));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((value) => `${value}${value}`).join("") : clean;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) return [0, 0, 0];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

function loadTexture(gl: Renderer["gl"], source: string) {
  const texture = new Texture(gl, {
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });

  return new Promise<{ image: HTMLImageElement; texture: Texture }>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      texture.image = image;
      resolve({ image, texture });
    };
    image.onerror = () => reject(new Error(`Unable to load halftone image: ${source}`));
    image.src = source;
  });
}

export default function HalftoneReveal({
  printSrc,
  revealSrc = printSrc,
  inkColor = "#101713",
  paperColor = "#f1ede3",
  mode = "mono",
  dotSize = 0.94,
  dotDensity = 72,
  angle = 45,
  shape = "circle",
  contrast = 1.12,
  invert = false,
  revealRadius = 0.34,
  revealMix = 0.82,
  edge = 0.78,
  follow = 0.24,
  idleReveal = 0,
  trigger = "hover",
  className = "",
  style,
}: HalftoneRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const renderMode = useSyncExternalStore(subscribeToRenderMode, getRenderMode, () => "fallback");

  useEffect(() => {
    const root = rootRef.current;
    if (!root || renderMode !== "webgl") return;

    let disposed = false;
    let imagesReady = false;
    let inView = false;
    let pageVisible = document.visibilityState === "visible";
    let raf = 0;
    let frameCount = 0;
    let previousTime = performance.now();
    const pointer = { x: 0.5, y: 0.5, smoothX: 0.5, smoothY: 0.5, activity: 0, target: trigger === "always" ? 1 : 0 };

    root.dataset.halftoneMode = "webgl";
    root.dataset.halftoneReady = "false";
    root.dataset.halftoneState = trigger === "always" ? "revealing" : "idle";
    root.dataset.halftoneFrame = "0";

    const renderer = new Renderer({
      alpha: false,
      antialias: false,
      depth: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
      powerPreference: "high-performance",
      stencil: false,
      webgl: 2,
    });
    const gl = renderer.gl;
    if (!renderer.isWebgl2) {
      root.dataset.halftoneMode = "fallback";
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }

    const canvas = gl.canvas;
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.halftoneCanvas = "";
    root.appendChild(canvas);

    const printTexture = new Texture(gl, { generateMipmaps: false });
    const revealTexture = new Texture(gl, { generateMipmaps: false });
    const uniforms: HalftoneUniforms = {
      tPrint: { value: printTexture },
      tReveal: { value: revealTexture },
      iResolution: { value: [1, 1] },
      uPrintSize: { value: [1, 1] },
      uRevealSize: { value: [1, 1] },
      uMouse: { value: [0.5, 0.5] },
      uActivity: { value: 0 },
      uDotSize: { value: dotSize },
      uDensity: { value: dotDensity },
      uAngle: { value: angle },
      uShape: { value: SHAPES[shape] },
      uInk: { value: hexToRgb(inkColor) },
      uPaper: { value: hexToRgb(paperColor) },
      uMode: { value: MODES[mode] },
      uContrast: { value: contrast },
      uInvert: { value: invert ? 1 : 0 },
      uRevealRadius: { value: revealRadius },
      uRevealMix: { value: revealMix },
      uEdge: { value: edge },
      uIdleReveal: { value: idleReveal },
      uTrigger: { value: TRIGGERS[trigger] },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const render = () => {
      if (disposed || !imagesReady || !inView || !pageVisible) return;
      renderer.render({ scene: mesh });
      frameCount += 1;
      root.dataset.halftoneFrame = String(frameCount);
      root.dataset.halftoneReady = "true";
    };

    const schedule = () => {
      if (!raf && imagesReady && inView && pageVisible) raf = requestAnimationFrame(animate);
    };

    const animate = (now: number) => {
      raf = 0;
      if (disposed || !imagesReady || !inView || !pageVisible) return;
      const delta = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;
      const followAmount = 1 - Math.exp(-delta / Math.max(0.001, follow));
      const activityAmount = 1 - Math.exp(-delta / 0.12);
      pointer.smoothX += (pointer.x - pointer.smoothX) * followAmount;
      pointer.smoothY += (pointer.y - pointer.smoothY) * followAmount;
      pointer.activity += (pointer.target - pointer.activity) * activityAmount;
      uniforms.uMouse.value = [pointer.smoothX, pointer.smoothY];
      uniforms.uActivity.value = pointer.activity;
      render();

      const moving =
        Math.abs(pointer.x - pointer.smoothX) +
          Math.abs(pointer.y - pointer.smoothY) +
          Math.abs(pointer.target - pointer.activity) >
        0.002;

      if (moving) {
        schedule();
      } else if (pointer.target === 0) {
        root.dataset.halftoneState = "idle";
      }
    };

    const resize = () => {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      renderer.setSize(width, height);
      uniforms.iResolution.value = [canvas.width, canvas.height];
      previousTime = performance.now();
      schedule();
    };

    const setPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch" || trigger === "off") return;
      const bounds = root.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      pointer.x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      pointer.y = Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height));
      pointer.target = 1;
      root.dataset.halftoneState = "revealing";
      schedule();
    };

    const clearPointer = () => {
      if (trigger === "always") return;
      pointer.target = 0;
      root.dataset.halftoneState = "settling";
      schedule();
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        if (!inView && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else if (inView) {
          previousTime = performance.now();
          schedule();
        }
      },
      { rootMargin: "35% 0px", threshold: [0, 0.01] },
    );
    visibilityObserver.observe(root);

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
      if (!pageVisible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (pageVisible) {
        previousTime = performance.now();
        schedule();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    root.addEventListener("pointerenter", setPointer, { passive: true });
    root.addEventListener("pointermove", setPointer, { passive: true });
    root.addEventListener("pointerleave", clearPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    Promise.all([loadTexture(gl, printSrc), loadTexture(gl, revealSrc)])
      .then(([print, reveal]) => {
        if (disposed) return;
        uniforms.tPrint.value = print.texture;
        uniforms.tReveal.value = reveal.texture;
        uniforms.uPrintSize.value = [print.image.naturalWidth || 1, print.image.naturalHeight || 1];
        uniforms.uRevealSize.value = [reveal.image.naturalWidth || 1, reveal.image.naturalHeight || 1];
        imagesReady = true;
        resize();
      })
      .catch(() => {
        if (disposed) return;
        root.dataset.halftoneMode = "fallback";
        root.dataset.halftoneReady = "false";
        canvas.style.display = "none";
      });

    const onContextLost = (event: Event) => {
      event.preventDefault();
      root.dataset.halftoneMode = "fallback";
      root.dataset.halftoneReady = "false";
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      root.removeEventListener("pointerenter", setPointer);
      root.removeEventListener("pointermove", setPointer);
      root.removeEventListener("pointerleave", clearPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      geometry.remove();
      program.remove();
      if (canvas.parentNode === root) root.removeChild(canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    angle,
    contrast,
    dotDensity,
    dotSize,
    edge,
    follow,
    idleReveal,
    inkColor,
    invert,
    mode,
    paperColor,
    printSrc,
    renderMode,
    revealRadius,
    revealMix,
    revealSrc,
    shape,
    trigger,
  ]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-halftone-frame="0"
      data-halftone-mode={renderMode}
      data-halftone-ready="false"
      data-halftone-radius={String(revealRadius)}
      data-halftone-reveal
      data-halftone-reveal-src={revealSrc}
      data-halftone-print-src={printSrc}
      data-halftone-state="idle"
      style={style}
    />
  );
}
