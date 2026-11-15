/* One conforming half-arm mesh, copied twelve times and fitted without changing topology. */
(function(root){
'use strict';
const R=typeof module!=='undefined'?require('./branch-regions.js'):root.BranchRegions;
const S=typeof module!=='undefined'?require('./structural-model.js'):root.StructuralModel;
const PF=typeof module!=='undefined'?require('./polygon-fit.js'):root.PolygonFit;
const Surface=typeof module!=='undefined'?require('./silhouette-mesh.js'):root.SilhouetteMesh;
const Earcut=typeof module!=='undefined'?require('./vendor/earcut.min.js'):root.earcut;
const cache=new WeakMap(),edgeCache=new WeakMap(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const signed=p=>p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-a[1]*b[0]},0)/2;
const mean=a=>{const s=a.slice().sort((a,b)=>a-b),k=Math.floor(a.length*.15),v=s.slice(k,s.length-k);return v.reduce((s,x)=>s+x,0)/v.length};
function hull(points){const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),a=[],b=[];for(const v of sorted){while(a.length>1&&cross(a.at(-2),a.at(-1),v)<=1e-9)a.pop();a.push(v)}for(const v of sorted.slice().reverse()){while(b.length>1&&cross(b.at(-2),b.at(-1),v)<=1e-9)b.pop();b.push(v)}return a.slice(0,-1).concat(b.slice(0,-1));}
function subtract(p,q){if(q.some((a,i)=>p.every(v=>cross(a,q[(i+1)%q.length],v)<=1e-8))||p.some((a,i)=>q.every(v=>cross(a,p[(i+1)%p.length],v)<=1e-8)))return [p];let inside=p,out=[];for(let i=0;i<q.length&&inside.length>=3;i++){const a=q[i],b=q[(i+1)%q.length],left=[],right=[];for(let j=0;j<inside.length;j++){const v=inside[j],w=inside[(j+1)%inside.length],dv=cross(a,b,v),dw=cross(a,b,w);if(dv>=-1e-9)left.push(v);if(dv<=1e-9)right.push(v);if(dv>1e-9&&dw< -1e-9||dv< -1e-9&&dw>1e-9){const z=dv/(dv-dw),point=[v[0]+z*(w[0]-v[0]),v[1]+z*(w[1]-v[1])];left.push(point);right.push(point)}}if(right.length>=3&&Math.abs(signed(right))>1e-7)out.push(hull(right));inside=hull(left);}return out;}
function merge(parts){let p=parts.filter(p=>p.length>=3&&Math.abs(signed(p))>1e-7).flatMap(p=>p.length<=6?[p]:p.slice(1,-1).map((v,i)=>[p[0],v,p[i+2]]));while(true){let best=null;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const h=hull([...p[i],...p[j]]);if(h.length>6||Math.abs(Math.abs(signed(h))-Math.abs(signed(p[i]))-Math.abs(signed(p[j])))>1e-6)continue;const area=Math.abs(signed(h));if(!best||area>best.area)best={i,j,h,area};}if(!best)break;p[best.i]=best.h;p.splice(best.j,1);}return p;}
function intersect(p,q){let out=p;for(let i=0;i<q.length&&out.length>=3;i++){const a=q[i],b=q[(i+1)%q.length],next=[];for(let j=0;j<out.length;j++){const v=out[j],w=out[(j+1)%out.length],dv=cross(a,b,v),dw=cross(a,b,w);if(dv>=-1e-9)next.push(v);if(dv>1e-9&&dw< -1e-9||dv< -1e-9&&dw>1e-9){const z=dv/(dv-dw);next.push([v[0]+z*(w[0]-v[0]),v[1]+z*(w[1]-v[1])])}}out=hull(next)}return out;}
function projection(p,t){const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy);return {u:((p[0]-t.start[0])*dx+(p[1]-t.start[1])*dy)/(L*L),w:((p[1]-t.start[1])*dx-(p[0]-t.start[0])*dy)/L};}
function point(t,u,w){const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy);return [t.start[0]+u*dx-w*dy/L,t.start[1]+u*dy+w*dx/L]}
function sample(values,u,side){const k=clamp(u,0,1)*R.STEPS,i=Math.min(R.STEPS-1,Math.floor(k)),z=k-i;return values[i][side]*(1-z)+values[i+1][side]*z}
// Public 50% is the former maximum. Above it, tighten measured-profile error
// and permit deeper adaptive splits; do not subdivide flat regions merely to
// increase the polygon count. Branch selection saturates at the old maximum.
const structureDetail=detail=>Math.min(100,Math.max(0,detail)*2);
function primitives(t,values,detail,scale){const result=[],count=R.STEPS,base=Math.min(100,detail),extra=Math.max(0,detail-100)/100;
 function fit(i,j,depth){const ring=values.slice(i,j+1).map((v,k)=>point(t,(i+k)/count,v[0]*scale)).concat(values.slice(i,j+1).map((v,k)=>point(t,(i+k)/count,v[1]*scale)).reverse()),h=hull(ring);if(h.length<3)return;const anchors=[point(t,i/count,values[i][0]*scale),point(t,i/count,values[i][1]*scale),point(t,j/count,values[j][0]*scale),point(t,j/count,values[j][1]*scale)];let p;try{p=PF.fit(h,point(t,i/count,0),point(t,j/count,0),base,anchors)}catch{p=hull(anchors)}
  const root=t.parent===null,excess=Math.abs(signed(h))/Math.max(.001,Math.abs(signed(ring))),missing=Math.abs(signed(p))/Math.abs(signed(h)),limit=(root?1.15:1.3)*(1-extra)+(root?1.04:1.08)*extra;
  if((excess>limit+.3*(1-base/100)||missing<.92+.06*extra-.12*(1-base/100))&&depth<(root?2:base>=60?1:0)+Math.ceil(extra)&&j-i>1&&(j-i)*t.length/count>(3-1.5*extra)*scale){const middle=Math.round((i+j)/2);fit(i,middle,depth+1);fit(middle,j,depth+1)}else result.push(p);
 }
 fit(0,count,0);return result;
}
function scaffold(model,detail,hub){
 const profiles=R.measure(model).profiles,ideal=S.deform(model,Math.min(100,detail),100),groups=new Map(),means=new Map();
 for(const t of model.tree){if(!groups.has(t.slotId))groups.set(t.slotId,[]);groups.get(t.slotId).push(profiles[t.id].map(v=>t.mirror?[-v[1],-v[0]]:v));}
 for(const [id,records] of groups){const values=records[0].map((_,i)=>[0,1].map(s=>mean(records.map(p=>p[i][s]))));if(model.slots[id].parent===null)for(const v of values){const w=(v[1]-v[0])/2;v[0]=-w;v[1]=w}means.set(id,values)}
 const c=model.n*model.scale/2,axis=model.axis,r=c*6,wedge=[[c,c],[c+r*Math.cos(axis),c+r*Math.sin(axis)],[c+r*Math.cos(axis+Math.PI/6),c+r*Math.sin(axis+Math.PI/6)]],half=ideal.filter(t=>t.arm===0&&!t.mirror),claimed=[hull(hub.polygon)],base=[];
 const sourceGroups=detail>100?half.map(t=>({slotId:t.slotId,polygons:primitives(t,means.get(t.slotId),detail,model.scale).map(p=>intersect(p,wedge)).filter(p=>p.length>=3)})):null,material=sourceGroups?Surface.material(model,ideal,detail,wedge,sourceGroups):null;
 if(material){for(const group of Surface.partition(material,hull(hub.polygon),sourceGroups)){merge(group.polygons).forEach((polygon,i)=>base.push({slotId:group.slotId,pieceSlotId:group.slotId+':'+i,polygon}));}}
 else for(const t of half){const region=[];for(const source of primitives(t,means.get(t.slotId),detail,model.scale)){const p=intersect(source,wedge);if(p.length<3)continue;let parts=[p];for(const q of claimed)parts=parts.flatMap(v=>subtract(v,q));region.push(...parts);claimed.push(p)}
  const polygons=merge(region);polygons.forEach((polygon,i)=>base.push({slotId:t.slotId,pieceSlotId:t.slotId+':'+i,polygon}));
 }
 const vertices=[],faces=[],lookup=new Map(),owners=[];
 const vertex=p=>{const key=p.map(v=>Math.round(v*1e9)).join(',');if(lookup.has(key))return lookup.get(key);const id=vertices.length;lookup.set(key,id);vertices.push(p);owners.push(new Set());return id};
 for(let arm=0;arm<6;arm++)for(const mirror of [false,true]){const angle=arm*Math.PI/3,co=Math.cos(angle),si=Math.sin(angle),ca=Math.cos(2*axis),sa=Math.sin(2*axis);for(const face of base){let p=face.polygon.map(([x,y])=>{x-=c;y-=c;if(mirror)[x,y]=[ca*x+sa*y,sa*x-ca*y];return [c+x*co-y*si,c+x*si+y*co]});if(mirror)p.reverse();const t=ideal.find(t=>t.arm===arm&&t.slotId===face.slotId&&(t.parent===null||t.mirror===mirror)),ids=p.map(vertex);for(const id of ids)owners[id].add(t.id);faces.push({...face,polygon:undefined,ids,arm,mirror,branchId:t.id,sideCount:ids.length});}}
 const coreIds=hub.polygon.map(vertex);faces.push({ids:coreIds,kind:'core',pieceSlotId:'core',branchId:null,sideCount:6});
 // A T-junction remains on its containing edge during fitting. It never becomes
 // an independent kink on one face while its neighbor retains a straight edge.
 const constraints=new Map(),edges=faces.flatMap(f=>f.ids.map((a,i)=>[a,f.ids[(i+1)%f.ids.length]]));
 for(let v=0;v<vertices.length;v++){let best=null;for(const [a,b] of edges){if(v===a||v===b)continue;const A=vertices[a],B=vertices[b],P=vertices[v],dx=B[0]-A[0],dy=B[1]-A[1],den=dx*dx+dy*dy,u=((P[0]-A[0])*dx+(P[1]-A[1])*dy)/den;if(u<=1e-7||u>=1-1e-7||Math.abs(cross(A,B,P))>1e-7*Math.sqrt(den))continue;if(!best||den>best.den)best={a,b,u,den};}if(best)constraints.set(v,best);}
 // Partially overlapping collinear edges can otherwise create A→B→A
 // T-junction constraints. Flatten each collinear dependency group onto its
 // outer endpoints so fitting has an acyclic, stable set of shared coordinates.
 const parent=vertices.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),join=(a,b)=>{parent[find(a)]=find(b)};
 for(const [id,e] of constraints)for(const endpoint of [e.a,e.b]){const q=constraints.get(endpoint);if(!q)continue;const A=vertices[e.a],B=vertices[e.b],L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(Math.abs(cross(A,B,vertices[q.a]))<1e-7*L&&Math.abs(cross(A,B,vertices[q.b]))<1e-7*L)join(id,endpoint);}
 const lines=new Map();for(const id of constraints.keys()){const group=find(id);if(!lines.has(group))lines.set(group,[]);lines.get(group).push(id)}
 for(const ids of lines.values()){const e=constraints.get(ids[0]),A=vertices[e.a],B=vertices[e.b],dx=B[0]-A[0],dy=B[1]-A[1],all=[...new Set(ids.flatMap(id=>{const q=constraints.get(id);return [id,q.a,q.b]}))].sort((a,b)=>(vertices[a][0]-vertices[b][0])*dx+(vertices[a][1]-vertices[b][1])*dy),a=all[0],b=all.at(-1),X=vertices[a],Y=vertices[b],vx=Y[0]-X[0],vy=Y[1]-X[1],den=vx*vx+vy*vy;for(const id of ids){if(id===a||id===b)constraints.delete(id);else constraints.set(id,{a,b,u:((vertices[id][0]-X[0])*vx+(vertices[id][1]-X[1])*vy)/den,den})}}
 // Export uses the same subsegments on both sides of every shared edge. This
 // prevents coordinate rounding from turning a T-junction into a hairline gap.
 const resolved=resolveConstraints(constraints);constraints.clear();for(const [id,row] of resolved)constraints.set(id,row);
 const mesh={vertices,faces,owners,ideal,means,profiles,constraints,coreIds,detail,silhouette:!!material,initialFaceCount:faces.length,maxFaceCount:Math.floor(faces.length*1.1)};
 cutEdges(mesh);mesh.boundaries=boundaryEdges(mesh);mesh.exterior=new Set(mesh.boundaries.flat());
 return mesh;
}
// Both independent fits start from the same immutable scaffold. Only the face
// records change during refinement. Features copy the vertex/owner arrays before
// extending them; measured profiles, coordinates and constraints stay read-only.
function copyScaffold(mesh){return {...mesh,faces:mesh.faces.map(f=>({...f}))};}
function fitScaffold(mesh,model,detail,localHub){
 mesh.faithful=fitImage(mesh,model,localHub);
 // A shape that needs another facet on one observed arm gets that same facet
 // definition on every half-arm, rather than independently changing its topology.
 for(let pass=0;pass<(detail>=60?2:0);pass++){if(!refine(mesh))break;mesh.faithful=fitImage(mesh,model,localHub);}
 cutEdges(mesh);mesh.boundaries=boundaryEdges(mesh);mesh.exterior=new Set(mesh.boundaries.flat());
 if(model.boundaryEvidence&&detail>=120)addBoundaryFeatures(mesh,model);
 return mesh;
}
function build(model,detail,hub,localHub){
 const source=scaffold(model,detail,hub),mesh=fitScaffold(copyScaffold(source),model,detail,localHub);
 // Full-resolution evidence is a guide, not permission to damage a previously
 // sound interpretation. Compare complete valid poses, including their topology,
 // instead of accepting every nearest-contour projection unconditionally.
 if(model.boundaryEvidence){const baseline=fitScaffold(copyScaffold(source),{...model,boundaryEvidence:null},detail,localHub),before=boundaryError(baseline,model),after=boundaryError(mesh,model);if(before.total<after.total){baseline.boundaryComparison={before,after,selected:'scaffold'};return baseline;}mesh.boundaryComparison={before,after,selected:'evidence'};}
 return mesh;
}
function cutEdges(mesh){
 // Canonical coordinates never move. Reuse each exact directed subdivision
 // across fitting/refinement passes; feature insertion uses a new vertex array.
 let entry=edgeCache.get(mesh.vertices);if(!entry){entry={edges:new Map(),index:spatialBoxes(mesh.vertices.map(([x,y])=>[x,y,x,y]))};edgeCache.set(mesh.vertices,entry);}const {edges,index}=entry;
 for(const f of mesh.faces)f.cutIds=f.ids.flatMap((a,k)=>{const b=f.ids[(k+1)%f.ids.length],key=a+':'+b;if(edges.has(key))return edges.get(key);const A=mesh.vertices[a],B=mesh.vertices[b],dx=B[0]-A[0],dy=B[1]-A[1],den=dx*dx+dy*dy,padding=1e-7+1e-8*Math.sqrt(den),along=[],candidates=index.query([Math.min(A[0],B[0])-padding,Math.min(A[1],B[1])-padding,Math.max(A[0],B[0])+padding,Math.max(A[1],B[1])+padding]);for(const id of [...candidates].sort((a,b)=>a-b)){const P=mesh.vertices[id],u=((P[0]-A[0])*dx+(P[1]-A[1])*dy)/den;if(u>=-1e-8&&u<1-1e-8&&Math.abs(cross(A,B,P))<1e-7*Math.sqrt(den))along.push({id,u})}const ids=along.sort((a,b)=>a.u-b.u).map(v=>v.id);edges.set(key,ids);return ids});
}
function boundaryEdges(mesh){const edges=new Map();for(const f of mesh.faces)for(let i=0;i<f.cutIds.length;i++){const a=f.cutIds[i],b=f.cutIds[(i+1)%f.cutIds.length];if(a===b)continue;const key=a+':'+b,reverse=b+':'+a;if(edges.has(reverse)){const edge=edges.get(reverse);if(--edge.count===0)edges.delete(reverse);}else if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}const outgoing=new Map();for(const [key,{a,b}] of edges){if(!outgoing.has(a))outgoing.set(a,[]);outgoing.get(a).push([key,b]);}const loops=[];while(edges.size){const start=edges.values().next().value.a,ring=[];let at=start;do{ring.push(at);const next=outgoing.get(at)?.find(([key])=>edges.has(key));if(!next)throw Error('Open shared-mesh boundary');const edge=edges.get(next[0]);if(--edge.count===0)edges.delete(next[0]);at=next[1];}while(at!==start);if(ring.length>=3)loops.push(ring);}return loops;}

