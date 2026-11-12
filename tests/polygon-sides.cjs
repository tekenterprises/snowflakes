const assert=require('node:assert/strict'),fs=require('fs'),P=require('../dist/polygon-fit.js'),I=require('../dist/image-crystal.js'),B=require('../dist/branch-structure.js'),C=require('../dist/crystal.js');
const contains=(p,v)=>p.every((a,i)=>{const b=p[(i+1)%p.length];return (b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0])>=-1e-5});
for(const k of [3,4,5,6]){const p=Array.from({length:k},(_,i)=>[10*Math.cos(i*2*Math.PI/k),10*Math.sin(i*2*Math.PI/k)]),r=P.fit(p,[0,0],p[0]);assert.equal(r.length,k);assert(Math.abs(P.area(r)-P.area(p))<1e-6)}
const circle=Array.from({length:32},(_,i)=>[30*Math.cos(i*Math.PI/16),30*Math.sin(i*Math.PI/16)]),approx=P.fit(circle,[0,0],circle[0]);assert.equal(approx.length,6);assert(contains(approx,[0,0])&&contains(approx,circle[0]));
for(let i=1;i<=10;i++){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${i}.rgba`)),model=B.extract(pixels,768);
 for(const symmetry of [0,50,100])for(const detail of [0,100])for(const strength of [1,100]){
  const r=I.fit(pixels,768,strength,false,detail,symmetry,model);assert.equal(r.polygons.length,r.pieces.length);
  r.polygons.forEach((p,j)=>{assert(p.length>=3&&p.length<=6,`reference ${i}: ${p.length} sides`);assert(P.area(p)>0);assert(p.flat().every(Number.isFinite));assert(contains(p,r.pieces[j].start),'retain piece attachment');assert(contains(p,r.pieces[j].end),'retain piece endpoint')});
  for(const t of r.tree){const pieces=r.pieces.filter(p=>p.branchId===t.id);assert.equal(pieces[0].u0,0);assert.equal(pieces.at(-1).u1,1);assert(Math.hypot(...pieces[0].start.map((v,k)=>v-t.start[k]))<1e-6);assert(Math.hypot(...pieces.at(-1).end.map((v,k)=>v-t.end[k]))<1e-6);for(let j=1;j<pieces.length;j++){assert.equal(pieces[j-1].u1,pieces[j].u0);assert.deepEqual(pieces[j-1].end,pieces[j].start)}}
  assert.equal(r.loops.filter(p=>C.area(p)>0).length,1,'side reduction must preserve one connected cut');
 }
 console.log(`Reference ${i}: 3–6 sides, branch anchors and connected cut verified across strength/detail/symmetry.`);
}
