// Original hand-drawn lettering. This build uses only the curves below; no font,
// downloaded model, or external outline is an input. Run: node scripts/build-hola.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";
import { MeshoptSimplifier } from "three/examples/jsm/libs/meshopt_simplifier.module.js";

const root = resolve(import.meta.dirname, "..");
// Each cubic ends with its stroke radius. Tangent continuity, open counters,
// and gently varying pressure are authored before making the solid surface.
const strokes = [
  {
    start: [0.22, 0.75, 0.15],
    curves: [
      [0.40, 1.11, 0.61, 1.47, 1.03, 2.35, 0.16],
      [1.32, 2.97, 0.98, 3.21, 0.65, 2.88, 0.22],
      [0.31, 2.54, 0.24, 1.30, 0.14, 0.25, 0.25],
      [0.23, 0.81, 0.63, 1.43, 1.02, 1.40, 0.23],
      [1.55, 1.36, 1.43, 0.67, 1.31, 0.28, 0.24],
      [1.20, -0.08, 1.63, 0.04, 1.98, 0.53, 0.16],
    ],
  },
  {
    start: [2.85, 1.35, 0.22],
    curves: [
      [2.39, 1.73, 1.94, 1.37, 1.89, 0.72, 0.25],
      [1.84, 0.11, 2.19, -0.08, 2.60, 0.19, 0.24],
      [2.97, 0.43, 3.14, 1.11, 2.85, 1.35, 0.22],
    ],
  },
  {
    start: [2.85, 1.35, 0.16],
    curves: [
      [3.26, 1.05, 3.87, 1.86, 4.14, 2.58, 0.16],
      [4.38, 3.22, 3.90, 3.24, 3.62, 2.80, 0.22],
      [3.27, 2.25, 3.31, 1.09, 3.37, 0.53, 0.26],
      [3.45, -0.17, 4.02, 0.01, 4.48, 0.56, 0.16],
    ],
  },
  {
    start: [5.44, 1.35, 0.22],
    curves: [
      [4.99, 1.74, 4.48, 1.34, 4.45, 0.70, 0.25],
      [4.41, 0.15, 4.68, -0.07, 5.04, 0.15, 0.24],
      [5.43, 0.40, 5.71, 1.12, 5.44, 1.35, 0.22],
    ],
  },
  {
    start: [5.66, 1.48, 0.21],
    curves: [
      [5.54, 1.11, 5.40, 0.62, 5.43, 0.33, 0.23],
      [5.48, -0.07, 5.82, 0.12, 6.13, 0.43, 0.18],
      [6.43, 0.73, 6.58, 0.97, 6.78, 1.10, 0.12],
    ],
  },
];

const step = 0.0175;
const origin = [-0.75, -0.48, -1.20];
const size = [Math.ceil(8.1 / step), Math.ceil(3.25 / step), Math.ceil(2.4 / step)];
const [nx, ny, nz] = size;
const plane = nx * ny;
let field = new Float32Array(plane * nz).fill(-0.4);
const depth = 1.22;
const samples = [];
for (const stroke of strokes) {
  let [ax, ay, ar] = stroke.start;
  let previous;
  for (const [bx, by, cx, cy, dx, dy, dr] of stroke.curves) {
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, s = 1 - t;
      const point = [
        s*s*s*ax + 3*s*s*t*bx + 3*s*t*t*cx + t*t*t*dx,
        (s*s*s*ay + 3*s*s*t*by + 3*s*t*t*cy + t*t*t*dy) * 0.74,
        ar + (dr - ar) * t*t*(3 - 2*t),
      ];
      // Gently bend the pen's path in depth. Each stroke keeps a rounded cross
      // section instead of becoming a long, flat extrusion behind an outline.
      point.push(0.10*(point[0]-3.3) + 0.12*Math.sin(point[0]*1.3)
        - 0.20*point[1] + 0.06*Math.sin(point[1]*2 + point[0]*1.5));
      if (previous && i > 0) samples.push([previous, point]);
      previous = point;
    }
    [ax, ay, ar] = [dx, dy, dr];
  }
}

