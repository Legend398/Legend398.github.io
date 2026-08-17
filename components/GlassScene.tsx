"use client";

import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export type HeroMotionState = {
  pointerActive: boolean;
  pointerX: number;
  pointerY: number;
  renderScale: number;
  scroll: number;
};

export type GlassSceneProps = {
  active: boolean;
  compact: boolean;
  motion: RefObject<HeroMotionState>;
  registerFrameRequester: (requestFrame?: () => void) => void;
  reducedMotion: boolean;
};

type PhysicalShader = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

const glowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float glow = pow(max(0.0, 1.0 - dot(point, point)), 2.6);
    gl_FragColor = vec4(uColor, glow * uStrength);
  }
`;

const rimVertexShader = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec2 vRimUv;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewPosition = -viewPosition.xyz;
    vRimUv = uv;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const rimFragmentShader = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec2 vRimUv;
  void main() {
    vec3 normalDirection = normalize(vViewNormal);
    vec3 viewDirection = normalize(vViewPosition);
    float fresnel = pow(1.0 - clamp(abs(dot(normalDirection, viewDirection)), 0.0, 1.0), 2.15);
    float upperGleam = pow(max(dot(normalDirection, normalize(vec3(-0.24, 0.76, 0.60))), 0.0), 18.0);
    float lowerGleam = pow(max(dot(normalDirection, normalize(vec3(0.52, -0.34, 0.78))), 0.0), 28.0);
    float internalRibbon = pow(0.5 + 0.5 * sin(vRimUv.x * 42.0 + vRimUv.y * 13.0), 18.0) * (1.0 - fresnel);
    vec3 edgeColor = mix(vec3(0.24, 0.38, 0.98), vec3(0.88, 0.98, 1.0), fresnel + upperGleam * 0.55);
    edgeColor += vec3(1.0, 0.54, 0.42) * lowerGleam * 0.24;
    edgeColor += mix(vec3(0.25, 0.88, 1.0), vec3(0.72, 0.42, 1.0), vRimUv.x) * internalRibbon * 0.17;
    float alpha = clamp(fresnel * 0.76 + upperGleam * 0.34 + lowerGleam * 0.2 + internalRibbon * 0.07, 0.0, 0.9);
    gl_FragColor = vec4(edgeColor, alpha);
  }
`;

