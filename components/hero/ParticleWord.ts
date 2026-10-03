import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";

const TRAIL_COUNT = 6;
const shared = `
  uniform sampler2D uRest;
  uniform float uDt, uTime, uTouch;
  uniform vec3 uPointer;
  uniform vec4 uTrail[${TRAIL_COUNT}];
  uniform vec2 uFlow[${TRAIL_COUNT}];
`;

const velocityShader = `${shared}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 rest = texture2D(uRest, uv);
    vec3 p = texture2D(texturePosition, uv).xyz;
    vec4 state = texture2D(textureVelocity, uv);
    vec3 carry = vec3(0.0);
    float wake = 0.0;
    for (int i = 0; i < ${TRAIL_COUNT}; i++) {
      vec2 d = p.xy - uTrail[i].xy;
      float weight = exp(-dot(d, d) / 0.13) * uTrail[i].z;
      vec2 flow = uFlow[i];
      float roll = flow.x * d.y - flow.y * d.x;
      carry += vec3(flow * 3.2, roll * 13.0) * weight;
      wake += weight * length(flow);
    }
    vec3 ambient = vec3(
      sin(p.y * 4.1 + uTime * 0.7) + cos(p.z * 3.7 - uTime * 0.5),
      sin(p.z * 4.1 + uTime * 0.6) + cos(p.x * 3.7 + uTime * 0.4),
      sin(p.x * 4.1 - uTime * 0.5) + cos(p.y * 3.7 + uTime * 0.7)
    ) * 0.18;
    vec3 offset = rest.xyz - p;
    float tension = 24.0 + dot(offset, offset) * 95.0;
    vec3 v = (state.xyz + (offset * tension + ambient + carry) * uDt) * exp(-uDt * 6.2);
    v *= min(1.0, 3.4 / max(length(v), 0.0001));
    float hover = exp(-dot(p.xy - uPointer.xy, p.xy - uPointer.xy) / 0.085) * uTouch * 0.28;
    float energy = clamp(length(v) * 0.68 + wake * 0.13 + hover, 0.0, 1.0);
    float heat = mix(state.w, energy, 1.0 - exp(-uDt * (energy > state.w ? 15.0 : 3.2)));
    gl_FragColor = vec4(v, heat);
  }
`;

const positionShader = `${shared}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 p = texture2D(texturePosition, uv);
    vec3 v = texture2D(textureVelocity, uv).xyz;
    gl_FragColor = vec4(p.xyz + v * uDt, p.w);
  }
`;

export function decodeParticleWord(buffer: ArrayBuffer, stride = 1) {
  const view = new DataView(buffer);
  if (view.byteLength < 16 || view.getUint32(0, true) !== 0x4c435048 || view.getUint32(4, true) !== 1) {
    throw new Error("Invalid particle word asset");
  }
  const count = view.getUint32(8, true), scale = view.getFloat32(12, true);
  if (count !== 65536 || scale !== 8192 || view.byteLength !== 16 + count * 9 || ![1, 4].includes(stride)) {
    throw new Error("Unexpected particle word dimensions");
  }
  const positions = new Float32Array(count / stride * 3);
  const normals = new Float32Array(positions.length);
  for (let i = 0, n = 0; i < count; i += stride, n += 3) {
    for (let k = 0; k < 3; k++) {
      positions[n + k] = view.getInt16(16 + i * 9 + k * 2, true) / scale;
      normals[n + k] = view.getInt8(22 + i * 9 + k) / 127;
    }
  }
  return { positions, normals };
}

/** A spring-bound point volume. Movement carries grains sideways and through
 * their depth; it never pushes them radially away from a cursor-sized hole. */
