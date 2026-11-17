/* Browser/in-memory port of the accepted master-side-prototype v4 crystal
 * fitter. The source algorithms, finite-support rules and tolerances are
 * retained; only filesystem checkpoints and process orchestration are removed.
 * Coordinates here are Float64 canonical analysis pixels. */
(function(root){'use strict';
const {Math,Date,Float32Array,Float64Array,Uint8Array,Int32Array,Array,Number,Set,Map,WeakMap,Object}=root;
const earcut=root.earcut,floatClip=root.polygonClipping,F=root.Flake;
if(!earcut||!floatClip||!F)throw Error('Reconstruction partition dependencies missing');
const assert=(condition,message)=>{if(!condition)throw Error(message||'Crystal geometry assertion')};
assert.equal=(a,b,message)=>assert(a===b,message);

const N=(()=>{
/* Canonical median-pixel geometry. The source fitter tolerance is separate.
 * All geometric distance decisions here use the same 3e-5px tolerance. */
const DISTANCE_TOLERANCE=3e-5,SOURCE_TOLERANCE=4e-5;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
function onSegment(p,a,b,tolerance=DISTANCE_TOLERANCE){
 if(!finite(p)||!finite(a)||!finite(b))return false;
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(!length)return distance(p,a)<=tolerance;
 const along=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length;
 return along>=-tolerance&&along<=length+tolerance&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/length<=tolerance;
}
function cleanSpurs(input){
 let p=input.slice(),changed=true;
 // A repeated point alone is insufficient: every removed edge must be
 // cancelled by its exact opposite, so narrow real material is retained.
 const cancelled=q=>{const edges=new Map();for(let i=0;i<q.length;i++){const a=JSON.stringify(q[i]),b=JSON.stringify(q[(i+1)%q.length]);if(a===b)continue;const key=a+'>'+b,rev=b+'>'+a;if(edges.get(rev)){const n=edges.get(rev)-1;if(n)edges.set(rev,n);else edges.delete(rev)}else edges.set(key,(edges.get(key)||0)+1)}return !edges.size&&Math.abs(area(q))<=1e-10};
 while(changed){changed=false;for(let i=0;i<p.length;i++){const j=p.findIndex((q,k)=>k>i&&q[0]===p[i][0]&&q[1]===p[i][1]);if(j<0)continue;const sub=p.slice(i,j),rest=p.slice(j).concat(p.slice(0,i));if(cancelled(sub)){p=p.slice(0,i).concat(p.slice(j));changed=true;break}if(cancelled(rest)){p=sub;changed=true;break}}}
 return p;
}
function simple(input){
 let p=cleanSpurs(input),changed=true;
 if(p.some(q=>!finite(q)))throw Error('Non-finite polygon');
 while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++){const prev=(i+p.length-1)%p.length;if(distance(p[i],p[prev])<=DISTANCE_TOLERANCE){p.splice(i,1);changed=true;break}}if(changed)continue;
  for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(distance(a,c)>DISTANCE_TOLERANCE&&onSegment(b,a,c)){p.splice(i,1);changed=true;break}}
 }return p;
}
const facetCount=p=>simple(p).length;
function contact(input,supports,{insert=true}={}){
 const p=input.slice();
 for(const s of supports.filter(Boolean)){if(!s.segment||s.segment.length!==2||!s.segment.every(finite))continue;const [a,b]=s.segment;
  for(const q of p)if(onSegment(q,a,b))return {polygon:p,support:{...s,point:q}};
  if(!insert)continue;
  const ux=b[0]-a[0],uy=b[1]-a[1];
  for(let i=0;i<p.length;i++){const c=p[i],d=p[(i+1)%p.length],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;if(!den)continue;
   const t=((c[0]-a[0])*vy-(c[1]-a[1])*vx)/den,q=((c[0]-a[0])*uy-(c[1]-a[1])*ux)/den;
   // Crossing is of the finite segments. Do not extend the support line.
   if(t<0||t>1||q<0||q>1)continue;const point=[c[0]+q*vx,c[1]+q*vy];if(!finite(point))continue;
   p.splice(i+1,0,point);return {polygon:p,support:{...s,point}};
  }
 }return null;
}
function conform(input){
 const vertices=[];
 const add=p=>{let id=vertices.findIndex(q=>distance(p,q)<=DISTANCE_TOLERANCE);if(id<0){id=vertices.length;vertices.push(p.slice())}return id};
 let cells=input.map(c=>({...c,polygon:cleanSpurs(c.polygon).map(p=>vertices[add(p)])}));
 cells=cells.map(c=>{const ids=[];for(let i=0;i<c.polygon.length;i++){const a=c.polygon[i],b=c.polygon[(i+1)%c.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;ids.push(add(a));const middle=vertices.map((p,id)=>({p,id,t:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length})).filter(v=>v.t>DISTANCE_TOLERANCE&&v.t<length-DISTANCE_TOLERANCE&&onSegment(v.p,a,b)).sort((a,b)=>a.t-b.t);ids.push(...middle.map(v=>v.id))}const unique=ids.filter((id,i)=>id!==ids[(i+ids.length-1)%ids.length]);const polygon=cleanSpurs(unique.map(id=>vertices[id]));return {...c,polygon,vertices:polygon.map(add),facetCount:facetCount(polygon)}});
 return {cells,vertices};
}
return {DISTANCE_TOLERANCE,SOURCE_TOLERANCE,distance,finite,area,onSegment,cleanSpurs,simple,facetCount,contact,conform};

})();
const W=(()=>{
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const open=p=>p.length>1&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1]?p.slice(0,-1):p;
const clean=p=>{p=open(p);return p.filter((a,i)=>{const b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((a[0]-b[0])*(c[1]-a[1])-(a[1]-b[1])*(c[0]-a[0]))>1e-8})};
const mpArea=mp=>mp.reduce((s,poly)=>s+Math.abs(area(open(poly[0])))-poly.slice(1).reduce((s,r)=>s+Math.abs(area(open(r))),0),0);
let PRECISION=1e6,HARD_SEEDS=true;
// Canonical pixels. This tolerance welds boolean round-off, not image gaps.
const WELD_TOLERANCE=3e-5;
function weldPolygons(polygons){
 const points=[];
 for(const p of polygons)for(const a of p)if(!points.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<=WELD_TOLERANCE))points.push(a.slice());
 const canonical=a=>points.find(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<=WELD_TOLERANCE);
 const rings=polygons.map(p=>p.map(canonical));
 return rings.map(p=>{const result=[];for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<=WELD_TOLERANCE**2)continue;
  const middle=points.map(q=>({q,t:((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2})).filter(({q,t})=>t>WELD_TOLERANCE/Math.sqrt(l2)&&t<1-WELD_TOLERANCE/Math.sqrt(l2)&&Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)<=WELD_TOLERANCE*Math.sqrt(l2)).sort((a,b)=>a.t-b.t);
  result.push(a,...middle.map(x=>x.q));
 }return result.filter((a,i,all)=>!i||a!==all[i-1])});
}
const snap=mp=>mp.map(poly=>poly.map(r=>r.map(p=>p.map(v=>Math.round(v*PRECISION)/PRECISION))));
function operation(type,...a){return snap(floatClip[type](...a.map(snap)))}
const pc={union:(...a)=>operation('union',...a),intersection:(...a)=>operation('intersection',...a),difference:(...a)=>operation('difference',...a)};
function union(list){return list.length?pc.union(...list):[]}
const subject=p=>[[p]];
function sanitize(p){
 let changed=true;while(changed&&p.length>3){changed=false;
  for(let i=0;i<p.length;i++){const j=p.findIndex((q,k)=>k>i&&Math.hypot(q[0]-p[i][0],q[1]-p[i][1])<9e-6);if(j<0)continue;
   const sub=p.slice(i,j),rest=p.slice(j).concat(p.slice(0,i));
   if(Math.abs(area(sub))<1e-5){p=p.slice(0,i).concat(p.slice(j));changed=true;break}
   if(Math.abs(area(rest))<1e-5){p=sub;changed=true;break}
  }
 }return p;
}
function adjacent(a,b){for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],dx=q[0]-p[0],dy=q[1]-p[1],l2=dx*dx+dy*dy;if(l2<1e-12)continue;
 for(let j=0;j<b.length;j++){const r=b[j],s=b[(j+1)%b.length];if(Math.abs((r[0]-p[0])*dy-(r[1]-p[1])*dx)>1e-5*Math.sqrt(l2)||Math.abs((s[0]-p[0])*dy-(s[1]-p[1])*dx)>1e-5*Math.sqrt(l2))continue;
 const t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/l2,u=((s[0]-p[0])*dx+(s[1]-p[1])*dy)/l2;if(Math.min(1,Math.max(t,u))-Math.max(0,Math.min(t,u))>1e-7)return true;
 }}return false}
