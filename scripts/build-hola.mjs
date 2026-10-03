// Original spatial pen paths. No imported model or font is used by this build.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CatmullRomCurve3, Vector3 } from "three";

const root = resolve(import.meta.dirname, "..");
// Crossings are laid out in depth. A returning stroke can pass behind the next
// downstroke without welding the two silhouettes into a swollen junction.
const paths = [
  [
    [-0.40,0.45,-0.44], [-0.02,0.64,-0.44], [0.28,1.30,-0.42],
    [0.72,1.84,-0.38], [0.98,2.40,-0.23], [0.83,2.71,0.02],
    [0.45,2.48,0.18], [0.24,1.76,0.22], [0.12,0.80,0.22], [0.10,0.18,0.22],
  ],
  [
    [0.12,0.58,0.22], [0.23,0.92,0.22], [0.52,1.20,0.23],
    [0.89,1.17,0.22], [1.07,0.83,0.15], [1.06,0.43,0.10], [1.28,0.20,0.08], [1.65,0.32,0.00],
    [1.85,0.65,-0.08],
  ],
  [
    [2.38,1.23,0.13], [2.69,1.06,0.09], [2.75,0.69,0.10],
    [2.54,0.31,0.20], [2.18,0.16,0.27], [1.90,0.31,0.29],
    [1.80,0.69,0.25], [2.03,1.07,0.19],
  ],
  [
    [2.56,0.27,-0.08], [3.06,0.73,-0.31],
    [3.50,1.53,-0.28], [3.90,2.10,-0.26], [3.93,2.49,-0.09],
    [3.67,2.69,0.15], [3.25,2.43,0.34], [3.00,1.75,0.44],
    [2.99,0.96,0.47], [3.14,0.38,0.47], [3.45,0.20,0.36], [3.87,0.43,0.00],
    [4.04,0.72,-0.08],
  ],
  [
    [4.59,1.25,0.13], [4.86,1.09,0.09], [4.94,0.71,0.10],
    [4.71,0.32,0.20], [4.36,0.16,0.27], [4.10,0.31,0.29],
    [4.01,0.69,0.25], [4.27,1.07,0.19],
  ],
  [
    [4.84,1.00,0.06], [4.92,0.76,0.17], [4.99,0.37,0.32],
    [5.21,0.22,0.30], [5.57,0.34,0.22], [5.87,0.59,0.07], [6.03,0.77,0.00],
  ],
];
// The o and a bowls close on themselves. Their connections sit behind the
// letters rather than cutting a bar through either counter.
const closedPaths = new Set([2,4]);
const radius = 0.205;
const radialSegments = 28;
const capSegments = 9;
const positions = [], normals = [], indices = [], silhouetteSamples = [];
const strokeRanges = [];

function roundedPath(points, closed) {
  const guide = new CatmullRomCurve3(points.map(([x,y,z]) => new Vector3(x,y*0.90,z)), closed, "centripetal");
  guide.arcLengthDivisions = 4096;
  const count = Math.ceil(guide.getLength() / 0.0225);
  const samples = guide.getSpacedPoints(count);
  if (closed) samples.pop();
  const sigma = radius / (guide.getLength()/count);
  const reach = Math.ceil(sigma*3);
  // Smooth curvature in arc-length space. This removes tight pinches between
  // editing handles while preserving a genuinely circular, constant-width pen.
  const smooth = samples.map((_,i) => {
    const sum = new Vector3(); let total = 0;
    for (let offset=-reach;offset<=reach;offset++) {
      const weight = Math.exp(-0.5*(offset/sigma)**2), j = i+offset;
      const p = closed ? samples[((j%count)+count)%count]
        : j<0 ? samples[0].clone().addScaledVector(samples[1].clone().sub(samples[0]),j)
        : j>count ? samples[count].clone().addScaledVector(samples[count].clone().sub(samples[count-1]),j-count)
        : samples[j];
      sum.addScaledVector(p,weight); total+=weight;
    }
    return sum.divideScalar(total);
  });
  return new CatmullRomCurve3(smooth, closed, "centripetal");
}

