const assert=require('node:assert/strict'),fs=require('fs');
const B=require('../dist/branch-structure.js'),I=require('../dist/image-crystal.js'),S=require('../dist/structural-model.js'),C=require('../dist/crystal.js'),Core=require('../dist/crystal-core.js'),F=require('../dist/engine.js'),O=require('../dist/cut-output.js');
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function crossing(a,b){const v=[cross(a.start,a.end,b.start),cross(a.start,a.end,b.end),cross(b.start,b.end,a.start),cross(b.start,b.end,a.end)];return v.every(x=>Math.abs(x)>1e-6)&&v[0]*v[1]<0&&v[2]*v[3]<0}
function topology(r){return r.tree.map(t=>[t.arm,t.mirror,t.slotId,t.parent===null?null:r.tree[t.parent].slotId])}
function definitions(r){return r.pieces.map(p=>[p.branchId,p.pieceSlotId,p.sideCount,p.u0,p.u1])}
function correspondence(r){
 const perArm=Array.from({length:6},(_,arm)=>r.tree.filter(t=>t.arm===arm).map(t=>[t.slotId,t.mirror,t.parent===null?null:r.tree[t.parent].slotId]));for(const arm of perArm)assert.deepEqual(arm,perArm[0]);
 const slots=new Map();for(const t of r.tree){const pieces=r.pieces.filter(p=>p.branchId===t.id).map(p=>[p.pieceSlotId,p.sideCount,p.u0,p.u1]);if(slots.has(t.slotId))assert.deepEqual(pieces,slots.get(t.slotId));else slots.set(t.slotId,pieces)}
 for(let i=0;i<r.tree.length;i++)for(let j=i+1;j<r.tree.length;j++)assert(!crossing(r.tree[i],r.tree[j]),`crossing branch slots ${r.tree[i].slotId},${r.tree[j].slotId}`);
 assert.equal(r.hub.polygon.length,6);assert(C.area(r.hub.polygon)>0);assert.equal(r.loops.filter(p=>C.area(p)>0).length,1);
}
for(let ref=1;ref<=10;ref++){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${ref}.rgba`)),model=B.extract(pixels,768);
 for(const detail of [0,50,100]){let baseline=null;for(const symmetry of [0,25,50,75,100]){const r=I.fit(pixels,768,100,false,detail,symmetry,model);correspondence(r);if(!baseline)baseline=r;else{assert.deepEqual(topology(r),topology(baseline),'symmetry cannot add or remove branch slots');assert.deepEqual(definitions(r),definitions(baseline),'symmetry cannot change polygon count or side definition')}
  if(symmetry===100){const theta=2*model.axis,reflect=([x,y])=>[384+(x-384)*Math.cos(theta)+(y-384)*Math.sin(theta),384+(x-384)*Math.sin(theta)-(y-384)*Math.cos(theta)];for(const p of r.polygons){const q=p.map(reflect);assert(r.polygons.some(candidate=>candidate.length===q.length&&q.every(a=>candidate.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6))),'each polygon must have an exact reflected counterpart')}}
 }}
 console.log(`Reference ${ref}: common branch/polygon identities, side counts, no crossings, hub and reflection across detail/symmetry.`);
}

// The repeatedly reported fern twig must survive the entire scaffold, not just
// the raw candidate detector. These are test landmarks, never runtime inputs.
const variants=JSON.parse(fs.readFileSync('/tmp/twig-variants.json'));
for(const [i,v] of variants.entries()){
 const a=v.angle*Math.PI/180,transform=([x,y])=>{x=(x-384)*v.scale+v.dx;y=(y-384)*v.scale+v.dy;return [384+x*Math.cos(a)-y*Math.sin(a),384+x*Math.sin(a)+y*Math.cos(a)]},tip=transform([480,248]),join=transform([470,334]),pixels=new Uint8Array(fs.readFileSync(`/tmp/twig-variant-${i}.rgba`)),r=I.fit(pixels,768,100,false,100,0),matches=r.tree.filter(t=>Math.hypot(t.end[0]-tip[0],t.end[1]-tip[1])<4);
 assert.equal(matches.length,1,`variant ${i}: exactly one fitted twig`);assert(Math.hypot(matches[0].start[0]-join[0],matches[0].start[1]-join[1])<9);assert.equal(r.tree[matches[0].parent].parent,null);
}
const fern=I.fit(new Uint8Array(fs.readFileSync('/tmp/image-model-2.rgba')),768,100);
for(const tip of [[406,136],[364,118],[340,158],[299,181],[467,181],[240,229],[530,220],[595,418],[299,580]])assert(Math.min(...fern.tree.map(t=>Math.hypot(t.end[0]-tip[0],t.end[1]-tip[1])))<10,'retain visible smaller branches');
console.log('37 transformed fern inputs retain the known twig and parent; smaller annotated branches retained.');

// Distinguish an actual six-edge core from uniform dark material.
for(const visible of [false,true]){
 const n=256,c=128,axis=.13,radius=18,phase=axis+Math.PI/6,polygon=Array.from({length:6},(_,k)=>[c+radius*Math.cos(phase+k*Math.PI/3),c+radius*Math.sin(phase+k*Math.PI/3)]),gray=new Float32Array(n*n),target=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;target[i]=Math.hypot(x-c,y-c)<105?1:0;gray[i]=target[i]?.2:0;if(visible&&Math.min(...polygon.map((p,k)=>B.project([x,y],[p,polygon[(k+1)%6]]).distance))<.9)gray[i]=.9}
 const tree=Array.from({length:6},(_,arm)=>({parent:null,length:100,start:[c,c],end:[c+100*Math.cos(axis+arm*Math.PI/3),c+100*Math.sin(axis+arm*Math.PI/3)]})),model={n,scale:1,axis,gray,target,distance:F.distance(Uint8Array.from(target,v=>1-v),n),tree},core=Core.detect(model);
 assert.equal(core.observed,visible);if(visible)assert(Math.abs(core.radius-radius)<1.5,'find the image hexagon size');
}
console.log('Central hexagon detected from six-edge evidence; uniform material marked inferred.');

const pixels=new Uint8Array(fs.readFileSync('/tmp/image-model-9.rgba')),model=B.extract(pixels,768),mask=Uint8Array.from({length:768*768},(_,j)=>pixels[j*4]<230?1:0);
for(const symmetry of [0,50,100])for(const crystal of [0,100])for(const rim of [1,2]){
 const fitted=I.fit(pixels,768,100,false,100,symmetry,model),out=O.process(mask,768,{crystal,symmetry,detail:100,offset:0,round:0,fill:true,islands:true,size:100,gaps:.2,hanger:true,holeDiameter:3,holeRim:rim,holeNeck:.5},fitted),h=out.hanger;
 const root=fitted.tree.filter(t=>t.parent===null).reduce((a,b)=>(b.end[1]-b.start[1])/b.length<(a.end[1]-a.start[1])/a.length?b:a);
 assert(Math.abs(cross(root.start,root.end,h.center))/root.length<1e-7,'hanger must be on the actual final arm axis');assert(Math.abs(Math.hypot(h.center[0]-h.attachment[0],h.center[1]-h.attachment[1])-h.radius-.5*768/100)<1e-7,'tip-to-opening neck distance');assert.equal(out.loops.filter(p=>C.area(p)<0).length,1);
}
console.log('Broad plate hanger aligned with final branch axis in both geometry modes, across symmetry and rim settings.');