function touches(p,supports){
 for(const s of supports){const [a,b]=s.segment,ux=b[0]-a[0],uy=b[1]-a[1],l2=ux*ux+uy*uy;
  for(let i=0;i<p.length;i++){const c=p[i],d=p[(i+1)%p.length],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;
   if(Math.abs(den)>1e-10){const t=((c[0]-a[0])*vy-(c[1]-a[1])*vx)/den,q=((c[0]-a[0])*uy-(c[1]-a[1])*ux)/den;
    if(t>=-1e-7&&t<=1+1e-7&&q>=-1e-7&&q<=1+1e-7)return {...s,point:[a[0]+t*ux,a[1]+t*uy]};
   }else{const t=((c[0]-a[0])*ux+(c[1]-a[1])*uy)/l2;if(t>=-1e-7&&t<=1+1e-7&&Math.abs((c[0]-a[0])*uy-(c[1]-a[1])*ux)<1e-5)return {...s,point:c}}
  }
 }return null;
}
function convex(p){return p.every((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-7})}
function clip(p,n,c){const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=n[0]*a[0]+n[1]*a[1]-c,db=n[0]*b[0]+n[1]*b[1]-c;if(da>=-1e-8)out.push(a);if(da*db<-1e-12)out.push([a[0]+(b[0]-a[0])*da/(da-db),a[1]+(b[1]-a[1])*da/(da-db)])}return out}
function propagateSupport(input,supports){
 const cells=input.slice(),graph=cells.map(()=>new Set()),rooted=cells.map(c=>!!touches(c.polygon,supports));
 for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++)if(adjacent(cells[i].polygon,cells[j].polygon)){graph[i].add(j);graph[j].add(i)}
 let progress=true;while(progress){progress=false;
  for(let i=0;i<cells.length;i++){if(!cells[i]||rooted[i])continue;
   const options=[...graph[i]].filter(j=>cells[j]&&rooted[j]).sort((a,b)=>cells[a].polygon.length-cells[b].polygon.length);
   for(const j of options){try{const pair=weldPolygons([cells[j].polygon,cells[i].polygon]),u=pc.union(...pair.map(subject));if(u.length!==1||u[0].length!==1)continue;const p=sanitize(clean(u[0][0]));if(!touches(p,supports))continue;cells[j]={...cells[j],polygon:p,masterParents:[...new Set([...(cells[i].masterParents||[]),...(cells[j].masterParents||[])])]};cells[i]=null;for(const k of graph[i])if(k!==j&&cells[k]){graph[j].add(k);graph[k].delete(i);graph[k].add(j)}graph[j].delete(i);progress=true;break}catch{}}
  }
 }return cells.filter(Boolean);
}
function mesh(poly,meta){
 const flat=earcut.flatten(poly.map(open)),ids=earcut(flat.vertices,flat.holes,2),cells=[];
 for(let i=0;i<ids.length;i+=3){let p=ids.slice(i,i+3).map(j=>flat.vertices.slice(j*2,j*2+2));if(area(p)<0)p.reverse();if(area(p)>1e-7)cells.push(p)}
 // Greedily merge adjacent triangles into compact convex 3–6-sided facets.
 // Never alter their union or bridge an internal void.
 const attached=p=>!meta.axisOrigin||p.some(a=>{const [x,y]=meta.axisOrigin,[ux,uy]=meta.axisDirection,t=(a[0]-x)*ux+(a[1]-y)*uy;return Math.abs((a[0]-x)*uy-(a[1]-y)*ux)<1e-5&&t>=-1e-5&&t<=meta.axisLength+1e-5});
 // A merge only invalidates pairs containing its new polygon. Cache every
 // unchanged pair so the accepted greedy choice does not rerun the same exact
 // boolean hundreds of times on curving, non-catalogue photographic boundaries.
 const identities=new WeakMap(),pairs=new Map();let nextIdentity=0;
 const identity=p=>{if(!identities.has(p))identities.set(p,nextIdentity++);return identities.get(p)};
 let changed=true;
 while(changed){changed=false;let best=null;
  for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++){
   const key=identity(cells[i])+':'+identity(cells[j]);let candidate;
   if(pairs.has(key))candidate=pairs.get(key);
   else{
    candidate=null;let shares=0;for(const a of cells[i])if(cells[j].some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7))shares++;
    if(shares>=2){const u=floatClip.union(subject(cells[i]),subject(cells[j]));if(u.length===1&&u[0].length===1){let p=clean(u[0][0]);if(area(p)<0)p.reverse();const fixesAttachment=attached(p)&&(!attached(cells[i])||!attached(cells[j]));if(p.length<=6&&(convex(p)||fixesAttachment))candidate={p,merit:(fixesAttachment?1e6:0)+area(p)/p.length};}}
    pairs.set(key,candidate);
   }
   if(candidate&&(!best||candidate.merit>best.merit))best={i,j,...candidate};
  }
  if(best){cells[best.j]=best.p;cells.splice(best.i,1);changed=true}
 }
 return cells.map(p=>({...meta,polygon:p,attached:attached(p)}));
}
// Preserve exact observed/inferred hub contacts while reducing the outer
// contour. RDP runs on open arcs between finite hex intersections, so a coarse
// chord cannot shortcut across a narrow material neck and detach its branch.
function simplifyCoreContacts(p,tolerance,hex,seam){
 const segments=hex.map((a,i)=>[a,hex[(i+1)%hex.length]]).concat(seam?[seam]:[]);
 const onHex=q=>segments.some(([a,b])=>N.onSegment(q,a,b,1e-7));
 const ring=[],locked=[];
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],hits=[];
  ring.push(a);locked.push(onHex(a));
  for(let j=0;j<segments.length;j++){const [c,d]=segments[j],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;
   const ax=c[0]-a[0],ay=c[1]-a[1],t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
   if(t>1e-8&&t<1-1e-8&&u>=-1e-8&&u<=1+1e-8)hits.push({t,p:[a[0]+t*dx,a[1]+t*dy]});
  }
  hits.sort((a,b)=>a.t-b.t);for(const hit of hits)if(!ring.length||Math.hypot(hit.p[0]-ring.at(-1)[0],hit.p[1]-ring.at(-1)[1])>1e-8){ring.push(hit.p);locked.push(true)}
 }
 const anchors=locked.map((v,i)=>v?i:-1).filter(i=>i>=0);
 if(anchors.length<2)return F.simplify(p,tolerance);
 function rdp(path){if(path.length<=2)return path;const a=path[0],b=path.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let maximum=0,index=0;
  for(let i=1;i<path.length-1;i++){const q=path[i],t=l2?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2)):0,d=(q[0]-a[0]-t*dx)**2+(q[1]-a[1]-t*dy)**2;if(d>maximum){maximum=d;index=i}}
  return maximum>tolerance*tolerance?rdp(path.slice(0,index+1)).slice(0,-1).concat(rdp(path.slice(index))):[a,b];
 }
 const result=[];for(let i=0;i<anchors.length;i++){const lo=anchors[i],hi=anchors[(i+1)%anchors.length],arc=[ring[lo]];for(let j=(lo+1)%ring.length;j!==hi;j=(j+1)%ring.length)arc.push(ring[j]);arc.push(ring[hi]);result.push(...rdp(arc).slice(0,-1));}
 return result;
}
function run(row,raw,tolerance=1.6,options={}){
 const ref='upload';
 if(options.hardSeeds!==undefined)HARD_SEEDS=options.hardSeeds;
 const n=row.n;
 const loops=F.contours(raw,n,options.preserveCore?0:Math.min(.6,tolerance)).map(p=>{if(options.preserveCore&&area(p)>0)return simplifyCoreContacts(p.map(([x,y])=>[x-.5,y-.5]),tolerance,row.localHex,[[0,0],[n*Math.tan(row.halfAngles[0]),n]]);const q=area(p)>0?F.simplify(p,tolerance):options.preserveCore?F.simplify(p,.6):p;return q.map(([x,y])=>[x-.5,y-.5])});
 const outers=loops.filter(p=>area(p)>0),holes=loops.filter(p=>area(p)<0);
 let target=union(outers.map(subject));if(holes.length)target=pc.difference(target,union(holes.map(subject)));
 // Keep a straight x=0 symmetry seam and exact central exclusion. The same
 // clipping is used by saved geometry, not by the preview.
 target=pc.intersection(target,subject([[0,0],[row.displayShape[1],0],[row.displayShape[1],row.displayShape[0]],[0,row.displayShape[0]]]));target=pc.intersection(target,subject([[0,0],[n*Math.tan(row.halfAngles[0]),n],[0,n]]));target=pc.intersection(target,subject(row.imageBounds));target=pc.difference(target,subject(row.localHex));
 const supports=row.branches.map((b,i)=>({kind:'branch',identity:`branch-${i}`,segment:[[0,b.attachment],b.tip]}));
 supports.push(...row.hexSupports);
 supports.push({kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,row.trunkTip]]});
 // A disconnected target component cannot acquire skeleton support through a
 // facet merge. Retry contour reduction first; preserve it and fail explicitly
 // when finer contours confirm the source material itself is disconnected.
 const excludedUnsupported=[];
 if(options.coarse){const limit=Math.max(20,.002*mpArea(target));target=target.filter(poly=>{if(!poly.some(ring=>touches(open(ring),supports))&&mpArea([poly])<=limit){excludedUnsupported.push({polygon:poly,area:mpArea([poly]),reason:'small disconnected component without a fixed growth support'});return false}return true})}
 const unsupportedComponents=target.filter(poly=>!poly.some(ring=>touches(open(ring),supports)));
 if(unsupportedComponents.length){
  const reason=`Material components cannot reach fixed supports on ${ref}: areas=${unsupportedComponents.map(poly=>mpArea([poly]).toFixed(9)).join(',')}; target components=${target.length}; contourTolerance=${tolerance}`;
  if(tolerance>0&&!options.coarse){options.attempts?.push({contourTolerance:tolerance,reason});return run(row,raw,tolerance>.6?.6:tolerance>.15?.15:0,options)}
  throw Error(reason);
 }
 let remaining=target,cells=[];
 const slots=row.branches,slopes=slots.map(b=>1/Math.tan(b.angle*Math.PI/180));
 for(let i=0;i<slots.length;i++)for(const side of [-1,1]){
  const b=slots[i],bounds=[[[1,0],3]];
  if(i)bounds.push([[-(slopes[i-1]+slopes[i])/2,1],(slots[i-1].attachment+b.attachment)/2]);
  if(i+1<slots.length)bounds.push([[(slopes[i+1]+slopes[i])/2,-1],-(slots[i+1].attachment+b.attachment)/2]);
  else bounds.push([[slopes[i]+1/Math.sin(b.angle*Math.PI/180),-1],-b.attachment]);
  // Signed normal is positive below the branch axis, matching v2 side IDs.
  bounds.push([[side*slopes[i],-side],-side*b.attachment]);
  let region=[[0,0],[n,0],[n,n],[0,n]];for(const [normal,c] of bounds)region=clip(region,normal,c);
  if(region.length<3)continue;
  const original=row.sharedBranches[i],angle=original.angle*Math.PI/180,localAngle=b.angle*Math.PI/180,axis=[Math.sin(localAngle),Math.cos(localAngle)];
  const seeds=row.sourceCells.map((c,id)=>({c,id})).filter(({c})=>c.kind==='branch'&&c.identity===`branch-${i}`&&c.side===side).map(({c,id})=>{const center=c.polygon.reduce((s,p)=>[s[0]+p[0]/c.polygon.length,s[1]+p[1]/c.polygon.length],[0,0]);return {id,t:(center[0]*Math.sin(angle)+(center[1]-original.attachment)*Math.cos(angle))/original.length*b.length}}).sort((a,b)=>a.t-b.t);
  const divisions=HARD_SEEDS&&seeds.length?seeds:[{id:null,t:b.length/2}];
  for(let slot=0;slot<divisions.length;slot++){
   let piece=region;
   const rootProjection=b.attachment*axis[1];
   if(slot)piece=clip(piece,axis,rootProjection+(divisions[slot-1].t+divisions[slot].t)/2);
   if(slot+1<divisions.length)piece=clip(piece,[-axis[0],-axis[1]],-rootProjection-(divisions[slot+1].t+divisions[slot].t)/2);
   if(piece.length<3)continue;const part=pc.intersection(remaining,subject(piece));
   for(const poly of part)cells.push(...mesh(poly,{identity:`branch-${i}`,side,kind:'branch',masterParents:divisions[slot].id===null?[]:[divisions[slot].id],axisOrigin:[0,b.attachment],axisDirection:axis,axisLength:b.length}));
   if(part.length)remaining=pc.difference(remaining,part);
  }
 }
 for(const poly of remaining){
  const rest=mesh(poly,{identity:'trunk-junction',side:0,kind:'trunk',axisOrigin:[0,0],axisDirection:[0,1],axisLength:n});cells.push(...rest);
 }
 const welded=weldPolygons(cells.map(c=>c.polygon));for(let i=0;i<cells.length;i++)cells[i].polygon=sanitize(welded[i]);
 cells=cells.filter(c=>c.polygon.length>=3&&area(c.polygon)>1e-7);
 // Completion facets must themselves reach a fixed skeleton or hex boundary.
 // Merge unsupported fragments with adjacent supported material; never invent
 // a connector crossing a photographed opening. Concave completion cells are
 // allowed when a convex split would leave a detached cell.
 if(options.coarse)cells=propagateSupport(cells,supports);
 let pending=true;const discardedIsolated=[];
 while(pending){pending=false;let best=null;
  for(let i=0;i<cells.length;i++){
   if(touches(cells[i].polygon,supports))continue;pending=true;
   for(let j=0;j<cells.length;j++){if(i===j)continue;
    const a=cells[i].polygon,b=cells[j].polygon;
    if(!adjacent(a,b))continue;
    const pair=weldPolygons([a,b]),u=pc.union(...pair.map(subject));if(u.length!==1||u[0].length!==1)continue;
    let p=sanitize(clean(u[0][0]));if(area(p)<0)p.reverse();const support=touches(p,supports);
    const score=p.length+(support?0:1000)+.0001*area(p);
    if(!best||score<best.score)best={i,j,p,score};
   }
  }
  if(!pending)break;
  if(!best){const isolated=cells.filter(c=>!touches(c.polygon,supports));
   const reason=`Material cannot reach any fixed support on ${ref}: ${isolated.length} unsupported cells; areas=${isolated.map(c=>area(c.polygon).toFixed(9)).join(',')}; target components=${target.length}; contourTolerance=${tolerance}`;
   if(options.coarse)break;
   if(tolerance>0){options.attempts?.push({contourTolerance:tolerance,reason});return run(row,raw,tolerance>.6?.6:tolerance>.15?.15:0,options)}
   throw Error(reason);
  }
  cells[best.j].polygon=best.p;cells[best.j].masterParents=[...new Set([...(cells[best.j].masterParents||[]),...(cells[best.i].masterParents||[])])];cells.splice(best.i,1);
 }
 for(const c of cells){const preferred=supports.filter(s=>s.kind===c.kind&&(s.kind!=='branch'||s.identity===c.identity));const support=touches(c.polygon,preferred)||touches(c.polygon,supports.filter(s=>s.kind==='hex'))||touches(c.polygon,supports.filter(s=>s.kind==='trunk'))||touches(c.polygon,supports);if(!support){if(options.coarse){c.growthSupport=null;continue}throw Error('Unsupported cell')}c.growthSupport=support;c.kind=support.kind;c.identity=support.identity;
  if(c.kind==='branch'){const b=row.branches[Number(c.identity.split('-')[1])],a=b.angle*Math.PI/180,center=c.polygon.reduce((s,p)=>[s[0]+p[0]/c.polygon.length,s[1]+p[1]/c.polygon.length],[0,0]);c.side=center[0]*Math.cos(a)-(center[1]-b.attachment)*Math.sin(a)>=0?1:-1}
  else c.side=0;
 }
 for(const c of cells)if(!c.masterParents?.length){const center=c.polygon.reduce((s,p)=>[s[0]+p[0]/c.polygon.length,s[1]+p[1]/c.polygon.length],[0,0]);const choices=row.sourceCells.map((cell,id)=>({cell,id})).filter(({cell})=>cell.kind===c.kind);choices.sort((a,b)=>{const score=q=>{const m=q.cell.polygon.reduce((s,p)=>[s[0]+p[0]/q.cell.polygon.length,s[1]+p[1]/q.cell.polygon.length],[0,0]);return Math.hypot(m[0]-center[0],m[1]*row.trunkTip/340-center[1])};return score(a)-score(b)});c.masterParents=choices.length?[choices[0].id]:[]}
 const baseCut=union(cells.map(c=>subject(c.polygon)));
 const missing=mpArea(pc.difference(target,baseCut)),excess=mpArea(pc.difference(baseCut,target));
 const cellArea=cells.reduce((s,c)=>s+area(c.polygon),0),overlap=cellArea-mpArea(baseCut);
 if(missing>.01||excess>.01||Math.abs(overlap)>.01)throw Error(`Union mismatch ${ref}: ${missing}/${excess}/${overlap}`);
 // Conform all cell boundaries: insert every existing vertex that lies on an
 // edge. Collinear junctions are explicit; completion facets may have more
 // than six sides and are passed to the separately verified partitioner.
 const verts=new Map();for(const c of cells)for(const p of c.polygon)verts.set(p.map(x=>x.toFixed(7)).join(','),p);
 for(const c of cells){if(!c.growthSupport)continue;const p=c.growthSupport.point;verts.set(p.map(x=>x.toFixed(7)).join(','),p)}
 const all=[...verts.values()];
 for(const c of cells){c.facetCount=c.polygon.length;const out=[];
  for(let i=0;i<c.polygon.length;i++){const a=c.polygon[i],b=c.polygon[(i+1)%c.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
   const middle=all.map(p=>({p,t:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2})).filter(({p,t})=>t>1e-7&&t<1-1e-7&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)<1e-6*Math.sqrt(l2)).sort((a,b)=>a.t-b.t);
   out.push(a,...middle.map(x=>x.p));
  }c.polygon=out;
 }
 // Canonical vertex registry makes equal shared positions explicit in output.
 const points=[],registry=new Map();for(const c of cells){c.vertices=c.polygon.map(p=>{const close=points.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<9e-6);if(close>=0)return close;const k=p.map(x=>x.toFixed(6)).join(',');if(!registry.has(k)){registry.set(k,points.length);points.push(p.map(v=>Math.round(v*PRECISION)/PRECISION))}return registry.get(k)});c.vertices=c.vertices.filter((id,i,all)=>id!==all[(i+all.length-1)%all.length])}
 for(const c of cells){
  let changed=true;while(changed&&c.vertices.length>3){changed=false;for(let i=0;i<c.vertices.length;i++){const j=c.vertices.indexOf(c.vertices[i],i+1);if(j<0)continue;const loop=c.vertices.slice(i,j).map(id=>points[id]),rest=c.vertices.slice(j).concat(c.vertices.slice(0,i)).map(id=>points[id]);if(Math.abs(area(loop))<1e-5){c.vertices.splice(i,j-i);changed=true;break}if(Math.abs(area(rest))<1e-5){c.vertices=c.vertices.slice(i,j);changed=true;break}}}
  c.polygon=c.vertices.map(i=>points[i]);
 }
 cells=cells.filter(c=>c.polygon.length>=3&&area(c.polygon)>1e-7);
 const finalCut=union(cells.map(c=>subject(c.polygon))),finalMissing=mpArea(pc.difference(target,finalCut)),finalExcess=mpArea(pc.difference(finalCut,target)),finalOverlap=cells.reduce((s,c)=>s+area(c.polygon),0)-mpArea(finalCut);
 if(finalMissing>.01||finalExcess>.01||Math.abs(finalOverlap)>.01)throw Error('Final topology changed material');
 for(const c of cells)for(const key of ['axisOrigin','axisDirection','axisLength','attached'])delete c[key];
 const report={...row};delete report.sourceCells;Object.assign(report,{cells,vertices:points,interpretedMaterial:target,baseCut:finalCut,clipPrecision:PRECISION,masterGuidance:HARD_SEEDS?'partition':'soft-region',discardedIsolated,excludedUnsupported,fidelityMode:options.coarse?'coarse':'detailed',contourTolerance:tolerance,weldTolerance:WELD_TOLERANCE,attempts:options.attempts||[],validation:{missingArea:finalMissing,excessArea:finalExcess,overlapArea:finalOverlap,materialArea:mpArea(target),cutHoles:finalCut.reduce((s,p)=>s+p.length-1,0)}});
 return report;
}