for (const [pathIndex, points] of paths.entries()) {
  const closed = closedPaths.has(pathIndex);
  const curve = roundedPath(points, closed);
  curve.arcLengthDivisions = 4096;
  const segments = Math.ceil(curve.getLength() / 0.037);
  const frames = curve.computeFrenetFrames(segments, closed);
  const rings = [];
  const firstVertex = positions.length / 3;

  function ring(center, normal, binormal, tangent, radialSize, axialNormal) {
    const ids = [];
    for (let j = 0; j < radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      const radial = normal.clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(binormal, Math.sin(angle));
      const p = center.clone().addScaledVector(radial, radius * radialSize);
      const n = radial.multiplyScalar(radialSize).addScaledVector(tangent, axialNormal).normalize();
      ids.push(positions.length / 3);
      positions.push(p.x,p.y,p.z);
      normals.push(n.x,n.y,n.z);
    }
    rings.push(ids);
  }

  const begin = curve.getPointAt(0), end = curve.getPointAt(1);
  if (!closed) {
    positions.push(...begin.clone().addScaledVector(frames.tangents[0], -radius).toArray());
    normals.push(...frames.tangents[0].clone().negate().toArray());
  }
  for (let c = 1; !closed && c < capSegments; c++) {
    const angle = c / capSegments * Math.PI * 0.5;
    ring(begin.clone().addScaledVector(frames.tangents[0], -radius*Math.cos(angle)),
      frames.normals[0], frames.binormals[0], frames.tangents[0], Math.sin(angle), -Math.cos(angle));
  }
  for (let i = 0; i < segments + (closed ? 0 : 1); i++) {
    const p = curve.getPointAt(i / segments);
    ring(p, frames.normals[i], frames.binormals[i], frames.tangents[i], 1, 0);
    silhouetteSamples.push([p.x,p.y]);
  }
  for (let c = 1; !closed && c < capSegments; c++) {
    const angle = c / capSegments * Math.PI * 0.5;
    ring(end.clone().addScaledVector(frames.tangents[segments], radius*Math.sin(angle)),
      frames.normals[segments], frames.binormals[segments], frames.tangents[segments], Math.cos(angle), Math.sin(angle));
  }
  const finalVertex = positions.length / 3;
  if (!closed) {
    positions.push(...end.clone().addScaledVector(frames.tangents[segments], radius).toArray());
    normals.push(...frames.tangents[segments].toArray());
  }
  for (let j = 0; j < radialSegments; j++) {
    const k = (j+1) % radialSegments;
    if (!closed) indices.push(firstVertex,rings[0][k],rings[0][j]);
    for (let i = 0; i < rings.length - (closed ? 0 : 1); i++) {
      const next = rings[(i+1)%rings.length];
      indices.push(rings[i][j],rings[i][k],next[j], rings[i][k],next[k],next[j]);
    }
    if (!closed) indices.push(rings.at(-1)[j],rings.at(-1)[k],finalVertex);
  }
  strokeRanges.push({firstVertex,finalVertex,segments,closed});
}

// Consistent outward winding; the sweep's analytic normals remain continuous.
let orientation = 0;
for (let i = 0; i < indices.length; i += 3) {
  const [a,b,c] = indices.slice(i,i+3).map(x => x*3);
  const u = new Vector3(...positions.slice(b,b+3)).sub(new Vector3(...positions.slice(a,a+3)));
  const v = new Vector3(...positions.slice(c,c+3)).sub(new Vector3(...positions.slice(a,a+3)));
  orientation += u.cross(v).dot(new Vector3(...normals.slice(a,a+3)));
}
if (orientation < 0) for (let i = 0; i < indices.length; i += 3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for (let i=0;i<positions.length;i++) {const a=i%3;min[a]=Math.min(min[a],positions[i]);max[a]=Math.max(max[a],positions[i]);}
const scale=6.35/(max[0]-min[0]),center=min.map((v,i)=>(v+max[i])*0.5);
const normalized=Float32Array.from(positions,(v,i)=>(v-center[i%3])*scale);
const vertexCount=positions.length/3;
const indexArray=vertexCount<65536?Uint16Array.from(indices):Uint32Array.from(indices);
const arrays=[normalized,Float32Array.from(normals),indexArray],views=[];
let byteOffset=0;
const binary=Buffer.concat(arrays.map(array=>{
  const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
  views.push({buffer:0,byteOffset,byteLength:data.length});
  const pad=Buffer.alloc((4-data.length%4)%4);byteOffset+=data.length+pad.length;
  return Buffer.concat([data,pad]);
}));
const model={
  asset:{version:"2.0",generator:"Himanshu portfolio / build-hola.mjs",extras:{text:"hola",surface:"Original spatial pen paths with constant circular strokes",strokeRanges}},
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"hola-original"}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],
  buffers:[{byteLength:binary.length}],bufferViews:views,accessors:[
    {bufferView:0,componentType:5126,count:vertexCount,type:"VEC3",min:min.map((v,i)=>(v-center[i])*scale),max:max.map((v,i)=>(v-center[i])*scale)},
    {bufferView:1,componentType:5126,count:vertexCount,type:"VEC3"},
    {bufferView:2,componentType:vertexCount<65536?5123:5125,count:indexArray.length,type:"SCALAR"},
  ],
};
let json=Buffer.from(JSON.stringify(model));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
mkdirSync(resolve(root,"public/model"),{recursive:true});
writeFileSync(resolve(root,"public/model/hola.glb"),Buffer.concat([header,json,binHeader,binary]));

