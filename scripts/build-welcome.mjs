// Rebuild the portfolio sculpture from the bundled OFL typeface. No reference
// model is an input. Run with `node scripts/build-welcome.mjs`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../node_modules/three-stdlib/libs/opentype.js";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { MeshoptSimplifier } from "three/examples/jsm/libs/meshopt_simplifier.module.js";

const root = resolve(import.meta.dirname, "..");
const fontBytes = readFileSync(resolve(import.meta.dirname, "assets/Pacifico-Regular.ttf"));
const font = parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const outline = font.getPath("Welcome", 0, 0, 1000);
const bounds = outline.getBoundingBox();
const width = 1000;
const margin = 8;
const scale = (width - margin * 2) / (bounds.x2 - bounds.x1);
const height = Math.ceil((bounds.y2 - bounds.y1) * scale + margin * 2);
const mask = new Uint8Array(width * height);

// Rasterize each glyph separately with an even-odd scanline fill, then union.
// That removes joins between connected letters before sculpting the surface.
font.forEachGlyph("Welcome", 0, 0, 1000, {}, (glyph, x, y, size) => {
  const paths = [];
  let points = [];
  let from;
  const add = (x, y) => {
    points.push([(x - bounds.x1) * scale + margin, (y - bounds.y1) * scale + margin]);
    from = { x, y };
  };
  for (const c of glyph.getPath(x, y, size).commands) {
    if (c.type === "M") { if (points.length) paths.push(points); points = []; add(c.x, c.y); }
    if (c.type === "L") add(c.x, c.y);
    if (c.type === "Q" || c.type === "C") {
      const p = from;
      for (let i = 1; i <= 32; i++) {
        const t = i / 32, s = 1 - t;
        if (c.type === "Q") add(s*s*p.x + 2*s*t*c.x1 + t*t*c.x, s*s*p.y + 2*s*t*c.y1 + t*t*c.y);
        else add(s*s*s*p.x + 3*s*s*t*c.x1 + 3*s*t*t*c.x2 + t*t*t*c.x, s*s*s*p.y + 3*s*s*t*c.y1 + 3*s*t*t*c.y2 + t*t*t*c.y);
      }
    }
    if (c.type === "Z") { paths.push(points); points = []; }
  }
  if (points.length) paths.push(points);
  for (let row = 0; row < height; row++) {
    const hits = [];
    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length];
        if ((a[1] > row) !== (b[1] > row)) hits.push(a[0] + (row - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      for (let col = Math.ceil(hits[i]); col <= Math.floor(hits[i + 1]); col++) mask[row * width + col] = 1;
    }
  }
});

// Exact Euclidean distance, rather than diagonal approximations that leave
// ridges in specular highlights. A small smoothing pass softens the medial seam.
const distance = new Float32Array(mask.length);
function distance1D(values) {
  const n=values.length, sites=new Int32Array(n), boundaries=new Float64Array(n+1), result=new Float64Array(n);
  let k=0; boundaries[0]=-Infinity; boundaries[1]=Infinity;
  for(let q=1;q<n;q++) {
    let s=((values[q]+q*q)-(values[sites[k]]+sites[k]*sites[k]))/(2*q-2*sites[k]);
    while(s<=boundaries[k]) { k--;s=((values[q]+q*q)-(values[sites[k]]+sites[k]*sites[k]))/(2*q-2*sites[k]); }
    sites[++k]=q; boundaries[k]=s; boundaries[k+1]=Infinity;
  }
  k=0;
  for(let q=0;q<n;q++) { while(boundaries[k+1]<q) k++;result[q]=(q-sites[k])**2+values[sites[k]]; }
  return result;
}
for(let y=0;y<height;y++) distance.set(distance1D(Array.from(mask.slice(y*width,(y+1)*width),v=>v?1e12:0)),y*width);
for(let x=0;x<width;x++) {
  const column=distance1D(Array.from({length:height},(_,y)=>distance[y*width+x]));
  for(let y=0;y<height;y++) distance[y*width+x]=Math.sqrt(column[y]);
}
for (let pass = 0; pass < 24; pass++) {
  const previous = distance.slice();
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (distance[i] > 2) distance[i] = (previous[i]*4 + previous[i-1] + previous[i+1] + previous[i-width] + previous[i+width]) / 8;
  }
}