return {pc,union,mpArea,area,adjacent,touches,subject,clean,weldPolygons,run};
})();
const M=W;
const B=(()=>{
/* Piecewise-affine supported fans, in canonical median pixels.
 * An earcut triangulation is mapped to the same combinatorial triangulation
 * of a convex polygon. Straight spokes there map to noncrossing bent spokes
 * here. Their intervening faces retain the complete original boundary.
 * The 3–6 facet limit applies after mapping back, never in the convex domain.
 */
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];

function rootsFor(p,supports){
 const groups=[];
 for(const support of supports){
  if(!support.segment)continue;
  const roots=[],[a,b]=support.segment,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
  const add=point=>{
   const vertex=p.find(q=>N.distance(q,point)<=N.DISTANCE_TOLERANCE);
   if(vertex)point=vertex;
   if(!p.some((q,i)=>N.onSegment(point,q,p[(i+1)%p.length])))return;
   if(!roots.some(r=>N.distance(r.point,point)<=N.DISTANCE_TOLERANCE))roots.push({point,support});
  };
  // Contact() returns the first endpoint on a coincident edge. The opposite
  // finite support endpoint and interior roots are equally valid fan anchors.
  add(a);add(b);
  for(let i=0;i<p.length;i++){
   const hit=N.contact([p[i],p[(i+1)%p.length]],[support]);if(hit)add(hit.support.point);
   if(l2){const q=p[i],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2));add([a[0]+t*dx,a[1]+t*dy])}
  }
  if(l2)for(const t of [.5,.25,.75])add([a[0]+t*dx,a[1]+t*dy]);
  groups.push(roots);
 }
 // Competing supports each receive a turn before one long coincident edge can
 // spend the bounded search budget on all of its own anchors.
 const roots=[];for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i]&&!roots.some(r=>N.distance(r.point,group[i].point)<=N.DISTANCE_TOLERANCE))roots.push(group[i]);
 return roots;
}

function rootedRing(input,root){
 let p=input.slice(),index=p.findIndex(q=>N.distance(q,root.point)<=N.DISTANCE_TOLERANCE);
 if(index<0){
  const edge=p.findIndex((a,i)=>N.onSegment(root.point,a,p[(i+1)%p.length]));
  if(edge<0)return null;
  p.splice(edge+1,0,root.point);index=edge+1;
 }
 return p.slice(index).concat(p.slice(0,index));
}

function edgesFor(p,rotation){
 const n=p.length,order=Array.from({length:n},(_,i)=>(i+rotation)%n);
 const flat=order.flatMap(i=>p[i]),triangles=earcut(flat,null,2),edges=new Map();
 if(triangles.length!==3*(n-2))return null;
 for(let k=0;k<triangles.length;k+=3)for(let e=0;e<3;e++){
  const a=order[triangles[k+e]],b=order[triangles[k+(e+1)%3]];
  if((a+1)%n===b||(b+1)%n===a)continue;
  const key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,[a,b]);
 }
 return [...edges.values()];
}

function convexRing(p,mode){
 const weights=p.map((a,i)=>{
  const length=N.distance(a,p[(i+1)%p.length]);
  return mode===0?1:mode===1?Math.sqrt(Math.max(length,.01)):Math.max(length,.01);
 });
 const total=weights.reduce((a,b)=>a+b,0);let angle=0;
 return weights.map(weight=>{const q=[Math.cos(angle),Math.sin(angle)];angle+=2*Math.PI*weight/total;return q});
}

function simplePath(input){
 const points=[];
 for(const point of input){
  if(points.length&&N.distance(points[points.length-1],point)<=N.DISTANCE_TOLERANCE)continue;
  while(points.length>1&&N.onSegment(points[points.length-1],points[points.length-2],point))points.pop();
  points.push(point);
 }
 return points;
}

function mappedSpoke(index,p,domain,edges){
 if(index===0)return [p[0]];
 const start=domain[0],direction=subtract(domain[index],start),hits=[];
 for(const [a,b] of edges){
  if(a===0||b===0||a===index||b===index)continue;
  const edge=subtract(domain[b],domain[a]),den=cross(direction,edge);
  if(Math.abs(den)<1e-12)continue;
  const delta=subtract(domain[a],start),t=cross(delta,edge)/den,u=cross(delta,direction)/den;
  if(t<=1e-9||t>=1-1e-9||u<-1e-9||u>1+1e-9)continue;
  hits.push({t,point:[p[a][0]+u*(p[b][0]-p[a][0]),p[a][1]+u*(p[b][1]-p[a][1])]});
 }
 hits.sort((a,b)=>a.t-b.t);
 // These are open paths: polygon simplification would also inspect the
 // artificial closing edge and could remove their required support endpoint.
 return simplePath([p[0],...hits.map(h=>h.point),p[index]]);
}

function inside(q,p){
 let yes=false;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[i],b=p[j];if(N.onSegment(q,a,b))return true;
  if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}

function visible(a,b,p){
 const direction=subtract(b,a);
 for(let i=0;i<p.length;i++){
  const c=p[i],d=p[(i+1)%p.length],edge=subtract(d,c),den=cross(direction,edge);
  if(Math.abs(den)<1e-12)continue;
  const delta=subtract(c,a),t=cross(delta,edge)/den,u=cross(delta,direction)/den;
  if(t>1e-8&&t<1-1e-8&&u>1e-8&&u<1-1e-8)return false;
 }
 return [.1,.25,.5,.75,.9].every(t=>inside([a[0]+t*direction[0],a[1]+t*direction[1]],p));
}

function shorten(spoke,p,mode){
 if(!mode||spoke.length<=2)return spoke;
 const points=mode===2?spoke.slice().reverse():spoke,result=[points[0]];
 for(let i=0;i<points.length-1;){
  let j=points.length-1;while(j>i+1&&!visible(points[i],points[j],p))j--;
  result.push(points[j]);i=j;
 }
 return mode===2?result.reverse():result;
}

function fan(c,p,domain,edges,supports,alive,shortcut){
 const n=p.length,spokes=p.map((_,i)=>shorten(mappedSpoke(i,p,domain,edges),p,shortcut));
 const cost=Array(n).fill(Infinity),back=Array(n);cost[1]=0;
 for(let i=1;i<n-1&&alive();i++){
  if(!Number.isFinite(cost[i]))continue;
  // Every original corner on the outer arc contributes a facet; extra bends
  // can only reduce this range, so longer arcs cannot form a six-sided face.
  for(let j=i+1;j<n&&j-i<=5;j++){
   const polygon=N.simple([...spokes[i],...p.slice(i+1,j+1),...spokes[j].slice(1,-1).reverse()]);
   if(polygon.length<3||polygon.length>6||N.area(polygon)<=1e-8)continue;
   const contact=N.contact(polygon,supports);if(!contact)continue;
   const value=cost[i]+1+polygon.length*.001;
   if(value<cost[j]){cost[j]=value;back[j]={i,cell:{...c,polygon:contact.polygon,growthSupport:contact.support,kind:contact.support.kind,identity:contact.support.identity}}}
  }
 }
 if(!back[n-1])return null;
 const cells=[];for(let j=n-1;j>1;){const step=back[j];if(!step)return null;cells.push(step.cell);j=step.i}
 return cells;
}

function valid(cells,target,supports){
 try{
  if(cells.some(c=>N.facetCount(c.polygon)<3||N.facetCount(c.polygon)>6||N.area(c.polygon)<=0||!N.contact(c.polygon,supports)))return false;
  const union=M.union(cells.map(c=>M.subject(c.polygon)));
  return M.mpArea(M.pc.difference(M.subject(target),union))<.001&&M.mpArea(M.pc.difference(union,M.subject(target)))<.001&&Math.abs(cells.reduce((sum,c)=>sum+N.area(c.polygon),0)-M.mpArea(union))<.001;
 }catch{return false}
}

function partition(c,supports,{budgetMs=80}={}){
 const deadline=Date.now()+budgetMs,alive=()=>Date.now()<deadline;
 const input=N.simple(c.polygon);
 if(input.length<3||N.area(input)<=0)return null;
 const roots=rootsFor(input,supports);let best=null;
 for(const root of roots){
  if(!alive())break;
  const p=rootedRing(input,root);if(!p)continue;
  // Rotating the input changes earcut's deterministic diagonal choices.
  const rotations=[0,Math.floor(p.length/3),Math.floor(2*p.length/3),1,Math.floor(p.length/2)];
  for(const rotation of [...new Set(rotations)]){
   if(!alive())break;
   const edges=edgesFor(p,rotation);if(!edges)continue;
   for(let mode=0;mode<3&&alive();mode++)for(let shortcut=0;shortcut<3&&alive();shortcut++){
    const cells=fan(c,p,convexRing(p,mode),edges,supports,alive,shortcut);
    // Shortcut paths can cross their neighbors, unlike the homeomorphic
    // paths. Accept them only after measuring the actual complete cell union.
    if(cells&&(!best||cells.length<best.length)&&valid(cells,input,supports))best=cells;
   }
  }
 }
 return best?{cells:best}:null;
}

