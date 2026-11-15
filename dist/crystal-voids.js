/* Artistic facet fitting for cavity outlines, preserving material topology. */
(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./crystal'):root.Crystal,B=typeof module!=='undefined'?require('./boundary-fit'):root.BoundaryFit;
const Clipper=typeof module!=='undefined'?require('./vendor/clipper'):root.ClipperLib;
const PolygonFit=typeof module!=='undefined'?require('./polygon-fit'):root.PolygonFit;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){const s=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),a=[],b=[];for(const p of s){while(a.length>1&&cross(a.at(-2),a.at(-1),p)<=0)a.pop();a.push(p)}for(const p of s.slice().reverse()){while(b.length>1&&cross(b.at(-2),b.at(-1),p)<=0)b.pop();b.push(p)}return a.slice(0,-1).concat(b.slice(0,-1));}
function centroid(p){const a=C.area(p);return [0,1].map(k=>p.reduce((s,v,i)=>{const w=p[(i+1)%p.length];return s+(v[k]+w[k])*(v[0]*w[1]-w[0]*v[1])},0)/(6*a));}
function simple(p){for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){if(i===0&&j===p.length-1)continue;const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];if(cross(a,b,c)*cross(a,b,d)<-1e-9&&cross(c,d,a)*cross(c,d,b)<-1e-9)return false;}return true;}
function fit(holes,material,size,detail=100){
 if(!holes.length)return holes;
 const paths=ps=>ps.map(p=>(C.area(p)<0?p.slice().reverse():p).map(([x,y])=>({X:Math.round(x*1e6),Y:Math.round(y*1e6)}))),base=paths(material.filter(p=>C.area(p)>0)),state=ps=>{const clip=new Clipper.Clipper(),tree=new Clipper.PolyTree();clip.StrictlySimple=true;clip.AddPaths(base,Clipper.PolyType.ptSubject,true);clip.AddPaths(paths(ps),Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctDifference,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);let components=0,voids=0;function visit(node){for(const child of node.Childs()){if(child.IsHole())voids++;else components++;visit(child)}}visit(tree);return {components,voids};};
 const out=holes.map(p=>p.slice()),initial=state(out),scale=size/768;
 for(let index=0;index<out.length;index++){
  const original=out[index],area=Math.abs(C.area(original));if(original.length<=6||area<4*scale*scale)continue;
  const convexHull=hull(original),solidity=area/Math.max(area,Math.abs(C.area(convexHull))),sides=solidity>.9?6:solidity>.75?10:16,center=centroid(original),candidates=[];
  if(solidity>.85){const end=convexHull.reduce((a,b)=>Math.hypot(b[0]-center[0],b[1]-center[1])>Math.hypot(a[0]-center[0],a[1]-center[1])?b:a);candidates.push(PolygonFit.fit(convexHull,center,end,detail));}
  for(const tolerance of [2,3,4,5,6])candidates.push(B.fit(original,tolerance*scale*(1+.75*(1-detail/100))));
  let best=original;
  for(let candidate of candidates){
   if(C.area(candidate)*C.area(original)<0)candidate=candidate.slice().reverse();const a=Math.abs(C.area(candidate));
   if(candidate.length<3||candidate.length>=best.length||!simple(candidate)||a<area*.8||a>area*1.2)continue;
   const nextCenter=centroid(candidate);if(!nextCenter.every(Number.isFinite)||Math.hypot(nextCenter[0]-center[0],nextCenter[1]-center[1])>Math.max(1.5*scale,Math.sqrt(area)*.08))continue;
   const trial=out.slice();trial[index]=candidate;const next=state(trial);
   if(next.components!==initial.components||next.voids!==initial.voids)continue;
   best=candidate;if(best.length<=sides)break;
  }
  out[index]=best;
 }
 return out;
}
root.CrystalVoids={fit};if(typeof module!=='undefined')module.exports=root.CrystalVoids;
})(globalThis);