function BackdropGlow({ color, position, rotation = [0, 0, 0], scale, strength }: {
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  strength: number;
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }), [color, strength]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh position={position} rotation={rotation} scale={scale} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function GlassWord({ active, compact, motion, reducedMotion, registerFrameRequester }: GlassSceneProps) {
  const font = useLoader(FontLoader, "/fonts/helvetiker_bold.typeface.json");
  const word = useRef<THREE.Group>(null);
  const compiledShader = useRef<PhysicalShader | null>(null);
  const hoverValue = useRef(0);
  const pointerValue = useRef(new THREE.Vector2(0.5, 0.5));
  const hoverTarget = useRef(0);
  const pointerTarget = useRef(new THREE.Vector2(0.5, 0.5));
  const invalidate = useThree((state) => state.invalidate);
  const geometry = useMemo(() => {
    const nextGeometry = new TextGeometry("BUILD", {
      font,
      size: 1,
      depth: 0.27,
      curveSegments: compact ? 8 : 12,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.048,
      bevelOffset: 0,
      bevelSegments: compact ? 4 : 6,
    });
    nextGeometry.computeBoundingBox();
    const bounds = nextGeometry.boundingBox;
    if (bounds) {
      nextGeometry.translate(
        -(bounds.max.x + bounds.min.x) / 2,
        -(bounds.max.y + bounds.min.y) / 2,
        -(bounds.max.z + bounds.min.z) / 2,
      );
    }
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [compact, font]);
  const material = useMemo(() => {
    const nextMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#6f91ff"),
      roughness: 0.035,
      metalness: 0,
      transmission: 0.5,
      thickness: 0.22,
      ior: 1.45,
      attenuationColor: new THREE.Color("#9fb5ff"),
      attenuationDistance: 5,
      clearcoat: 1,
      clearcoatRoughness: 0.018,
      specularIntensity: 1,
      specularColor: new THREE.Color("#ffffff"),
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    nextMaterial.onBeforeCompile = (shader) => {
      const physicalShader = shader as PhysicalShader;
      compiledShader.current = physicalShader;
      physicalShader.uniforms.uPointerUv = { value: pointerValue.current };
      physicalShader.uniforms.uHover = { value: hoverValue.current };
      physicalShader.vertexShader = physicalShader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGlassUv;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlassUv = uv;");
      physicalShader.fragmentShader = physicalShader.fragmentShader
        .replace("#include <common>", `#include <common>
uniform vec2 uPointerUv;
uniform float uHover;
varying vec2 vGlassUv;
float localGlassLens() {
  float aspectDistance = length((vGlassUv - uPointerUv) * vec2(1.0, 1.45));
  return uHover * (1.0 - smoothstep(0.035, 0.17, aspectDistance));
}`)
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nfloat glassLens = localGlassLens();\nroughnessFactor = mix(roughnessFactor, 0.72, glassLens);\ndiffuseColor.a = mix(diffuseColor.a, 0.7, glassLens);",
        )
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
vec2 lensDirection = normalize((vGlassUv - uPointerUv) + vec2(0.0001));
normal = normalize(normal + vec3(lensDirection * glassLens * 0.2, 0.0));`);
    };
    nextMaterial.customProgramCacheKey = () => "build-glass-local-lens-v1";
    return nextMaterial;
  }, []);
  const rimMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: rimVertexShader,
    fragmentShader: rimFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    toneMapped: false,
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => rimMaterial.dispose(), [rimMaterial]);
  useEffect(() => {
    registerFrameRequester(invalidate);
    if (active && !reducedMotion) invalidate();
    return () => registerFrameRequester();
  }, [active, invalidate, reducedMotion, registerFrameRequester]);
  useEffect(() => {
    if (active && !reducedMotion) return;
    hoverTarget.current = 0;
    hoverValue.current = 0;
    if (compiledShader.current) compiledShader.current.uniforms.uHover.value = 0;
  }, [active, reducedMotion]);

  const setPointerUv = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!active || reducedMotion || !event.uv) return;
    event.stopPropagation();
    pointerTarget.current.copy(event.uv);
    hoverTarget.current = 1;
    invalidate();
  }, [active, invalidate, reducedMotion]);
  const clearPointer = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hoverTarget.current = 0;
    invalidate();
  }, [invalidate]);

  useFrame((_, frameDelta) => {
    if (!active || reducedMotion || !word.current) return;

    const delta = Math.min(frameDelta, 0.05);
    hoverValue.current = THREE.MathUtils.damp(hoverValue.current, hoverTarget.current, 16, delta);
    pointerValue.current.lerp(pointerTarget.current, 1 - Math.exp(-22 * delta));
    if (compiledShader.current) {
      compiledShader.current.uniforms.uHover.value = hoverValue.current;
      compiledShader.current.uniforms.uPointerUv.value = pointerValue.current;
    }

    const targetY = motion.current.scroll * 0.34;
    const targetRotation = -0.035 + motion.current.scroll * 0.025;
    word.current.position.y = THREE.MathUtils.damp(word.current.position.y, targetY, 9, delta);
    word.current.rotation.x = THREE.MathUtils.damp(word.current.rotation.x, targetRotation, 9, delta);

    const unsettled = Math.max(
      Math.abs(hoverValue.current - hoverTarget.current),
      pointerValue.current.distanceTo(pointerTarget.current),
      Math.abs(word.current.position.y - targetY),
      Math.abs(word.current.rotation.x - targetRotation),
    );
    if (unsettled > 0.0015) invalidate();
  });

  return (
    <group
      ref={word}
      position={[compact ? 0 : 0.38, 0, 0]}
      rotation={[-0.035, -0.06, compact ? -0.025 : -0.045]}
      scale={compact ? 0.76 : 0.92}
    >
      <mesh
        geometry={geometry}
        material={material}
        onPointerEnter={setPointerUv}
        onPointerMove={setPointerUv}
        onPointerOut={clearPointer}
      />
      <mesh geometry={geometry} material={rimMaterial} scale={1.0025} raycast={() => null} renderOrder={3} />
    </group>
  );
}

function GlassStage(props: GlassSceneProps) {
  return (
    <>
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3.2} color="#f8fdff" position={[0, 3.5, 4]} scale={[8, 1.1, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#7396ff" position={[-4, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={[5, 1.5, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#ffb18d" position={[4, -1.5, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 1, 1]} />
      </Environment>
      <BackdropGlow color="#537bff" position={[-1.65, 0.75, -1.45]} scale={[3.7, 2.5, 1]} strength={0.36} />
      <BackdropGlow color="#8ecfff" position={[0.55, -0.15, -1.4]} rotation={[0, 0, -0.18]} scale={[4.6, 2.2, 1]} strength={0.14} />
      <BackdropGlow color="#ffad84" position={[2.15, -0.72, -1.3]} scale={[2.75, 1.8, 1]} strength={0.26} />
      <GlassWord {...props} />
    </>
  );
}

export function GlassScene(props: GlassSceneProps) {
  const { compact } = props;
  return (
    <Canvas
      aria-hidden="true"
      dpr={compact ? 0.72 : 0.82}
      camera={{ position: [0, 0.05, compact ? 7.2 : 6.25], fov: compact ? 39 : 35 }}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        precision: compact ? "mediump" : "highp",
        powerPreference: "high-performance",
        stencil: false,
      }}
      shadows={false}
      fallback={null}
    >
      <ambientLight intensity={0.24} />
      <directionalLight position={[3.5, 4.5, 5]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-3, -1, 3]} intensity={0.7} color="#b8d3ff" />
      <pointLight position={[0, -2, 2.8]} intensity={4} distance={7} color="#ffd3bd" />
      <GlassStage {...props} />
    </Canvas>
  );
}