// Add the same optional boundary corner to every copy of a role. It is a free
// vertex, inserted after the old T-junction constraints have been resolved; an
// inferred tip can therefore leave the former straight edge. Most faces gain
// a corner without gaining a cell. Only a full hexagon needs a common split.
function boundaryError(mesh,model){const evidence=model.boundaryEvidence,size=evidence.size,scale=size/(model.n*model.scale),C=typeof module!=='undefined'?require('./crystal'):root.Crystal,target=C.raster(evidence.loops,size),mask=C.raster(mesh.boundaries.map(r=>r.map(i=>mesh.faithful[i].map(v=>v*scale))),size);let missing=0,excess=0;for(let i=0;i<mask.length;i++){if(target[i]&&!mask[i])missing++;if(!target[i]&&mask[i])excess++;}return {missing,excess,total:missing+excess};}
// Candidate edges can contain old T-junctions. Walk their complete common
// subdivision; an unsplit corner-to-corner lookup would miss real exterior edges.
function exteriorChain(face,a,b,exterior){const ids=face.mirror?face.cutIds.slice().reverse():face.cutIds,start=ids.indexOf(a);if(start<0)return null;const chain=[a];for(let k=1;k<=ids.length;k++){const next=ids[(start+k)%ids.length],previous=chain.at(-1);if(!exterior.has(previous+':'+next)&&!exterior.has(next+':'+previous))return null;chain.push(next);if(next===b)return chain;}return null;}
// A shared diagonal must work in every canonical and faithful embedding. Small
// dynamic programming over the affected face avoids a fixed, sometimes flat,
// seven-corner split. Goal convexity prefers splits that let the feature move.
function featureParts(records,vertices,faithful,goals,maxParts){const count=records[0].ids.length,memo=new Map();
 const polygon=(record,role,positions)=>{const p=role.map(k=>positions[record.ids[k]]);return record.face.mirror?p.reverse():p;};
 const feasible=role=>records.every(record=>[vertices,faithful].every(positions=>{const p=polygon(record,role,positions);return signed(p)>1e-8&&convex(p);}));
 function solve(role){const key=role.join(',');if(memo.has(key))return memo.get(key);let best=null;if(role.length<=6&&feasible(role)){const bad=records.reduce((n,record)=>n+(convex(polygon(record,role,goals))?0:1),0);best={parts:[role],score:1+bad*8};}
  for(let i=0;i<role.length;i++)for(let j=i+2;j<role.length;j++){if(i===0&&j===role.length-1)continue;const left=role.slice(i,j+1),right=role.slice(j).concat(role.slice(0,i+1));if(!feasible(left)||!feasible(right))continue;const a=solve(left),b=solve(right);if(!a||!b||a.parts.length+b.parts.length>maxParts)continue;const score=a.score+b.score;if(!best||score<best.score)best={parts:a.parts.concat(b.parts),score};}
  memo.set(key,best);return best;
 }const result=solve(Array.from({length:count},(_,i)=>i));return result?{parts:result.parts,goalConvex:result.score===result.parts.length}:null;
}
// A concave neck may require an interior vertex: boundary-only diagonals can
// be degenerate in copies whose new corners remain collinear. Choose each local
// center inside both the old face and the goal's visibility kernel, then merge
// adjacent fan triangles with one common partition across all embeddings.
function featureFan(records,trial,maxParts){const n=records[0].ids.length,start=trial.vertices.length;
 for(const record of records){let initial=record.ids.map(id=>trial.faithful[id]),goal=record.ids.map(id=>trial.goals[id]);if(record.face.mirror){initial=initial.slice().reverse();goal=goal.slice().reverse();}const kernel=intersect(hull(initial),goal);if(kernel.length<3||signed(kernel)<1e-6){trial.vertices.length=trial.faithful.length=trial.goals.length=trial.owners.length=start;for(const r of records)if(r.ids.length>n)r.ids.pop();return null;}const center=[0,1].map(k=>kernel.reduce((sum,p)=>sum+p[k],0)/kernel.length),canonical=[0,1].map(k=>record.ids.reduce((sum,id)=>sum+trial.vertices[id][k],0)/n),id=trial.vertices.length;trial.vertices.push(canonical);trial.faithful.push(center);trial.goals.push(center);trial.owners.push(new Set(record.ids.flatMap(id=>[...trial.owners[id]])));record.ids.push(id);}
 const feasible=role=>records.every(record=>[trial.vertices,trial.faithful,trial.goals].every(positions=>{let p=role.map(i=>positions[record.ids[i]]);if(record.face.mirror)p.reverse();return signed(p)>1e-8&&convex(p);}));let best=null;
 for(let startAt=0;startAt<n;startAt++){const dp=Array(n+1).fill(null);dp[n]=[];for(let i=n-1;i>=0;i--)for(let length=1;length<=4&&i+length<=n;length++){if(!dp[i+length])continue;const role=[n,...Array.from({length:length+1},(_,k)=>(startAt+i+k)%n)];if(!feasible(role))continue;const parts=[role,...dp[i+length]];if(parts.length<=maxParts&&(!dp[i]||parts.length<dp[i].length))dp[i]=parts;}if(dp[0]&&(!best||dp[0].length<best.length))best=dp[0];}
 if(!best){trial.vertices.length=trial.faithful.length=trial.goals.length=trial.owners.length=start;for(const r of records)r.ids.pop();}return best;
}
// Compatible local triangulation. Each embedding triangulates the same ordered
// boundary roles; omitted collinear roles are reinserted by splitting their
// incident triangle. Overlay only those diagonals in a convex reference polygon,
// then map vertices back barycentrically. This changes one small face family,
// never overlays the twelve photographic silhouettes.
function compatibleFeature(records,trial,maxParts){const n=records[0].ids.length;if(n>12)return null;const reference=Array.from({length:n},(_,i)=>[1000*Math.cos(i*2*Math.PI/n),1000*Math.sin(i*2*Math.PI/n)]),embeddings=[],triangulations=new Map();
 function triangles(p,mirror){const o=p[0],dx=p[1][0]-o[0],dy=p[1][1]-o[1],length=Math.hypot(dx,dy);if(length<1e-6)return null;const q=p.map(v=>{const x=v[0]-o[0],y=v[1]-o[1];return [Math.round((x*dx+y*dy)/(length*length)*1e9)/1e9,Math.round((mirror?-1:1)*(y*dx-x*dy)/(length*length)*1e9)/1e9];}),boundary=Array.from({length:n},(_,i)=>i);for(let changed=true;changed&&boundary.length>3;){changed=false;for(let i=0;i<boundary.length;i++){const a=p[boundary[(i+boundary.length-1)%boundary.length]],b=p[boundary[i]],c=p[boundary[(i+1)%boundary.length]];if(Math.abs(cross(a,c,b))<=1e-9*Math.hypot(c[0]-a[0],c[1]-a[1])){boundary.splice(i,1);changed=true;break;}}}const raw=Earcut(boundary.flatMap(i=>q[i]),null,2),out=[];for(let i=0;i<raw.length;i+=3)out.push(raw.slice(i,i+3).map(j=>boundary[j]));const used=new Set(out.flat());
  for(let id=0;id<n;id++){if(used.has(id))continue;let found=false;for(let k=0;k<out.length&&!found;k++)for(let j=0;j<3;j++){const a=out[k][j],b=out[k][(j+1)%3],c=out[k][(j+2)%3],A=q[a],B=q[b],P=q[id],vx=B[0]-A[0],vy=B[1]-A[1],den=vx*vx+vy*vy,t=((P[0]-A[0])*vx+(P[1]-A[1])*vy)/den;if(t<=1e-10||t>=1-1e-10||Math.abs(cross(A,B,P))>1e-8*Math.sqrt(den))continue;out.splice(k,1,[a,id,c],[id,b,c]);used.add(id);found=true;break;}if(!found)return null;}
  if(out.length!==n-2)return null;let sum=0;for(const ids of out){let shape=ids.map(i=>p[i]);if(mirror)shape.reverse();const a=signed(shape);if(a<=1e-8)return null;sum+=a;}if(Math.abs(sum-Math.abs(signed(p)))>1e-6)return null;return out;
 }
 let canonicalTriangles=null;for(const record of records){const rows=[];for(const positions of [trial.vertices,trial.faithful,trial.goals]){const p=record.ids.map(id=>positions[id]),ids=positions===trial.vertices&&canonicalTriangles?canonicalTriangles:triangles(p,record.face.mirror);if(positions===trial.vertices&&!canonicalTriangles)canonicalTriangles=ids;if(!ids)return null;const key=ids.map(t=>t.slice().sort((a,b)=>a-b).join(',')).sort().join('|');if(!triangulations.has(key))triangulations.set(key,ids);rows.push({p,ids});}embeddings.push(rows);}
 let atoms=[reference];for(const ids of triangulations.values()){const next=[];for(const atom of atoms)for(const face of ids){const triangle=hull(face.map(i=>reference[i])),part=intersect(atom,triangle);if(part.length>=3&&signed(part)>1e-7)next.push(part);}atoms=next;if(atoms.length>128)return null;}
 const points=[],lookup=new Map(),vertex=p=>{const key=p.map(v=>Math.round(v*1e7)).join(',');if(lookup.has(key))return lookup.get(key);const id=points.length;lookup.set(key,id);points.push(p);return id;};reference.forEach(vertex);let roles=atoms.map(p=>p.map(vertex));if(points.length>192)return null;
 const mapped=embeddings.map(rows=>rows.map(({p,ids})=>points.map((point,index)=>{if(index<n)return p[index];for(const face of ids){const [A,B,C]=face.map(i=>reference[i]),den=cross(A,B,C),u=cross(point,B,C)/den,v=cross(A,point,C)/den,w=1-u-v;if(Math.min(u,v,w)<-1e-7)continue;return [0,1].map(k=>u*p[face[0]][k]+v*p[face[1]][k]+w*p[face[2]][k]);}return null;})));if(mapped.some(rows=>rows.some(ps=>ps.some(p=>!p||p.some(v=>!Number.isFinite(v))))))return null;
 function validRole(role){return mapped.every((rows,i)=>rows.every(ps=>{let p=role.map(id=>ps[id]);if(records[i].face.mirror)p.reverse();return signed(p)>1e-8&&convex(p);}));}
 // The reference overlay cells can have more than six corners. Its convex
 // atoms lie in one affine triangle in every embedding, so fan splitting is safe.
 roles=roles.flatMap(role=>role.length<=6?[role]:role.slice(1,-1).map((_,i)=>[role[0],role[i+1],role[i+2]]));if(roles.some(role=>!validRole(role)))return null;
 function joined(a,b){const edges=new Map();for(const ring of [a,b])for(let i=0;i<ring.length;i++){const x=ring[i],y=ring[(i+1)%ring.length],reverse=y+':'+x;if(edges.has(reverse))edges.delete(reverse);else edges.set(x+':'+y,[x,y]);}if(edges.size===a.length+b.length)return null;const first=edges.values().next().value,ring=[];let at=first[0];while(edges.size){ring.push(at);const pair=[...edges.entries()].find(([,e])=>e[0]===at);if(!pair)return null;edges.delete(pair[0]);at=pair[1][1];if(at===ring[0])break;}if(edges.size)return null;
  for(let changed=true;changed&&ring.length>3;){changed=false;for(let i=0;i<ring.length;i++){const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];if(mapped.every(rows=>rows.every(ps=>Math.abs(cross(ps[a],ps[c],ps[b]))<1e-7*Math.hypot(ps[c][0]-ps[a][0],ps[c][1]-ps[a][1])))){ring.splice(i,1);changed=true;break;}}}return ring.length<=6&&validRole(ring)?ring:null;
 }
 while(true){let merged=false;for(let i=0;i<roles.length&&!merged;i++)for(let j=i+1;j<roles.length;j++){const ring=joined(roles[i],roles[j]);if(ring){roles[i]=ring;roles.splice(j,1);merged=true;break;}}if(!merged)break;}if(roles.length>maxParts)return null;
 const total=reference.reduce((s,a,i)=>{const b=reference[(i+1)%n];return s+a[0]*b[1]-a[1]*b[0]},0)/2,covered=roles.reduce((s,r)=>s+signed(r.map(i=>points[i])),0);if(Math.abs(total-covered)>1e-3)return null;
 for(let i=0;i<records.length;i++){const record=records[i];for(let j=n;j<points.length;j++){const id=trial.vertices.length;trial.vertices.push(mapped[i][0][j]);trial.faithful.push(mapped[i][1][j]);trial.goals.push(mapped[i][2][j]);trial.owners.push(new Set(record.ids.flatMap(k=>[...trial.owners[k]])));record.ids.push(id);record.newIds.push(id);record.initials.push(mapped[i][1][j]);if(record.targets)record.targets.push(mapped[i][2][j]);}}
 return roles;
}
// Keep only a few strong turns from an ordered evidence run. A blunt stub
// needs its neck and end corners; one extremum alone creates a triangular ear.
function featureCorners(contour){const keep=[0,contour.length-1];for(let pass=0;pass<3;pass++){let best=null;for(let k=0;k<keep.length-1;k++){const a=contour[keep[k]],b=contour[keep[k+1]],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;for(let i=keep[k]+1;i<keep[k+1];i++){const p=contour[i],u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(den||1),0,1),distance=Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);if(distance>=1.5&&(!best||distance>best.distance))best={i,distance};}}if(!best)break;keep.push(best.i);keep.sort((a,b)=>a-b);}return keep.slice(1,-1).map(i=>contour[i]);}
function matchedCorners(contour,corners,count){const indices=[0,...corners.map((_,i)=>Math.round((i+1)*(count+1)/(corners.length+1))),count+1],points=[contour[0],...corners,contour.at(-1)],out=[];for(let k=1;k<=count;k++){const i=indices.findIndex((v,j)=>j+1<indices.length&&k>=v&&k<=indices[j+1]),t=(k-indices[i])/(indices[i+1]-indices[i]);out.push(points[i].map((v,d)=>v+t*(points[i+1][d]-v)));}return out;}
function addBoundaryFeatures(mesh,model){const before=boundaryError(mesh,model),exterior=new Set(mesh.boundaries.flatMap(r=>r.map((a,i)=>a+':'+r[(i+1)%r.length]))),groups=new Map();for(const face of mesh.faces){if(face.kind==='core')continue;if(!groups.has(face.pieceSlotId))groups.set(face.pieceSlotId,[]);groups.get(face.pieceSlotId).push(face);}const candidates=[];
 for(const [key,faces] of groups){const n=faces[0].ids.length;for(let edge=0;edge<n;edge++){const records=[];let compatible=true;for(const face of faces){const ids=face.mirror?face.ids.slice().reverse():face.ids,a=ids[edge],b=ids[(edge+1)%n],chain=exteriorChain(face,a,b,exterior);if(!chain){compatible=false;break;}const found=Surface.feature(model,mesh.vertices[face.mirror?b:a],mesh.vertices[face.mirror?a:b],face.arm,[mesh.faithful[face.mirror?b:a],mesh.faithful[face.mirror?a:b]]);if(found&&face.mirror){found.u=1-found.u;found.contour.reverse();}records.push({face,a,b,chain,found});}const supported=records.filter(r=>r.found);if(compatible&&supported.length&&records.every(r=>r.chain.length===records[0].chain.length))candidates.push({key,records,edge,priority:Math.max(...supported.map(r=>r.found.priority))});}}
 let accepted=0,error=before;const used=new Set(),attempts=[];
 for(const candidate of candidates.sort((a,b)=>b.priority-a.priority)){if(accepted>=3)break;if(used.has(candidate.key))continue;try{const values=candidate.records.filter(r=>r.found).map(r=>r.found.u).sort((a,b)=>a-b),u=values[values.length>>1],seed=candidate.records[0],A=mesh.vertices[seed.a],B=mesh.vertices[seed.b],dx=B[0]-A[0],dy=B[1]-A[1],den=dx*dx+dy*dy,ts=seed.chain.map(id=>((mesh.vertices[id][0]-A[0])*dx+(mesh.vertices[id][1]-A[1])*dy)/den),segment=ts.findIndex((v,i)=>i+1<ts.length&&u>v+1e-5&&u<ts[i+1]-1e-5);if(segment<0)continue;
  const cornerCount=Math.max(...candidate.records.map(r=>r.found?featureCorners(r.found.contour).length:0));if(!cornerCount)continue;
  const trial={...mesh,vertices:mesh.vertices.slice(),faithful:mesh.faithful.slice(),goals:mesh.faithful.slice(),owners:mesh.owners.slice(),faces:mesh.faces.map(f=>({...f}))},records=[];
  for(const record of candidate.records){const {face,chain}=record,ids=face.mirror?face.ids.slice().reverse():face.ids.slice(),left=chain[segment],right=chain[segment+1],L=mesh.vertices[left],R=mesh.vertices[right],newIds=[],initials=[],targets=record.found?matchedCorners(record.found.contour,featureCorners(record.found.contour),cornerCount).map(p=>{const a=mesh.faithful[left],b=mesh.faithful[right],dx=b[0]-a[0],dy=b[1]-a[1];if(cross(a,b,p)*(face.mirror?-1:1)<=0)return p;const u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);return [a[0]+u*dx,a[1]+u*dy];}):null;
   for(let j=0;j<cornerCount;j++){const t=(j+1)/(cornerCount+1),id=trial.vertices.length,canonical=L.map((v,k)=>v+t*(R[k]-v)),initial=mesh.faithful[left].map((v,k)=>v+t*(mesh.faithful[right][k]-v));trial.vertices.push(canonical);trial.faithful.push(initial);trial.goals.push(targets?.[j]||initial);trial.owners.push(new Set([...mesh.owners[left],...mesh.owners[right]]));newIds.push(id);initials.push(initial);}
   const inserted=[];if(left!==record.a)inserted.push(left);inserted.push(...newIds);if(right!==record.b)inserted.push(right);ids.splice(candidate.edge+1,0,...inserted);records.push({...record,ids,newIds,initials,targets});
  }
  const budget=1+Math.floor((mesh.maxFaceCount-mesh.faces.length)/records.length),diagonals=featureParts(records,trial.vertices,trial.faithful,trial.goals,budget);let parts=diagonals?.parts,method='diagonals';if(!diagonals?.goalConvex){const fan=featureFan(records,trial,budget);if(fan){parts=fan;method='fan';}else{const compatible=compatibleFeature(records,trial,budget);if(compatible){parts=compatible;method='compatible';}}}if(!parts){attempts.push({role:candidate.key,reason:'no shared convex partition'});continue;}
  const replacements=new Map(records.map(record=>[record.face.pieceSlotId+'|'+record.face.arm+'|'+record.face.mirror,parts.map((role,k)=>{let ids=role.map(i=>record.ids[i]);if(record.face.mirror)ids.reverse();return {...record.face,ids,sideCount:ids.length,pieceSlotId:record.face.pieceSlotId+(parts.length>1?'.boundary'+k:'')};})]));trial.faces=trial.faces.flatMap(face=>replacements.get(face.pieceSlotId+'|'+face.arm+'|'+face.mirror)||[face]);
  if(!valid(trial,trial.vertices)||!valid(trial,trial.faithful)){attempts.push({role:candidate.key,reason:'invalid initial partition'});continue;}
  // Pin accepted vertices. Only the inserted corners move, so a local feature
  // cannot be rejected because another pass drifted an unrelated branch.
  let moved=0;for(const record of records){if(!record.targets)continue;for(const alpha of [1,.75,.5,.25,.125]){const positions=trial.faithful.slice();record.newIds.forEach((id,j)=>positions[id]=record.initials[j].map((v,k)=>v+alpha*(record.targets[j][k]-v)));if(valid(trial,positions)){trial.faithful=positions;moved++;break;}}}
  if(!moved){attempts.push({role:candidate.key,reason:'no feasible feature movement'});continue;}cutEdges(trial);trial.boundaries=boundaryEdges(trial);trial.exterior=new Set(trial.boundaries.flat());const after=boundaryError(trial,model);if(error.total-after.total<=Math.max(0,(parts.length-1)*records.length)*2.25*(model.boundaryEvidence.size/768)**2){attempts.push({role:candidate.key,reason:'no image improvement',before:error,after});continue;}
  Object.assign(mesh,trial);error=after;used.add(candidate.key);accepted++;attempts.push({role:candidate.key,accepted:true,method,cellsAdded:(parts.length-1)*records.length,after});
  }catch(error){attempts.push({role:candidate.key,reason:'optional geometry rejected',error:String(error.message||error)});}
 }
 mesh.boundaryFeatureCount=accepted;mesh.boundaryFit={before,after:error,accepted:accepted>0,attempts};return accepted>0;
}

