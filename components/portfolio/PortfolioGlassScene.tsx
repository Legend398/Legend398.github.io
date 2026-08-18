"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import helvetiker from "../../public/fonts/helvetiker_bold.typeface.json";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

export type SceneZone = "hero" | "contact" | "none";

export type GlassInteractionState = {
  pointerActive: boolean;
  pointerX: number;
  pointerY: number;
  progress: number;
  zone: SceneZone;
};

export type PortfolioGlassSceneProps = {
  active: boolean;
  compact: boolean;
  interaction: RefObject<GlassInteractionState>;
  onContactChange: (contact: boolean) => void;
  onReady: () => void;
  registerFrameRequester: (requestFrame?: () => void) => void;
};

const backgroundVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const backgroundFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uZone;

  float softBand(vec2 uv, vec2 origin, vec2 direction, float width) {
    vec2 normal = normalize(vec2(-direction.y, direction.x));
    float distanceToLine = abs(dot(uv - origin, normal));
    return exp(-pow(distanceToLine / width, 2.0));
  }

  void main() {
    vec2 uv = vUv;
    vec3 ivory = vec3(0.957, 0.941, 0.906);
    vec3 forest = vec3(0.027, 0.075, 0.059);
    vec3 color = mix(forest, ivory, step(0.5, uZone));
    float mint = softBand(uv, vec2(0.38, 0.42), normalize(vec2(0.72, 0.48)), 0.105);
    float ice = softBand(uv, vec2(0.58, 0.62), normalize(vec2(-0.56, 0.83)), 0.075);
    float peach = softBand(uv, vec2(0.82, 0.32), normalize(vec2(0.68, -0.72)), 0.095);
    color = mix(color, vec3(0.31, 0.47, 0.41), mint * (uZone > 0.5 ? 0.22 : 0.3));
    color = mix(color, vec3(0.7, 0.74, 0.71), ice * (uZone > 0.5 ? 0.16 : 0.2));
    color = mix(color, vec3(0.94, 0.7, 0.61), peach * (uZone > 0.5 ? 0.25 : 0.18));
    float strandA = softBand(uv, vec2(0.47, 0.48), normalize(vec2(0.84, 0.54)), 0.011);
    float strandB = softBand(uv, vec2(0.67, 0.43), normalize(vec2(-0.66, 0.75)), 0.008);
    color = mix(color, vec3(0.035, 0.22, 0.17), clamp(strandA * 0.26 + strandB * 0.2, 0.0, 0.34));

    vec2 grid = abs(fract(uv * vec2(12.0, 8.0)) - 0.5) / fwidth(uv * vec2(12.0, 8.0));
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    color = mix(color, vec3(0.04, 0.22, 0.17), line * 0.055);

    float vignette = smoothstep(0.9, 0.24, distance(uv, vec2(0.56, 0.5)));
    color *= 0.96 + vignette * 0.06;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const glassVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const glassFragmentShader = /* glsl */ `
  uniform sampler2D uSceneTexture;
  uniform vec2 uResolution;
  uniform vec2 uPointerUv;
  uniform vec2 uRippleCenter;
  uniform float uHover;
  uniform float uOpacity;
  uniform float uRippleAge;
  uniform float uRippleEnergy;
  uniform float uZone;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  vec3 sampleDispersed(vec2 uv, vec2 offset, float spread) {
    float red = texture2D(uSceneTexture, clamp(uv + offset * (1.0 + spread), 0.002, 0.998)).r;
    float green = texture2D(uSceneTexture, clamp(uv + offset, 0.002, 0.998)).g;
    float blue = texture2D(uSceneTexture, clamp(uv + offset * (1.0 - spread), 0.002, 0.998)).b;
    return vec3(red, green, blue);
  }

  void main() {
    vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
    vec3 normal = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 2.25);
    vec2 refractionOffset = normal.xy * mix(0.021, 0.064, 1.0 - facing);

    float pointerDistance = distance(screenUv, uPointerUv);
    float lens = (1.0 - smoothstep(0.018, 0.088, pointerDistance)) * uHover;
    float lensRing = smoothstep(0.084, 0.06, pointerDistance) * (1.0 - smoothstep(0.034, 0.052, pointerDistance)) * uHover;
    vec2 lensDirection = normalize(screenUv - uPointerUv + vec2(0.0001));
    float rippleDistance = distance(screenUv, uRippleCenter);
    float rippleEnvelope = (1.0 - smoothstep(0.018, 0.155, rippleDistance)) * exp(-uRippleAge * 4.8);
    float rippleWave = sin(rippleDistance * 155.0 - uRippleAge * 27.0);
    vec2 rippleDirection = normalize(screenUv - uRippleCenter + vec2(0.0001));
    vec2 rippleOffset = rippleDirection * rippleWave * rippleEnvelope * uRippleEnergy * 0.0065;
    vec2 localOffset = refractionOffset + lensDirection * lens * 0.026 + rippleOffset;

    vec3 refracted = sampleDispersed(screenUv, localOffset, 0.34 + lens * 0.5);
    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
    vec3 localBlur = (
      sampleDispersed(screenUv + vec2(pixel.x * 9.0, 0.0), localOffset, 0.54) +
      sampleDispersed(screenUv - vec2(pixel.x * 9.0, 0.0), localOffset, 0.54) +
      sampleDispersed(screenUv + vec2(0.0, pixel.y * 9.0), localOffset, 0.54) +
      sampleDispersed(screenUv - vec2(0.0, pixel.y * 9.0), localOffset, 0.54)
    ) * 0.25;
    refracted = mix(refracted, localBlur, lens * 0.92);

    vec3 lightDirection = normalize(vec3(-0.42, 0.68, 0.62));
    vec3 reflectedLight = reflect(-lightDirection, normal);
    float specular = pow(max(dot(reflectedLight, viewDirection), 0.0), 54.0);
    vec3 edgeTint = uZone > 0.5 ? vec3(0.82, 0.84, 0.82) : vec3(0.78, 0.84, 0.81);
    vec3 color = refracted;
    color = mix(color, edgeTint, 0.008 + fresnel * 0.08);
    color += vec3(0.99, 1.0, 0.99) * fresnel * 0.62;
    color += vec3(1.0) * specular * 0.68;
    color += vec3(0.22, 0.78, 0.7) * lensRing * 0.16;
    color += vec3(1.0, 0.51, 0.34) * lensRing * 0.045;
    color += vec3(0.2, 0.72, 0.6) * lens * 0.12;

    float alpha = (0.13 + fresnel * 0.7 + specular * 0.2 + lens * 0.14) * uOpacity;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.98));
  }
`;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function GlassWord({
  active,
  compact,
  interaction,
  onContactChange,
  onReady,
  registerFrameRequester,
}: PortfolioGlassSceneProps) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh<TextGeometry, THREE.ShaderMaterial>>(null);
  const contactTarget = useRef(0);
  const contactValue = useRef(0);
  const contactStatus = useRef(false);
  const previousPointer = useRef(new THREE.Vector2(0.5, 0.5));
  const readyReported = useRef(false);
  const rippleAge = useRef(10);
  const rippleCenter = useRef(new THREE.Vector2(0.5, 0.5));
  const rippleEnergy = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const renderTarget = useFBO({ depthBuffer: false, stencilBuffer: false, samples: 0 });
  const drawingBufferSize = useMemo(() => new THREE.Vector2(), []);

  const font = useMemo(() => new FontLoader().parse(helvetiker), []);
  const geometry = useMemo(() => {
    const nextGeometry = new TextGeometry("BUILD", {
      bevelEnabled: true,
      bevelOffset: 0,
      bevelSegments: 5,
      bevelSize: 0.045,
      bevelThickness: 0.065,
      curveSegments: 9,
      depth: 0.34,
      font,
      size: 1.38,
    });
    nextGeometry.center();
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [font]);

  const background = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: backgroundFragmentShader,
      uniforms: { uZone: { value: 0 } },
      vertexShader: backgroundVertexShader,
    });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    return { camera, geometry, material, scene };
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader: glassFragmentShader,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uHover: { value: 0 },
      uOpacity: { value: 1 },
      uPointerUv: { value: new THREE.Vector2(0.5, 0.5) },
      uRippleAge: { value: 10 },
      uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uRippleEnergy: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uSceneTexture: { value: renderTarget.texture },
      uZone: { value: 0 },
    },
    vertexShader: glassVertexShader,
  }), [renderTarget.texture]);

  useEffect(() => {
    registerFrameRequester(invalidate);
    invalidate();
    return () => registerFrameRequester();
  }, [invalidate, registerFrameRequester]);

  useEffect(() => () => {
    background.geometry.dispose();
    background.material.dispose();
    geometry.dispose();
    material.dispose();
  }, [background, geometry, material]);

  useEffect(() => {
    if (active) invalidate();
  }, [active, compact, invalidate]);

  /* Three.js uniforms and renderer state are intentionally mutated inside R3F's frame loop. */
  /* eslint-disable react-hooks/immutability */
  useFrame(({ camera, gl, raycaster, scene }, frameDelta) => {
    if (!active || !group.current || !mesh.current) return;
    const delta = Math.min(frameDelta, 0.05);
    const motion = interaction.current;
    const inHero = motion.zone === "hero";
    const progress = clamp(motion.progress);
    const targetX = compact
      ? (inHero ? 0.04 + progress * 0.14 : 0)
      : (inHero ? 1.68 : 0.3);
    const targetY = compact
      ? (inHero ? 0.28 + progress * 0.9 : -1.55)
      : (inHero ? 0.96 + progress * 0.92 : -1.15);
    const targetScaleX = compact
      ? (inHero ? 0.43 - progress * 0.04 : 0.46)
      : (inHero ? 0.62 - progress * 0.045 : 1.14);
    const targetScaleY = compact
      ? (inHero ? 0.53 - progress * 0.05 : 0.46)
      : (inHero ? 0.84 - progress * 0.06 : 1.14);
    const targetScaleZ = compact
      ? (inHero ? 0.48 - progress * 0.04 : 0.46)
      : (inHero ? 0.76 - progress * 0.05 : 1.14);
    const targetOpacity = inHero ? 1 - progress * 0.7 : 0.44 + progress * 0.28;
    const targetRotationY = compact && inHero
      ? -0.06 + progress * 0.14
      : (inHero ? -0.11 : 0.08);
    const targetRotationZ = compact && inHero ? -0.018 + progress * 0.055 : 0;

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 8.5, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 8.5, delta);
    group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, targetScaleX, 8.5, delta);
    group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, targetScaleY, 8.5, delta);
    group.current.scale.z = THREE.MathUtils.damp(group.current.scale.z, targetScaleZ, 8.5, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.08, 8.5, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotationY, 8.5, delta);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, targetRotationZ, 8.5, delta);

    let directlyOverWord = false;
    if (motion.pointerActive) {
      raycaster.setFromCamera(new THREE.Vector2(motion.pointerX, motion.pointerY), camera);
      directlyOverWord = raycaster.intersectObject(mesh.current, false).length > 0;
    }
    const pointerUvX = (motion.pointerX + 1) * 0.5;
    const pointerUvY = (motion.pointerY + 1) * 0.5;
    const pointerTravel = Math.hypot(
      pointerUvX - previousPointer.current.x,
      pointerUvY - previousPointer.current.y,
    );
    const enteredWord = directlyOverWord && !contactStatus.current;
    if (directlyOverWord && (enteredWord || pointerTravel > 0.0025)) {
      rippleCenter.current.set(pointerUvX, pointerUvY);
      rippleAge.current = 0;
      rippleEnergy.current = Math.min(1, Math.max(enteredWord ? 0.28 : 0, pointerTravel * 14));
    } else {
      rippleAge.current += delta;
      rippleEnergy.current = THREE.MathUtils.damp(rippleEnergy.current, 0, 5.6, delta);
    }
    previousPointer.current.set(pointerUvX, pointerUvY);
    contactTarget.current = directlyOverWord ? 1 : 0;
    contactValue.current = THREE.MathUtils.damp(contactValue.current, contactTarget.current, 16, delta);
    if (directlyOverWord !== contactStatus.current) {
      contactStatus.current = directlyOverWord;
      onContactChange(directlyOverWord);
    }

    material.uniforms.uHover.value = contactValue.current;
    material.uniforms.uPointerUv.value.set(pointerUvX, pointerUvY);
    material.uniforms.uOpacity.value = targetOpacity;
    material.uniforms.uRippleAge.value = rippleAge.current;
    material.uniforms.uRippleCenter.value.copy(rippleCenter.current);
    material.uniforms.uRippleEnergy.value = rippleEnergy.current;
    material.uniforms.uZone.value = inHero ? 0 : 1;
    background.material.uniforms.uZone.value = inHero ? 0 : 1;
    gl.getDrawingBufferSize(drawingBufferSize);
    material.uniforms.uResolution.value.copy(drawingBufferSize);

    const previousAutoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(renderTarget);
    gl.setClearColor(0xf4f0e7, 1);
    gl.clear(true, true, true);
    gl.render(background.scene, background.camera);
    gl.setRenderTarget(null);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.autoClear = previousAutoClear;
    if (!readyReported.current) {
      readyReported.current = true;
      onReady();
    }

    const unsettled = Math.max(
      Math.abs(contactValue.current - contactTarget.current),
      Math.abs(group.current.position.x - targetX),
      Math.abs(group.current.position.y - targetY),
      Math.abs(group.current.scale.x - targetScaleX),
      Math.abs(group.current.scale.y - targetScaleY),
      Math.abs(group.current.scale.z - targetScaleZ),
      Math.abs(group.current.rotation.y - targetRotationY),
      Math.abs(group.current.rotation.z - targetRotationZ),
      rippleEnergy.current,
    );
    if (unsettled > 0.001) invalidate();
  }, 1);
  /* eslint-enable react-hooks/immutability */

  return (
    <group
      position={[compact ? 0.04 : 1.68, compact ? 0.28 : 0.96, 0]}
      ref={group}
      rotation={[-0.08, compact ? -0.06 : -0.11, compact ? -0.018 : 0]}
      scale={compact ? [0.43, 0.53, 0.48] : [0.62, 0.84, 0.76]}
    >
      <mesh geometry={geometry} material={material} ref={mesh} />
    </group>
  );
}

export function PortfolioGlassScene(props: PortfolioGlassSceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ fov: 35, near: 0.1, far: 30, position: [0, 0, 8] }}
      dpr={props.compact ? 1 : 0.82}
      fallback={null}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
      }}
      shadows={false}
    >
      <GlassWord {...props} />
    </Canvas>
  );
}
