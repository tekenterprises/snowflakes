const assert=require('node:assert/strict'),fs=require('fs'),P=require('../dist/polygon-fit.js'),I=require('../dist/image-crystal.js'),B=require('../dist/branch-structure.js'),C=require('../dist/crystal.js');
const contains=(p,v)=>p.every((a,i)=>{const b=p[(i+1)%p.length];return (b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0])>=-1e-5});
for(const k of [3,4,5,6]){const p=Array.from({length:k},(_,i)=>[10*Math.cos(i*2*Math.PI/k),10*Math.sin(i*2*Math.PI/k)]),r=P.fit(p,[0,0],p[0]);assert.equal(r.length,k);assert(Math.abs(P.area(r)-P.area(p))<1e-6)}
const circle=Array.from({length:32},(_,i)=>[30*Math.cos(i*Math.PI/16),30*Math.sin(i*Math.PI/16)]),approx=P.fit(circle,[0,0],circle[0]);assert.equal(approx.length,6);assert(contains(approx,[0,0])&&contains(approx,circle[0]));
for(let i=1;i<=10;i++){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${i}.rgba`)),model=B.extract(pixels,768);
 for(const symmetry of [0,50,100])for(const detail of [0,100])for(const strength of [1,100]){
  const r=I.fit(pixels,768,strength,false,detail,symmetry,model);assert.equal(r.polygons.length,r.pieces.length);
  r.polygons.forEach((p,j)=>{assert(p.length>=3&&p.length<=6,`reference ${i}: ${p.length} sides`);assert(P.area(p)>0);assert(p.flat().every(Number.isFinite));assert(contains(p,r.pieces[j].start),'retain piece attachment');assert(contains(p,r.pieces[j].end),'retain piece endpoint')});
  // Partition cells share boundaries; they are no longer overlapping branch
  // ribbons with repeated centerline start/end anchors.
  for(const p of r.pieces){assert.equal(p.sideCount,p.polygon.length);assert(p.vertexIds?.length===p.sideCount);}

  assert.equal(r.loops.filter(p=>C.area(p)>0).length,1,'side reduction must preserve one connected cut');
 }
 console.log(`Reference ${i}: 3–6 sides, cell identities and connected cut verified across strength/detail/symmetry.`);
}
