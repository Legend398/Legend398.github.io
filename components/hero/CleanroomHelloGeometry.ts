import * as THREE from "three";

type CubicDefinition = {
  p0: [number, number, number];
  c1: [number, number, number];
  c2: [number, number, number];
  p1: [number, number, number];
};

// Independent reimplementation brief:
// lowercase hello, inflated glass stroke, rounded terminals, asymmetric rhythm.
// These authored control points do not use coordinates from an imported model.
const CLEANROOM_HELLO_CUBICS: CubicDefinition[] = [
  { p0: [-3.08, -0.55, 0.00], c1: [-2.96, -0.22, 0.05], c2: [-2.77, 0.83, 0.12], p1: [-2.56, 1.28, 0.17] },
  { p0: [-2.56, 1.28, 0.17], c1: [-2.37, 1.64, 0.22], c2: [-2.08, 1.34, -0.16], p1: [-2.18, 0.73, -0.20] },
  { p0: [-2.18, 0.73, -0.20], c1: [-2.28, 0.10, -0.18], c2: [-2.41, -0.54, -0.04], p1: [-2.13, -0.56, 0.02] },
  { p0: [-2.13, -0.56, 0.02], c1: [-1.85, -0.53, 0.09], c2: [-1.96, 0.43, 0.13], p1: [-1.62, 0.40, 0.09] },
  { p0: [-1.62, 0.40, 0.09], c1: [-1.28, 0.37, 0.03], c2: [-1.48, -0.55, -0.05], p1: [-1.17, -0.55, 0.00] },

  { p0: [-1.17, -0.55, 0.00], c1: [-1.00, -0.12, 0.06], c2: [-0.67, 0.26, 0.14], p1: [-0.43, 0.16, 0.17] },
  { p0: [-0.43, 0.16, 0.17], c1: [-0.53, 0.58, 0.11], c2: [-1.06, 0.40, -0.13], p1: [-1.02, -0.05, -0.17] },
  { p0: [-1.02, -0.05, -0.17], c1: [-1.04, -0.43, -0.16], c2: [-0.54, -0.62, 0.03], p1: [-0.12, -0.54, 0.06] },

  { p0: [-0.12, -0.54, 0.06], c1: [0.02, -0.08, 0.11], c2: [-0.01, 1.23, 0.17], p1: [0.28, 1.40, 0.20] },
  { p0: [0.28, 1.40, 0.20], c1: [0.62, 1.52, -0.15], c2: [0.52, -0.46, -0.18], p1: [0.69, -0.55, -0.02] },

  { p0: [0.69, -0.55, -0.02], c1: [0.84, -0.08, 0.04], c2: [0.80, 1.00, 0.15], p1: [1.07, 1.17, 0.18] },
  { p0: [1.07, 1.17, 0.18], c1: [1.37, 1.29, -0.13], c2: [1.30, -0.45, -0.17], p1: [1.47, -0.54, 0.00] },

  { p0: [1.47, -0.54, 0.00], c1: [1.54, -0.07, 0.10], c2: [1.78, 0.43, 0.18], p1: [2.13, 0.39, 0.20] },
  { p0: [2.13, 0.39, 0.20], c1: [2.53, 0.34, -0.04], c2: [2.56, -0.50, -0.16], p1: [2.17, -0.58, -0.15] },
  { p0: [2.17, -0.58, -0.15], c1: [1.76, -0.63, -0.08], c2: [1.60, 0.02, 0.08], p1: [1.94, 0.17, 0.12] },
  { p0: [1.94, 0.17, 0.12], c1: [2.24, 0.30, 0.15], c2: [2.50, 0.34, 0.09], p1: [2.69, 0.57, 0.03] },
];

const toVector = ([x, y, z]: [number, number, number]) => new THREE.Vector3(x, y, z);

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(edge1 - edge0, 0.00001), 0, 1);
  return t * t * (3 - 2 * t);
}

function createCenterline(segmentCount: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  CLEANROOM_HELLO_CUBICS.forEach(({ p0, c1, c2, p1 }) => {
    path.add(new THREE.CubicBezierCurve3(
      toVector(p0),
      toVector(c1),
      toVector(c2),
      toVector(p1),
    ));
  });

  const sampled = Array.from(
    { length: segmentCount + 1 },
    (_, index) => path.getPointAt(index / segmentCount),
  );
  const smoothed = sampled.map((point) => point.clone());

  for (let index = 2; index < sampled.length - 2; index += 1) {
    smoothed[index]
      .copy(sampled[index - 2]).multiplyScalar(-3)
      .addScaledVector(sampled[index - 1], 12)
      .addScaledVector(sampled[index], 17)
      .addScaledVector(sampled[index + 1], 12)
      .addScaledVector(sampled[index + 2], -3)
      .multiplyScalar(1 / 35);
  }

  smoothed.forEach((point, index) => {
    const t = index / segmentCount;
    const endpointGate = smoothstep(0, 0.04, t) * smoothstep(0, 0.05, 1 - t);
    point.z += endpointGate * (
      0.052 * Math.sin(t * Math.PI * 3.2 + 0.35)
      + 0.022 * Math.sin(t * Math.PI * 8.4)
    );
    point.x += point.y * 0.11;
  });

  return smoothed;
}