// Swept elliptical solids: nearby strokes merge in the volume, so there are no
// interpenetrating tube surfaces or exposed end caps at a letter connection.
for (const [a, b] of samples) {
  const radius = Math.max(a[2], b[2]) + 0.11;
  const from = [
    Math.max(1, Math.floor((Math.min(a[0], b[0]) - radius - origin[0]) / step)),
    Math.max(1, Math.floor((Math.min(a[1], b[1]) - radius - origin[1]) / step)),
    Math.max(1, Math.floor((Math.min(a[3],b[3])-radius * depth - origin[2]) / step)),
  ];
  const to = [
    Math.min(nx - 2, Math.ceil((Math.max(a[0], b[0]) + radius - origin[0]) / step)),
    Math.min(ny - 2, Math.ceil((Math.max(a[1], b[1]) + radius - origin[1]) / step)),
    Math.min(nz - 2, Math.ceil((Math.max(a[3],b[3])+radius * depth - origin[2]) / step)),
  ];
  const vx = b[0] - a[0], vy = b[1] - a[1], vz=(b[3]-a[3])/depth;
  const length2 = vx*vx + vy*vy + vz*vz;
  for (let y = from[1]; y <= to[1]; y++) for (let x = from[0]; x <= to[0]; x++) {
    const px = origin[0] + x*step - a[0], py = origin[1] + y*step - a[1];
    for (let z = from[2]; z <= to[2]; z++) {
      const pz=(origin[2]+z*step-a[3])/depth;
      const t = Math.max(0, Math.min(1, (px*vx + py*vy + pz*vz) / length2));
      const d2 = (px - t*vx)**2 + (py - t*vy)**2 + (pz - t*vz)**2;
      const r = a[2] + (b[2] - a[2])*t;
      const i = z*plane + y*nx + x;
      const f = r - Math.sqrt(d2);
      if (f > field[i]) field[i] = f;
    }
  }
}
// Smooth the entire union rather than smoothing each letter independently.
// This gently blends junctions and gives continuous, broad specular highlights.
let next = field.slice();
for (let pass = 0; pass < 16; pass++) {
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) {
    const start = z*plane + y*nx;
    for (let x = 1; x < nx - 1; x++) {
      const i = start + x;
      next[i] = (field[i]*2 + field[i-1] + field[i+1] + field[i-nx] + field[i+nx] + field[i-plane] + field[i+plane]) / 8;
    }
  }
  [field, next] = [next, field];
}

const positions = [], normals = [], indices = [], cache = new Map();
const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
function vertex(x, y, z, edge) {
  const [a,b] = edges[edge].map(i => corners[i]);
  const ia=(z+a[2])*plane+(y+a[1])*nx+x+a[0];
  const ib=(z+b[2])*plane+(y+b[1])*nx+x+b[0];
  const axis=a[0]!==b[0]?0:a[1]!==b[1]?1:2;
  const key=Math.min(ia,ib)*3+axis;
  if (cache.has(key)) return cache.get(key);
  const t=field[ia]/(field[ia]-field[ib]);
  const id=positions.length/3;
  positions.push(...[x,y,z].map((v,i)=>origin[i]+(v+a[i]+(b[i]-a[i])*t)*step));
  const normal=[1,nx,plane].map(d=>
    (field[ia-d]-field[ia+d])*(1-t)+(field[ib-d]-field[ib+d])*t);
  const length=Math.hypot(...normal);
  normals.push(...normal.map(v=>v/length));
  cache.set(key,id);
  return id;
}
for(let z=1;z<nz-2;z++) for(let y=1;y<ny-2;y++) for(let x=1;x<nx-2;x++) {
  let cube=0;
  for(let i=0;i<8;i++) {
    const c=corners[i];
    if(field[(z+c[2])*plane+(y+c[1])*nx+x+c[0]]<0) cube|=1<<i;
  }
  if(!edgeTable[cube]) continue;
  for(let i=0;triTable[cube*16+i]!==-1;i+=3) {
    indices.push(vertex(x,y,z,triTable[cube*16+i]),vertex(x,y,z,triTable[cube*16+i+1]),vertex(x,y,z,triTable[cube*16+i+2]));
  }
}