function refine(mesh){const groups=new Map();for(const f of mesh.faces){if(f.kind==='core'||f.ids.length<4)continue;if(!groups.has(f.pieceSlotId))groups.set(f.pieceSlotId,[]);groups.get(f.pieceSlotId).push(f);}
 const violation=p=>p.reduce((v,b,i)=>v+Math.max(0,-cross(p[(i+p.length-1)%p.length],b,p[(i+1)%p.length])),0),choices=[];
 for(const [key,faces] of groups){const n=faces[0].ids.length,ordered=faces.map(f=>f.mirror?f.ids.slice().reverse():f.ids),polys=ordered.map(ids=>ids.map(i=>mesh.goals[i])),baseline=polys.reduce((s,p)=>s+violation(p),0),residual=Math.max(...ordered.flat().map(i=>Math.hypot(...mesh.goals[i].map((v,k)=>v-mesh.faithful[i][k]))));if(baseline<1e-5||residual<3)continue;let best=null;
  for(let a=0;a<n;a++)for(let b=a+2;b<n;b++){if(a===0&&b===n-1)continue;const roles=[Array.from({length:b-a+1},(_,k)=>a+k),Array.from({length:n-b+a+1},(_,k)=>(b+k)%n)];if(!ordered.every(ids=>roles.every(role=>{const p=role.map(i=>mesh.vertices[ids[i]]),a=signed(p);return Math.abs(a)>1e-8&&convex(a>0?p:p.slice().reverse());})))continue;const score=polys.reduce((s,p)=>s+roles.reduce((v,indices)=>v+violation(indices.map(i=>p[i])),0),0);if(!best||score<best.score)best={roles,score};}
  if(best&&best.score<baseline*.75)choices.push({key,...best,priority:residual*(1-best.score/baseline)});
 }
 // A coordinated role split is repeated on all twelve half-arms. Bound the
 // total increase rather than allowing photo noise to multiply the cell count.
 const selected=new Map();let remaining=mesh.maxFaceCount-mesh.faces.length;for(const choice of choices.sort((a,b)=>b.priority-a.priority)){const cost=groups.get(choice.key).length;if(cost>remaining)continue;selected.set(choice.key,choice);remaining-=cost;if(selected.size===4)break;}if(!selected.size)return false;
 mesh.faces=mesh.faces.flatMap(f=>{const choice=selected.get(f.pieceSlotId);if(!choice)return [f];const ids=f.mirror?f.ids.slice().reverse():f.ids;return choice.roles.map((role,k)=>{const next=role.map(i=>ids[i]);if(f.mirror)next.reverse();return {...f,ids:next,pieceSlotId:f.pieceSlotId+'.'+k,sideCount:next.length}})});return true;
}

