// A non-catalogue branch scaffold deliberately bridges exterior bays. Source
// patches must change actual cells, while keeping the core and branch owners.
const assert=require('node:assert/strict'),Surface=require('../dist/silhouette-mesh'),C=require('../dist/crystal'),F=require('../dist/engine'),Cells=require('../dist/cavity-cells');
const n=160,c=n/2,area=loops=>loops.reduce((s,p)=>s+C.area(p),0);
{
 // The same total excess spread as a narrow residual along a noisy slender
 // branch is not a topology failure. A small broad tip residual must not turn
 // that entire contour into thousands of replacement cells.
 const size=768,top=Array.from({length:161},(_,i)=>[64+i*4,382+.2*Math.sin(i*2.7)]),bottom=top.map(([x])=>[x,387+.2*Math.sin(x)]).reverse(),outline=top.concat(bottom),nominal=[[40,379],[728,379],[728,390],[40,390]],core=[[370,383],[375,382],[380,383],[380,386],[375,387],[370,386]],pieces=[{pieceSlotId:'branch',branchId:0,slotId:0,polygon:nominal},{kind:'core',pieceSlotId:'core',polygon:core}],mesh={pieces,loops:[nominal],template:{boundaries:[[0,1,2,3]],faithful:nominal}},model={n:size,scale:1,slots:[{}],boundaryEvidence:{size,loops:[outline]}};
 const target=C.raster([outline],size),mask=C.raster([nominal],size),distance=F.distance(target,size);let excess=0,broad=0,sourceArea=0;for(let i=0;i<mask.length;i++){sourceArea+=target[i];if(mask[i]&&!target[i]){excess++;if(distance[i]>3)broad++;}}assert(excess>sourceArea*.06&&broad>sourceArea*.015&&broad<excess*.25,'control isolates the broad-share gate');
 const repaired=Surface.sourcePatches(model,mesh,100,0,[],[]);assert.equal(repaired,mesh,'narrow noisy boundary residual retains the existing scaffold');
}
for(const axis of [.17,.43]){
 const point=(r,a)=>[c+r*Math.cos(a),c+r*Math.sin(a)],core=Array.from({length:6},(_,k)=>point(8,axis+k*Math.PI/3)),outline=[];
 // Six wide tips separated by deep, open bays. It is deliberately unrelated
 // to any reference photograph or known catalogue branch measurements.
 for(let arm=0;arm<6;arm++){const a=axis+arm*Math.PI/3;outline.push(point(62,a-.055),point(64,a),point(61,a+.065),point(13,a+Math.PI/6));}
 const raw=C.raster([outline],n),roots=Array.from({length:6},(_,arm)=>({id:arm,localId:arm,slotId:0,parent:null,arm,mirror:false,start:[c,c],end:point(64,axis+arm*Math.PI/3),path:[[c,c],point(64,axis+arm*Math.PI/3)],length:64})),pieces=roots.map((t,i)=>({branchId:i,slotId:0,arm:i,mirror:false,pieceSlotId:'root',polygon:[[c,c],point(67,axis+(i-.5)*Math.PI/3),point(67,axis+(i+.5)*Math.PI/3)]}));
 // Subtract the protected central hexagon so the nominal scaffold is a
 // partition too. This lets the test detect repair overlap around the core.
 const Clipper=require('../dist/vendor/clipper');const clipped=[];
 for(const p of pieces){const clip=new Clipper.Clipper(),out=new Clipper.Paths(),toPath=q=>q.map(([X,Y])=>({X:Math.round(X*1e6),Y:Math.round(Y*1e6)}));clip.AddPath(toPath(p.polygon),Clipper.PolyType.ptSubject,true);clip.AddPath(toPath(core),Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctDifference,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);for(const q of out)clipped.push({...p,polygon:q.map(v=>[v.X/1e6,v.Y/1e6])});}
 clipped.push({kind:'core',pieceSlotId:'core',polygon:core});
 const vertices=clipped.flatMap(p=>p.polygon),boundaries=[];let offset=0;for(const p of clipped){boundaries.push(p.polygon.map((_,i)=>offset+i));offset+=p.polygon.length;}
 const template={faithful:vertices,boundaries,ideal:roots},mesh={pieces:clipped,loops:Cells.boundary(clipped.map(p=>p.polygon)).loops,template},model={n,scale:1,axis,slots:[{}],tree:roots,target:raw,boundaryEvidence:{size:n,loops:[outline]}};
 for(const symmetry of [0,35,100]){const repaired=Surface.sourcePatches(model,mesh,100,symmetry,roots,roots);assert(repaired.sourcePatch,'broad unsupported bay activates source repair');assert(repaired.pieces.some(p=>p.kind==='core'&&p.polygon===core),'central hexagon remains');assert(repaired.pieces.every(p=>p.polygon.length>=3&&p.polygon.length<=6&&p.polygon.flat().every(Number.isFinite)&&C.area(p.polygon)>0));const sum=repaired.pieces.reduce((s,p)=>s+C.area(p.polygon),0);assert(Math.abs(sum-area(repaired.loops))<.02,'actual repaired cells have no interior overlap');assert(repaired.pieces.every(p=>p.kind==='core'||p.slotId===0),'branch slot ownership survives');
  if(symmetry===0){const mask=C.raster(repaired.loops,n);let added=0,missing=0;for(let i=0;i<raw.length;i++){added+=mask[i]&&!raw[i]?1:0;missing+=raw[i]&&!mask[i]?1:0;}assert(added<20&&missing<20,`source fit: +${added}/-${missing} pixels`);}
  if(symmetry===100){const original=repaired.pieces.filter(p=>p.kind!=='core');for(const role of new Set(original.map(p=>p.pieceSlotId)))assert.equal(original.filter(p=>p.pieceSlotId===role).length,12,'one subdivision repeated across all half-arms');}
 }
}
console.log('Generated source patches reopen bays, retain branch slots and the core, and repeat canonical cells.');