return {partition};

})();
const C=(()=>{
/* Exterior-only artistic coarsening, in canonical median pixels.
 * Internal interfaces and hole rims are immutable. Each replacement chord is
 * within maxDistance of its complete original boundary arc in both directions:
 * the arc's vertices lie in the chord's convex distance capsule, and its
 * continuous projection covers that chord. Areas are measured against the
 * original cell, so repeated removals cannot accumulate an unreported bias.
 */
const T=N.DISTANCE_TOLERANCE;
const open=r=>r.length>1&&N.distance(r[0],r[r.length-1])<=T?r.slice(0,-1):r.slice();
function pointDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
 const t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function exteriorEdge(a,b,rings){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<=T)return false;
 const intervals=[];
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const c=ring[i],d=ring[(i+1)%ring.length];
  if(pointDistance(c,a,b)>T&&pointDistance(d,a,b)>T){
   // Endpoints may lie beyond this cell edge; test the supporting line too.
   if(Math.abs((c[0]-a[0])*dy-(c[1]-a[1])*dx)>T*length||Math.abs((d[0]-a[0])*dy-(d[1]-a[1])*dx)>T*length)continue;
  }else if(Math.abs((c[0]-a[0])*dy-(c[1]-a[1])*dx)>T*length||Math.abs((d[0]-a[0])*dy-(d[1]-a[1])*dx)>T*length)continue;
  const t=((c[0]-a[0])*dx+(c[1]-a[1])*dy)/length,u=((d[0]-a[0])*dx+(d[1]-a[1])*dy)/length;
  intervals.push([Math.max(0,Math.min(t,u)),Math.min(length,Math.max(t,u))]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);let end=0;
 for(const [lo,hi]of intervals){if(hi<=end)continue;if(lo>end+T)return false;end=hi;if(end>=length-T)return true}
 return false;
}
function simpleRing(p){
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||(i===0&&j===p.length-1))continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  if(N.onSegment(a,c,d)||N.onSegment(b,c,d)||N.onSegment(c,a,b)||N.onSegment(d,a,b))return false;
  if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)return false;
 }return true;
}
function valid(cells,p,supports){
 try{
  if(!cells.length||cells.some(c=>c.polygon.some(q=>!N.finite(q))||N.area(c.polygon)<=0||N.facetCount(c.polygon)<3||N.facetCount(c.polygon)>6||!N.contact(c.polygon,supports,{insert:false})))return false;
  const u=M.union(cells.map(c=>M.subject(c.polygon)));
  return M.mpArea(M.pc.difference(M.subject(p),u))<.001&&M.mpArea(M.pc.difference(u,M.subject(p)))<.001&&Math.abs(cells.reduce((s,c)=>s+N.area(c.polygon),0)-M.mpArea(u))<.001;
 }catch{return false}
}
function coarsen(c,supports,material,{budgetMs=30,maxDistance=4}={}){
 const deadline=Date.now()+budgetMs,alive=()=>Date.now()<deadline;
 try{
  let original=open(N.cleanSpurs(c.polygon));
  if(original.length<3||original.some(p=>!N.finite(p))||N.area(original)<=0)return null;
  const contact=c.growthSupport?.point||N.contact(original,supports)?.support.point;
  // Preserve the actual finite skeleton contact, even if it lies inside an edge.
  if(contact&&!original.some(p=>N.distance(p,contact)<=T)){
   const edge=original.findIndex((a,i)=>N.onSegment(contact,a,original[(i+1)%original.length]));
   if(edge>=0)original.splice(edge+1,0,contact.slice());
  }
  const outers=material.map(poly=>open(poly[0]));
  const holes=material.flatMap(poly=>poly.slice(1).map(r=>M.subject(open(r))));
  const originalSubject=M.subject(original),other=M.pc.difference(material,originalSubject);
  const holeArea=holes.length?M.union(holes):[];
  const area=N.area(original),biasLimit=Math.max(3,.08*area);
  const outer=original.map((a,i)=>exteriorEdge(a,original[(i+1)%original.length],outers));
  const fixed=[contact,...supports.filter(s=>s?.kind==='branch'||s?.kind==='trunk').map(s=>s.segment?.[1])].filter(N.finite);
  let ring=original.map((point,index)=>({point,index,locked:!outer[index]||!outer[(index+original.length-1)%original.length]||fixed.some(p=>N.distance(p,point)<=T)}));
  let addedArea=0,omittedArea=0;
  while(ring.length>3&&alive()){
   const candidates=[];
   for(let i=0;i<ring.length;i++){
    if(ring[i].locked)continue;
    const a=ring[(i+ring.length-1)%ring.length],b=ring[i],d=ring[(i+1)%ring.length];
    let distance=0;
    for(let j=(a.index+1)%original.length;j!==d.index;j=(j+1)%original.length)distance=Math.max(distance,pointDistance(original[j],a.point,d.point));
    if(distance>maxDistance+T)continue;
    const delta=((b.point[0]-a.point[0])*(d.point[1]-a.point[1])-(b.point[1]-a.point[1])*(d.point[0]-a.point[0]))/2;
    // Prefer weak corners while counterbalancing the accumulated signed bias.
    const score=Math.abs(delta)+.65*Math.abs(addedArea-omittedArea-delta)+distance*.05;
    candidates.push({i,score});
   }
   candidates.sort((a,b)=>a.score-b.score);let accepted=false;
   for(const candidate of candidates){
    if(!alive())break;
    const next=ring.filter((_,i)=>i!==candidate.i),p=next.map(v=>v.point);
    if(N.area(p)<=0||!simpleRing(p))continue;
    const subject=M.subject(p),added=M.mpArea(M.pc.difference(subject,originalSubject)),omitted=M.mpArea(M.pc.difference(originalSubject,subject));
    if(added+omitted>.25*area||Math.abs(added-omitted)>biasLimit)continue;
    if(M.mpArea(M.pc.intersection(subject,other))>=.001||(holeArea.length&&M.mpArea(M.pc.intersection(subject,holeArea))>=.001))continue;
    ring=next;addedArea=added;omittedArea=omitted;accepted=true;
    const hit=N.contact(p,supports);let cells=null;
    if(hit&&N.facetCount(hit.polygon)<=6)cells=[{...c,polygon:hit.polygon,growthSupport:hit.support,kind:hit.support.kind,identity:hit.support.identity}];
    else if(alive())cells=B.partition({...c,polygon:p},supports,{budgetMs:Math.max(1,Math.min(8,deadline-Date.now()))})?.cells;
    if(cells&&valid(cells,p,supports))return {cells,polygon:p,addedArea,omittedArea};
    break;
   }
   if(!accepted)break;
  }
 }catch{}
 return null;
}
return {coarsen};

})();
const H=(()=>{
/* Split one material cavity with two disjoint bridges across a finite fixed
 * support. All coordinates and the 0.001 area tolerance are canonical pixels.
 * The cavity rim is copied verbatim; neither bridges nor subdivision fill it.
 */
const T=N.DISTANCE_TOLERANCE;
const open=r=>r.length>1&&N.distance(r[0],r[r.length-1])<=T?r.slice(0,-1):r.slice();
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const arc=(p,a,b)=>{const result=[p[a]];for(let i=(a+1)%p.length;i!==(b+1)%p.length;i=(i+1)%p.length)result.push(p[i]);return result};

function bridge(point,outer,hole,support){
 const [a,b]=support.segment,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<=T)return null;
 const axis=[dx/length,dy/length],normal=[-axis[1],axis[0]],delta=sub(point,a);
 const distance=cross(axis,delta),projection=delta[0]*axis[0]+delta[1]*axis[1];
 if(Math.abs(distance)<=T||projection<-T||projection>length+T)return null;
 const direction=normal.map(v=>-Math.sign(distance)*v),hits=[];
 for(let i=0;i<outer.length;i++){
  const c=outer[i],edge=sub(outer[(i+1)%outer.length],c),den=cross(direction,edge);
  if(Math.abs(den)<1e-12)continue;
  const offset=sub(c,point),t=cross(offset,edge)/den,u=cross(offset,direction)/den;
  if(t>T&&u>=-1e-9&&u<=1+1e-9)hits.push({t,edge:i,u,point:[point[0]+t*direction[0],point[1]+t*direction[1]]});
 }
 hits.sort((a,b)=>a.t-b.t);const hit=hits[0];
 if(!hit||hit.t<Math.abs(distance)-T)return null;
 // A bridge must immediately enter material, without crossing another part
 // of the hole on its way to the support and exterior.
 for(let i=0;i<hole.length;i++){
  const c=hole[i],edge=sub(hole[(i+1)%hole.length],c),den=cross(direction,edge);
  if(Math.abs(den)<1e-12)continue;
  const offset=sub(c,point),t=cross(offset,edge)/den,u=cross(offset,direction)/den;
  if(t>T&&t<hit.t-T&&u>=-1e-9&&u<=1+1e-9)return null;
 }
 return hit;
}

function insert(outer,bridges){
 const ring=[];
 for(let i=0;i<outer.length;i++){
  ring.push(outer[i]);
  for(const hit of bridges.filter(h=>h.edge===i).sort((a,b)=>a.u-b.u)){
   const vertex=outer.find(q=>N.distance(q,hit.point)<=T);
   if(vertex){hit.point=vertex;continue}
   if(N.distance(ring[ring.length-1],hit.point)>T)ring.push(hit.point);
  }
 }
 return ring;
}

function valid(cells,target,supports){
 try{
  if(!cells.length||cells.some(c=>N.facetCount(c.polygon)<3||N.facetCount(c.polygon)>6||N.area(c.polygon)<=0||!N.contact(c.polygon,supports)))return false;
  const u=M.union(cells.map(c=>M.subject(c.polygon)));
  return M.mpArea(M.pc.difference([target],u))<.001&&M.mpArea(M.pc.difference(u,[target]))<.001&&Math.abs(cells.reduce((s,c)=>s+N.area(c.polygon),0)-M.mpArea(u))<.001;
 }catch{return false}
}

function radialSplit(target,supports,deadline,material){
 const outer=target[0],hole=target[1],roots=[];
 const add=point=>{
  const vertex=outer.find(q=>N.distance(q,point)<=T);if(vertex)point=vertex;
  if(outer.some((q,i)=>N.onSegment(point,q,outer[(i+1)%outer.length]))&&!roots.some(q=>N.distance(q,point)<=T))roots.push(point);
 };
 for(const support of supports){
  if(!support.segment)continue;
  const [a,b]=support.segment;add(a);add(b);
  for(const t of [.5,.25,.75])add([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  for(let i=0;i<outer.length;i++){
   const hit=N.contact([outer[i],outer[(i+1)%outer.length]],[support]);if(hit)add(hit.support.point);
  }
 }
 const center=hole.reduce((sum,q)=>[sum[0]+q[0]/hole.length,sum[1]+q[1]/hole.length],[0,0]);
 const aims=[center,...hole.map((q,i)=>[(q[0]+hole[(i+1)%hole.length][0])/2,(q[1]+hole[(i+1)%hole.length][1])/2])];
 const size=4*Math.max(...outer.flat().map(Math.abs),1)+100;
 for(const root of roots)for(const aim of aims){
  if(Date.now()>=deadline)return null;
  const delta=sub(aim,root),length=Math.hypot(...delta);if(length<=T)continue;
  const axis=delta.map(v=>v/length),normal=[-axis[1],axis[0]],parts=[];
  try{
   for(const side of [-1,1]){
    const quad=[[-1,0],[1,0],[1,side],[-1,side]].map(([x,y])=>[root[0]+size*(x*axis[0]+y*normal[0]),root[1]+size*(x*axis[1]+y*normal[1])]);
    const half=M.pc.intersection([target],M.subject(quad));
    if(!half.length||half.some(poly=>poly.length!==1)){parts.length=0;break}
    for(const poly of half){const p=N.simple(open(poly[0]));if(N.area(p)<0)p.reverse();parts.push(p)}
   }
  }catch{continue}
  if(parts.length<2||parts.some(p=>!N.contact(p,supports)))continue;
  const cells=[],represented=[];let failed=false;
  for(const polygon of parts){
   const cell={polygon},hit=N.contact(polygon,supports);
   if(hit&&N.facetCount(polygon)<=6){cells.push({...cell,polygon:hit.polygon,growthSupport:hit.support,kind:hit.support.kind,identity:hit.support.identity});represented.push(polygon);continue}
   let result=B.partition(cell,supports,{budgetMs:Math.max(1,Math.min(20,deadline-Date.now()))});
   if(!result&&material&&Date.now()<deadline)result=C.coarsen(cell,supports,material,{budgetMs:Math.max(1,Math.min(25,deadline-Date.now()))});
   if(!result){failed=true;break}cells.push(...result.cells);represented.push(result.polygon||polygon);
  }
  if(!failed)try{
   const expected=M.union(represented.map(M.subject));
   if(expected.length!==1||!valid(cells,expected[0],supports))continue;
   const actual=M.union(cells.map(c=>M.subject(c.polygon)));
   if(M.mpArea(M.pc.intersection(actual,M.subject(hole)))>=.001)continue;
   return {cells,addedArea:M.mpArea(M.pc.difference(actual,[target])),omittedArea:M.mpArea(M.pc.difference([target],actual))};
  }catch{}
 }
 return null;
}

function partition(polyWithHoles,supports,{budgetMs=150,material}={}){
 const deadline=Date.now()+budgetMs,alive=()=>Date.now()<deadline;
 if(polyWithHoles.length!==2)return null;
 let outer=open(polyWithHoles[0]),hole=open(polyWithHoles[1]);
 if(N.area(outer)<0)outer.reverse();if(N.area(hole)>0)hole.reverse();
 if(outer.length<3||hole.length<3)return null;
 const target=[outer,hole];
 const radial=radialSplit(target,supports,Math.min(deadline,Date.now()+Math.max(20,budgetMs*.75)),material);
 if(radial)return radial;
 for(const support of supports){
  if(!alive())break;
  if(!support.segment)continue;
  const axis=sub(support.segment[1],support.segment[0]);
  const projection=q=>q[0]*axis[0]+q[1]*axis[1];
  const pairs=[];
  for(let i=0;i<hole.length;i++)for(let j=i+1;j<hole.length;j++)pairs.push({i,j,score:Math.abs(projection(hole[i])-projection(hole[j]))});
  pairs.sort((a,b)=>b.score-a.score);
  for(const pair of pairs){
   if(!alive())break;
   const left=bridge(hole[pair.i],outer,hole,support),right=bridge(hole[pair.j],outer,hole,support);
   if(!left||!right||N.distance(left.point,right.point)<=T)continue;
   const ring=insert(outer,[left,right]),a=ring.findIndex(q=>N.distance(q,left.point)<=T),b=ring.findIndex(q=>N.distance(q,right.point)<=T);
   if(a<0||b<0||a===b)continue;
   const parts=[N.simple([...arc(ring,a,b),...arc(hole,pair.j,pair.i)]),N.simple([...arc(ring,b,a),...arc(hole,pair.i,pair.j)])];
   if(parts.some(p=>N.area(p)<=0))continue;
   // Reject crossing bridges or wrong arc pairing before spending the
   // subdivision budget. This also verifies complete retention of the void.
   try{
    const u=M.union(parts.map(M.subject));
    if(M.mpArea(M.pc.difference([target],u))>=.001||M.mpArea(M.pc.difference(u,[target]))>=.001||Math.abs(parts.reduce((s,p)=>s+N.area(p),0)-M.mpArea(u))>=.001)continue;
   }catch{continue}
   const cells=[],represented=[];let failed=false;
   for(const polygon of parts){
    const hit=N.contact(polygon,supports),cell={polygon,kind:support.kind,identity:support.identity,side:0};
    if(hit&&N.facetCount(hit.polygon)<=6){cells.push({...cell,polygon:hit.polygon,growthSupport:hit.support,kind:hit.support.kind,identity:hit.support.identity});represented.push(polygon);continue}
    let result=B.partition(cell,supports,{budgetMs:Math.max(1,Math.min(20,deadline-Date.now()))});
    if(!result&&material&&Date.now()<deadline)result=C.coarsen(cell,supports,material,{budgetMs:Math.max(1,Math.min(30,deadline-Date.now()))});
    if(!result){failed=true;break}cells.push(...result.cells);represented.push(result.polygon||polygon);
   }
   if(!failed)try{
    const expected=M.union(represented.map(M.subject));
    if(expected.length!==1||!valid(cells,expected[0],supports))continue;
    const actual=M.union(cells.map(c=>M.subject(c.polygon)));
    if(M.mpArea(M.pc.intersection(actual,M.subject(hole)))>=.001)continue;
    return {cells,addedArea:M.mpArea(M.pc.difference(actual,[target])),omittedArea:M.mpArea(M.pc.difference([target],actual))};
   }catch{}
  }
 }
 return null;
}

return {partition};

})();
const S=(()=>{
function splitPositive(c){const p=N.cleanSpurs(c.polygon);for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)if(N.distance(p[i],p[j])<=3e-5){const a=p.slice(i,j),b=p.slice(j).concat(p.slice(0,i));if(N.area(a)>1e-8&&N.area(b)>1e-8)return splitPositive({...c,polygon:a}).concat(splitPositive({...c,polygon:b}))}return [{...c,polygon:p}]}
function supported(c,supports){const p=N.simple(c.polygon);if(p.length<3||p.length>6||N.area(p)<=0)return null;const hit=N.contact(p,supports);return hit?{...c,polygon:hit.polygon,growthSupport:hit.support,kind:hit.support.kind,identity:hit.support.identity}:null}
function solve(c,supports,ms=35){const hit=supported(c,supports);if(hit)return [hit];return B.partition(c,supports,{budgetMs:ms})?.cells||null}
function shared(a,b){let sum=0;for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy);if(l<3e-5)continue;for(let j=0;j<b.length;j++){const r=b[j],s=b[(j+1)%b.length];if(Math.abs((r[0]-p[0])*dy-(r[1]-p[1])*dx)>3e-5*l||Math.abs((s[0]-p[0])*dy-(s[1]-p[1])*dx)>3e-5*l)continue;const t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/l,u=((s[0]-p[0])*dx+(s[1]-p[1])*dy)/l;sum+=Math.max(0,Math.min(l,Math.max(t,u))-Math.max(0,Math.min(t,u)))}}return sum}
function merge(a,b){try{const pair=W.weldPolygons([a,b]),u=M.pc.union(...pair.map(M.subject));if(u.length===1&&u[0].length===1)return N.simple(u[0][0].slice(0,-1))}catch{}return null}
function run(base,{budgetMs=3200}={}){
 const start=Date.now(),deadline=start+budgetMs;
 const supports=base.branches.map((b,i)=>({kind:'branch',identity:`branch-${i}`,segment:[[0,b.attachment],b.tip]})).concat(base.hexSupports,{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,base.trunkTip]]});
 let pool=base.cells,warmStart=false;
 // Expose point-touch lobes before solving, rather than discovering their
 // missing support only after a whole half-arm has been finalized.
 try{pool=Final.repairNumericalSlivers(pool,supports).cells;pool=N.conform(pool).cells}catch{}
 pool=pool.flatMap(splitPositive);let material=base.interpretedMaterial;const edits=[];
 function coarse(c,ms){const result=C.coarsen(c,supports,material,{budgetMs:ms,maxDistance:4});if(!result)return null;const old=c.polygon;material=M.pc.union(M.pc.difference(material,M.subject(old)),M.subject(result.polygon));edits.push({addedArea:result.addedArea,omittedArea:result.omittedArea,oldPolygon:old,newPolygon:result.polygon});c.polygon=result.polygon;return result.cells}
 const solutions=pool.map(c=>{const s=supported(c,supports);return s?[s]:null}),consumed=new Set(),audit={warmStart,bentPartitions:0,neighborRepairs:0,neighborhoods:0};
 const initialPending=solutions.filter(s=>!s).length;
 for(let i=0;i<pool.length&&Date.now()<deadline;i++)if(!solutions[i]){const r=solve(pool[i],supports,Math.max(45,Math.min(180,1200/Math.max(1,initialPending))))||coarse(pool[i],100);if(r){solutions[i]=r;audit.bentPartitions++}}
 for(let i=0;i<pool.length&&Date.now()<deadline;i++){
  if(consumed.has(i)||solutions[i])continue;const remaining=solutions.slice(i).filter(s=>!s).length,localEnd=Math.min(deadline,Date.now()+Math.max(90,(deadline-Date.now())/Math.max(1,remaining)));
  const queue=[{ids:[i],polygon:pool[i].polygon}],seen=new Set([String(i)]);let found=null,tries=0;
  while(queue.length&&Date.now()<localEnd&&tries<64){const group=queue.shift();if(group.ids.length>=6)continue;const neighbors=pool.map((c,j)=>({j,length:consumed.has(j)||group.ids.includes(j)?0:shared(group.polygon,c.polygon)})).filter(n=>n.length>3e-5).sort((a,b)=>b.length-a.length);
   for(const {j}of neighbors){if(Date.now()>=localEnd)break;const ids=group.ids.concat(j).sort((a,b)=>a-b),signature=ids.join(',');if(seen.has(signature))continue;seen.add(signature);const polygon=merge(group.polygon,pool[j].polygon);if(!polygon)continue;tries++;audit.neighborhoods++;const candidate={...pool[i],polygon,masterParents:[...new Set(ids.flatMap(k=>pool[k].masterParents||[]))]},result=solve(candidate,supports,Math.max(8,Math.min(30,localEnd-Date.now())))||coarse(candidate,Math.max(5,Math.min(65,localEnd-Date.now())));if(result){found={ids,result,candidate};break}queue.push({ids,polygon})}if(found)break;
  }
  if(found){pool[i]=found.candidate;solutions[i]=found.result;for(const j of found.ids)if(j!==i){solutions[j]=null;consumed.add(j)}audit.neighborRepairs++}
 }
 const cells=[],failed=[];for(let i=0;i<pool.length;i++){if(consumed.has(i))continue;if(solutions[i])cells.push(...solutions[i]);else failed.push({...pool[i],index:i,reason:Date.now()>=deadline?'time-budget':'bent-partition-search-exhausted'})}
 if(edits.length){base.originalInterpretedMaterial=base.originalInterpretedMaterial||base.interpretedMaterial;base.interpretedMaterial=material;base.baseCut=material;base.cells=pool.filter((c,i)=>!consumed.has(i));base.coarseningAudit=(base.coarseningAudit||[]).concat(edits)}
 const row={...base,cells,failed,partitionAudit:{...audit,coarsenedRegions:edits.length,elapsedMs:Date.now()-start,timeBudgetMs:budgetMs}};return row;
}
function partitionRegion(c,supports,budgetMs=80){return solve(c,supports,budgetMs)}

