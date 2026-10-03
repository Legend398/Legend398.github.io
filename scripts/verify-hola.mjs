import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const bytes=readFileSync(resolve(root,"public/model/hola.glb"));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.ok(bytes.length<1_000_000,"Keep the hero model below 1 MB");
const jsonLength=bytes.readUInt32LE(12);
const model=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
assert.equal(model.asset.extras.text,"hola");
assert.equal(model.meshes.length,1);
assert.ok(!model.buffers.some(buffer=>buffer.uri),"The model must have no external dependencies");
const binaryStart=28+jsonLength;
function accessor(index) {
  const a=model.accessors[index],v=model.bufferViews[a.bufferView];
  const Type=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;
  const data=bytes.subarray(binaryStart+v.byteOffset,binaryStart+v.byteOffset+v.byteLength);
  return new Type(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
}
const positions=accessor(0),normals=accessor(1),indices=accessor(2);
assert.equal(positions.length,normals.length);
for(let i=0;i<positions.length;i+=3) {
  assert.ok(Number.isFinite(positions[i])&&Number.isFinite(positions[i+1])&&Number.isFinite(positions[i+2]));
  const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);
  assert.ok(Math.abs(length-1)<0.002,"Surface normals must be finite unit vectors");
}
const edges=new Map();
const parents=Uint32Array.from({length:positions.length/3},(_,i)=>i);
function parent(i) {
  while(parents[i]!==i) { parents[i]=parents[parents[i]];i=parents[i]; }
  return i;
}
let volume=0;
let invertedArea=0, surfaceArea=0;
for(let i=0;i<indices.length;i+=3) {
  const triangle=[indices[i],indices[i+1],indices[i+2]];
  assert.equal(new Set(triangle).size,3,"No degenerate triangles");
  for(let e=0;e<3;e++) {
    const a=triangle[e],b=triangle[(e+1)%3];
    assert.ok(a<positions.length/3);
    const key=a<b?`${a}/${b}`:`${b}/${a}`;
    edges.set(key,(edges.get(key)??0)+1);
    parents[parent(a)]=parent(b);
  }
  const a=triangle[0]*3,b=triangle[1]*3,c=triangle[2]*3;
  const u=[0,1,2].map(k=>positions[b+k]-positions[a+k]);
  const v=[0,1,2].map(k=>positions[c+k]-positions[a+k]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const area=Math.hypot(...cross)*0.5;
  surfaceArea+=area;
  if(cross.reduce((sum,value,k)=>sum+value*(normals[a+k]+normals[b+k]+normals[c+k]),0)<0) invertedArea+=area;
  volume+=positions[a]*(positions[b+1]*positions[c+2]-positions[b+2]*positions[c+1])
    +positions[a+1]*(positions[b+2]*positions[c]-positions[b]*positions[c+2])
    +positions[a+2]*(positions[b]*positions[c+1]-positions[b+1]*positions[c]);
}
assert.ok([...edges.values()].every(count=>count===2),"The glass surface must be watertight");
assert.equal(new Set(Array.from(parents,(_,i)=>parent(i))).size,6,"Keep the letter bowls and connecting strokes independently rounded");
assert.equal(positions.length/3-edges.size+indices.length/3,8,"Four capped strokes and two closed letter bowls must remain watertight");
assert.ok(volume>0,"The faces must point outwards");
assert.ok(invertedArea/surfaceArea<1e-7,"Rounded bends must not fold the tube surface inside out");
assert.ok(!existsSync(resolve(root,"public/model/hello.gltf")),"The imported asset must not ship");
for(const file of ["app/page.tsx","components/GlassWordScene.tsx"]) {
  assert.ok(!/hello\.gltf|haoqi|CleanroomHello|SCULPTED_WORD_PATH/.test(readFileSync(resolve(root,file),"utf8")),`${file} references the retired asset`);
}
console.log(`hola verified: ${indices.length/3} triangles, watertight surface, unit normals, ${(bytes.length/1024).toFixed(0)} KiB, no retired asset dependency.`);
