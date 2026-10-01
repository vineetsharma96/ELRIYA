/** Verifies exported GLB containers, accessor bounds, budgets and required kit. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';

const root = resolve('public/assets');
const required = ['protagonist','citizen','companion','cafe','apartment','tower','blossom-tree','flower-patch','shuttle','street-lamp','bench','road-tile','petal'];
const limits = { protagonist: 15000, citizen: 15000, companion: 10000, cafe: 25000, apartment: 22000, tower: 15000, 'blossom-tree': 7000, 'flower-patch': 12000, shuttle: 12000, 'street-lamp': 4000, bench: 5000, 'road-tile': 2000, petal: 500 };
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(dir,entry.name));
    else if (entry.name.endsWith('.glb')) files.push(join(dir,entry.name));
  }
}
await walk(root);
const reports = [], errors = [];
for (const file of files) {
  const buf = await readFile(file);
  if (buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(4) !== 2 || buf.readUInt32LE(8) !== buf.length) {
    errors.push(`${file}: invalid GLB container`); continue;
  }
  if (buf.readUInt32LE(16) !== 0x4e4f534a) { errors.push(`${file}: first chunk is not JSON`); continue; }
  const gltf = JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8'));
  const name = file.split(/[\\/]/).at(-1).replace('.glb','');
  if (gltf.scenes?.length !== 1 || gltf.meshes?.length !== 1) errors.push(`${name}: expected one asset scene/mesh; found ${gltf.scenes?.length}/${gltf.meshes?.length}`);
  let triangles=0, vertices=0, primitives=0;
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for (const mesh of gltf.meshes || []) for (const primitive of mesh.primitives) {
    const pos = gltf.accessors[primitive.attributes.POSITION];
    const count = primitive.indices === undefined ? pos.count : gltf.accessors[primitive.indices].count;
    if ((primitive.mode ?? 4) !== 4) errors.push(`${name}: non-triangle primitive`);
    triangles += count/3; vertices += pos.count; primitives++;
    for (let i=0;i<3;i++) { min[i]=Math.min(min[i],pos.min[i]); max[i]=Math.max(max[i],pos.max[i]); }
    if (primitive.attributes.NORMAL === undefined) errors.push(`${name}: normals missing`);
    if (primitive.attributes.TEXCOORD_0 === undefined) errors.push(`${name}: UVs missing`);
  }
  if (!Number.isFinite(triangles) || triangles <= 0) errors.push(`${name}: no renderable mesh`);
  if (triangles > (limits[name] ?? 25000)) errors.push(`${name}: ${triangles} triangles exceeds ${limits[name]} budget`);
  if (buf.length > 2_000_000) errors.push(`${name}: >2MB transfer budget`);
  if (gltf.images?.some(image=>image.uri && !image.uri.startsWith('data:'))) errors.push(`${name}: external texture URI`);
  reports.push({ name, path:'/' + relative(resolve('public'),file).replaceAll('\\','/'), bytes:buf.length,
    triangles, vertices, drawCalls:primitives, materials:gltf.materials?.length ?? 0,
    boundsMesh:min.map((value,index)=>[+value.toFixed(4),+max[index].toFixed(4)]),
    animations:gltf.animations?.map(animation=>animation.name) ?? [],
    source:gltf.asset.generator, extensions:gltf.extensionsUsed ?? [] });
}
for (const name of required) if (!reports.some(asset=>asset.name===name)) errors.push(`${name}: missing required asset`);
const report = { checkedAt:new Date().toISOString(), totalBytes:reports.reduce((sum,item)=>sum+item.bytes,0), assets:reports, errors };
await writeFile(resolve('scripts/assets/inspection.json'),JSON.stringify(report,null,2));
console.table(reports.map(({name,bytes,triangles,drawCalls})=>({name,KB:Math.round(bytes/1024),triangles,drawCalls})));
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else console.log(`PASS: ${reports.length} GLBs, ${(report.totalBytes/1024/1024).toFixed(2)} MiB total, valid container/mesh/UV/export guardrails.`);