return {run,partitionRegion,shared,merge};
})();
const Final=(()=>{
const holes=cut=>cut.reduce((s,p)=>s+p.slice(1).filter(r=>Math.abs(M.area(r.slice(0,-1)))>.05).length,0);
function sharedLength(a,b){let shared=0;for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;for(let j=0;j<b.length;j++){const r=b[j],s=b[(j+1)%b.length];if(Math.abs((r[0]-p[0])*dy-(r[1]-p[1])*dx)>N.DISTANCE_TOLERANCE*length||Math.abs((s[0]-p[0])*dy-(s[1]-p[1])*dx)>N.DISTANCE_TOLERANCE*length)continue;const t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/length,u=((s[0]-p[0])*dx+(s[1]-p[1])*dy)/length;shared=Math.max(shared,Math.min(length,Math.max(t,u))-Math.max(0,Math.min(t,u)))}}return shared}
function repairNumericalSlivers(input,supports){
 let cells=input.map(c=>({...c,polygon:N.cleanSpurs(c.polygon)})),merges=0;
 // Diagnose against the complete vertex set, but merge the original material,
 // before any conformance can erase a thin positive-area triangle.
 for(let pass=0;pass<input.length;pass++){
  const preview=N.conform(cells),bad=preview.cells.findIndex(c=>N.area(c.polygon)<=0||c.facetCount<3);
  if(bad<0)return {cells,merges};
  const source=cells[bad],neighbors=cells.map((c,index)=>({c,index,length:index===bad?0:sharedLength(source.polygon,c.polygon)})).filter(x=>x.length>N.DISTANCE_TOLERANCE).sort((a,b)=>b.length-a.length);
  let repaired=false;
  for(const {c,index}of neighbors){try{
   const original=M.union([M.subject(source.polygon),M.subject(c.polygon)]);
   const pair=W.weldPolygons([c.polygon,source.polygon]),merged=W.pc.union(...pair.map(M.subject));
   if(merged.length!==1||merged[0].length!==1)continue;
   const polygon=N.simple(merged[0][0].slice(0,-1));if(polygon.length<3||polygon.length>6||N.area(polygon)<=0)continue;
   const hit=N.contact(polygon,supports);if(!hit)continue;
   const target=M.subject(hit.polygon),missing=M.mpArea(M.pc.difference(original,target)),excess=M.mpArea(M.pc.difference(target,original));
   if(missing>=.001||excess>=.001||holes(original)!==holes(target))continue;
   const replacement={...c,polygon:hit.polygon,growthSupport:hit.support,masterParents:[...new Set([...(source.masterParents||[]),...(c.masterParents||[])])],numericalSliverMerges:(c.numericalSliverMerges||0)+(source.numericalSliverMerges||0)+1};
   cells=cells.map((value,i)=>i===index?replacement:value).filter((_,i)=>i!==bad);merges++;repaired=true;break;
  }catch{}}
  assert(repaired,`Numerical sliver cannot merge without changing material: cell ${bad}, area ${N.area(source.polygon)}`);
 }
 throw Error('Numerical sliver merge did not converge');
}
function splitClosedLobes(cells,vertices){
 const result=[];
 function split(ids){
  for(let i=0;i<ids.length;i++){const j=ids.indexOf(ids[i],i+1);if(j<0)continue;return split(ids.slice(i,j)).concat(split(ids.slice(j).concat(ids.slice(0,i))))}
  if(ids.length<3){assert(Math.abs(N.area(ids.map(id=>vertices[id])))<=1e-10,'Nonzero discarded bridge');return []}
  return [ids];
 }
 for(const c of cells){const rings=split(c.vertices);assert(rings.length,'Cell contains only a cancelled bridge');for(const ids of rings){const polygon=ids.map(id=>vertices[id]);assert(N.area(polygon)>0,'Repeated vertex encloses a reversed material lobe');result.push({...c,vertices:ids,polygon,facetCount:N.facetCount(polygon)})}}
 return result;
}
function repairUnsupportedLobes(input,supports){
 let cells=input;
 for(let pass=0;pass<input.length;pass++){
  const bad=cells.findIndex(c=>!N.contact(c.polygon,supports));if(bad<0)return cells;
  const source=cells[bad],neighbors=cells.map((c,index)=>({c,index,length:index===bad?0:sharedLength(source.polygon,c.polygon)})).filter(x=>x.length>N.DISTANCE_TOLERANCE).sort((a,b)=>b.length-a.length);let repaired=false;
  for(const {c,index}of neighbors){try{
   const original=M.union([M.subject(source.polygon),M.subject(c.polygon)]),pair=W.weldPolygons([c.polygon,source.polygon]),merged=W.pc.union(...pair.map(M.subject));if(merged.length!==1||merged[0].length!==1)continue;
   const polygon=N.simple(merged[0][0].slice(0,-1));if(polygon.length<3||N.area(polygon)<=0)continue;
   const base={...c,polygon,masterParents:[...new Set([...(source.masterParents||[]),...(c.masterParents||[])])],unsupportedLobeMerges:(c.unsupportedLobeMerges||0)+(source.unsupportedLobeMerges||0)+1};
   const hit=polygon.length<=6?N.contact(polygon,supports):null;
   let replacement=hit?[{...base,polygon:hit.polygon,growthSupport:hit.support}]:S.partitionRegion(base,supports,80);
   if(!replacement||!replacement.length)continue;
   const conformed=N.conform(replacement);replacement=splitClosedLobes(conformed.cells,conformed.vertices);
   let valid=true;for(const piece of replacement){const touch=N.contact(piece.polygon,supports);if(!touch||!piece.polygon.every(N.finite)||N.area(piece.polygon)<=0||piece.facetCount<3||piece.facetCount>6){valid=false;break}piece.polygon=touch.polygon;piece.growthSupport=touch.support}if(!valid)continue;
   const target=M.union(replacement.map(piece=>M.subject(piece.polygon)));if(M.mpArea(M.pc.difference(original,target))>=.001||M.mpArea(M.pc.difference(target,original))>=.001||holes(original)!==holes(target)||Math.abs(replacement.reduce((sum,piece)=>sum+N.area(piece.polygon),0)-M.mpArea(target))>=.001)continue;
   cells=cells.flatMap((value,i)=>i===bad?[]:i===index?replacement:[value]);repaired=true;break;
  }catch{}}
  assert(repaired,`Unsupported material lobe cannot merge without changing material: cell ${bad}, area ${N.area(source.polygon)}`);
 }
 throw Error('Unsupported material lobe merge did not converge');
}
function validateEdgeIncidence(cells,vertices,cut){
 const edges=new Map();for(const [cell,c]of cells.entries())for(let i=0;i<c.vertices.length;i++){const a=c.vertices[i],b=c.vertices[(i+1)%c.vertices.length];assert(a!==b,'Zero-length cell edge');const key=[a,b].sort((a,b)=>a-b).join(':');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,cell})}
 const boundary=cut.flatMap(poly=>poly.flatMap(r=>r.slice(0,-1).map((a,i)=>[a,r[i+1]]))),single=[];
 for(const [key,uses]of edges){assert(uses.length<=2,`Nonmanifold edge ${key}`);if(uses.length===2)assert(uses[0].a===uses[1].b&&uses[0].b===uses[1].a&&uses[0].cell!==uses[1].cell,`Repeated directed edge ${key}`);else single.push([vertices[uses[0].a],vertices[uses[0].b]])}
 function covered([a,b],segments){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),tol=N.DISTANCE_TOLERANCE;const intervals=[];for(const [c,d]of segments){if(Math.abs((c[0]-a[0])*dy-(c[1]-a[1])*dx)>tol*length||Math.abs((d[0]-a[0])*dy-(d[1]-a[1])*dx)>tol*length)continue;const t=((c[0]-a[0])*dx+(c[1]-a[1])*dy)/length,u=((d[0]-a[0])*dx+(d[1]-a[1])*dy)/length;intervals.push([Math.max(0,Math.min(t,u)),Math.min(length,Math.max(t,u))])}intervals.sort((a,b)=>a[0]-b[0]);let end=0;for(const [lo,hi]of intervals){if(hi<0||lo>length)continue;if(lo>end+tol)return false;end=Math.max(end,hi)}return end>=length-tol}
 for(const edge of single)assert(covered(edge,boundary),'Single-incidence edge is not an actual cut boundary');
 for(const edge of boundary)assert(covered(edge,single),'Actual cut boundary is not covered by cell boundary edges');
}
function run(row,baseline){
 const key='upload';
 if(row.failed.length){const e=Error('Refuse incomplete geometry');e.partitionAudit=row.partitionAudit;e.reasonHistogram=row.failed.reduce((out,c)=>{const reason=c.reason||'unspecified';out[reason]=(out[reason]||0)+1;return out},{});throw e}
 const supports=row.branches.map((b,i)=>({kind:'branch',identity:`branch-${i}`,segment:[[0,b.attachment],b.tip]})).concat(row.hexSupports,{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,row.trunkTip]]});
 const repaired=repairNumericalSlivers(row.cells,supports);row.cells=repaired.cells;
 const candidates=c=>supports.slice().sort((a,b)=>Number(b.identity===c.growthSupport?.identity)-Number(a.identity===c.growthSupport?.identity));
 for(const c of row.cells){c.polygon=N.simple(c.polygon);const hit=N.contact(c.polygon,candidates(c));assert(hit,`Cell has no finite support: ${key}`);c.polygon=hit.polygon;c.growthSupport=hit.support;}
 let conformed=N.conform(row.cells);row.cells=splitClosedLobes(conformed.cells,conformed.vertices);
 row.cells=repairUnsupportedLobes(row.cells,supports);conformed=N.conform(row.cells);row.cells=splitClosedLobes(conformed.cells,conformed.vertices);row.vertices=conformed.vertices;
 for(const [index,c] of row.cells.entries()){
  assert(c.polygon.every(N.finite)&&N.area(c.polygon)>0,`Nonpositive/nonfinite cell: ${key}:${index}`);
  assert(c.facetCount>=3&&c.facetCount<=6,`Final sides: ${key}:${index} ${c.facetCount}`);
  const hit=N.contact(c.polygon,candidates(c),{insert:false});assert(hit,`Final vertex must touch finite support: ${key}:${index}`);
  c.growthSupport=hit.support;c.kind=hit.support.kind;c.identity=hit.support.identity;
  if(c.kind==='branch'){const b=row.branches[Number(c.identity.split('-')[1])],a=b.angle*Math.PI/180,center=c.polygon.reduce((s,p)=>[s[0]+p[0]/c.polygon.length,s[1]+p[1]/c.polygon.length],[0,0]);c.side=center[0]*Math.cos(a)-(center[1]-b.attachment)*Math.sin(a)>=0?1:-1}else c.side=0;
 }
 const cut=M.union(row.cells.map(c=>M.subject(c.polygon))),missing=M.mpArea(M.pc.difference(baseline.baseCut,cut)),excess=M.mpArea(M.pc.difference(cut,baseline.baseCut)),overlap=row.cells.reduce((s,c)=>s+M.area(c.polygon),0)-M.mpArea(cut);
 const interpreted=baseline.interpretedMaterial,materialMissing=M.mpArea(M.pc.difference(interpreted,cut)),materialExcess=M.mpArea(M.pc.difference(cut,interpreted));
 assert(missing<.01&&excess<.01&&Math.abs(overlap)<.01,JSON.stringify({key,missing,excess,overlap}));
 assert(materialMissing<.01&&materialExcess<.01,JSON.stringify({key,materialMissing,materialExcess}));
 assert.equal(holes(cut),holes(baseline.baseCut),'Base cut significant hole topology must remain fixed');
 assert.equal(holes(cut),holes(interpreted),'Interpreted material significant hole topology must remain fixed');
 validateEdgeIncidence(row.cells,row.vertices,cut);
 row.baseCut=cut;row.validation={missingArea:missing,excessArea:excess,overlapArea:overlap,interpretedMissingArea:materialMissing,interpretedExcessArea:materialExcess,materialArea:M.mpArea(cut),signedAreaBias:M.mpArea(cut)-M.mpArea(interpreted),cutHoles:holes(cut),numericalSliverMerges:repaired.merges};delete row.failed;delete row.mirroredCells;delete row.mirroredVertices;
 return row;
}

