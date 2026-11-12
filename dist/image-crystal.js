/* Geometry is downstream of a separately measured image graph. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
const C=typeof module!=='undefined'?require('./crystal.js'):root.Crystal;
const B=typeof module!=='undefined'?require('./branch-structure.js'):root.BranchStructure;
const R=typeof module!=='undefined'?require('./branch-regions.js'):root.BranchRegions;
const S=typeof module!=='undefined'?require('./structural-model.js'):root.StructuralModel;
const Shared=typeof module!=='undefined'?require('./shared-polygons.js'):root.SharedPolygons;
const Mesh=typeof module!=='undefined'?require('./shared-mesh.js'):root.SharedMesh;
const Core=typeof module!=='undefined'?require('./crystal-core.js'):root.CrystalCore;
const Clipper=typeof module!=='undefined'?require('./vendor/clipper.js'):root.ClipperLib;
function fit(pixels,size,intensity,invert=false,detail=100,symmetry=0,measured=null,threshold=230){
 const model=measured||B.extract(pixels,size,invert,symmetry,threshold);if(!model)return null;
 const {n,scale,target,axis}=model,s=intensity/100,prepared=S.prepare(model);
 let tree,pieces,cutPolygons,meshLoops,hub=Core.fit(model,symmetry),traceHub=hub;
 if(prepared.slots){tree=S.deform(prepared,Mesh.structureDetail(detail),symmetry);const mesh=Mesh.fit(prepared,detail,symmetry,Core.fit(model,100),Core.fit(model,0));pieces=mesh.pieces;cutPolygons=mesh.cutPolygons;meshLoops=mesh.loops;const core=pieces.find(p=>p.kind==='core');hub={...hub,polygon:core.polygon,center:[0,1].map(k=>core.polygon.reduce((s,p)=>s+p[k],0)/6)}}
 else{tree=B.prune(model,detail);const profiles=R.measure(model).profiles;pieces=tree.flatMap(t=>R.pieces(t.path,profiles[t.sourceId],detail,intensity).map(p=>({...p,branchId:t.id,polygon:p.polygon.map(v=>v.map(x=>x*scale)),start:p.start.map(x=>x*scale),end:p.end.map(x=>x*scale)})));tree=tree.map(t=>({...t,path:t.path.map(p=>p.map(v=>v*scale)),start:t.start.map(v=>v*scale),end:t.end.map(v=>v*scale),length:t.length*scale}))}
 if(!prepared.slots)pieces.push({kind:'core',branchId:null,pieceSlotId:'core',sideCount:6,polygon:hub.polygon,start:hub.center,end:hub.center,u0:0,u1:1,error:0});
 const polygons=pieces.map(p=>p.polygon);
 if(!polygons.length)return null;
 // Union the disjoint shared cells to obtain the laser-cut boundary.
 const engine=new Clipper.Clipper(),paths=(cutPolygons||polygons).map(p=>{const q=C.area(p)<0?p.slice().reverse():p;return q.map(([x,y])=>({X:Math.round(x*1e4),Y:Math.round(y*1e4)}))}),solution=new Clipper.Paths();
 engine.AddPaths(paths,Clipper.PolyType.ptSubject,true);engine.Execute(Clipper.ClipType.ctUnion,solution,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 let loops=meshLoops||solution.map(p=>p.map(v=>[v.X/1e4,v.Y/1e4]));
 let lowMask=C.raster(loops.map(p=>p.map(v=>v.map(x=>x/scale))),n);
 // Geometry intensity changes the fit, never the detected graph. Blend in signed-distance space.
 if(s<1){const trace=symmetry?F.averageArms(target,n,symmetry/100):target,a=F.distance(trace,n),b=F.distance(Uint8Array.from(trace,v=>1-v),n),c=F.distance(lowMask,n),d=F.distance(Uint8Array.from(lowMask,v=>1-v),n);lowMask=Uint8Array.from(target,(v,i)=>(1-s)*(a[i]-b[i])+s*(c[i]-d[i])<=0?1:0);loops=F.contours(F.fillHoles(F.components(lowMask,n,true).mask,n),n,.1+s*.4).map(p=>p.map(v=>v.map(x=>x*scale)))}
 let union=0,intersection=0;for(let i=0;i<target.length;i++){union+=target[i]||lowMask[i]?1:0;intersection+=target[i]&&lowMask[i]?1:0}
 const branches=tree.flatMap(t=>t.path.slice(1).map((p,i)=>[t.path[i],p]));
 // Build only when a non-crystal symmetric cut requests it.
 let traceMask=null;
 const alignedTrace=()=>{if(!traceMask&&prepared.slots){const ribbons=Shared.trace(prepared,S.deform(prepared,detail,symmetry),symmetry);ribbons.push(traceHub.polygon);const clip=new Clipper.Clipper(),out=new Clipper.Paths();clip.AddPaths(ribbons.map(p=>(C.area(p)<0?p.slice().reverse():p).map(([x,y])=>({X:Math.round(x*1e4),Y:Math.round(y*1e4)}))),Clipper.PolyType.ptSubject,true);clip.Execute(Clipper.ClipType.ctUnion,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);traceMask=C.raster(out.map(p=>p.map(v=>[v.X/1e4,v.Y/1e4])),size)}return traceMask};
 return {alignedTrace,polygons,pieces,branches,loops,mask:C.raster(loops,size),match:union?intersection/union:0,axis:axis*180/Math.PI,source:prepared.source,hub,inferredBranchCount:tree.filter(t=>!t.observed).length,armCount:tree.filter(t=>t.parent===null).length,branchCount:tree.length,tree};
}
root.ImageCrystal={fit};if(typeof module!=='undefined')module.exports=root.ImageCrystal;
})(globalThis);
