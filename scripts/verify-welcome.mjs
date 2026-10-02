import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bytes = readFileSync(resolve(root, "public/model/welcome.glb"));
assert.equal(bytes.readUInt32LE(0), 0x46546c67, "Expected a GLB container");
assert.equal(bytes.readUInt32LE(4), 2, "Expected glTF 2.0");
assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB length mismatch");
const jsonLength = bytes.readUInt32LE(12);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binOffset = 20 + jsonLength;
assert.equal(bytes.readUInt32LE(binOffset + 4), 0x004e4942);
assert.equal(bytes.readUInt32LE(binOffset) + binOffset + 8, bytes.length);
const binary = bytes.subarray(binOffset + 8);
assert.equal(gltf.asset.extras.text, "Welcome");
assert.equal(gltf.buffers.length, 1);
assert.equal(gltf.buffers[0].byteLength, binary.length);
assert.equal(gltf.buffers[0].uri, undefined, "Model must be self-contained");
assert.equal(gltf.meshes.length, 1);
assert.equal(gltf.meshes[0].primitives.length, 1);
assert.equal(gltf.images, undefined, "Welcome should not need external textures");

function accessor(index) {
  const entry = gltf.accessors[index];
  const view = gltf.bufferViews[entry.bufferView];
  const size = entry.componentType === 5123 ? 2 : 4;
  const components = entry.type === "VEC3" ? 3 : 1;
  const start = (view.byteOffset ?? 0) + (entry.byteOffset ?? 0);
  assert.equal(start % 4, 0, "Vertex/index data must be aligned");
  assert.ok(start + entry.count * size * components <= binary.length);
  const values = [];
  for (let i = 0; i < entry.count * components; i++) {
    const offset = start + i * size;
    values.push(entry.componentType === 5126 ? binary.readFloatLE(offset)
      : size === 2 ? binary.readUInt16LE(offset) : binary.readUInt32LE(offset));
  }
  assert.ok(values.every(Number.isFinite), "No non-finite mesh values");
  return { entry, values };
}

const primitive = gltf.meshes[0].primitives[0];
const positions = accessor(primitive.attributes.POSITION);
const normals = accessor(primitive.attributes.NORMAL);
const indices = accessor(primitive.indices);
assert.equal(positions.entry.count, normals.entry.count);
assert.equal(indices.entry.count % 3, 0);
assert.ok(positions.entry.count > 1000 && positions.entry.count < 50_000);
assert.ok(indices.values.every((index) => index >= 0 && index < positions.entry.count));
assert.ok(bytes.length < 1_000_000, "Keep the sculpture below 1 MB");
for (let i = 0; i < normals.values.length; i += 3) {
  assert.ok(Math.abs(Math.hypot(...normals.values.slice(i, i + 3)) - 1) < 0.01, "Normals must be unit length");
}
for (let axis = 0; axis < 3; axis++) {
  const values = positions.values.filter((_, index) => index % 3 === axis);
  assert.ok(Math.abs(Math.min(...values) - positions.entry.min[axis]) < 0.00001);
  assert.ok(Math.abs(Math.max(...values) - positions.entry.max[axis]) < 0.00001);
}
const edges = new Map();
for (let i = 0; i < indices.values.length; i += 3) {
  const triangle = indices.values.slice(i, i + 3);
  assert.equal(new Set(triangle).size, 3, "No collapsed triangles");
  for (let j = 0; j < 3; j++) {
    const edge = [triangle[j], triangle[(j + 1) % 3]].sort((a, b) => a - b).join(":");
    edges.set(edge, (edges.get(edge) ?? 0) + 1);
  }
}
assert.ok([...edges.values()].every((count) => count >= 2), "Sculpture must have no open boundary edges");
const sharedContourEdges = [...edges.values()].filter((count) => count > 2).length;

const font = readFileSync(resolve(root, "scripts/assets/Pacifico-Regular.ttf"));
assert.equal(createHash("sha256").update(font).digest("hex"), "5b6c0d5334a7bf77dea52b975c5a0c408878c0f7115ed5b6fb151f634b7bf701");
const license = readFileSync(resolve(root, "scripts/assets/Pacifico-OFL.txt"), "utf8");
assert.ok(license.includes("Copyright 2018 The Pacifico Project Authors"));
assert.ok(license.includes("SIL OPEN FONT LICENSE Version 1.1"));
const fallback = readFileSync(resolve(root, "components/hero/WelcomePath.ts"), "utf8");
assert.ok(fallback.includes('WELCOME_VIEWBOX = "101 -960 3940 985"'));
assert.ok(fallback.includes('WELCOME_PATH = "M'));
assert.ok(!existsSync(resolve(root, "public/model/hello.gltf")), "Borrowed asset must be absent");
function verifyNoBorrowedRequest(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) verifyNoBorrowedRequest(path);
    else if (/\.(tsx?|css)$/.test(path)) {
      assert.ok(!readFileSync(path, "utf8").includes("/model/hello.gltf"), `Old model request in ${path}`);
    }
  }
}
verifyNoBorrowedRequest(resolve(root, "app"));
verifyNoBorrowedRequest(resolve(root, "components"));
console.log(`Welcome verified: ${positions.entry.count} vertices, ${indices.entry.count / 3} triangles, ${bytes.length} bytes; no open boundaries (${sharedContourEdges} shared contour join), finite normals, bundled font/license and matching fallback present.`);