return {run,holes,repairNumericalSlivers,splitClosedLobes,validateEdgeIncidence};
})();
const Repair=(()=>{
function run(row,base,{budgetMs=900,maxNeighborhoods=16,maxNeighbors=4}={}){
 if(!row.failed.length)return false;
 const supports=row.branches.map((b,i)=>({kind:'branch',identity:`branch-${i}`,segment:[[0,b.attachment],b.tip]})).concat(row.hexSupports,{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,row.trunkTip]]});
 const queue=[[]],seen=new Set(['']),deadline=Date.now()+budgetMs;let tested=0;
 while(queue.length&&Date.now()<deadline&&tested<maxNeighborhoods){
  const ids=queue.shift(),group=row.failed.concat(ids.map(i=>row.cells[i]));let region;try{region=M.union(group.map(c=>M.subject(c.polygon)))}catch{continue}tested++;
  if(region.some(p=>p.length>1)){
   const result=[];let okay=true;for(const poly of region){if(poly.length===1){const r=S.partitionRegion({...group[0],polygon:poly[0].slice(0,-1)},supports,60);if(!r){okay=false;break}result.push(...r)}else{const r=H.partition(poly,supports,{budgetMs:150,material:base.interpretedMaterial});if(!r){okay=false;break}result.push(...r.cells)}}
   if(okay){const parents=[...new Set(group.flatMap(c=>c.masterParents||[]))],cut=M.union(result.map(c=>M.subject(c.polygon))),missing=M.mpArea(M.pc.difference(region,cut)),excess=M.mpArea(M.pc.difference(cut,region));
    if(missing>=.001||excess>=.001){base.originalInterpretedMaterial=base.originalInterpretedMaterial||base.interpretedMaterial;base.interpretedMaterial=M.pc.union(M.pc.difference(base.interpretedMaterial,region),cut);base.baseCut=base.interpretedMaterial;base.holeCoarseningAudit={missingArea:missing,addedArea:excess};}
    row.cells=row.cells.filter((c,i)=>!ids.includes(i)).concat(result.map(c=>({...c,masterParents:parents})));row.failed=[];row.partitionAudit={...row.partitionAudit,holeNeighborhood:{neighbors:ids.length,tested}};return true;
   }
  }
  if(ids.length>=maxNeighbors)continue;const neighbors=row.cells.map((c,i)=>({i,length:ids.includes(i)?0:region.reduce((s,p)=>s+S.shared(p[0].slice(0,-1),c.polygon),0)})).filter(c=>c.length>3e-5).sort((a,b)=>b.length-a.length);
  for(const n of neighbors){const next=ids.concat(n.i).sort((a,b)=>a-b),k=next.join(',');if(!seen.has(k)){seen.add(k);queue.push(next)}}
 }
 return false;
}

return {run};
})();

const MedianMesh=(()=>{
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const open=p=>p.length>1&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1]?p.slice(0,-1):p;
const clean=p=>{p=open(p);return p.filter((a,i)=>{const b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((a[0]-b[0])*(c[1]-a[1])-(a[1]-b[1])*(c[0]-a[0]))>1e-8})};
const mpArea=mp=>mp.reduce((s,poly)=>s+Math.abs(area(open(poly[0])))-poly.slice(1).reduce((s,r)=>s+Math.abs(area(open(r))),0),0);
const snap=mp=>mp.map(poly=>poly.map(r=>r.map(p=>p.map(v=>Math.round(v*1e6)/1e6))));
function operation(type,...a){return snap(floatClip[type](...a.map(snap)))}
const pc={union:(...a)=>operation('union',...a),intersection:(...a)=>operation('intersection',...a),difference:(...a)=>operation('difference',...a)};
function union(list){return list.length?pc.union(...list):[]}
const subject=p=>[[p]];
function sanitize(p){
 let changed=true;while(changed&&p.length>3){changed=false;
  for(let i=0;i<p.length;i++){const j=p.findIndex((q,k)=>k>i&&Math.hypot(q[0]-p[i][0],q[1]-p[i][1])<9e-6);if(j<0)continue;
   const sub=p.slice(i,j),rest=p.slice(j).concat(p.slice(0,i));
   if(Math.abs(area(sub))<1e-5){p=p.slice(0,i).concat(p.slice(j));changed=true;break}
   if(Math.abs(area(rest))<1e-5){p=sub;changed=true;break}
  }
 }return p;
}
function adjacent(a,b){for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],dx=q[0]-p[0],dy=q[1]-p[1],l2=dx*dx+dy*dy;if(l2<1e-12)continue;
 for(let j=0;j<b.length;j++){const r=b[j],s=b[(j+1)%b.length];if(Math.abs((r[0]-p[0])*dy-(r[1]-p[1])*dx)>1e-5*Math.sqrt(l2)||Math.abs((s[0]-p[0])*dy-(s[1]-p[1])*dx)>1e-5*Math.sqrt(l2))continue;
 const t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/l2,u=((s[0]-p[0])*dx+(s[1]-p[1])*dy)/l2;if(Math.min(1,Math.max(t,u))-Math.max(0,Math.min(t,u))>1e-7)return true;
 }}return false}