// Eliminate cyclic affine constraints once, rather than repeatedly nudging a
// T-junction loop during every vertex move. Each solved row uses free vertices only.
function resolveConstraints(source){const index=new Map(),low=new Map(),active=new Set(),stack=[],groups=[];let next=0;
 function visit(id){index.set(id,next);low.set(id,next++);stack.push(id);active.add(id);const e=source.get(id);for(const child of [e.a,e.b])if(source.has(child)){if(!index.has(child)){visit(child);low.set(id,Math.min(low.get(id),low.get(child)))}else if(active.has(child))low.set(id,Math.min(low.get(id),index.get(child)));}if(low.get(id)===index.get(id)){const group=[];let child;do{child=stack.pop();active.delete(child);group.push(child)}while(child!==id);groups.push(group);}}
 for(const id of source.keys())if(!index.has(id))visit(id);
 const result=new Map(),add=(map,key,value)=>map.set(key,(map.get(key)||0)+value);
 for(const group of groups){const ids=new Map(group.map((id,k)=>[id,k])),n=group.length,A=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)),rhs=group.map(()=>new Map());
  group.forEach((id,i)=>{const e=source.get(id);for(const [child,w] of [[e.a,1-e.u],[e.b,e.u]]){if(ids.has(child))A[i][ids.get(child)]-=w;else for(const [free,weight] of result.get(child)?.weights||[[child,1]])add(rhs[i],free,w*weight);}});
  for(let col=0;col<n;col++){let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(A[row][col])>Math.abs(A[pivot][col]))pivot=row;if(Math.abs(A[pivot][col])<1e-12)throw Error('Unanchored mesh junction');[A[col],A[pivot]]=[A[pivot],A[col]];[rhs[col],rhs[pivot]]=[rhs[pivot],rhs[col]];const scale=A[col][col];A[col]=A[col].map(v=>v/scale);rhs[col]=new Map([...rhs[col]].map(([id,w])=>[id,w/scale]));for(let row=0;row<n;row++){if(row===col)continue;const w=A[row][col];if(Math.abs(w)<1e-15)continue;for(let k=col;k<n;k++)A[row][k]-=w*A[col][k];for(const [id,weight] of rhs[col])add(rhs[row],id,-w*weight);}}
  group.forEach((id,i)=>{const weights=[...rhs[i]].filter(([,w])=>Math.abs(w)>1e-12),sum=weights.reduce((s,[,w])=>s+w,0);result.set(id,{weights:weights.map(([id,w])=>[id,w/sum])})});
 }return result;
}
function conform(mesh,positions){for(const [id,e] of mesh.constraints)positions[id]=[0,1].map(k=>e.weights.reduce((s,[free,w])=>s+positions[free][k]*w,0));return positions;}