const positions = [], indices = [], cache = new Map();
const worldScale = 6.35 / (width - 2 * margin);
const maxDistance = distance.reduce((a, b) => Math.max(a, b), 0);
function vertex(point, back) {
  const key = `${point.id}:${point.d === 0 ? "edge" : back ? "back" : "front"}`;
  if (cache.has(key)) return cache.get(key);
  const radius = Math.min(1, point.d / (maxDistance * 1.05));
  const z = 0.30 * Math.sqrt(Math.max(0, 2*radius - radius*radius));
  const index = positions.length / 3;
  positions.push((point.x - width/2)*worldScale, (height/2 - point.y)*worldScale*1.24, (back ? -1 : 1)*z);
  cache.set(key, index);
  return index;
}
function gridPoint(x, y) {
  const id = y*width+x;
  return { x, y, id: String(id), d: mask[id] ? Math.max(0.05, distance[id] - 0.5) : -0.5 };
}
function triangle(points) {
  const polygon = [];
  for (let i = 0; i < 3; i++) {
    const a = points[i], b = points[(i+1)%3];
    if (a.d >= 0) polygon.push(a);
    if ((a.d >= 0) !== (b.d >= 0)) {
      const t = a.d/(a.d-b.d);
      polygon.push({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, d:0, id:[a.id,b.id].sort().join("/") });
    }
  }
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(vertex(polygon[0],false),vertex(polygon[i+1],false),vertex(polygon[i],false));
    indices.push(vertex(polygon[0],true),vertex(polygon[i],true),vertex(polygon[i+1],true));
  }
}
for (let y = 0; y < height-1; y++) for (let x = 0; x < width-1; x++) {
  const a=gridPoint(x,y),b=gridPoint(x+1,y),c=gridPoint(x,y+1),d=gridPoint(x+1,y+1);
  if (Math.max(a.d,b.d,c.d,d.d)<0) continue;
  triangle([a,b,c]); triangle([b,d,c]);
}
const geometry = new BufferGeometry();
const positionArray = new Float32Array(positions);
const neighbors = Array.from({length:positions.length/3},()=>new Set());
for(let i=0;i<indices.length;i+=3) {
  const [a,b,c]=indices.slice(i,i+3);
  neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);
}
// Non-shrinking smoothing rounds the raster contour without thinning letters.
for(let pass=0;pass<12;pass++) {
  const previous=positionArray.slice(), factor=pass%2 ? -0.53 : 0.5;
  for(let i=0;i<neighbors.length;i++) for(let axis=0;axis<3;axis++) {
    let sum=0; for(const j of neighbors[i]) sum+=previous[j*3+axis];
    positionArray[i*3+axis]+=factor*(sum/neighbors[i].size-previous[i*3+axis]);
  }
}
geometry.setAttribute("position", new Float32BufferAttribute(positionArray,3));
geometry.setIndex(indices);
geometry.computeVertexNormals();
await MeshoptSimplifier.ready;
const [simplified,error] = MeshoptSimplifier.simplifyWithAttributes(
  Uint32Array.from(indices),positionArray,3,geometry.attributes.normal.array,3,
  [0.1,0.1,0.1],null,120000,0.0015,
);
const [remap, vertexCount]=MeshoptSimplifier.compactMesh(simplified);
const compactPositions=new Float32Array(vertexCount*3), compactNormals=new Float32Array(vertexCount*3);
for(let i=0;i<remap.length;i++) if(remap[i]!==0xffffffff) {
  compactPositions.set(positionArray.subarray(i*3,i*3+3),remap[i]*3);
  compactNormals.set(geometry.attributes.normal.array.subarray(i*3,i*3+3),remap[i]*3);
}
geometry.setAttribute("position",new Float32BufferAttribute(compactPositions,3));
geometry.setAttribute("normal",new Float32BufferAttribute(compactNormals,3));
geometry.setIndex(Array.from(simplified));
geometry.center();
geometry.computeBoundingBox();
const arrays = [geometry.attributes.position.array, geometry.attributes.normal.array, geometry.index.array];
const views = [];
let byteOffset = 0;
const binary = Buffer.concat(arrays.map((array) => {
  const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
  views.push({buffer:0,byteOffset,byteLength:data.length});
  byteOffset+=data.length;
  return data;
}));
const gltf = {
  asset:{version:"2.0",generator:"Himanshu portfolio / build-welcome.mjs",extras:{text:"Welcome",lettering:"Pacifico, SIL OFL 1.1",surface:"Original rounded distance-field sculpture"}},
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"Welcome"}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],
  buffers:[{byteLength:binary.length}],bufferViews:views,
  accessors:[
    {bufferView:0,componentType:5126,count:arrays[0].length/3,type:"VEC3",min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},
    {bufferView:1,componentType:5126,count:arrays[1].length/3,type:"VEC3"},
    {bufferView:2,componentType:arrays[2] instanceof Uint32Array?5125:5123,count:arrays[2].length,type:"SCALAR"},
  ],
};
let json=Buffer.from(JSON.stringify(gltf));
json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20); header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
mkdirSync(resolve(root,"public/model"),{recursive:true});
writeFileSync(resolve(root,"public/model/welcome.glb"),Buffer.concat([header,json,binHeader,binary]));
const path=outline.toPathData(2);
const viewBox=`${bounds.x1-20} ${bounds.y1-20} ${bounds.x2-bounds.x1+40} ${bounds.y2-bounds.y1+40}`;
writeFileSync(resolve(root,"components/hero/WelcomePath.ts"),`// Generated by scripts/build-welcome.mjs from Pacifico (SIL OFL 1.1).\nexport const WELCOME_VIEWBOX = ${JSON.stringify(viewBox)};\nexport const WELCOME_PATH = ${JSON.stringify(path)};\n`);
console.log(JSON.stringify({vertices:arrays[0].length/3,triangles:simplified.length/3,error,bytes:28+json.length+binary.length,bounds:geometry.boundingBox,viewBox}));