function touches(p,supports){
 for(const s of supports){const [a,b]=s.segment,ux=b[0]-a[0],uy=b[1]-a[1],l2=ux*ux+uy*uy;
  for(let i=0;i<p.length;i++){const c=p[i],d=p[(i+1)%p.length],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;
   if(Math.abs(den)>1e-10){const t=((c[0]-a[0])*vy-(c[1]-a[1])*vx)/den,q=((c[0]-a[0])*uy-(c[1]-a[1])*ux)/den;
    if(t>=-1e-7&&t<=1+1e-7&&q>=-1e-7&&q<=1+1e-7)return {...s,point:[a[0]+t*ux,a[1]+t*uy]};
   }else{const t=((c[0]-a[0])*ux+(c[1]-a[1])*uy)/l2;if(t>=-1e-7&&t<=1+1e-7&&Math.abs((c[0]-a[0])*uy-(c[1]-a[1])*ux)<1e-5)return {...s,point:c}}
  }
 }return null;
}
function convex(p){return p.every((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-7})}
function clip(p,n,c){const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=n[0]*a[0]+n[1]*a[1]-c,db=n[0]*b[0]+n[1]*b[1]-c;if(da>=-1e-8)out.push(a);if(da*db<-1e-12)out.push([a[0]+(b[0]-a[0])*da/(da-db),a[1]+(b[1]-a[1])*da/(da-db)])}return out}
function mesh(poly,meta){
 const flat=earcut.flatten(poly.map(open)),ids=earcut(flat.vertices,flat.holes,2),cells=[];
 for(let i=0;i<ids.length;i+=3){let p=ids.slice(i,i+3).map(j=>flat.vertices.slice(j*2,j*2+2));if(area(p)<0)p.reverse();if(area(p)>1e-7)cells.push(p)}
 // Greedily merge adjacent triangles into compact convex 3–6-sided facets.
 // Never alter their union or bridge an internal void.
 const attached=p=>!meta.axisOrigin||p.some(a=>{const [x,y]=meta.axisOrigin,[ux,uy]=meta.axisDirection,t=(a[0]-x)*ux+(a[1]-y)*uy;return Math.abs((a[0]-x)*uy-(a[1]-y)*ux)<1e-5&&t>=-1e-5&&t<=meta.axisLength+1e-5});
 // A merge only invalidates pairs containing its new polygon. Cache every
 // unchanged pair so the accepted greedy choice does not rerun the same exact
 // boolean hundreds of times on curving, non-catalogue photographic boundaries.
 const identities=new WeakMap(),pairs=new Map();let nextIdentity=0;
 const identity=p=>{if(!identities.has(p))identities.set(p,nextIdentity++);return identities.get(p)};
 let changed=true;
 while(changed){changed=false;let best=null;
  for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++){
   const key=identity(cells[i])+':'+identity(cells[j]);let candidate;
   if(pairs.has(key))candidate=pairs.get(key);
   else{
    candidate=null;let shares=0;for(const a of cells[i])if(cells[j].some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7))shares++;
    if(shares>=2){const u=floatClip.union(subject(cells[i]),subject(cells[j]));if(u.length===1&&u[0].length===1){let p=clean(u[0][0]);if(area(p)<0)p.reverse();const fixesAttachment=attached(p)&&(!attached(cells[i])||!attached(cells[j]));if(p.length<=6&&(convex(p)||fixesAttachment))candidate={p,merit:(fixesAttachment?1e6:0)+area(p)/p.length};}}
    pairs.set(key,candidate);
   }
   if(candidate&&(!best||candidate.merit>best.merit))best={i,j,...candidate};
  }
  if(best){cells[best.j]=best.p;cells.splice(best.i,1);changed=true}
 }
 return cells.map(p=>({...meta,polygon:p,attached:attached(p)}));
}
function run(row,raw,central,tolerance=1.6){
 const ref='median',n=row.n;
 const loops=F.contours(raw,n,.6).map(p=>{const q=area(p)>0?F.simplify(p,tolerance):p;return q.map(([x,y])=>[x-.5,y-.5])});
 const outers=loops.filter(p=>area(p)>0),holes=loops.filter(p=>area(p)<0);
 let target=union(outers.map(subject));if(holes.length)target=pc.difference(target,union(holes.map(subject)));
 // Keep a straight x=0 symmetry seam and exact central exclusion. The same
 // clipping is used by saved geometry, not by the preview.
 target=pc.intersection(target,subject([[0,0],[row.displayShape[1],0],[row.displayShape[1],row.displayShape[0]],[0,row.displayShape[0]]]));
 let remaining=target,cells=[];
 const slots=row.branches,slopes=slots.map(b=>1/Math.tan(b.angle*Math.PI/180));
 for(let i=0;i<slots.length;i++)for(const side of [-1,1]){
  const b=slots[i],bounds=[[[1,0],3]];
  if(i)bounds.push([[-(slopes[i-1]+slopes[i])/2,1],(slots[i-1].attachment+b.attachment)/2]);
  if(i+1<slots.length)bounds.push([[(slopes[i+1]+slopes[i])/2,-1],-(slots[i+1].attachment+b.attachment)/2]);
  else bounds.push([[slopes[i]+1/Math.sin(b.angle*Math.PI/180),-1],-b.attachment]);
  // Signed normal is positive below the branch axis, matching v2 side IDs.
  bounds.push([[side*slopes[i],-side],-side*b.attachment]);
  let region=[[0,0],[n,0],[n,n],[0,n]];for(const [normal,c] of bounds)region=clip(region,normal,c);
  if(region.length<3)continue;const part=pc.intersection(remaining,subject(region));
  for(const poly of part)cells.push(...mesh(poly,{identity:`branch-${i}`,side,kind:'branch',axisOrigin:[0,b.attachment],axisDirection:[Math.sin(b.angle*Math.PI/180),Math.cos(b.angle*Math.PI/180)],axisLength:b.length}));
  if(part.length)remaining=pc.difference(remaining,part);
 }
 for(const poly of remaining){
  const rest=mesh(poly,{identity:'trunk-junction',side:0,kind:'trunk',axisOrigin:[0,0],axisDirection:[0,1],axisLength:n});cells.push(...rest);
 }
 for(const c of cells)c.polygon=sanitize(c.polygon);
 cells=cells.filter(c=>c.polygon.length>=3&&area(c.polygon)>1e-7);
 // Completion facets must themselves reach a fixed skeleton or hex boundary.
 // Merge unsupported fragments with adjacent supported material; never invent
 // a connector crossing a photographed opening. Concave completion cells are
 // allowed when a convex split would leave a detached cell.
 const supports=row.branches.map((b,i)=>({kind:'branch',identity:`branch-${i}`,segment:[[0,b.attachment],b.tip]}));
 for(const loop of F.contours(central,n,.6)){for(let i=0;i<loop.length;i++){const a=loop[i].map(x=>x-.5),b=loop[(i+1)%loop.length].map(x=>x-.5);supports.push({kind:'hex',identity:'central-hex',segment:[a,b]})}}
 supports.push({kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,n]]});
 let pending=true;const discardedIsolated=[];
 while(pending){pending=false;let best=null;
  for(let i=0;i<cells.length;i++){
   if(touches(cells[i].polygon,supports))continue;pending=true;
   for(let j=0;j<cells.length;j++){if(i===j)continue;
    const a=cells[i].polygon,b=cells[j].polygon;
    if(!adjacent(a,b))continue;
    const u=floatClip.union(subject(a),subject(b));if(u.length!==1||u[0].length!==1)continue;
    let p=sanitize(clean(u[0][0]));if(area(p)<0)p.reverse();const support=touches(p,supports);
    const score=p.length+(support?0:1000)+.0001*area(p);
    if(!best||score<best.score)best={i,j,p,score};
   }
  }
  if(!pending)break;
  if(!best){const isolated=cells.filter(c=>!touches(c.polygon,supports));if(isolated.every(c=>area(c.polygon)<3)){
    for(const c of isolated){discardedIsolated.push(c.polygon);target=pc.difference(target,subject(c.polygon))}
    cells=cells.filter(c=>touches(c.polygon,supports));break;
   }if(tolerance>.6)return run(row,raw,central,.6);throw Error(`Material cannot reach any fixed support on ${ref}`)}
  cells[best.j].polygon=best.p;cells.splice(best.i,1);
 }
 for(const c of cells){const preferred=supports.filter(s=>s.kind===c.kind&&(s.kind!=='branch'||s.identity===c.identity));const support=touches(c.polygon,preferred)||touches(c.polygon,supports.filter(s=>s.kind==='hex'))||touches(c.polygon,supports.filter(s=>s.kind==='trunk'))||touches(c.polygon,supports);if(!support)throw Error('Unsupported cell');c.growthSupport=support;c.kind=support.kind;c.identity=support.identity;
  if(c.kind==='branch'){const b=row.branches[Number(c.identity.split('-')[1])],a=b.angle*Math.PI/180,center=c.polygon.reduce((s,p)=>[s[0]+p[0]/c.polygon.length,s[1]+p[1]/c.polygon.length],[0,0]);c.side=center[0]*Math.cos(a)-(center[1]-b.attachment)*Math.sin(a)>=0?1:-1}
  else c.side=0;
 }
 const baseCut=union(cells.map(c=>subject(c.polygon)));
 const missing=mpArea(pc.difference(target,baseCut)),excess=mpArea(pc.difference(baseCut,target));
 const cellArea=cells.reduce((s,c)=>s+area(c.polygon),0),overlap=cellArea-mpArea(baseCut);
 if(missing>.01||excess>.01||Math.abs(overlap)>.01)throw Error(`Union mismatch ${ref}: ${missing}/${excess}/${overlap}`);
 // Conform all cell boundaries: insert every existing vertex that lies on an
 // edge. Directional facet counts stay <=6; collinear junctions are explicit.
 const verts=new Map();for(const c of cells)for(const p of c.polygon)verts.set(p.map(x=>x.toFixed(7)).join(','),p);
 for(const c of cells){const p=c.growthSupport.point;verts.set(p.map(x=>x.toFixed(7)).join(','),p)}
 const all=[...verts.values()];
 for(const c of cells){c.facetCount=c.polygon.length;const out=[];
  for(let i=0;i<c.polygon.length;i++){const a=c.polygon[i],b=c.polygon[(i+1)%c.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
   const middle=all.map(p=>({p,t:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2})).filter(({p,t})=>t>1e-7&&t<1-1e-7&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)<1e-6*Math.sqrt(l2)).sort((a,b)=>a.t-b.t);
   out.push(a,...middle.map(x=>x.p));
  }c.polygon=out;
 }
 // Canonical vertex registry makes equal shared positions explicit in output.
 const points=[],registry=new Map();for(const c of cells){c.vertices=c.polygon.map(p=>{const close=points.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<9e-6);if(close>=0)return close;const k=p.map(x=>x.toFixed(6)).join(',');if(!registry.has(k)){registry.set(k,points.length);points.push(p.map(v=>Math.round(v*1e6)/1e6))}return registry.get(k)});c.vertices=c.vertices.filter((id,i,all)=>id!==all[(i+all.length-1)%all.length])}
 for(const c of cells){
  let changed=true;while(changed&&c.vertices.length>3){changed=false;for(let i=0;i<c.vertices.length;i++){const j=c.vertices.indexOf(c.vertices[i],i+1);if(j<0)continue;const loop=c.vertices.slice(i,j).map(id=>points[id]),rest=c.vertices.slice(j).concat(c.vertices.slice(0,i)).map(id=>points[id]);if(Math.abs(area(loop))<1e-5){c.vertices.splice(i,j-i);changed=true;break}if(Math.abs(area(rest))<1e-5){c.vertices=c.vertices.slice(i,j);changed=true;break}}}
  c.polygon=c.vertices.map(i=>points[i]);
 }
 cells=cells.filter(c=>c.polygon.length>=3&&area(c.polygon)>1e-7);
 const finalCut=union(cells.map(c=>subject(c.polygon))),finalMissing=mpArea(pc.difference(target,finalCut)),finalExcess=mpArea(pc.difference(finalCut,target)),finalOverlap=cells.reduce((s,c)=>s+area(c.polygon),0)-mpArea(finalCut);
 if(finalMissing>.01||finalExcess>.01||Math.abs(finalOverlap)>.01)throw Error('Final topology changed material');
 for(const c of cells)for(const key of ['axisOrigin','axisDirection','axisLength','attached'])delete c[key];
 const report={...row};delete report.sourceCells;Object.assign(report,{cells,vertices:points,interpretedMaterial:target,baseCut:finalCut,discardedIsolated,contourTolerance:tolerance,validation:{missingArea:finalMissing,excessArea:finalExcess,overlapArea:finalOverlap,materialArea:mpArea(target),cutHoles:finalCut.reduce((s,p)=>s+p.length-1,0)}});
 return report;
}

return {run};
})();
const GuidePartition=(()=>{let deadline=Infinity;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function simple(input){let p=input.slice(),changed=true;while(changed&&p.length>3){changed=false;
 for(let i=0;i<p.length;i++){const prev=(i+p.length-1)%p.length;if(dist(p[i],p[prev])<2e-5){p.splice(prev,1);changed=true;break}}
 if(changed)continue;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],l=dist(b,c);if(l>1e-8&&Math.abs((a[0]-b[0])*(c[1]-b[1])-(a[1]-b[1])*(c[0]-b[0]))/l<=2.5e-5){p.splice(i,1);changed=true;break}}
 }return p}
