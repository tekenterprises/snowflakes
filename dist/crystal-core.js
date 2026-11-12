/* A central hexagon fitted to grayscale edge evidence, with explicit uncertainty. */
(function(root){
'use strict';
const B=typeof module!=='undefined'?require('./branch-structure.js'):root.BranchStructure;
const cache=new WeakMap(),median=a=>a.slice().sort((a,b)=>a-b)[a.length>>1];
function vertices(center,radius,phase){return Array.from({length:6},(_,k)=>[center[0]+radius*Math.cos(phase+k*Math.PI/3),center[1]+radius*Math.sin(phase+k*Math.PI/3)])}
function detect(model){
 if(cache.has(model))return cache.get(model);
 const {n,gray,target,distance,axis}=model,c=n/2,roots=model.tree.filter(t=>t.parent===null),reach=median(roots.map(t=>t.length));
 const score=polygon=>{const sides=[],contrasts=[];let covered=0;
  for(let k=0;k<6;k++){const a=polygon[k],b=polygon[(k+1)%6],L=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L;let ink=0,edge=0,hits=0;
   for(let u=.15;u<.9;u+=.1){const x=a[0]+u*(b[0]-a[0]),y=a[1]+u*(b[1]-a[1]),v=B.sample(gray,n,x,y),l=B.sample(gray,n,x+nx*1.5,y+ny*1.5),r=B.sample(gray,n,x-nx*1.5,y-ny*1.5);ink+=v;edge+=Math.max(v-(l+r)/2,Math.abs(l-r)*.35);hits++;covered+=B.sample(target,n,x,y)>.7?1:0}
   sides.push(edge/hits+ink/hits*.04);contrasts.push(edge/hits);
  }
  sides.sort((a,b)=>a-b);contrasts.sort((a,b)=>a-b);return {score:(sides[0]+sides[1]+sides[2]+sides[3])/4,coverage:covered/48,sides,contrasts};
 };
 let best=null;
 for(let phaseKind=0;phaseKind<2;phaseKind++)for(let delta=-4;delta<=4;delta+=2)for(let radius=3;radius<=Math.min(reach*.25,n*.12);radius+=.5){const phase=axis+phaseKind*Math.PI/6+delta*Math.PI/180,polygon=vertices([c,c],radius,phase),e=score(polygon);if(e.coverage<.96)continue;const value=e.score-.008*(3/radius);if(!best||value>best.value)best={center:[c,c],radius,phase,polygon,value,...e}}
 if(best)for(const dx of [-1,0,1])for(const dy of [-1,0,1]){const center=[c+dx,c+dy],polygon=vertices(center,best.radius,best.phase),e=score(polygon);if(e.coverage>.96&&e.score>best.score+.002)best={...best,center,polygon,...e}}
 const observed=!!best&&best.score>.055&&best.contrasts[1]>.025;
 if(!observed){const radius=Math.max(2,Math.min(reach*.055,B.sample(distance,n,c,c)*.8));best={center:[c,c],radius,phase:axis,polygon:vertices([c,c],radius,axis),score:best?best.score:0}}
 const result={...best,observed,confidence:observed?Math.min(1,best.score/.22):0};cache.set(model,result);return result;
}
function fit(model,symmetry){const local=detect(model),z=symmetry/100,c=model.n/2,phase=model.axis+Math.round((local.phase-model.axis)/(Math.PI/6))*Math.PI/6,ideal=vertices([c,c],local.radius,phase),polygon=local.polygon.map((p,i)=>p.map((v,k)=>(v*(1-z)+ideal[i][k]*z)*model.scale));return {polygon,observed:local.observed,confidence:local.confidence,center:local.center.map(v=>(v*(1-z)+c*z)*model.scale),radius:local.radius*model.scale}}
root.CrystalCore={detect,fit};if(typeof module!=='undefined')module.exports=root.CrystalCore;
})(globalThis);
