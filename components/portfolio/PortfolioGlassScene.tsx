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
    vec3 color = ivory;
    float mint = softBand(uv, vec2(0.38, 0.42), normalize(vec2(0.72, 0.48)), 0.105);
    float ice = softBand(uv, vec2(0.58, 0.62), normalize(vec2(-0.56, 0.83)), 0.075);
    float peach = softBand(uv, vec2(0.82, 0.32), normalize(vec2(0.68, -0.72)), 0.095);
    color = mix(color, vec3(0.58, 0.8, 0.74), mint * 0.34);
    color = mix(color, vec3(0.78, 0.88, 0.86), ice * 0.28);
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
  uniform float uHover;
  uniform float uOpacity;
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
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 2.25);
    vec2 refractionOffset = normal.xy * mix(0.021, 0.064, 1.0 - facing);

    float pointerDistance = distance(screenUv, uPointerUv);
    float lens = (1.0 - smoothstep(0.018, 0.088, pointerDistance)) * uHover;
    float lensRing = smoothstep(0.084, 0.06, pointerDistance) * (1.0 - smoothstep(0.034, 0.052, pointerDistance)) * uHover;
    vec2 lensDirection = normalize(screenUv - uPointerUv + vec2(0.0001));
    vec2 localOffset = refractionOffset + lensDirection * lens * 0.019;

    vec3 refracted = sampleDispersed(screenUv, localOffset, 0.34 + lens * 0.5);
    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
    vec3 localBlur = (
      sampleDispersed(screenUv + vec2(pixel.x * 5.0, 0.0), localOffset, 0.54) +
      sampleDispersed(screenUv - vec2(pixel.x * 5.0, 0.0), localOffset, 0.54) +
      sampleDispersed(screenUv + vec2(0.0, pixel.y * 5.0), localOffset, 0.54) +
      sampleDispersed(screenUv - vec2(0.0, pixel.y * 5.0), localOffset, 0.54)
    ) * 0.25;
    refracted = mix(refracted, localBlur, lens * 0.82);

    vec3 lightDirection = normalize(vec3(-0.42, 0.68, 0.62));
    vec3 reflectedLight = reflect(-lightDirection, normal);
    float specular = pow(max(dot(reflectedLight, viewDirection), 0.0), 54.0);
    vec3 edgeTint = uZone > 0.5 ? vec3(0.08, 0.18, 0.15) : vec3(0.07, 0.19, 0.16);
    vec3 color = mix(refracted, edgeTint, 0.025 + fresnel * 0.29);
    color += vec3(0.94, 1.0, 0.99) * fresnel * 0.43;
    color += vec3(1.0) * specular * 0.68;
    color += vec3(0.22, 0.78, 0.7) * lensRing * 0.16;
    color += vec3(1.0, 0.51, 0.34) * lensRing * 0.045;

    float alpha = (0.5 + fresnel * 0.46 + specular * 0.2 + lens * 0.035) * uOpacity;
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
  registerFrameRequester,
}: PortfolioGlassSceneProps) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh<TextGeometry, THREE.ShaderMaterial>>(null);
  const contactTarget = useRef(0);
  const contactValue = useRef(0);
  const contactStatus = useRef(false);
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
    const targetX = compact ? 0 : (inHero ? 1.68 : 0.3);
    const targetY = compact
      ? (inHero ? 1.05 + progress * 0.46 : -1.55)
      : (inHero ? 0.96 + progress * 0.92 : -1.15);
    const targetScaleX = compact
      ? (inHero ? 0.38 - progress * 0.025 : 0.46)
      : (inHero ? 0.62 - progress * 0.045 : 1.14);
    const targetScaleY = compact
      ? (inHero ? 0.38 - progress * 0.025 : 0.46)
      : (inHero ? 0.84 - progress * 0.06 : 1.14);
    const targetScaleZ = compact
      ? (inHero ? 0.38 - progress * 0.025 : 0.46)
      : (inHero ? 0.76 - progress * 0.05 : 1.14);
    const targetOpacity = inHero ? 1 - progress * 0.7 : 0.44 + progress * 0.28;

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 8.5, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 8.5, delta);
    group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, targetScaleX, 8.5, delta);
    group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, targetScaleY, 8.5, delta);
    group.current.scale.z = THREE.MathUtils.damp(group.current.scale.z, targetScaleZ, 8.5, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.08, 8.5, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, inHero ? -0.11 : 0.08, 8.5, delta);

    let directlyOverWord = false;
    if (motion.pointerActive) {
      raycaster.setFromCamera(new THREE.Vector2(motion.pointerX, motion.pointerY), camera);
      directlyOverWord = raycaster.intersectObject(mesh.current, false).length > 0;
    }
    contactTarget.current = directlyOverWord ? 1 : 0;
    contactValue.current = THREE.MathUtils.damp(contactValue.current, contactTarget.current, 16, delta);
    if (directlyOverWord !== contactStatus.current) {
      contactStatus.current = directlyOverWord;
      onContactChange(directlyOverWord);
    }

    material.uniforms.uHover.value = contactValue.current;
    material.uniforms.uPointerUv.value.set((motion.pointerX + 1) * 0.5, (motion.pointerY + 1) * 0.5);
    material.uniforms.uOpacity.value = targetOpacity;
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

    const unsettled = Math.max(
      Math.abs(contactValue.current - contactTarget.current),
      Math.abs(group.current.position.x - targetX),
      Math.abs(group.current.position.y - targetY),
      Math.abs(group.current.scale.x - targetScaleX),
      Math.abs(group.current.scale.y - targetScaleY),
      Math.abs(group.current.scale.z - targetScaleZ),
    );
    if (unsettled > 0.001) invalidate();
  }, 1);
  /* eslint-enable react-hooks/immutability */

  return (
    <group
      position={[compact ? 0 : 1.68, compact ? 1.05 : 0.96, 0]}
      ref={group}
      rotation={[-0.08, -0.11, 0]}
      scale={compact ? 0.38 : [0.62, 0.84, 0.76]}
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
      dpr={props.compact ? 0.72 : 0.82}
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