function overlaps(p,q,epsilon=1e-7){const separates=(p,q)=>p.some((a,i)=>{const b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return L>1e-8&&q.every(v=>cross(a,b,v)<=epsilon*L)});return !separates(p,q)&&!separates(q,p);}
// Every side must have nonzero length and contain all vertices on its inside.
// A collapsed side cannot act as a false separating axis between overlapping cells.
function convex(p){return p.every((a,i)=>{const b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return L>1e-6&&p.every(v=>cross(a,b,v)>=-1e-7*L)});}
function valid(mesh,positions){const polygons=mesh.faces.map(f=>f.ids.map(i=>positions[i])),boxes=[];for(const p of polygons){if(signed(p)<1e-8||!convex(p))return false;boxes.push([Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]);}
 const order=boxes.map((_,i)=>i).sort((a,b)=>boxes[a][0]-boxes[b][0]);for(let i=0;i<order.length;i++){const a=order[i],A=boxes[a];for(let j=i+1;j<order.length;j++){const b=order[j],B=boxes[b];if(B[0]>=A[2]-1e-7)break;if(B[1]>=A[3]-1e-7||A[1]>=B[3]-1e-7)continue;if(overlaps(polygons[a],polygons[b]))return false;}}return true;
}
// Conservative spatial broad phase for repeated local moves. A face occupies
// every grid square touched by its closed AABB; queries include changed faces
// separately because their accepted boxes are still at their previous pose.
function spatialBoxes(boxes){const span=Math.max(Math.max(...boxes.map(b=>b[2]))-Math.min(...boxes.map(b=>b[0])),Math.max(...boxes.map(b=>b[3]))-Math.min(...boxes.map(b=>b[1]))),size=Number.isFinite(span)?Math.max(1,span/Math.sqrt(Math.max(1,boxes.length))):1,cells=new Map(),large=new Set();
 function keys(b){const x0=Math.floor(b[0]/size),x1=Math.floor(b[2]/size),y0=Math.floor(b[1]/size),y1=Math.floor(b[3]/size);if(![x0,x1,y0,y1].every(Number.isFinite)||(x1-x0+1)*(y1-y0+1)>4096)return null;const out=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)out.push(x+':'+y);return out;}
 function add(id,b){const list=keys(b);if(!list){large.add(id);return;}for(const key of list){if(!cells.has(key))cells.set(key,new Set());cells.get(key).add(id);}}
 boxes.forEach((b,id)=>add(id,b));return {query(b){const list=keys(b);if(!list)return new Set(boxes.map((_,id)=>id));const ids=new Set(large);for(const key of list)for(const id of cells.get(key)||[])ids.add(id);return ids;},update(id,b,next){const list=keys(b);if(list)for(const key of list){const ids=cells.get(key);ids.delete(id);if(!ids.size)cells.delete(key);}else large.delete(id);add(id,next);}};
}
function fitImage(mesh,model,localHub){const local=S.deform(model,Math.min(100,mesh.detail),0),goals=mesh.vertices.map((p,i)=>{const ids=[...mesh.owners[i]];if(!ids.length)return p.slice();const candidates=ids.map(id=>{const t=mesh.ideal[id],dest=local[id],v=projection(p,t),side=v.w<0?0:1,canonical=mesh.means.get(t.slotId),source=mesh.profiles[dest.localId],canonWidth=Math.abs(sample(canonical,v.u,t.mirror?1-side:side)),localWidth=Math.abs(sample(source,v.u,side)),ratio=clamp(localWidth/Math.max(.25,canonWidth),.25,4);return point(dest,v.u,v.w*ratio)});return [0,1].map(k=>mean(candidates.map(v=>v[k])))});
 if(mesh.silhouette||model.boundaryEvidence){const tangents=new Map();for(const ring of mesh.boundaries)for(let k=0;k<ring.length;k++){const a=mesh.vertices[ring[(k+ring.length-1)%ring.length]],b=mesh.vertices[ring[(k+1)%ring.length]];tangents.set(ring[k],[b[0]-a[0],b[1]-a[1]]);}for(const i of mesh.exterior){if(mesh.coreIds.includes(i))continue;const arm=Math.max(0,mesh.faces.find(f=>f.ids.includes(i)&&f.arm!==undefined)?.arm||0);goals[i]=mesh.boundaryGoals?.get(i)||Surface.project(model,mesh.vertices[i],arm,tangents.get(i));}}
 if(localHub)mesh.coreIds.forEach((id,k)=>goals[id]=localHub.polygon[k].slice());
 mesh.goals=goals;
 // Core and seam vertices are shared; one feasible mesh is fitted for all arms.
 // Start conservatively, then let each free vertex improve its image fit without
 // flipping a face, breaking a shared edge, or crossing another cell.
 let positions=(mesh.faithful||mesh.vertices).map(p=>p.slice()),conformed=false;
 for(const alpha of [1,.5,.25,.125,.0625,0]){const trial=conform(mesh,positions.map((p,i)=>p.map((v,k)=>v+alpha*(goals[i][k]-v))));if(valid(mesh,trial)){positions=trial;conformed=true;break}}
 // Every trial changes free vertices and their directly solved dependents only.
 // Keep the accepted arrays in place, then roll back trial references. This
 // preserves the original coordinate arithmetic without copying/conforming the
 // unrelated vertices on every local candidate.
 const polygons=mesh.faces.map(f=>f.ids.map(i=>positions[i])),box=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))],boxes=polygons.map(box),incident=mesh.vertices.map(()=>[]),dependents=mesh.vertices.map(()=>[]);
 mesh.faces.forEach((f,i)=>f.ids.forEach(id=>incident[id].push(i)));for(const [id,e] of mesh.constraints)for(const [free] of e.weights)dependents[free].push(id);
 function affected(ids){const vertices=[...new Set(ids.flatMap(id=>[id,...dependents[id]]))];return {ids,vertices,faces:[...new Set(vertices.flatMap(id=>incident[id]))]};}
 const influence=mesh.vertices.map((_,i)=>affected([i])),index=spatialBoxes(boxes);
 function moveValid(affected){const changed=new Map(affected.map(id=>[id,mesh.faces[id].ids.map(i=>positions[i])])),nextBoxes=new Map([...changed].map(([id,p])=>[id,box(p)])),changedIds=[...changed.keys()],changedIndex=changed.size>16?spatialBoxes([...nextBoxes.values()]):null;for(const [id,p] of changed){if(signed(p)<1e-8||!convex(p))return null;const A=nextBoxes.get(id),candidates=index.query(A);if(changedIndex){for(const j of changedIndex.query(A))candidates.add(changedIds[j]);}else for(const j of changedIds)candidates.add(j);for(const j of [...candidates].sort((a,b)=>a-b)){if(j===id)continue;const q=changed.get(j)||polygons[j],B=nextBoxes.get(j)||boxes[j];if(A[0]>=B[2]-1e-7||B[0]>=A[2]-1e-7||A[1]>=B[3]-1e-7||B[1]>=A[3]-1e-7)continue;if(overlaps(p,q))return null;}}return {changed,nextBoxes};}
 let stateValid=conformed&&valid(mesh,positions);
 function trial(move,targets){if(!conformed)move={...move,vertices:[...new Set([...move.vertices,...mesh.constraints.keys()])],faces:mesh.faces.map((_,id)=>id)};const saved=move.vertices.map(id=>[id,positions[id]]);move.ids.forEach((id,k)=>positions[id]=targets[k]);for(const id of move.vertices){const e=mesh.constraints.get(id);if(e)positions[id]=[0,1].map(k=>e.weights.reduce((s,[free,w])=>s+positions[free][k]*w,0));}const checked=stateValid?moveValid(move.faces):valid(mesh,positions)?{changed:new Map(move.faces.map(id=>[id,mesh.faces[id].ids.map(i=>positions[i])]))}:null;let result=null;if(checked)result={...checked,pose:move.vertices.map(id=>[id,positions[id]])};for(const [id,p] of saved)positions[id]=p;return result;}
 function commit(result){for(const [id,p] of result.pose)positions[id]=p;for(const [id,p] of result.changed){polygons[id]=p;const bounds=result.nextBoxes?.get(id)||box(p);index.update(id,boxes[id],bounds);boxes[id]=bounds;}stateValid=conformed=true;}
 const toward=(ids,alpha)=>ids.map(i=>positions[i].map((v,k)=>v+alpha*(goals[i][k]-v)));
 // Move connected groups together before individual vertices. A whole branch
 // can translate/rotate even when moving one corner first would flip a thin face.
 const blocks=[];for(let arm=0;arm<6;arm++)blocks.push([...new Set(mesh.faces.filter(f=>f.arm===arm).flatMap(f=>f.ids))]);for(const t of mesh.ideal){const children=new Set([t.id]);for(const child of mesh.ideal)if(children.has(child.parent))children.add(child.id);blocks.push([...new Set(mesh.faces.filter(f=>children.has(f.branchId)).flatMap(f=>f.ids))]);}
 const moves=blocks.map(block=>affected(block.filter(i=>!mesh.constraints.has(i))));
 for(let pass=0;pass<2;pass++)for(const move of moves)for(const alpha of [1,.5,.25]){const result=trial(move,toward(move.ids,alpha));if(result){commit(result);break;}}
 function fitFaces(){for(const face of mesh.faces){const ids=face.ids.filter(i=>!mesh.constraints.has(i));if(!ids.some(i=>Math.hypot(...positions[i].map((v,k)=>v-goals[i][k]))>.1))continue;const move=affected(ids);for(const alpha of [1,.5,.25]){const result=trial(move,toward(ids,alpha));if(result){commit(result);break;}}}}
 fitFaces();
 for(let pass=0;pass<4;pass++)for(let i=0;i<positions.length;i++){if(mesh.constraints.has(i)||Math.hypot(...positions[i].map((v,k)=>v-goals[i][k]))<.1)continue;let best=null;const delta=goals[i].map((v,k)=>v-positions[i][k]),distance=delta[0]**2+delta[1]**2;
  for(const direction of [delta,[delta[0],0],[0,delta[1]]])for(const alpha of [1,.5,.25]){const target=positions[i].map((v,k)=>v+alpha*direction[k]),gain=distance-target.reduce((s,v,k)=>s+(v-goals[i][k])**2,0);if(gain<.001||best&&gain<=best.gain)continue;const result=trial(influence[i],[target]);if(result)best={...result,gain};}
  if(best)commit(best);
 }

 fitFaces();return positions;
}
function fit(model,detail,symmetry,hub,localHub){let details=cache.get(model);if(!details){details=new Map();cache.set(model,details)}let mesh=details.get(detail);if(mesh){details.delete(detail);details.set(detail,mesh)}else{mesh=build(model,clamp(detail,0,100)*2,hub,localHub);details.set(detail,mesh);if(details.size>6)details.delete(details.keys().next().value)}const z=1-symmetry/100;let vertices=z===1?mesh.faithful.map(p=>p.slice()):z===0?mesh.vertices.map(p=>p.slice()):mesh.vertices.map((p,i)=>p.map((v,k)=>v+z*(mesh.faithful[i][k]-v)));
 if(!valid(mesh,vertices)){let alpha=z;do{alpha*=.5;vertices=mesh.vertices.map((p,i)=>p.map((v,k)=>v+alpha*(mesh.faithful[i][k]-v)))}while(alpha>1e-5&&!valid(mesh,vertices));if(!valid(mesh,vertices))vertices=mesh.vertices;}
 const pieces=mesh.faces.map(f=>{const polygon=f.ids.map(i=>vertices[i]),center=[0,1].map(k=>mean(polygon.map(p=>p[k])));return {...f,vertexIds:f.ids,polygon,start:center,end:center,u0:0,u1:1,error:0}});
 return {pieces,loops:mesh.boundaries.map(ids=>ids.map(i=>vertices[i])),cutPolygons:mesh.faces.map(f=>f.cutIds.map(i=>vertices[i])),vertices,template:mesh};
}
root.SharedMesh={fit,valid,overlaps,structureDetail};if(typeof module!=='undefined')module.exports=root.SharedMesh;
})(globalThis);
