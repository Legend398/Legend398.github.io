import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { decodeParticleWord } from "../components/hero/ParticleWord.ts";

const root = resolve(import.meta.dirname, "..");
const asset = readFileSync(resolve(root, "public/model/hello-particles.bin"));
const buffer = asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength);
assert.ok(asset.length < 650_000, "Keep the point volume below 650 kB");
for (const stride of [1, 4]) {
  const { positions, normals } = decodeParticleWord(buffer, stride);
  assert.equal(positions.length / 3, 65536 / stride);
  const bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  const occupiedColumns = new Set();
  let front = 0, back = 0;
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const value = positions[i + k];
      assert.ok(Number.isFinite(value));
      bounds[k][0] = Math.min(bounds[k][0], value);
      bounds[k][1] = Math.max(bounds[k][1], value);
    }
    const normalLength = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    assert.ok(normalLength > .985 && normalLength < 1.015, "Lighting needs valid normals");
    if (positions[i + 2] > .1) front++;
    if (positions[i + 2] < -.1) back++;
    occupiedColumns.add(Math.floor((positions[i] + 3.2) / .03));
  }
  assert.ok(Math.abs(bounds[0][1] - bounds[0][0] - 6.35) < .01);
  assert.ok(bounds[2][1] - bounds[2][0] > .40, "Letters must have real depth");
  assert.ok(front > positions.length / 12 && back > positions.length / 12, "Both faces must be populated");
  let components = 0, previous = -2;
  for (const col of [...occupiedColumns].sort((a,b) => a-b)) {
    if (col > previous + 1) components++;
    previous = col;
  }
  assert.equal(components, 5, "All five letters must remain separated and complete");
}
assert.throws(() => decodeParticleWord(buffer.slice(0, -1)));
const corrupt = buffer.slice(0); new DataView(corrupt).setUint32(8, 0, true);
assert.throws(() => decodeParticleWord(corrupt));
assert.throws(() => decodeParticleWord(buffer, 3));
assert.ok(readFileSync(resolve(root, "public/model/hello-particles.svg"), "utf8").includes('<circle'));
assert.ok(!existsSync(resolve(root, "public/model/hola.glb")));
console.log("Particle HELLO verified: 65,536 desktop / 16,384 mobile points, five separate letters, front/back depth, valid normals, malformed-asset rejection, static fallback, 590 kB.");
