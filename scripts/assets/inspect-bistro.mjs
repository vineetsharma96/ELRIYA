/** Validate the actual Bistro GLBs and traversable openings against the contract. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Matrix4, Vector3, Quaternion, Ray, Triangle } from 'three'
const contract=JSON.parse(await readFile('public/assets/architecture/blossom_bistro_contract.json','utf8'))
const assets=[...contract.assets.exterior,contract.assets.interior,contract.assets.cup]
const errors=[], reports=[]
const componentBytes={5121:1,5123:2,5125:4,5126:4}
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}
for(const asset of assets){
 const file='public'+asset.url, buffer=await readFile(file)
 if(buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(8)!==buffer.length)throw Error('Bad GLB: '+file)
 const jsonBytes=buffer.readUInt32LE(12), gltf=JSON.parse(buffer.subarray(20,20+jsonBytes).toString())
 const binary=buffer.subarray(28+jsonBytes), data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength)
 function accessor(index){
  const a=gltf.accessors[index], v=gltf.bufferViews[a.bufferView], width=widths[a.type], bytes=componentBytes[a.componentType]
  if(!width||!bytes||a.sparse)throw Error('Unsupported accessor in '+file)
  const stride=v.byteStride??width*bytes, offset=(v.byteOffset??0)+(a.byteOffset??0)
  const read=a.componentType===5126?'getFloat32':a.componentType===5125?'getUint32':a.componentType===5123?'getUint16':'getUint8'
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>data[read](offset+i*stride+j*bytes,true)))
 }
 const triangles=[], min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity]
 function visit(index,parent){
  const node=gltf.nodes[index], local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation??[0,0,0])),new Quaternion(...(node.rotation??[0,0,0,1])),new Vector3(...(node.scale??[1,1,1])))
  const matrix=parent.clone().multiply(local)
  if(node.mesh!==undefined)for(const p of gltf.meshes[node.mesh].primitives){
   if((p.mode??4)!==4)errors.push(file+': non-triangle primitive')
   const positions=accessor(p.attributes.POSITION).map(v=>new Vector3(...v).applyMatrix4(matrix))
   const normals=p.attributes.NORMAL===undefined?[]:accessor(p.attributes.NORMAL)
   const uv=p.attributes.TEXCOORD_0===undefined?[]:accessor(p.attributes.TEXCOORD_0)
   if(!normals.length||!uv.length)errors.push(file+': missing normals/UVs')
   if(normals.some(v=>v.some(n=>!Number.isFinite(n))))errors.push(file+': invalid normals')
   if(uv.some(v=>v.some(n=>!Number.isFinite(n)||n<-.0001||n>1.0001)))errors.push(file+': invalid atlas UVs')
   for(const point of positions)point.toArray().forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n)})
   const ids=p.indices===undefined?positions.map((_,i)=>i):accessor(p.indices).map(v=>v[0])
   for(let i=0;i<ids.length;i+=3)triangles.push(new Triangle(...ids.slice(i,i+3).map(id=>positions[id])))
  }
  for(const child of node.children??[])visit(child,matrix)
 }
 for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index,new Matrix4())
 if(triangles.length>asset.triangleCeiling)errors.push(`${file}: ${triangles.length} exceeds ${asset.triangleCeiling}`)
 if(gltf.materials.length!==1)errors.push(file+': expected one atlas material')
 if(gltf.images.some(image=>image.uri||image.bufferView===undefined))errors.push(file+': texture not embedded')
 if(gltf.cameras?.length||gltf.animations?.length)errors.push(file+': unintended cameras/animations')
 let doorwayClear=null
 if(asset.lod!==undefined){
  doorwayClear=true
  if(Math.abs(min[0]+4.6)>.001||Math.abs(max[0]-4.6)>.001||Math.abs(min[2]+.6)>.001||Math.abs(max[2]-7.6)>.001)errors.push(file+': roof envelope mismatch')
  const ray=new Ray(), hit=new Vector3()
  for(const x of [-.7,0,.7])for(const y of [.15,.8,1.55,1.9]){
   ray.set(new Vector3(x,y,-1),new Vector3(0,0,1))
   if(triangles.some(t=>ray.intersectTriangle(t.a,t.b,t.c,false,hit)&&hit.z<=.25))doorwayClear=false
  }
  if(!doorwayClear)errors.push(file+': mesh blocks a doorway traversal sample')
 }
 if(asset.url.includes('tea_cup')&&Math.abs(min[1])>.0001)errors.push(file+': cup base origin mismatch')
 reports.push({url:asset.url,triangles:triangles.length,triangleCeiling:asset.triangleCeiling,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),bounds:{min,max},materials:gltf.materials.length,embeddedImages:gltf.images.length,doorwayClear})
}
for(const collider of contract.colliders){
 if(collider.min.some((n,i)=>n>collider.max[i]))errors.push(collider.id+': inverted bounds')
 if(!collider.cameraOnly&&collider.min[0]<0&&collider.max[0]>0&&collider.min[2]<=.2&&collider.max[2]>=0)errors.push(collider.id+': movement collider closes doorway')
}
const report={checkedAt:new Date().toISOString(),contractSchema:contract.schemaVersion,assets:reports,errors}
await mkdir('artifacts/bistro',{recursive:true})
await writeFile('artifacts/bistro/export-check.json',JSON.stringify(report,null,2))
console.table(reports.map(a=>({asset:a.url.split('/').at(-1),triangles:a.triangles,ceiling:a.triangleCeiling,KiB:Math.round(a.bytes/1024),doorwayClear:a.doorwayClear})))
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log('PASS: actual GLB budgets, atlas UVs/textures, transformed bounds, door traversal samples and collision opening.')
