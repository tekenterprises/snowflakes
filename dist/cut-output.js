/* Apply cut settings to the final vector topology, including subpixel holes. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
const C=typeof module!=='undefined'?require('./crystal.js'):root.Crystal;
const Features=typeof module!=='undefined'?require('./cut-features.js'):root.CutFeatures;
const E=typeof module!=='undefined'?require('./exact-symmetry.js'):root.ExactSymmetry;
const Voids=typeof module!=='undefined'?require('./structural-voids'):root.StructuralVoids;
const Boundary=typeof module!=='undefined'?require('./boundary-fit'):root.BoundaryFit;
const Clipper=typeof module!=='undefined'?require('./vendor/clipper.js'):root.ClipperLib;
const Cells=typeof module!=='undefined'?require('./cavity-cells.js'):root.CavityCells;
const CrystalVoids=typeof module!=='undefined'?require('./crystal-voids.js'):root.CrystalVoids;
const meshCache=new WeakMap();
// Worker callers reuse the threshold mask and fitted object while cut settings
// change. Keep evidence work scoped to those identities so stale inputs cannot
// leak across uploads.
const structuralCache=new WeakMap(),fillGeometryCache=new WeakMap();
function perMask(cache,mask,size){let sizes=cache.get(mask);if(!sizes){sizes=new Map();cache.set(mask,sizes)}let entries=sizes.get(size);if(!entries){entries=new Map();sizes.set(size,entries)}return entries;}
function clean(loops,fill,keepLargest){
 const scale=1e6,engine=new Clipper.Clipper(),tree=new Clipper.PolyTree();
 engine.AddPaths(loops.map(p=>p.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}))),Clipper.PolyType.ptSubject,true);
 engine.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const outer=[];
 function visit(node){for(const child of node.Childs()){if(!child.IsHole())outer.push(child);visit(child)}}
 // Filling an outer boundary absorbs all of its nested holes and islands.
 if(fill)outer.push(...tree.Childs());else visit(tree);
 const area=node=>Math.abs(Clipper.Clipper.Area(node.Contour())),material=node=>area(node)-(fill?0:node.Childs().reduce((s,h)=>s+area(h),0));
 const selected=keepLargest?outer.slice().sort((a,b)=>material(b)-material(a)).slice(0,1):outer;
 const out=[];for(const node of selected){out.push(node.Contour());if(!fill)for(const hole of node.Childs())out.push(hole.Contour())}
 return {loops:out.map(p=>p.map(v=>[v.X/scale,v.Y/scale])),components:selected.length,removed:outer.length-selected.length};
}
function subtract(loops,holes){if(!holes.length)return loops;const clip=new Clipper.Clipper(),out=new Clipper.Paths(),paths=ps=>ps.map(p=>p.map(([x,y])=>({X:Math.round(x*1e6),Y:Math.round(y*1e6)})));clip.AddPaths(paths(loops),Clipper.PolyType.ptSubject,true);clip.AddPaths(paths(holes),Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctDifference,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return out.map(p=>p.map(v=>[v.X/1e6,v.Y/1e6]));}
function contains(loops,p){let inside=false;for(const ring of loops)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside;}
function process(mask,size,o,fitted=null){
 const geometry=o.crystal&&fitted;
 const maskEntries=perMask(structuralCache,mask,size);
 let structural=null,protectedMask=null;
 if(o.fill){structural=maskEntries.get('analysis');if(!structural){structural=Voids.analyze(mask,size,E.axis(mask,size));maskEntries.set('analysis',structural)}
  const blendKey=`blend:${o.symmetry}`;protectedMask=maskEntries.get(blendKey);if(!protectedMask){protectedMask=Voids.blend(structural,size,o.symmetry);maskEntries.set(blendKey,protectedMask)}
 }
 const settings={...o,fill:false,islands:o.gaps>0?false:o.islands};
 let material=null,geometryLoops=null;
 if(fitted){let byMask=fillGeometryCache.get(fitted);if(!byMask){byMask=new WeakMap();fillGeometryCache.set(fitted,byMask)}let entries=perMask(byMask,mask,size);const cacheKey=`${o.detail}|${o.fill?1:0}|${o.symmetry}`;let cached=entries.get(cacheKey);
  if(!cached){material=fitted.material?fitted.material(o.fill):null;geometryLoops=material||fitted.loops;
   if(o.fill&&structural?.count&&geometryLoops){const cavityKey=`cavities:${o.detail}|${o.symmetry}`,cavities=entries.get(cavityKey)||F.contours(protectedMask,size,0).map(p=>Boundary.fit(p,(1.5+7.5*(1-o.detail/100)**1.5)*size/768));entries.set(cavityKey,cavities);geometryLoops=subtract(geometryLoops,cavities);if(material)material=geometryLoops;}
   cached={material,geometryLoops};entries.set(cacheKey,cached);
  }else({material,geometryLoops}=cached);
 }
 // The shared cells own the exterior. Selected cavities are cut into real cells,
 // never used as an SVG clipping mask or an independent replacement silhouette.
 let mesh=null;
 if(fitted?.pieces&&geometryLoops&&(geometry||o.crystalPreview)){
  const key=JSON.stringify([!!o.fill,!!o.islands,o.gaps>0,o.symmetry,size]);
  let entries=meshCache.get(fitted);if(!entries){entries=new Map();meshCache.set(fitted,entries)}
  mesh=entries.get(key);
  if(!mesh){let holes=CrystalVoids.fit(geometryLoops.filter(p=>C.area(p)<0),fitted.loops,size,o.detail);
   // These image-supported bay closures already carry their canonical shape;
   // add them as real cell cavities without running the photographic hole fitter.
   const structuralGaps=fitted.structuralGaps||[];for(const ring of structuralGaps)if(ring?.length>=3)holes.push(C.area(ring)<0?ring.map(p=>p.slice()):ring.slice().reverse().map(p=>p.slice()));
   if(o.symmetry===100&&holes.length)holes=E.enforce(holes.map(p=>p.slice().reverse()),size,fitted.axis*Math.PI/180).map(p=>p.slice().reverse());mesh=Cells.build(fitted.polygons,holes,fitted.pieces,fitted.cutPolygons,{symmetric:o.symmetry===100,size,axis:fitted.axis*Math.PI/180,baselineCellCount:fitted.sourcePatch?.beforeCells});if(o.islands&&!(o.gaps>0)){const selected=clean(mesh.loops,false,true);if(selected.removed){const keep=mesh.polygons.map(p=>contains(selected.loops,[0,1].map(k=>p.reduce((s,v)=>s+v[k],0)/p.length)));mesh.polygons=mesh.polygons.filter((_,i)=>keep[i]);mesh.pieces=mesh.pieces.filter((_,i)=>keep[i]);mesh.cutPolygons=mesh.cutPolygons.filter((_,i)=>keep[i]);mesh.loops=selected.loops;}}entries.set(key,mesh)}
  material=geometryLoops=mesh.loops;
 }
 let input=geometry?(material?C.raster(material,size):fitted.mask):mask,aligned=false;
 if(!geometry&&o.symmetry>0&&fitted?.alignedTrace){const trace=fitted.alignedTrace();if(trace){aligned=true;const z=o.symmetry/100;if(z===1)input=trace;else{const original=o.fill?F.fillHoles(mask,size):mask,a=F.distance(original,size),b=F.distance(Uint8Array.from(original,v=>1-v),size),c=F.distance(trace,size),d=F.distance(Uint8Array.from(trace,v=>1-v),size);input=Uint8Array.from(mask,(_,i)=>(1-z)*(a[i]-b[i])+z*(c[i]-d[i])<=0?1:0)}}}
 if(o.fill){input=F.fillHoles(input,size);if(protectedMask)input=Uint8Array.from(input,(v,i)=>v&&!protectedMask[i]?1:0);}
 const result=F.process(input,size,geometry?{...settings,detail:100,symmetry:0}:aligned?{...settings,symmetry:0}:settings);
 if(geometry){
  // Retain fitted edges without raster stair-steps, but never bypass cut settings.
  if(o.offset===0&&o.round===0)result.loops=geometryLoops;
  result.polygons=mesh?.polygons||fitted.polygons;
 }
 if(fitted){result.branches=fitted.branches;result.crystalMaterial=material||fitted.loops;result.previewPolygons=mesh?.polygons||fitted.polygons;result.crystalMesh=mesh;result.baseCrystalLoops=geometryLoops;}
 if(o.gaps>0)result.loops=Features.closeGaps(result.loops,o.gaps*size/o.size);
 if(o.symmetry===100&&result.loops.length&&!(geometry&&mesh&&o.offset===0&&o.round===0&&!(o.gaps>0)))result.loops=E.enforce(result.loops,size,fitted?fitted.axis*Math.PI/180:E.axis(result.mask,size));
 // Fill policy has already been resolved in the real cells. Re-filling only
 // their cut boundary here would reintroduce a preview/export disagreement.
 const final=clean(result.loops,o.fill&&!structural?.count&&!(fitted?.structuralGaps?.length)&&!(geometry&&mesh&&o.offset===0&&o.round===0&&!(o.gaps>0)),o.islands);
 result.structuralVoids=structural?.count||0;
 result.loops=final.loops;result.components=final.components;result.removed=Math.max(result.removed,final.removed);
 // An intentional hanger is added last: symmetry, closing and filling must
 // neither duplicate it nor erase it.
 if(o.hanger&&result.loops.length){const roots=fitted?.tree?.filter(t=>t.parent===null)||[],axis=roots.length?roots.reduce((a,b)=>(b.end[1]-b.start[1])/Math.hypot(b.end[0]-b.start[0],b.end[1]-b.start[1])<(a.end[1]-a.start[1])/Math.hypot(a.end[0]-a.start[0],a.end[1]-a.start[1])?b:a):null;result.hanger=Features.hanger(result.loops,size,o.size,o.holeDiameter,o.holeRim,o.holeNeck,axis);const attached=clean(result.hanger.loops,false,o.islands);result.loops=attached.loops;result.components=attached.components;}
 result.mask=C.raster(result.loops,size);
 return result;
}
root.CutOutput={process,clean};if(typeof module!=='undefined')module.exports=root.CutOutput;
})(globalThis);