function onEdge(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2;return t>=-1e-7&&t<=1+1e-7&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(l2)<1e-5}
function roots(p,supports){const result=[];
 for(const s of supports){const [a,b]=s.segment,u=[b[0]-a[0],b[1]-a[1]],l2=u[0]**2+u[1]**2;
  const candidates=[a,b];
  for(const q of p){const t=Math.max(0,Math.min(1,((q[0]-a[0])*u[0]+(q[1]-a[1])*u[1])/l2));candidates.push([a[0]+t*u[0],a[1]+t*u[1]])}
  for(let i=0;i<p.length;i++){
   const c=p[i],d=p[(i+1)%p.length],v=[d[0]-c[0],d[1]-c[1]],den=u[0]*v[1]-u[1]*v[0];
   if(Math.abs(den)>1e-10){const t=((c[0]-a[0])*v[1]-(c[1]-a[1])*v[0])/den,q=((c[0]-a[0])*u[1]-(c[1]-a[1])*u[0])/den;if(t>=0&&t<=1&&q>=0&&q<=1)candidates.push([a[0]+t*u[0],a[1]+t*u[1]])}
  }
  for(const q of candidates)if(p.some((a,i)=>onEdge(q,a,p[(i+1)%p.length]))&&!result.some(r=>dist(r.point,q)<1e-5))result.push({...s,point:q});
 }return result;
}
function fan(p,support){
 let root=support.point,index=p.findIndex(q=>dist(q,root)<1e-5),ring=p;
 if(index>=0)root=p[index];
 if(index<0){index=p.findIndex((a,i)=>onEdge(root,a,p[(i+1)%p.length]));if(index<0)return null;ring=p.slice(0,index+1).concat([root],p.slice(index+1));index++}
 ring=ring.slice(index).concat(ring.slice(0,index));ring[0]=root;
 const n=ring.length,value=Array(n).fill(Infinity),back=Array(n).fill(null);value[1]=0;
 for(let i=1;i<n-1;i++){
  if(!Number.isFinite(value[i]))continue;
  for(let j=i+1;j<n&&j-i<=4;j++){
   const q=simple([root,...ring.slice(i,j+1)]);if(q.length<3||q.length>6||M.area(q)<1e-7)continue;
   try{if(M.mpArea(M.pc.difference(M.subject(q),M.subject(p)))>1e-5)continue}catch{continue}
   const score=value[i]+1+.001*q.length;
   if(score<value[j]){value[j]=score;back[j]={i,q}}
  }
 }
 if(!back[n-1])return null;
 const pieces=[];for(let j=n-1;j>1;){const b=back[j];if(!b)return null;pieces.push(b.q);j=b.i}
 const u=M.union(pieces.map(M.subject));if(M.mpArea(M.pc.difference(M.subject(p),u))>.001||Math.abs(pieces.reduce((s,q)=>s+M.area(q),0)-M.mpArea(u))>.001)return null;
 return pieces;
}
function sweep(p,support){
 const [a,b]=support.segment,length=dist(a,b),u=[(b[0]-a[0])/length,(b[1]-a[1])/length],v=[u[1],-u[0]];
 const tt=p.map(q=>(q[0]-a[0])*u[0]+(q[1]-a[1])*u[1]);
 let knots=[...tt,0,length].filter(t=>t>=Math.min(...tt)-1e-7&&t<=Math.max(...tt)+1e-7).sort((a,b)=>a-b);
 knots=knots.filter((t,i)=>!i||t-knots[i-1]>1e-5);
 const world=(t,d)=>[a[0]+u[0]*t+v[0]*d,a[1]+u[1]*t+v[1]*d];
 const value=Array(knots.length).fill(Infinity),back=Array(knots.length).fill(null);value[0]=0;
 for(let i=0;i<knots.length-1&&Date.now()<deadline;i++){
  if(!Number.isFinite(value[i]))continue;
  for(let j=i+1;j<knots.length&&Date.now()<deadline;j++){
   if(knots[i]>length+1e-5||knots[j]<-1e-5)continue;
   const rect=[world(knots[i],-1000),world(knots[j],-1000),world(knots[j],1000),world(knots[i],1000)];
   if(M.area(rect)<0)rect.reverse();
   let parts;try{parts=M.pc.intersection(M.subject(p),M.subject(rect))}catch{continue}
   const cells=[];let valid=true;
   for(const poly of parts){if(poly.length!==1){valid=false;break}let q=simple(poly[0].slice(0,-1));if(M.area(q)<0)q.reverse();
    if(M.area(q)<1e-7)continue;
    const touch=M.touches(q,[support]);
    if(q.length<3||q.length>6||!touch){valid=false;break}cells.push({polygon:q,growthSupport:touch});
   }
   if(!valid||!cells.length)continue;
   const score=value[i]+cells.length+.001*cells.reduce((s,c)=>s+c.polygon.length,0);
   if(score<value[j]){value[j]=score;back[j]={i,cells}}
  }
 }
 if(!back[knots.length-1])return null;
 const cells=[];for(let j=knots.length-1;j>0;){const step=back[j];if(!step)return null;cells.push(...step.cells);j=step.i}
 const union=M.union(cells.map(c=>M.subject(c.polygon)));
 if(M.mpArea(M.pc.difference(M.subject(p),union))>.001||M.mpArea(M.pc.difference(union,M.subject(p)))>.001)return null;
 return cells;
}
function partition(c,supports,{budgetMs=100}={}){
 deadline=Date.now()+budgetMs;
 const p=simple(c.polygon);if(p.length<=6)return [{...c,polygon:p,facetCount:p.length}];
 let best=null;
 const candidates=roots(p,supports);
 for(const s of candidates){if(Date.now()>=deadline)break;if(Date.now()>=deadline)break;const pieces=fan(p,s);if(pieces&&(!best||pieces.length<best.pieces.length))best={pieces,s};if(best&&best.pieces.length<=Math.ceil((p.length-2)/4))break}
 if(!best){const seen=new Set();for(const s of candidates){if(Date.now()>=deadline)break;if(Date.now()>=deadline)break;const key=JSON.stringify(s.segment);if(seen.has(key))continue;seen.add(key);const cells=sweep(p,s);if(cells)return cells.map(q=>({...c,...q,facetCount:q.polygon.length,kind:q.growthSupport.kind,identity:q.growthSupport.identity}))}return null}
 return best.pieces.map(p=>({...c,polygon:p,facetCount:p.length,growthSupport:best.s,kind:best.s.kind,identity:best.s.identity}));
}

return {partition};
})();

const GuideQuality=(()=>{let deadline=Infinity;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function simple(input){let p=input.slice(),changed=true;while(changed&&p.length>3){changed=false;
 for(let i=0;i<p.length;i++){const prev=(i+p.length-1)%p.length;if(dist(p[i],p[prev])<2e-5){p.splice(prev,1);changed=true;break}}
 if(changed)continue;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],l=dist(b,c);if(l>1e-8&&Math.abs((a[0]-b[0])*(c[1]-b[1])-(a[1]-b[1])*(c[0]-b[0]))/l<=2.5e-5){p.splice(i,1);changed=true;break}}
 }return p}
function onEdge(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2;return t>=-1e-7&&t<=1+1e-7&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(l2)<1e-5}
function roots(p,supports){const result=[];
 for(const s of supports){const [a,b]=s.segment,u=[b[0]-a[0],b[1]-a[1]],l2=u[0]**2+u[1]**2;
  const candidates=[a,b];
  for(const q of p){const t=Math.max(0,Math.min(1,((q[0]-a[0])*u[0]+(q[1]-a[1])*u[1])/l2));candidates.push([a[0]+t*u[0],a[1]+t*u[1]])}
  for(let i=0;i<p.length;i++){
   const c=p[i],d=p[(i+1)%p.length],v=[d[0]-c[0],d[1]-c[1]],den=u[0]*v[1]-u[1]*v[0];
   if(Math.abs(den)>1e-10){const t=((c[0]-a[0])*v[1]-(c[1]-a[1])*v[0])/den,q=((c[0]-a[0])*u[1]-(c[1]-a[1])*u[0])/den;if(t>=0&&t<=1&&q>=0&&q<=1)candidates.push([a[0]+t*u[0],a[1]+t*u[1]])}
  }
  for(const q of candidates)if(p.some((a,i)=>onEdge(q,a,p[(i+1)%p.length]))&&!result.some(r=>dist(r.point,q)<1e-5))result.push({...s,point:q});
 }return result;
}
function fan(p,support){
 let root=support.point,index=p.findIndex(q=>dist(q,root)<1e-5),ring=p;
 if(index>=0)root=p[index];
 if(index<0){index=p.findIndex((a,i)=>onEdge(root,a,p[(i+1)%p.length]));if(index<0)return null;ring=p.slice(0,index+1).concat([root],p.slice(index+1));index++}
 ring=ring.slice(index).concat(ring.slice(0,index));ring[0]=root;
 const n=ring.length,value=Array(n).fill(Infinity),back=Array(n).fill(null);value[1]=0;
 for(let i=1;i<n-1;i++){
  if(!Number.isFinite(value[i]))continue;
  for(let j=i+1;j<n&&j-i<=4;j++){
   const q=simple([root,...ring.slice(i,j+1)]);if(q.length<3||q.length>6||M.area(q)<1e-7)continue;
   try{if(M.mpArea(M.pc.difference(M.subject(q),M.subject(p)))>1e-5)continue}catch{continue}
   const score=value[i]+shapeCost(q);
   if(score<value[j]){value[j]=score;back[j]={i,q}}
  }
 }
 if(!back[n-1])return null;
 const pieces=[];for(let j=n-1;j>1;){const b=back[j];if(!b)return null;pieces.push(b.q);j=b.i}
 const u=M.union(pieces.map(M.subject));if(M.mpArea(M.pc.difference(M.subject(p),u))>.001||Math.abs(pieces.reduce((s,q)=>s+M.area(q),0)-M.mpArea(u))>.001)return null;
 return pieces;
}
function sweep(p,support){
 const [a,b]=support.segment,length=dist(a,b),u=[(b[0]-a[0])/length,(b[1]-a[1])/length],v=[u[1],-u[0]];
 const tt=p.map(q=>(q[0]-a[0])*u[0]+(q[1]-a[1])*u[1]);
 let knots=[...tt,0,length].filter(t=>t>=Math.min(...tt)-1e-7&&t<=Math.max(...tt)+1e-7).sort((a,b)=>a-b);
 knots=knots.filter((t,i)=>!i||t-knots[i-1]>1e-5);
 const world=(t,d)=>[a[0]+u[0]*t+v[0]*d,a[1]+u[1]*t+v[1]*d];
 const value=Array(knots.length).fill(Infinity),back=Array(knots.length).fill(null);value[0]=0;
 for(let i=0;i<knots.length-1&&Date.now()<deadline;i++){
  if(!Number.isFinite(value[i]))continue;
  for(let j=i+1;j<knots.length&&Date.now()<deadline;j++){
   if(knots[i]>length+1e-5||knots[j]<-1e-5)continue;
   const rect=[world(knots[i],-1000),world(knots[j],-1000),world(knots[j],1000),world(knots[i],1000)];
   if(M.area(rect)<0)rect.reverse();
   let parts;try{parts=M.pc.intersection(M.subject(p),M.subject(rect))}catch{continue}
   const cells=[];let valid=true;
   for(const poly of parts){if(poly.length!==1){valid=false;break}let q=simple(poly[0].slice(0,-1));if(M.area(q)<0)q.reverse();
    if(M.area(q)<1e-7)continue;
    const touch=M.touches(q,[support]);
    if(q.length<3||q.length>6||!touch){valid=false;break}cells.push({polygon:q,growthSupport:touch});
   }
   if(!valid||!cells.length)continue;
   const score=value[i]+cells.reduce((s,c)=>s+shapeCost(c.polygon),0);
   if(score<value[j]){value[j]=score;back[j]={i,cells}}
  }
 }
 if(!back[knots.length-1])return null;
 const cells=[];for(let j=knots.length-1;j>0;){const step=back[j];if(!step)return null;cells.push(...step.cells);j=step.i}
 const union=M.union(cells.map(c=>M.subject(c.polygon)));
 if(M.mpArea(M.pc.difference(M.subject(p),union))>.001||M.mpArea(M.pc.difference(union,M.subject(p)))>.001)return null;
 return cells;
}

function shapeCost(p){
 const A=Math.abs(M.area(p));let perimeter=0,acute=0;
 for(let i=0;i<p.length;i++){
  const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];perimeter+=dist(b,c);
  const ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1];
  if(ux*vy-uy*vx<0){const angle=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/Math.max(1e-12,Math.hypot(ux,uy)*Math.hypot(vx,vy)))))*180/Math.PI;acute+=5*Math.max(0,(14-angle)/14)**2}
 }
 return 1+.025*Math.max(0,perimeter*perimeter/Math.max(1e-9,4*Math.PI*A)-3)**1.2+acute;
}
function quality(cells){
 let cost=cells.reduce((s,c)=>s+shapeCost(simple(c.polygon)),0);const hubs=new Map();
 for(const c of cells){const support=c.growthSupport;if(!support)continue;const [a,b]=support.segment,dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),contacts=c.polygon.filter(p=>Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/l<3e-5).map(p=>((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l);
  if(contacts.length&&Math.max(...contacts)-Math.min(...contacts)>2)continue;
  const t=((support.point[0]-a[0])*dx+(support.point[1]-a[1])*dy)/l,key=support.identity+':'+Math.round(t/2);hubs.set(key,(hubs.get(key)||0)+1);
 }
 for(const n of hubs.values())cost+=.35*Math.max(0,n-2)**2;
 return cost;
}
function partition(c,supports,{budgetMs=100}={}){
 deadline=Date.now()+budgetMs;
 const p=simple(c.polygon);let best=null;
 const raw=roots(p,supports),candidates=raw.length<=24?raw:[raw[0],...Array.from({length:23},(_,i)=>raw[Math.round(i*(raw.length-1)/22)])];
 for(const s of candidates){if(Date.now()>=deadline)break;if(Date.now()>=deadline)break;const pieces=fan(p,s);if(!pieces)continue;const cells=pieces.map(p=>({...c,polygon:p,facetCount:p.length,growthSupport:s,kind:s.kind,identity:s.identity}));const score=quality(cells);if(!best||score<best.score)best={cells,score}}
 const seen=new Set();for(const s of candidates){if(Date.now()>=deadline)break;if(Date.now()>=deadline)break;const key=JSON.stringify(s.segment);if(seen.has(key))continue;seen.add(key);const pieces=sweep(p,s);if(!pieces)continue;const cells=pieces.map(q=>({...c,...q,facetCount:q.polygon.length,kind:q.growthSupport.kind,identity:q.growthSupport.identity})),score=quality(cells);if(!best||score<best.score)best={cells,score}}
 return best?best.cells:null;
}

return {partition,quality,simple};
})();
root.ReconstructionPartition={N,W,B,C,H,S,Final,Repair,MedianMesh,GuidePartition,GuideQuality};
if(typeof module!=="undefined")module.exports=root.ReconstructionPartition;
})(typeof globalThis!=="undefined"?globalThis:this);