// A lightweight outline fallback comes from the frontal projection of the same
// authored centerlines. Only this 2D projection combines overlapping strokes.
const step=0.0075,origin=[min[0]-0.05,min[1]-0.05];
const nx=Math.ceil((max[0]-min[0]+0.1)/step)+1,ny=Math.ceil((max[1]-min[1]+0.1)/step)+1;
const field=new Float32Array(nx*ny).fill(-1);
for (const p of silhouetteSamples) {
  const xa=Math.max(0,Math.floor((p[0]-radius-step-origin[0])/step)), xb=Math.min(nx-1,Math.ceil((p[0]+radius+step-origin[0])/step));
  const ya=Math.max(0,Math.floor((p[1]-radius-step-origin[1])/step)), yb=Math.min(ny-1,Math.ceil((p[1]+radius+step-origin[1])/step));
  for(let y=ya;y<=yb;y++) for(let x=xa;x<=xb;x++) {
    const i=y*nx+x;field[i]=Math.max(field[i],radius-Math.hypot(origin[0]+x*step-p[0],origin[1]+y*step-p[1]));
  }
}
const outlines=new Map(),points=new Map();
function contourPoint(x,y,edge) {
  const [a,b]=[[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]][edge];
  const ia=(y+a[1])*nx+x+a[0],ib=(y+b[1])*nx+x+b[0],key=Math.min(ia,ib)*2+(a[0]===b[0]?1:0);
  if(!points.has(key)) {
    const t=field[ia]/(field[ia]-field[ib]);
    points.set(key,[(origin[0]+(x+a[0]+t*(b[0]-a[0]))*step)*100,-(origin[1]+(y+a[1]+t*(b[1]-a[1]))*step)*100]);
  }
  return key;
}
for(let y=0;y<ny-1;y++) for(let x=0;x<nx-1;x++) {
  const values=[field[y*nx+x],field[y*nx+x+1],field[(y+1)*nx+x+1],field[(y+1)*nx+x]],crossings=[];
  for(let e=0;e<4;e++) if((values[e]>0)!==(values[(e+1)%4]>0)) crossings.push(contourPoint(x,y,e));
  for(let i=0;i<crossings.length;i+=2) {
    const a=crossings[i],b=crossings[i+1];
    if(!outlines.has(a))outlines.set(a,[]);if(!outlines.has(b))outlines.set(b,[]);
    outlines.get(a).push(b);outlines.get(b).push(a);
  }
}
const used=new Set(),contours=[];
for(const first of outlines.keys()) {
  if(used.has(first))continue;
  let current=first,previous=-1;const line=[];
  do {line.push(points.get(current));used.add(current);const after=outlines.get(current).find(p=>p!==previous);previous=current;current=after;}
  while(current!==first&&current!==undefined&&!used.has(current));
  const twiceArea=line.reduce((area,p,i)=>{const q=line[(i+1)%line.length];return area+p[0]*q[1]-q[0]*p[1];},0);
  if(Math.abs(twiceArea)<2)continue; // Ignore sub-pixel contour specks at a crossing.
  contours.push(`M${line.map(p=>p.map(v=>v.toFixed(2)).join(",")).join("L")}Z`);
}
const viewBox=`${min[0]*100-4} ${-max[1]*100-4} ${(max[0]-min[0])*100+8} ${(max[1]-min[1])*100+8}`;
writeFileSync(resolve(root,"components/hero/HolaPath.ts"),`// Generated from scripts/build-hola.mjs.\nexport const HOLA_VIEWBOX = ${JSON.stringify(viewBox)};\nexport const HOLA_PATH = ${JSON.stringify(contours.join(""))};\n`);
console.log(JSON.stringify({vertices:vertexCount,triangles:indices.length/3,bytes:28+json.length+binary.length,contours:contours.length,bounds:model.accessors[0]}));