function createFrame(points: THREE.Vector3[], index: number) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const tangent = next.clone().sub(previous).normalize();
  const lateral = new THREE.Vector3(-tangent.y, tangent.x, 0);
  if (lateral.lengthSq() < 0.000001) lateral.set(0, 1, 0);
  lateral.normalize();
  const depth = tangent.clone().cross(lateral).normalize();
  return { depth, lateral, tangent };
}

export function createCleanroomHelloGeometry() {
  const segmentCount = 340;
  const radialSegments = 24;
  const capSegments = 6;
  const lateralRadius = 0.205;
  const depthRadius = 0.405;
  const points = createCenterline(segmentCount);
  const positions: number[] = [];
  const indices: number[] = [];
  const ringStarts: number[] = [];

  const addRing = (
    center: THREE.Vector3,
    lateral: THREE.Vector3,
    depth: THREE.Vector3,
    lateralRadius: number,
    depthRadius: number,
  ) => {
    ringStarts.push(positions.length / 3);
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const angle = radialIndex / radialSegments * Math.PI * 2;
      const vertex = center.clone()
        .addScaledVector(lateral, Math.cos(angle) * lateralRadius)
        .addScaledVector(depth, Math.sin(angle) * depthRadius);
      positions.push(vertex.x, vertex.y, vertex.z);
    }
  };

  const startFrame = createFrame(points, 0);
  const startPressure = 0.72;
  const startLateralRadius = lateralRadius * startPressure;
  const startDepthRadius = depthRadius * startPressure;
  const startTip = points[0].clone().addScaledVector(startFrame.tangent, -startLateralRadius);
  const startTipIndex = positions.length / 3;
  positions.push(startTip.x, startTip.y, startTip.z);
  for (let capIndex = capSegments - 1; capIndex >= 1; capIndex -= 1) {
    const phi = capIndex / capSegments * Math.PI / 2;
    const center = points[0].clone().addScaledVector(
      startFrame.tangent,
      -startLateralRadius * Math.sin(phi),
    );
    addRing(
      center,
      startFrame.lateral,
      startFrame.depth,
      startLateralRadius * Math.cos(phi),
      startDepthRadius * Math.cos(phi),
    );
  }

  points.forEach((point, index) => {
    const t = index / segmentCount;
    const frame = createFrame(points, index);
    const endpointTaper = smoothstep(0, 0.045, t) * smoothstep(0, 0.055, 1 - t);
    const pressure = (
      1
      + 0.05 * Math.sin(t * Math.PI * 2 + 0.4)
      + 0.022 * Math.sin(t * Math.PI * 6)
    ) * (0.95 + 0.08 * Math.abs(frame.tangent.y));
    const radiusScale = THREE.MathUtils.lerp(0.72, 1, endpointTaper) * pressure;
    addRing(
      point,
      frame.lateral,
      frame.depth,
      lateralRadius * radiusScale,
      depthRadius * radiusScale,
    );
  });

  const endFrame = createFrame(points, points.length - 1);
  const endLateralRadius = lateralRadius * 0.72;
  const endDepthRadius = depthRadius * 0.72;
  for (let capIndex = 1; capIndex < capSegments; capIndex += 1) {
    const phi = capIndex / capSegments * Math.PI / 2;
    const center = points.at(-1)!.clone().addScaledVector(
      endFrame.tangent,
      endLateralRadius * Math.sin(phi),
    );
    addRing(
      center,
      endFrame.lateral,
      endFrame.depth,
      endLateralRadius * Math.cos(phi),
      endDepthRadius * Math.cos(phi),
    );
  }
  const endTip = points.at(-1)!.clone().addScaledVector(endFrame.tangent, endLateralRadius);
  const endTipIndex = positions.length / 3;
  positions.push(endTip.x, endTip.y, endTip.z);

  const firstRingStart = ringStarts[0];
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const nextRadial = (radialIndex + 1) % radialSegments;
    indices.push(startTipIndex, firstRingStart + nextRadial, firstRingStart + radialIndex);
  }

  for (let ringIndex = 0; ringIndex < ringStarts.length - 1; ringIndex += 1) {
    const current = ringStarts[ringIndex];
    const next = ringStarts[ringIndex + 1];
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadial = (radialIndex + 1) % radialSegments;
      indices.push(
        current + radialIndex,
        current + nextRadial,
        next + radialIndex,
        current + nextRadial,
        next + nextRadial,
        next + radialIndex,
      );
    }
  }

  const lastRingStart = ringStarts.at(-1)!;
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const nextRadial = (radialIndex + 1) % radialSegments;
    indices.push(lastRingStart + radialIndex, lastRingStart + nextRadial, endTipIndex);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  geometry.center();
  geometry.computeBoundingBox();
  const width = geometry.boundingBox
    ? geometry.boundingBox.max.x - geometry.boundingBox.min.x
    : 1;
  const scale = 6.35 / Math.max(width, 0.00001);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.provenance = "independent-cleanroom-v2";
  geometry.userData.layers = "bezier|arc-length|depth-lanes|elliptical-sweep|round-caps|smooth-normals";
  return geometry;
}
