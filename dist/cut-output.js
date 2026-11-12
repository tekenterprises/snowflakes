/* Apply cut settings to the final vector topology, including subpixel holes. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
const C=typeof module!=='undefined'?require('./crystal.js'):root.Crystal;
const Features=typeof module!=='undefined'?require('./cut-features.js'):root.CutFeatures;
const E=typeof module!=='undefined'?require('./exact-symmetry.js'):root.ExactSymmetry;
const Clipper=typeof module!=='undefined'?require('./vendor/clipper.js'):root.ClipperLib;
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
function process(mask,size,o,fitted=null){
 const geometry=o.crystal&&fitted;
 const settings={...o,islands:o.gaps>0?false:o.islands};
 let input=geometry?fitted.mask:mask,aligned=false;
 if(!geometry&&o.symmetry>0&&fitted?.alignedTrace){const trace=fitted.alignedTrace();if(trace){aligned=true;const z=o.symmetry/100;if(z===1)input=trace;else{const original=o.fill?F.fillHoles(mask,size):mask,a=F.distance(original,size),b=F.distance(Uint8Array.from(original,v=>1-v),size),c=F.distance(trace,size),d=F.distance(Uint8Array.from(trace,v=>1-v),size);input=Uint8Array.from(mask,(_,i)=>(1-z)*(a[i]-b[i])+z*(c[i]-d[i])<=0?1:0)}}}
 const result=F.process(input,size,geometry?{...settings,detail:100,symmetry:0}:aligned?{...settings,symmetry:0}:settings);
 if(geometry){
  // Retain fitted edges without raster stair-steps, but never bypass cut settings.
  if(o.offset===0&&o.round===0)result.loops=fitted.loops;
  result.polygons=fitted.polygons;
 }
 if(fitted)result.branches=fitted.branches;
 if(o.gaps>0)result.loops=Features.closeGaps(result.loops,o.gaps*size/o.size);
 if(o.symmetry===100&&result.loops.length)result.loops=E.enforce(result.loops,size,fitted?fitted.axis*Math.PI/180:E.axis(result.mask,size));
 const final=clean(result.loops,o.fill,o.islands);
 result.loops=final.loops;result.components=final.components;result.removed=Math.max(result.removed,final.removed);
 // An intentional hanger is added last: symmetry, closing and filling must
 // neither duplicate it nor erase it.
 if(o.hanger&&result.loops.length){const roots=fitted?.tree?.filter(t=>t.parent===null)||[],axis=roots.length?roots.reduce((a,b)=>(b.end[1]-b.start[1])/Math.hypot(b.end[0]-b.start[0],b.end[1]-b.start[1])<(a.end[1]-a.start[1])/Math.hypot(a.end[0]-a.start[0],a.end[1]-a.start[1])?b:a):null;result.hanger=Features.hanger(result.loops,size,o.size,o.holeDiameter,o.holeRim,o.holeNeck,axis);const attached=clean(result.hanger.loops,false,o.islands);result.loops=attached.loops;result.components=attached.components;}
 result.mask=C.raster(result.loops,size);
 return result;
}
root.CutOutput={process,clean};if(typeof module!=='undefined')module.exports=root.CutOutput;
})(globalThis);