export class ParticleWord {
  readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly compute: GPUComputationRenderer;
  private readonly velocity;
  private readonly position;
  private readonly rest: THREE.DataTexture;
  private readonly inverse = new THREE.Matrix4();
  private readonly localRay = new THREE.Ray();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly hit = new THREE.Vector3();
  private readonly lastHit = new THREE.Vector3();
  private readonly flow = new THREE.Vector2();
  private readonly trails = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector4(100, 100, 0, 0));
  private readonly flows = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector2());
  private readonly pointer = new THREE.Vector3(100, 100, 0);
  private readonly uniforms;
  private lastTouch = false;
  private slot = 0;
  private lastEmission = -1;
  private energy = 0;
  private readonly occupied = new Set<string>();

  constructor(renderer: THREE.WebGLRenderer, buffer: ArrayBuffer, compact: boolean) {
    const data = decodeParticleWord(buffer, compact ? 4 : 1);
    const count = data.positions.length / 3, size = Math.sqrt(count);
    this.compute = new GPUComputationRenderer(size, size, renderer);
    this.compute.setDataType(THREE.HalfFloatType);
    this.rest = this.compute.createTexture();
    const restData = this.rest.image.data;
    if (!restData) throw new Error("Particle texture allocation failed");
    const velocityData = this.compute.createTexture();
    const lookup = new Float32Array(count * 2), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const seed = ((Math.imul(i + 13, 1664525) + 1013904223) >>> 0) / 4294967296;
      for (let k = 0; k < 3; k++) restData[i * 4 + k] = data.positions[i * 3 + k];
      restData[i * 4 + 3] = seed;
      seeds[i] = seed;
      lookup[i * 2] = (i % size + 0.5) / size;
      lookup[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
      this.occupied.add(`${Math.round(data.positions[i * 3] / 0.09)},${Math.round(data.positions[i * 3 + 1] / 0.09)}`);
    }
    this.uniforms = {
      uRest: { value: this.rest }, uDt: { value: 0 }, uTime: { value: 0 },
      uTouch: { value: 0 }, uPointer: { value: this.pointer },
      uTrail: { value: this.trails }, uFlow: { value: this.flows },
    };
    this.velocity = this.compute.addVariable("textureVelocity", velocityShader, velocityData);
    this.position = this.compute.addVariable("texturePosition", positionShader, this.rest);
    for (const variable of [this.position, this.velocity]) {
      this.compute.setVariableDependencies(variable, [this.position, this.velocity]);
      Object.assign(variable.material.uniforms, this.uniforms);
    }
    const error = this.compute.init();
    if (error) { this.compute.dispose(); throw new Error(error); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute("lookup", new THREE.BufferAttribute(lookup, 2));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: this.compute.getCurrentRenderTarget(this.position).texture },
        uVelocity: { value: this.compute.getCurrentRenderTarget(this.velocity).texture },
        uSize: { value: 11 }, uTime: { value: 0 },
      },
      vertexShader: `
        attribute vec2 lookup; attribute float seed;
        uniform sampler2D uPosition, uVelocity;
        uniform float uSize, uTime;
        varying vec3 vNormal, vView, vLocal;
        varying float vHeat, vSeed, vGlint;
        void main() {
          vec3 p = texture2D(uPosition, lookup).xyz;
          vec4 v = texture2D(uVelocity, lookup);
          vNormal = normalize(normalMatrix * normalize(normal + cross(v.xyz, normal) * .14));
          vHeat = v.w; vSeed = seed; vLocal = p;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * (.80 + seed * .45) * projectionMatrix[1][1] / max(1.0, -mv.z), 1.0, 4.0);
          vGlint = pow(max(0.0, sin(uTime * (.6 + seed * .8) + seed * 117.0)), 24.0);
          vGlint *= .45 + .55 * pow(.5 + .5 * sin(p.x * 2.1 - p.y * 3.0 + uTime * .45), 2.0);
          vGlint = min(1.0, vGlint + v.w * .8);
          #ifdef GLINT_PASS
            gl_PointSize = clamp(gl_PointSize * (3.0 + vGlint * 3.0), 3.0, 15.0);
          #endif
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal, vView, vLocal;
        varying float vHeat, vSeed, vGlint;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float r = dot(q, q);
          #ifdef GLINT_PASS
            float core = exp(-r * 38.0);
            float halo = exp(-r * 7.0) * .13;
            float rays = exp(-abs(q.x) * 42.0 - abs(q.y) * 6.0)
                       + exp(-abs(q.y) * 42.0 - abs(q.x) * 6.0);
            float alpha = (core + halo + rays * .15) * vGlint * .70;
            if (alpha < .01) discard;
            gl_FragColor = vec4(.9, .96, 1.0, alpha);
            return;
          #endif
          float coverage = 1.0 - smoothstep(.55, 1.0, r);
          if (coverage < .03) discard;
          vec3 grain = vec3(q.x, -q.y, sqrt(max(0.0, 1.0-r)));
          vec3 facet = vec3(cos(vSeed * 91.0), sin(vSeed * 137.0), 0.0);
          vec3 n = normalize(vNormal * .78 + grain * .16 + facet * .09);
          vec3 light = normalize(vec3(-.45 + sin(uTime * .27) * .16, .8, 1.3));
          float diffuse = max(0.0, dot(n, light));
          float reflection = max(0.0, dot(n, normalize(light + vView)));
          float edge = pow(1.0-abs(dot(n, vView)), 2.0);
          vec3 reflected = reflect(-vView, n);
          float studio = pow(.5 + .5 * sin(reflected.y * 11.0 + reflected.x * 2.5 + uTime * .16), 5.0);
          vec3 color = vec3(.025, .045, .07) + vec3(.09,.12,.16)*diffuse;
          color += vec3(.44,.50,.57)*studio + vec3(.70,.78,.86)*pow(reflection, 58.0);
          color += vec3(.12,.18,.23)*edge;
          color *= .78 + vSeed * .40;
          float motion = smoothstep(.04, .72, vHeat);
          float ribbon = .75+.25*sin(dot(vLocal, vec3(3.1, -2.0, 2.7))-uTime*1.2);
          color = mix(color, vec3(.75,.9,1.0), motion*.82*ribbon);
          color += vec3(.36,.46,.58)*pow(motion, 3.0)*pow(reflection, 9.0);
          gl_FragColor = vec4(color, coverage * .93);
        }
      `,
      transparent: true, depthWrite: true, depthTest: true, toneMapped: false,
    });
    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;
    // A sparse second draw gives selected grains a small optical halo without
    // making every particle larger or blurring the word's silhouette.
    const glintGeometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "lookup", "seed"]) {
      const source = geometry.getAttribute(name);
      const values = new Float32Array(Math.ceil(count / 32) * source.itemSize);
      for (let i = 0, n = 0; i < count; i += 32) {
        for (let k = 0; k < source.itemSize; k++) values[n++] = source.array[i * source.itemSize + k];
      }
      glintGeometry.setAttribute(name, new THREE.BufferAttribute(values, source.itemSize));
    }
    const glintMaterial = new THREE.ShaderMaterial({
      uniforms: material.uniforms, vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
      defines: { GLINT_PASS: true }, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.glints = new THREE.Points(glintGeometry, glintMaterial);
    this.glints.frustumCulled = false;
    this.glints.renderOrder = 3;
    this.mesh.add(this.glints);
  }

  update(dt: number, time: number, ray: THREE.Ray, touch: boolean, pixelHeight: number, compact: boolean) {
    const h = THREE.MathUtils.clamp(dt, 0, 1 / 30);
    this.mesh.updateWorldMatrix(true, false);
    this.inverse.copy(this.mesh.matrixWorld).invert();
    this.localRay.copy(ray).applyMatrix4(this.inverse);
    const hasHit = touch && this.localRay.intersectPlane(this.plane, this.hit) !== null;
    let contact = false;
    this.flow.set(0, 0);
    if (hasHit) {
      this.pointer.copy(this.hit);
      const x = Math.round(this.hit.x / .09), y = Math.round(this.hit.y / .09);
      contact = this.occupied.has(`${x},${y}`);
      if (this.lastTouch) {
        this.flow.set(this.hit.x-this.lastHit.x, this.hit.y-this.lastHit.y).divideScalar(Math.max(h, .008)).clampLength(0, 4);
      }
      this.lastHit.copy(this.hit);
      if (this.flow.lengthSq() > .012 && time - this.lastEmission > .032) {
        this.trails[this.slot].set(this.hit.x, this.hit.y, .72, 0);
        this.flows[this.slot].copy(this.flow);
        this.slot = (this.slot + 1) % TRAIL_COUNT;
        this.lastEmission = time;
      }
    } else this.pointer.set(100, 100, 0);
    this.lastTouch = hasHit;
    for (const trail of this.trails) trail.z *= Math.exp(-h * 4.2);
    this.energy = Math.max(this.energy * Math.exp(-h * 3.2), contact ? Math.min(1, this.flow.length() * .35) : 0);
    this.uniforms.uDt.value = h;
    this.uniforms.uTime.value = time;
    this.uniforms.uTouch.value = hasHit ? 1 : 0;
    this.compute.compute();
    const uniforms = this.mesh.material.uniforms;
    uniforms.uPosition.value = this.compute.getCurrentRenderTarget(this.position).texture;
    uniforms.uVelocity.value = this.compute.getCurrentRenderTarget(this.velocity).texture;
    uniforms.uTime.value = time;
    uniforms.uSize.value = pixelHeight * (compact ? .011 : .0075);
    return { contact, energy: this.energy };
  }

  dispose() {
    this.compute.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.glints.geometry.dispose();
    this.glints.material.dispose();
  }
}
