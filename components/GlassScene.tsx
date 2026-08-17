"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

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

function GlassKnot({ active, compact, motion, reducedMotion, registerFrameRequester }: GlassSceneProps) {
  const group = useRef<THREE.Group>(null);
  const bodyMesh = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>>(null);
  const contactLight = useRef<THREE.PointLight>(null);
  const hoverTarget = useRef(0);
  const hoverValue = useRef(0);
  const contactTarget = useRef(new THREE.Vector3(0.8, 0.2, 1.4));
  const contactPosition = useRef(new THREE.Vector3(0.8, 0.2, 1.4));
  const invalidate = useThree((state) => state.invalidate);

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.TorusKnotGeometry(
      compact ? 1.18 : 1.46,
      compact ? 0.32 : 0.42,
      compact ? 128 : 176,
      compact ? 20 : 26,
      2,
      3,
    );
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [compact]);

  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e4efeb"),
    roughness: 0.05,
    metalness: 0,
    transmission: 0.86,
    thickness: 1.05,
    ior: 1.28,
    attenuationColor: new THREE.Color("#cde5de"),
    attenuationDistance: 5.5,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    specularIntensity: 1.15,
    specularColor: new THREE.Color("#ffffff"),
    envMapIntensity: 1.55,
    iridescence: 0.16,
    iridescenceIOR: 1.18,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  const rimMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#eef8f4"),
    roughness: 0.025,
    metalness: 0,
    transmission: 0.28,
    thickness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => rimMaterial.dispose(), [rimMaterial]);

  useEffect(() => {
    registerFrameRequester(invalidate);
    if (active && !reducedMotion) invalidate();
    return () => registerFrameRequester();
  }, [active, invalidate, reducedMotion, registerFrameRequester]);

  const moveContact = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!active || reducedMotion || !group.current) return;
    event.stopPropagation();
    hoverTarget.current = 1;
    contactTarget.current.copy(group.current.worldToLocal(event.point.clone()));
    invalidate();
  }, [active, invalidate, reducedMotion]);

  const clearContact = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hoverTarget.current = 0;
    invalidate();
  }, [invalidate]);

  useFrame((_, frameDelta) => {
    if (!active || reducedMotion || !group.current) return;
    const delta = Math.min(frameDelta, 0.05);
    const scroll = motion.current.scroll;
    hoverValue.current = THREE.MathUtils.damp(hoverValue.current, hoverTarget.current, 11, delta);
    contactPosition.current.lerp(contactTarget.current, 1 - Math.exp(-16 * delta));

    const targetY = 0.12 + scroll * 0.36;
    const targetRotationX = -0.14 + scroll * 0.08;
    const targetRotationY = -0.48 + scroll * 0.16;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 7, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetRotationX, 7, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotationY, 7, delta);
    const activeMaterial = bodyMesh.current?.material;
    if (activeMaterial) {
      activeMaterial.roughness = THREE.MathUtils.damp(activeMaterial.roughness, 0.075 + hoverValue.current * 0.18, 12, delta);
      activeMaterial.iridescence = THREE.MathUtils.damp(activeMaterial.iridescence, 0.16 + hoverValue.current * 0.38, 12, delta);
    }

    if (contactLight.current) {
      contactLight.current.position.copy(contactPosition.current);
      contactLight.current.intensity = THREE.MathUtils.damp(contactLight.current.intensity, hoverValue.current * 8.5, 13, delta);
    }

    const unsettled = Math.max(
      Math.abs(hoverValue.current - hoverTarget.current),
      Math.abs(group.current.position.y - targetY),
      Math.abs(group.current.rotation.x - targetRotationX),
      Math.abs(group.current.rotation.y - targetRotationY),
    );
    if (unsettled > 0.0015) invalidate();
  });

  return (
    <group
      ref={group}
      position={[compact ? 0.08 : 0.16, 0.12, 0]}
      rotation={[-0.14, -0.48, compact ? 0.08 : 0.17]}
      scale={compact ? 1.08 : 1.34}
    >
      <mesh
        ref={bodyMesh}
        geometry={geometry}
        material={material}
        onPointerEnter={moveContact}
        onPointerMove={moveContact}
        onPointerOut={clearContact}
      />
      <mesh geometry={geometry} material={rimMaterial} scale={1.018} raycast={() => null} renderOrder={3} />
      <pointLight ref={contactLight} color="#f09a85" intensity={0} distance={4.5} decay={2} />
    </group>
  );
}

function GlassStage(props: GlassSceneProps) {
  return (
    <>
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3.4} color="#ffffff" position={[-1, 4, 4]} scale={[8, 1.4, 1]} />
        <Lightformer form="rect" intensity={2.1} color="#b7ddd2" position={[-4, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 1.6, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#f3b2a4" position={[4, -1.5, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 1.2, 1]} />
      </Environment>
      <ambientLight intensity={0.62} />
      <directionalLight position={[3.5, 5, 4]} intensity={2.15} color="#ffffff" />
      <directionalLight position={[-4, -1, 3]} intensity={0.9} color="#b9ddd4" />
      <GlassKnot {...props} />
    </>
  );
}

export function GlassScene(props: GlassSceneProps) {
  const { compact } = props;
  return (
    <Canvas
      aria-hidden="true"
      dpr={compact ? 0.72 : 0.86}
      camera={{ position: [0, 0.1, compact ? 7.4 : 6.4], fov: compact ? 40 : 35 }}
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
      <GlassStage {...props} />
    </Canvas>
  );
}
