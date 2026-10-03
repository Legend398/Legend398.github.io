import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Mesh, Vector3 } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const root = resolve(import.meta.dirname, "..");
const font = new FontLoader().parse(JSON.parse(readFileSync(resolve(root, "public/fonts/helvetiker_bold.typeface.json"), "utf8")));
let advance = 0;
const letters = [..."HELLO"].map(letter => {
  const shape = new TextGeometry(letter, {
    font, size: 1, depth: 0.24, curveSegments: 18,
    bevelEnabled: true, bevelThickness: 0.048, bevelSize: 0.036, bevelSegments: 5,
  });
  shape.translate(advance, 0, 0);
  advance += font.data.glyphs[letter].ha / font.data.resolution + .075;
  return shape;
});
const geometry = mergeGeometries(letters);
letters.forEach(letter => letter.dispose());
geometry.center();
geometry.computeBoundingBox();
const scale = 6.35 / (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
geometry.scale(scale, scale * 1.17, scale);
geometry.computeBoundingBox();

let seed = 417091;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const sampler = new MeshSurfaceSampler(new Mesh(geometry)).setRandomGenerator(random).build();
const count = 256 * 256;
// Little endian: magic, version, count, coordinate scale, then xyz Int16 + normal xyz Int8.
const data = Buffer.alloc(16 + count * 9);
data.write("HPCL"); data.writeUInt32LE(1, 4); data.writeUInt32LE(count, 8); data.writeFloatLE(8192, 12);
const p = new Vector3(), n = new Vector3();
const fallback = [];
for (let i = 0; i < count; i++) {
  sampler.sample(p, n);
  // A fifth of the grains occupy the interior, making cursor movement reveal depth.
  if (random() < 0.20) p.z *= random();
  for (let k = 0; k < 3; k++) {
    data.writeInt16LE(Math.round(p.getComponent(k) * 8192), 16 + i * 9 + k * 2);
    data.writeInt8(Math.round(n.getComponent(k) * 127), 22 + i * 9 + k);
  }
  if (i % 7 === 0 && p.z > -0.04) {
    fallback.push(`<circle cx="${(p.x * 160 + 528).toFixed(1)}" cy="${(182 - p.y * 160).toFixed(1)}" r="${(0.60 + random() * 0.52).toFixed(2)}"/>`);
  }
}
mkdirSync(resolve(root, "public/model"), { recursive: true });
writeFileSync(resolve(root, "public/model/hello-particles.bin"), data);
writeFileSync(resolve(root, "public/model/hello-particles.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1056 364" role="img" aria-label="Hello"><g fill="#17405b" opacity=".85">${fallback.join("")}</g></svg>\n`);
geometry.dispose();
console.log(`HELLO: ${count.toLocaleString()} volumetric particles, ${data.length.toLocaleString()} bytes, licensed Helvetiker lettering.`);