// Preserve the silhouette and field-derived normals while keeping runtime work
// close to the existing hero. All sculpting happens offline, never on page load.
await MeshoptSimplifier.ready;
const positionArray=Float32Array.from(positions), normalArray=Float32Array.from(normals);
function edgeCounts(index) {
  const counts=new Map();
  for(let i=0;i<index.length;i+=3) for(let e=0;e<3;e++) {
    const a=index[i+e],b=index[i+(e+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`;
    counts.set(key,(counts.get(key)??0)+1);
  }
  return [...counts.values()].filter(n=>n!==2).length;
}
console.log(JSON.stringify({rawVertices:positions.length/3,rawTriangles:indices.length/3,irregularEdges:edgeCounts(indices)}));
const [simplified,error]=MeshoptSimplifier.simplifyWithAttributes(
  Uint32Array.from(indices),positionArray,3,normalArray,3,[0.25,0.25,0.25],null,138000,0.0009,
);
const [remap,vertexCount]=MeshoptSimplifier.compactMesh(simplified);
const compactPositions=new Float32Array(vertexCount*3), compactNormals=new Float32Array(vertexCount*3);
for(let i=0;i<remap.length;i++) if(remap[i]!==0xffffffff) {
  compactPositions.set(positionArray.subarray(i*3,i*3+3),remap[i]*3);
  compactNormals.set(normalArray.subarray(i*3,i*3+3),remap[i]*3);
}
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<compactPositions.length;i++) { const a=i%3;min[a]=Math.min(min[a],compactPositions[i]);max[a]=Math.max(max[a],compactPositions[i]); }
const scale=6.35/(max[0]-min[0]), center=min.map((v,i)=>(v+max[i])/2);
for(let i=0;i<compactPositions.length;i++) compactPositions[i]=(compactPositions[i]-center[i%3])*scale;
let orientation=0;
for(let i=0;i<simplified.length;i+=3) {
  const [a,b,c]=[simplified[i]*3,simplified[i+1]*3,simplified[i+2]*3];
  const u=[0,1,2].map(k=>compactPositions[b+k]-compactPositions[a+k]);
  const v=[0,1,2].map(k=>compactPositions[c+k]-compactPositions[a+k]);
  orientation+=(u[1]*v[2]-u[2]*v[1])*compactNormals[a]+(u[2]*v[0]-u[0]*v[2])*compactNormals[a+1]+(u[0]*v[1]-u[1]*v[0])*compactNormals[a+2];
}
if(orientation<0) for(let i=0;i<simplified.length;i+=3) [simplified[i+1],simplified[i+2]]=[simplified[i+2],simplified[i+1]];
const compactIndices=vertexCount<65536?Uint16Array.from(simplified):simplified;
const arrays=[compactPositions,compactNormals,compactIndices],views=[];
let byteOffset=0;
const binary=Buffer.concat(arrays.map(array=>{
  const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
  views.push({buffer:0,byteOffset,byteLength:data.length});
  const pad=Buffer.alloc((4-data.length%4)%4);byteOffset+=data.length+pad.length;
  return Buffer.concat([data,pad]);
}));
const model={
  asset:{version:"2.0",generator:"Himanshu portfolio / build-hola.mjs",extras:{text:"hola",surface:"Original cubic lettering, unified elliptical volume"}},
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"hola"}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],
  buffers:[{byteLength:binary.length}],bufferViews:views,accessors:[
    {bufferView:0,componentType:5126,count:vertexCount,type:"VEC3",min:min.map((v,i)=>(v-center[i])*scale),max:max.map((v,i)=>(v-center[i])*scale)},
    {bufferView:1,componentType:5126,count:vertexCount,type:"VEC3"},
    {bufferView:2,componentType:vertexCount<65536?5123:5125,count:compactIndices.length,type:"SCALAR"},
  ],
};
let json=Buffer.from(JSON.stringify(model));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
mkdirSync(resolve(root,"public/model"),{recursive:true});
writeFileSync(resolve(root,"public/model/hola.glb"),Buffer.concat([header,json,binHeader,binary]));

// The no-WebGL fallback is traced from this same solid's frontal silhouette.
// Its counters, junctions and terminal shapes therefore match the 3D lettering.
const outlines=new Map(),points=new Map();
const silhouette=new Float32Array(plane).fill(-Infinity);
for(let z=1;z<nz-1;z++) for(let i=0;i<plane;i++) silhouette[i]=Math.max(silhouette[i],field[z*plane+i]);
function contourPoint(x,y,edge) {
  const [a,b]=[[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]][edge];
  const ia=(y+a[1])*nx+x+a[0],ib=(y+b[1])*nx+x+b[0];
  const key=Math.min(ia,ib)*2+(a[0]===b[0]?1:0);
  if(!points.has(key)) {
    const fa=silhouette[ia],fb=silhouette[ib],t=fa/(fa-fb);
    points.set(key,[(origin[0]+(x+a[0]+t*(b[0]-a[0]))*step)*100,-(origin[1]+(y+a[1]+t*(b[1]-a[1]))*step)*100]);
  }
  return key;
}
for(let y=1;y<ny-2;y++) for(let x=1;x<nx-2;x++) {
  const values=[silhouette[y*nx+x],silhouette[y*nx+x+1],silhouette[(y+1)*nx+x+1],silhouette[(y+1)*nx+x]];
  const crossings=[];
  for(let e=0;e<4;e++) if((values[e]>0)!==(values[(e+1)%4]>0)) crossings.push(contourPoint(x,y,e));
  for(let i=0;i<crossings.length;i+=2) {
    const a=crossings[i],b=crossings[i+1];
    if(!outlines.has(a)) outlines.set(a,[]);if(!outlines.has(b)) outlines.set(b,[]);
    outlines.get(a).push(b);outlines.get(b).push(a);
  }
}
const used=new Set(),paths=[];
for(const first of outlines.keys()) {
  if(used.has(first)) continue;
  let current=first,previous=-1;
  const line=[];
  do {
    line.push(points.get(current));used.add(current);
    const after=outlines.get(current).find(p=>p!==previous);previous=current;current=after;
  } while(current!==first&&current!==undefined&&!used.has(current));
  paths.push(`M${line.map(p=>p.map(v=>v.toFixed(2)).join(",")).join("L")}Z`);
}
const viewBox=`${min[0]*100-4} ${-max[1]*100-4} ${(max[0]-min[0])*100+8} ${(max[1]-min[1])*100+8}`;
writeFileSync(resolve(root,"components/hero/HolaPath.ts"),`// Generated from the original volume by scripts/build-hola.mjs.\nexport const HOLA_VIEWBOX = ${JSON.stringify(viewBox)};\nexport const HOLA_PATH = ${JSON.stringify(paths.join(""))};\n`);
console.log(JSON.stringify({vertices:vertexCount,triangles:simplified.length/3,bytes:28+json.length+binary.length,error,bounds:model.accessors[0],contours:paths.length}));
