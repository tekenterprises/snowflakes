/* Corresponding branch slots, fitted to the original image before symmetry. */
(function(root){
'use strict';
const B=typeof module!=='undefined'?require('./branch-structure.js'):root.BranchStructure;
const Tips=typeof module!=='undefined'?require('./branch-tips.js'):root.BranchTips;
const cache=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=t=>Math.atan2(t.end[1]-t.start[1],t.end[0]-t.start[0]);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b){const p=cross(a[0],a[1],b[0]),q=cross(a[0],a[1],b[1]),r=cross(b[0],b[1],a[0]),s=cross(b[0],b[1],a[1]);return Math.min(Math.abs(p),Math.abs(q),Math.abs(r),Math.abs(s))>1e-6&&p*q<0&&r*s<0}
const median=a=>{const q=a.slice().sort((a,b)=>a-b);return q.length%2?q[q.length>>1]:(q[q.length/2-1]+q[q.length/2])/2};
function line(parent,u,a,length){const start=parent.start.map((v,k)=>v+u*(parent.end[k]-v)),direction=angle(parent)+a;return [start,[start[0]+length*Math.cos(direction),start[1]+length*Math.sin(direction)]]}
function evidence(model,path){
 const {n,gray,target,distance}=model,a=path[0],b=path[1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L,ink=[],ridge=[],clear=[];let on=0;
 for(let v=.12;v<.99;v+=.055){const x=a[0]+v*L*ux,y=a[1]+v*L*uy,d=B.sample(distance,n,x,y),w=clamp(d,1.25,3.5),c=B.sample(gray,n,x,y),l=B.sample(gray,n,x-uy*w,y+ux*w),r=B.sample(gray,n,x+uy*w,y-ux*w);on+=B.sample(target,n,x,y)>.35?1:0;ink.push(c);ridge.push(c-Math.max(l,r));clear.push(d)}
 const occupancy=on/ink.length,contrast=median(ridge),width=median(clear),inside=B.sample(target,n,b[0]-ux,b[1]-uy),outside=B.sample(target,n,b[0]+ux*2,b[1]+uy*2);
 // A boundary edge has poor clearance; a pale outlined stem can still score
 // through medial support. Endpoint evidence prevents stopping halfway along it.
 const score=median(ink)*.65+contrast*1.8+Math.min(1,width/2)*.18+(inside-outside)*.2-2*(1-occupancy);
 return {score,occupancy,width,contrast,tip:inside-outside};
}
function recover(model,parent,slot,mirror,bounds){
 const sign=mirror?-1:1,expected=slot.angle*sign;let best=null;
 for(let du=-.06;du<=.06001;du+=.02)for(let da=-.3;da<=.30001;da+=.075)for(const ratio of [.65,.85,1,1.15,1.35]){
  const u=clamp(slot.u+du,bounds[0],bounds[1]),a=expected+da,L=slot.length*ratio,path=line(parent,u,a,L);
  if(model.tree.some(t=>t.id!==parent.sourceId&&(intersects(path,t.path)||B.project(path[1],t.path).distance<Math.max(1.5,Math.min(t.width,slot.width)*.6))))continue;
  const e=evidence(model,path);
  if(e.occupancy<.93)continue;
  const score=e.score-.1*(du/.06)**2-.08*(da/.3)**2-.05*Math.abs(Math.log(ratio));
  if(!best||score>best.score)best={u,a,length:L,path,score,e};
 }
 if(!best)return {u:slot.u,a:expected,length:slot.length,path:line(parent,slot.u,expected,slot.length),observed:false,confidence:0};
 // Refine the endpoint locally; searching along a supported vein, not snapping
 // to a distant silhouette corner, preserves the intended parent assignment.
 const d=angle({start:best.path[0],end:best.path[1]}),ux=Math.cos(d),uy=Math.sin(d),start=best.path[0];let last=best.length,gap=0;
 for(let r=Math.max(2,best.length*.7);r<slot.length*1.5;r+=.25){if(B.sample(model.target,model.n,start[0]+ux*r,start[1]+uy*r)>.4){last=r;gap=0}else gap+=.25;if(gap>1.5)break}
 if(last>best.length*.75){best.length=last;best.path=[start,[start[0]+ux*last,start[1]+uy*last]]}
 return {...best,observed:best.e.occupancy>.96&&best.e.score>.3&&best.e.tip>.2,confidence:clamp(best.e.score,0,1)};
}
function settle(model,tree){
 const rebuild=()=>{for(const t of tree)if(t.parent!==null){t.path=line(tree[t.parent],t.u,t.angle,t.length);t.start=t.path[0];t.end=t.path[1]}};
 for(let pass=0;pass<8;pass++){let changed=false;
  for(let i=0;i<tree.length;i++)for(let j=i+1;j<tree.length;j++){
   const a=tree[i],b=tree[j];if(!intersects(a.path,b.path))continue;
   const priority=t=>t.parent===null?100:t.sourceId!==null?10+t.confidence:t.confidence;
   const t=priority(a)<priority(b)?a:b;if(t.parent===null)continue;const parent=tree[t.parent];let best=null;
   // Prefer moving the junction along its own parent while keeping the actual
   // tip. This resolves competition without inventing a bridge to another stem.
   for(let du=-.09;du<=.09001;du+=.01){const u=clamp(t.u+du,.005,.995),start=parent.start.map((v,k)=>v+u*(parent.end[k]-v)),path=[start,t.end];
    if(tree.some(other=>other.id!==t.id&&other.parent!==t.id&&intersects(path,other.path)))continue;
    const e=evidence(model,path),score=e.score-Math.abs(du)*2;if(e.occupancy<.93)continue;
    if(!best||score>best.score)best={u,path,score};
   }
   if(best){t.u=best.u;t.angle=wrap(angle({start:best.path[0],end:best.path[1]})-angle(parent));t.length=B.length(best.path)}
   else{
    // An unsupported prediction must not cross an established branch. Stop its
    // uncertain extent before the first obstruction; retain its slot identity.
    let fraction=1;for(const other of tree){if(other.id===t.id||!intersects(t.path,other.path))continue;const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],ex=other.end[0]-other.start[0],ey=other.end[1]-other.start[1],qx=other.start[0]-t.start[0],qy=other.start[1]-t.start[1],den=dx*ey-dy*ex;fraction=Math.min(fraction,(qx*ey-qy*ex)/den*.97)}t.length*=fraction;t.observed=false;t.confidence=0;
   }
   t.constrained=true;rebuild();changed=true;
  }
  if(!changed)break;
 }
 return tree;
}
function conflicts(tree){const out=[];for(let i=0;i<tree.length;i++)for(let j=i+1;j<tree.length;j++)if(intersects(tree[i].path,tree[j].path))out.push([tree[i],tree[j]]);return out}
function repairTemplate(prepared){
 // Independent coordinate medians can cross even when each source tree does
 // not. Find a nearby feasible common configuration, applying every adjustment
 // to a slot (all twelve instances), never to a selected arm.
 for(let pass=0;pass<8;pass++){
  const hits=conflicts(deform(prepared,100,100));if(!hits.length)return;
  const pair=hits[0].filter(t=>t.parent!==null).sort((a,b)=>prepared.slots[a.slotId].sources.length-prepared.slots[b.slotId].sources.length);let winner=null;
  for(const t of pair){const slot=prepared.slots[t.slotId],original={u:slot.u,angle:slot.angle,length:slot.length};
   for(const du of [0,-.01,.01,-.025,.025,-.05,.05])for(const da of [0,-.07,.07,-.15,.15,-.3,.3]){
    slot.u=clamp(original.u+du,.01,.99);slot.angle=original.angle+da;
    const count=conflicts(deform(prepared,100,100)).length,cost=count*100+Math.abs(du)*10+Math.abs(da);
    if(count<hits.length&&(!winner||cost<winner.cost))winner={id:slot.id,u:slot.u,angle:slot.angle,cost};
   }
   Object.assign(slot,original);
  }
  if(!winner)return;Object.assign(prepared.slots[winner.id],{u:winner.u,angle:winner.angle,constrained:true});
 }
}
function rematch(model,slots){
 const children=new Map();for(const t of model.tree)if(t.parent!==null){if(!children.has(t.parent))children.set(t.parent,[]);children.get(t.parent).push(t)}
 // Reassociate against the completed template. Initial clustering order must
 // not strand a good observation in a discarded, low-support cluster.
 for(const parent of slots){const targets=slots.filter(t=>t.parent===parent.id).sort((a,b)=>a.u-b.u);if(!targets.length)continue;for(const t of targets)t.sources=[];
  for(const source of parent.sources){const original=model.tree[source.id];for(const mirror of parent.parent===null?[false,true]:[source.mirror]){
   const group=(children.get(original.id)||[]).map(t=>({id:t.id,arm:t.arm,mirror,key:original.id+':'+mirror,u:B.project(t.start,original.path).u,angle:wrap(angle(t)-angle(original))*(mirror?-1:1),length:t.length,width:t.width})).filter(t=>parent.parent!==null||t.angle>0).sort((a,b)=>a.u-b.u),m=targets.length,n=group.length,dp=Array.from({length:m+1},()=>new Float64Array(n+1)),steps=Array.from({length:m+1},()=>new Uint8Array(n+1));
   for(let i=1;i<=m;i++){dp[i][0]=i*1.5;steps[i][0]=1}for(let j=1;j<=n;j++){dp[0][j]=j*1.2;steps[0][j]=2}
   for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){const a=targets[i-1],b=group[j-1],du=Math.abs(a.u-b.u),da=Math.abs(wrap(a.angle-b.angle)),cost=du>.12||da>.65?Infinity:du/.08+da/.6+Math.abs(Math.log(a.length/b.length))*.3,options=[dp[i-1][j-1]+cost,dp[i-1][j]+1.5,dp[i][j-1]+1.2],k=options.indexOf(Math.min(...options));dp[i][j]=options[k];steps[i][j]=k}
   let i=m,j=n;while(i||j){const k=steps[i][j];if(k===0)targets[--i].sources.push(group[--j]);else if(k===1)i--;else j--}
  }}
 }
}
function prepare(model){
 if(cache.has(model))return cache.get(model);
 const source=model;model=Tips.refine(model);
 const canonical=B.consensus(model),slots=canonical.tree.map(t=>({...t,slotId:t.id})),roots=model.tree.filter(t=>t.parent===null),tree=[];
 if(roots.length!==6){const fallback={...model,slots:null,tree:model.tree,source:'image-geodesic'};cache.set(source,fallback);return fallback}
 rematch(model,slots);
 const siblings=new Map();for(const t of slots)if(t.parent!==null){if(!siblings.has(t.parent))siblings.set(t.parent,[]);siblings.get(t.parent).push(t)}
 const bounds=new Map();for(const list of siblings.values()){list.sort((a,b)=>a.u-b.u);list.forEach((t,i)=>bounds.set(t.id,[i?(list[i-1].u+t.u)/2:.015,i+1<list.length?(t.u+list[i+1].u)/2:.985]))}
 for(let arm=0;arm<6;arm++){let rootId=null;
  for(const mirror of [false,true]){const ids=new Map();for(const slot of slots){
   if(slot.parent===null&&mirror){ids.set(slot.id,rootId);continue}
   const source=slot.sources.find(s=>s.arm===arm&&(slot.parent===null||s.mirror===mirror)),original=source?model.tree[source.id]:null;let parent=null,path,u=0,a=0,confidence=1,observed=!!original;
   if(slot.parent===null){path=(original||roots[arm]).path.map(p=>p.slice())}
   else{parent=ids.get(slot.parent);const p=tree[parent];
    if(original){u=B.project(original.start,p.path).u;a=wrap(angle(original)-angle(p));path=line(p,u,a,original.length);confidence=original.confidence}
    else{const recovered=recover(model,p,slot,mirror,bounds.get(slot.id));({path,u,a,confidence,observed}=recovered)}
   }
   const id=tree.length,t={...slot,id,parent,slotId:slot.id,arm,mirror,start:path[0],end:path[1],path,length:B.length(path),u,angle:a,width:original?original.width:slot.width,observed,confidence,sourceId:original?original.id:null};
   tree.push(t);ids.set(slot.id,id);if(slot.parent===null)rootId=id;
  }}
 }
 settle(model,tree);
 // Update the common measurements from the fitted instances, weighting neither
 // a long arm nor a side with more detections more heavily than its peers.
 for(const slot of slots){const group=tree.filter(t=>t.slotId===slot.id),supported=group.filter(t=>t.sourceId!==null&&!t.constrained),use=supported.length>=2?supported:group;slot.length=median(use.map(t=>t.length));slot.width=median(use.map(t=>t.width));if(slot.parent!==null){slot.u=median(use.map(t=>t.u));slot.angle=median(use.map(t=>t.angle*(t.mirror?-1:1)))}}
 const prepared={...model,tree,slots,source:'shared-image-structure'};delete prepared.regionProfiles;repairTemplate(prepared);cache.set(source,prepared);return prepared;
}
function selected(prepared,detail){
 if(!prepared.slots)return new Set(prepared.tree.map(t=>t.id));
 const min=2.7+45*(1-detail/100)**2,keep=new Set();for(const t of prepared.slots)if(t.parent===null||keep.has(t.parent)&&t.length>=min)keep.add(t.id);return keep;
}
function deform(prepared,detail,symmetry){
 if(!prepared.slots)return B.prune(prepared,detail).map(t=>({...t,slotId:t.sourceId,path:t.path.map(p=>p.map(v=>v*prepared.scale)),start:t.start.map(v=>v*prepared.scale),end:t.end.map(v=>v*prepared.scale),length:t.length*prepared.scale}));
 const keep=selected(prepared,detail),z=symmetry/100,tree=[],ids=new Map(),scale=prepared.scale,c=prepared.n/2;
 for(const local of prepared.tree){if(!keep.has(local.slotId))continue;const slot=prepared.slots[local.slotId];let path,parent=null,u=0,relative=0;
  if(local.parent===null){const a=prepared.axis+local.arm*Math.PI/3,theta=angle(local)+wrap(a-angle(local))*z,L=local.length*(1-z)+slot.length*z;path=[[c,c],[c+L*Math.cos(theta),c+L*Math.sin(theta)]]}
  else{parent=ids.get(local.parent);const p=tree[parent],low={start:p.start.map(v=>v/scale),end:p.end.map(v=>v/scale)},L=local.length*(1-z)+slot.length*z;u=local.u*(1-z)+slot.u*z;relative=local.angle+wrap(slot.angle*(local.mirror?-1:1)-local.angle)*z;path=line(low,u,relative,L)}
  path=path.map(p=>p.map(v=>v*scale));const id=tree.length;ids.set(local.id,id);tree.push({...local,id,parent,u,angle:relative,localId:local.id,path,start:path[0],end:path[1],length:B.length(path),width:local.width*scale});
 }
 if(z>0&&z<1&&conflicts(tree).length){for(const t of tree){t.path=t.path.map(p=>p.map(v=>v/scale));t.start=t.path[0];t.end=t.path[1];t.length/=scale;t.width/=scale}settle(prepared,tree);for(const t of tree){t.path=t.path.map(p=>p.map(v=>v*scale));t.start=t.path[0];t.end=t.path[1];t.length*=scale;t.width*=scale}}
 return tree;
}
root.StructuralModel={prepare,selected,deform,evidence};if(typeof module!=='undefined')module.exports=root.StructuralModel;
})(globalThis);
