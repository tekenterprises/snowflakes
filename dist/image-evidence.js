/* Material evidence remains separate from the shared, hole-filled branch scaffold. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine'):root.Flake,C=typeof module!=='undefined'?require('./crystal'):root.Crystal,Clipper=typeof module!=='undefined'?require('./vendor/clipper'):root.ClipperLib;
const Boundary=typeof module!=='undefined'?require('./boundary-fit'):root.BoundaryFit;
const cache=new WeakMap(),rotations=Array.from({length:6},(_,k)=>[Math.cos(k*Math.PI/3),Math.sin(k*Math.PI/3)]);
function sample(a,n,x,y){const ix=Math.round(x),iy=Math.round(y);return ix>=0&&iy>=0&&ix<n&&iy<n?a[iy*n+ix]:n;}
function groups(mask,n){const seen=new Uint8Array(mask.length),q=new Int32Array(mask.length),out=[];for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;let h=0,t=1,sx=0,sy=0;q[0]=i;seen[i]=1;while(h<t){const j=q[h++],x=j%n,y=(j/n)|0;sx+=x+.5;sy+=y+.5;for(const k of [x?j-1:-1,x<n-1?j+1:-1,y?j-n:-1,y<n-1?j+n:-1])if(k>=0&&mask[k]&&!seen[k]){seen[k]=1;q[t++]=k;}}out.push({indices:Array.from(q.subarray(0,t)),area:t,center:[sx/t,sy/t]});}return out;}
function analyze(pixels,n,invert,threshold){const previous=cache.get(pixels);if(previous&&previous.n===n&&previous.invert===invert&&previous.threshold===threshold)return previous;
 const gray=new Float32Array(n*n),raw=new Uint8Array(n*n),strict=new Uint8Array(n*n);for(let i=0;i<raw.length;i++){let g=.2126*pixels[4*i]+.7152*pixels[4*i+1]+.0722*pixels[4*i+2];if(invert)g=255-g;gray[i]=g;raw[i]=g<threshold?1:0;strict[i]=g<Math.min(254,threshold+8)?1:0;}
 const filled=F.fillHoles(raw,n),closedStrict=F.fillHoles(strict,n),voids=Uint8Array.from(raw,(v,i)=>filled[i]&&!v?1:0),stable=Uint8Array.from(strict,(v,i)=>closedStrict[i]&&!v?1:0),clearance=F.distance(Uint8Array.from(voids,v=>1-v),n),scale=n/384,c=n/2;
 const candidates=groups(voids,n).filter(g=>g.area>=2*scale*scale).map(g=>({...g,stable:g.indices.reduce((s,i)=>s+stable[i],0)/g.area,width:g.indices.reduce((m,i)=>Math.max(m,clearance[i]),0),votes:1}));
 // Count distinct rotated observations, not multiple speckles in the same arm.
 for(const g of candidates){for(let k=1;k<6;k++){const [co,si]=rotations[k],x=c+(g.center[0]-c)*co-(g.center[1]-c)*si,y=c+(g.center[0]-c)*si+(g.center[1]-c)*co,tolerance=Math.max(2*scale,Math.sqrt(g.area)*.55,Math.hypot(x-c,y-c)*.035);if(candidates.some(h=>h!==g&&h.area/g.area>.3&&h.area/g.area<3.3&&Math.hypot(h.center[0]-x,h.center[1]-y)<tolerance))g.votes++;}}
 const accepted=candidates.filter(g=>(g.area>=8*scale*scale&&g.width>=1.1*scale&&g.stable>=.6)||(g.votes>=3&&g.width>=.6*scale&&g.stable>=.4)),holes=new Uint8Array(raw.length);for(const g of accepted)for(const i of g.indices)holes[i]=1;
 // A representative observed cavity supplies each radial family. Full symmetry
 // keeps repeated gaps even if one or two arms have a weak/broken image edge.
 const common=[],used=new Set();for(const g of accepted.slice().sort((a,b)=>b.votes-a.votes||b.stable-a.stable)){if(used.has(g))continue;const radius=Math.hypot(g.center[0]-c,g.center[1]-c),central=radius<Math.sqrt(g.area)*.5;if(g.votes<3&&!central)continue;
  const members=accepted.filter(h=>rotations.some(([co,si])=>Math.hypot(c+(g.center[0]-c)*co-(g.center[1]-c)*si-h.center[0],c+(g.center[0]-c)*si+(g.center[1]-c)*co-h.center[1])<Math.max(2*scale,Math.sqrt(g.area)*.55,radius*.035)&&h.area/g.area>.3&&h.area/g.area<3.3));members.forEach(h=>used.add(h));
  const region=new Uint8Array(raw.length);for(const i of g.indices)region[i]=1;const loops=F.contours(region,n,.55*scale);for(const [co,si] of rotations)for(const p of loops)common.push(p.map(([x,y])=>[c+(x-c)*co-(y-c)*si,c+(x-c)*si+(y-c)*co]));
 }
 const consensus=C.raster(union(common),n),outside=F.distance(filled,n),result={n,invert,threshold,raw,filled,holes,consensus,outside,accepted};cache.set(pixels,result);return result;
}
function operation(a,b,type){if(!a.length)return [];const clip=new Clipper.Clipper(),out=new Clipper.Paths(),paths=ps=>ps.map(p=>p.map(([x,y])=>({X:Math.round(x*1e6),Y:Math.round(y*1e6)})));clip.AddPaths(paths(a),Clipper.PolyType.ptSubject,true);if(b.length)clip.AddPaths(paths(b),Clipper.PolyType.ptClip,true);clip.Execute(type,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return out.map(p=>p.map(v=>[v.X/1e6,v.Y/1e6]));}
function union(p){return operation(p,[],Clipper.ClipType.ctUnion);}
function constrain(loops,evidence,detail,symmetry,axis=0,aligned=null){
 const {n}=evidence,c=n/2,z=symmetry/100,tolerance=(1.5+7.5*(1-detail/100)**1.5)*n/768;
 // Fit through the contour rather than unioning it with a larger mesh envelope.
 // Structural alignment supplies correspondence when symmetry is requested.
 const source=z?(aligned||F.averageArms(evidence.filled,n,z)):evidence.filled;
 const trace=F.contours(F.fillHoles(source,n),n,0).filter(p=>C.area(p)>0);
 const bounded=union(trace.map(p=>Boundary.fit(p,tolerance)));
 let holes=evidence.holes;
 if(z===1)holes=evidence.consensus;else if(z){const signed=a=>{const out=F.distance(a,n),inside=F.distance(Uint8Array.from(a,v=>1-v),n);return Float32Array.from(out,(v,i)=>v-inside[i]);},a=signed(holes),b=signed(evidence.consensus);holes=Uint8Array.from(a,(v,i)=>(1-z)*v+z*b[i]<=0?1:0);}
 let exclusions=F.contours(holes,n,0).map(p=>Boundary.fit(p,tolerance));
 // Preserve both observed sides before the final canonical half-arm replication.
 // Otherwise mirroring one half can accidentally refill a recurring cavity.
 if(z===1){const co=Math.cos(2*axis),si=Math.sin(2*axis),mirrored=exclusions.map(p=>p.map(([x,y])=>[c+co*(x-c)+si*(y-c),c+si*(x-c)-co*(y-c)]).reverse());exclusions=union([...exclusions,...mirrored]);}
 const open=operation(bounded,exclusions,Clipper.ClipType.ctDifference);
 return {filled:bounded,open,allowance:tolerance*1.5,voidCount:evidence.accepted.length};
}
root.ImageEvidence={analyze,constrain};if(typeof module!=='undefined')module.exports=root.ImageEvidence;
})(globalThis);
