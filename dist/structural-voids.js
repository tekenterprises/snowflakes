/* Classify observed cavities before choosing a vector or crystal representation. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine'):root.Flake,C=typeof module!=='undefined'?require('./crystal'):root.Crystal;
const rotations=Array.from({length:6},(_,k)=>[Math.cos(k*Math.PI/3),Math.sin(k*Math.PI/3)]);
function analyze(raw,n,axis=0){
 const filled=F.fillHoles(raw,n),holes=Uint8Array.from(raw,(v,i)=>filled[i]&&!v?1:0),labels=new Int32Array(raw.length),queue=new Int32Array(raw.length),groups=[],scale=n/384,c=n/2;
 for(let i=0;i<holes.length;i++){if(!holes[i]||labels[i])continue;const id=groups.length+1;let head=0,tail=1,sx=0,sy=0;queue[0]=i;labels[i]=id;
  while(head<tail){const j=queue[head++],x=j%n,y=(j/n)|0;sx+=x+.5;sy+=y+.5;for(const k of [x?j-1:-1,x<n-1?j+1:-1,y?j-n:-1,y<n-1?j+n:-1])if(k>=0&&holes[k]&&!labels[k]){labels[k]=id;queue[tail++]=k}}
  groups.push({id,area:tail,center:[sx/tail,sy/tail],indices:Array.from(queue.subarray(0,tail))});
 }
 const clearance=F.distance(Uint8Array.from(holes,v=>1-v),n),candidates=groups.filter(g=>g.area>=4*scale*scale&&g.indices.some(i=>clearance[i]>=Math.max(1,.75*scale)));
 const transform=(p,k,mirror)=>{let x=p[0]-c,y=p[1]-c;if(mirror){const co=Math.cos(2*axis),si=Math.sin(2*axis);[x,y]=[co*x+si*y,si*x-co*y]}const [co,si]=rotations[k];return [c+x*co-y*si,c+x*si+y*co]};
 function overlap(g,h,k,mirror){const center=transform(g.center,k,mirror),dx=h.center[0]-center[0],dy=h.center[1]-center[1];let hit=0,total=0;
  for(let j=0;j<g.indices.length;j+=Math.max(1,Math.floor(g.area/48))){const i=g.indices[j],p=transform([i%n+.5,Math.floor(i/n)+.5],k,mirror),x=Math.floor(p[0]+dx),y=Math.floor(p[1]+dy);total++;if(x>=0&&y>=0&&x<n&&y<n&&labels[y*n+x]===h.id)hit++;}return hit/total;
 }
 const matched=new Map(),accepted=[];
 for(const g of candidates){const radius=Math.hypot(g.center[0]-c,g.center[1]-c),central=radius<Math.sqrt(g.area)*.35;
  if(central){let votes=0;for(let k=0;k<6;k++)if(overlap(g,g,k,false)>.9)votes++;if(votes>=4){g.arms=votes;g.central=true;accepted.push(g);matched.set(g.id,[g])}continue;}
  const radial=new Set(),arms=new Set(),observations=new Map();
  for(let k=0;k<6;k++)for(const mirror of [false,true]){const p=transform(g.center,k,mirror),tolerance=Math.max(2*scale,Math.sqrt(g.area)*.35,radius*.025);const h=candidates.filter(h=>h.area/g.area>=.5&&h.area/g.area<=2&&Math.hypot(h.center[0]-p[0],h.center[1]-p[1])<=tolerance).sort((a,b)=>Math.hypot(a.center[0]-p[0],a.center[1]-p[1])-Math.hypot(b.center[0]-p[0],b.center[1]-p[1])).find(h=>overlap(g,h,k,mirror)>=.6);
   if(h){if(!mirror)radial.add(k);arms.add(k);observations.set(h.id,h)}
  }
  // Four independent arms, or seven distinct left/right observations across four arms.
  if(radial.size>=4||(arms.size>=4&&observations.size>=7)){g.arms=radial.size;accepted.push(g);matched.set(g.id,[...observations.values()])}
 }
 const mask=new Uint8Array(raw.length);for(const g of accepted)for(const i of g.indices)mask[i]=1;
 // Local interpretation preserves only observed cavities. The symmetric target
 // uses one observed representative per supported family, not their outer union.
 const common=[],used=new Set();for(const g of accepted.slice().sort((a,b)=>b.arms-a.arms||b.area-a.area)){if(used.has(g.id))continue;for(const h of matched.get(g.id))used.add(h.id);const region=new Uint8Array(raw.length);for(const i of g.indices)region[i]=1;for(const p of F.contours(region,n,.3*scale))for(let k=0;k<6;k++)for(const mirror of [false,true]){const q=p.map(v=>transform(v,k,mirror));common.push(mirror?q.reverse():q)}}
 // OR rasterization, since repeated copies may overlap at a symmetry axis.
 const consensus=new Uint8Array(raw.length);for(const p of common){const m=C.raster([p],n);for(let i=0;i<m.length;i++)if(m[i])consensus[i]=1;}
 return {mask,consensus,count:accepted.length,candidates:groups.length,accepted};
}
function blend(e,n,symmetry){if(!symmetry)return e.mask;if(symmetry===100)return e.consensus;const z=symmetry/100,signed=a=>{const d=F.distance(a,n),inside=F.distance(Uint8Array.from(a,v=>1-v),n);return Float32Array.from(d,(v,i)=>v-inside[i])},a=signed(e.mask),b=signed(e.consensus);return Uint8Array.from(a,(v,i)=>(1-z)*v+z*b[i]<=0?1:0);}
root.StructuralVoids={analyze,blend};if(typeof module!=='undefined')module.exports=root.StructuralVoids;
})(globalThis);
