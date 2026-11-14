/* One conforming half-arm mesh, copied twelve times and fitted without changing topology. */
(function(root){
'use strict';
const R=typeof module!=='undefined'?require('./branch-regions.js'):root.BranchRegions;
const S=typeof module!=='undefined'?require('./structural-model.js'):root.StructuralModel;
const PF=typeof module!=='undefined'?require('./polygon-fit.js'):root.PolygonFit;
const Surface=typeof module!=='undefined'?require('./silhouette-mesh.js'):root.SilhouetteMesh;
const cache=new WeakMap(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
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
function build(model,detail,hub,localHub){
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
 const mesh={vertices,faces,owners,ideal,means,profiles,constraints,coreIds,detail,silhouette:!!material};
 if(material){cutEdges(mesh);mesh.boundaries=boundaryEdges(mesh);mesh.exterior=new Set(mesh.boundaries.flat());}
 mesh.faithful=fitImage(mesh,model,localHub);
 // A shape that needs another facet on one observed arm gets that same facet
 // definition on every half-arm, rather than independently changing its topology.
 for(let pass=0;pass<(detail>=60?2:0);pass++){if(!refine(mesh))break;mesh.faithful=fitImage(mesh,model,localHub);}
 cutEdges(mesh);mesh.boundaries=boundaryEdges(mesh);return mesh;
}
function cutEdges(mesh){
 for(const f of mesh.faces)f.cutIds=f.ids.flatMap((a,k)=>{const b=f.ids[(k+1)%f.ids.length],A=mesh.vertices[a],B=mesh.vertices[b],dx=B[0]-A[0],dy=B[1]-A[1],den=dx*dx+dy*dy,along=[];for(let id=0;id<mesh.vertices.length;id++){const P=mesh.vertices[id],u=((P[0]-A[0])*dx+(P[1]-A[1])*dy)/den;if(u>=-1e-8&&u<1-1e-8&&Math.abs(cross(A,B,P))<1e-7*Math.sqrt(den))along.push({id,u})}return along.sort((a,b)=>a.u-b.u).map(v=>v.id)});
}
function boundaryEdges(mesh){const edges=new Map();for(const f of mesh.faces)for(let i=0;i<f.cutIds.length;i++){const a=f.cutIds[i],b=f.cutIds[(i+1)%f.cutIds.length];if(a===b)continue;const key=a+':'+b,reverse=b+':'+a;if(edges.has(reverse)){const edge=edges.get(reverse);if(--edge.count===0)edges.delete(reverse);}else if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}const outgoing=new Map();for(const [key,{a,b}] of edges){if(!outgoing.has(a))outgoing.set(a,[]);outgoing.get(a).push([key,b]);}const loops=[];while(edges.size){const start=edges.values().next().value.a,ring=[];let at=start;do{ring.push(at);const next=outgoing.get(at)?.find(([key])=>edges.has(key));if(!next)throw Error('Open shared-mesh boundary');const edge=edges.get(next[0]);if(--edge.count===0)edges.delete(next[0]);at=next[1];}while(at!==start);if(ring.length>=3)loops.push(ring);}return loops;}

function refine(mesh){const groups=new Map();for(const f of mesh.faces){if(f.kind==='core'||f.ids.length<4)continue;if(!groups.has(f.pieceSlotId))groups.set(f.pieceSlotId,[]);groups.get(f.pieceSlotId).push(f);}
 const violation=p=>p.reduce((v,b,i)=>v+Math.max(0,-cross(p[(i+p.length-1)%p.length],b,p[(i+1)%p.length])),0),choices=[];
 for(const [key,faces] of groups){const n=faces[0].ids.length,ordered=faces.map(f=>f.mirror?f.ids.slice().reverse():f.ids),polys=ordered.map(ids=>ids.map(i=>mesh.goals[i])),baseline=polys.reduce((s,p)=>s+violation(p),0),residual=Math.max(...ordered.flat().map(i=>Math.hypot(...mesh.goals[i].map((v,k)=>v-mesh.faithful[i][k]))));if(baseline<1e-5||residual<3)continue;let best=null;
  for(let a=0;a<n;a++)for(let b=a+2;b<n;b++){if(a===0&&b===n-1)continue;const roles=[Array.from({length:b-a+1},(_,k)=>a+k),Array.from({length:n-b+a+1},(_,k)=>(b+k)%n)],score=polys.reduce((s,p)=>s+roles.reduce((v,indices)=>v+violation(indices.map(i=>p[i])),0),0);if(!best||score<best.score)best={roles,score};}
  if(best&&best.score<baseline*.75)choices.push({key,...best,priority:residual*(1-best.score/baseline)});
 }
 const selected=new Map(choices.sort((a,b)=>b.priority-a.priority).slice(0,4).map(c=>[c.key,c]));if(!selected.size)return false;
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
function fitImage(mesh,model,localHub){const local=S.deform(model,Math.min(100,mesh.detail),0),goals=mesh.vertices.map((p,i)=>{const ids=[...mesh.owners[i]];if(!ids.length)return p.slice();const candidates=ids.map(id=>{const t=mesh.ideal[id],dest=local[id],v=projection(p,t),side=v.w<0?0:1,canonical=mesh.means.get(t.slotId),source=mesh.profiles[dest.localId],canonWidth=Math.abs(sample(canonical,v.u,t.mirror?1-side:side)),localWidth=Math.abs(sample(source,v.u,side)),ratio=clamp(localWidth/Math.max(.25,canonWidth),.25,4);return point(dest,v.u,v.w*ratio)});return [0,1].map(k=>mean(candidates.map(v=>v[k])))});
 if(mesh.silhouette)for(const i of mesh.exterior){if(mesh.coreIds.includes(i))continue;const arm=Math.max(0,mesh.faces.find(f=>f.ids.includes(i)&&f.arm!==undefined)?.arm||0);goals[i]=Surface.project(model,mesh.vertices[i],arm);}
 if(localHub)mesh.coreIds.forEach((id,k)=>goals[id]=localHub.polygon[k].slice());
 mesh.goals=goals;
 // Core and seam vertices are shared; one feasible mesh is fitted for all arms.
 // Start conservatively, then let each free vertex improve its image fit without
 // flipping a face, breaking a shared edge, or crossing another cell.
 let positions=(mesh.faithful||mesh.vertices).map(p=>p.slice());
 for(const alpha of [1,.5,.25,.125,.0625,0]){const trial=conform(mesh,positions.map((p,i)=>p.map((v,k)=>v+alpha*(goals[i][k]-v))));if(valid(mesh,trial)){positions=trial;break}}
 // Move connected groups together before individual vertices. A whole branch
 // can translate/rotate even when moving one corner first would flip a thin face.
 const blocks=[];for(let arm=0;arm<6;arm++)blocks.push([...new Set(mesh.faces.filter(f=>f.arm===arm).flatMap(f=>f.ids))]);for(const t of mesh.ideal){const children=new Set([t.id]);for(const child of mesh.ideal)if(children.has(child.parent))children.add(child.id);blocks.push([...new Set(mesh.faces.filter(f=>children.has(f.branchId)).flatMap(f=>f.ids))]);}
 for(let pass=0;pass<2;pass++)for(const block of blocks)for(const alpha of [1,.5,.25]){const trial=positions.map(p=>p.slice());for(const i of block)if(!mesh.constraints.has(i))trial[i]=positions[i].map((v,k)=>v+alpha*(goals[i][k]-v));conform(mesh,trial);if(valid(mesh,trial)){positions=trial;break}}
 const polygons=mesh.faces.map(f=>f.ids.map(i=>positions[i])),box=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))],boxes=polygons.map(box),incident=mesh.vertices.map(()=>[]),dependents=mesh.vertices.map(()=>[]);
 mesh.faces.forEach((f,i)=>f.ids.forEach(id=>incident[id].push(i)));for(const [id,e] of mesh.constraints)for(const [free] of e.weights)dependents[free].push(id);
 const influence=mesh.vertices.map((_,i)=>{const ids=new Set();function visit(k){if(ids.has(k))return;ids.add(k);dependents[k].forEach(visit)}visit(i);return [...new Set([...ids].flatMap(id=>incident[id]))]});
 function moveValid(trial,affected){const changed=new Map(affected.map(id=>[id,mesh.faces[id].ids.map(i=>trial[i])]));for(const [id,p] of changed){if(signed(p)<1e-8||!convex(p))return null;const A=box(p);for(let j=0;j<polygons.length;j++){if(j===id)continue;const q=changed.get(j)||polygons[j],B=changed.has(j)?box(q):boxes[j];if(A[0]>=B[2]-1e-7||B[0]>=A[2]-1e-7||A[1]>=B[3]-1e-7||B[1]>=A[3]-1e-7)continue;if(overlaps(p,q))return null;}}return changed;}
 function fitFaces(){for(const face of mesh.faces){const ids=face.ids.filter(i=>!mesh.constraints.has(i));if(!ids.some(i=>Math.hypot(...positions[i].map((v,k)=>v-goals[i][k]))>.1))continue;const affected=[...new Set(ids.flatMap(i=>influence[i]))];for(const alpha of [1,.5,.25]){const trial=positions.map(p=>p.slice());for(const i of ids)trial[i]=positions[i].map((v,k)=>v+alpha*(goals[i][k]-v));conform(mesh,trial);const changed=moveValid(trial,affected);if(changed){positions=trial;for(const [id,p] of changed){polygons[id]=p;boxes[id]=box(p)}break}}}}
 fitFaces();
 for(let pass=0;pass<4;pass++)for(let i=0;i<positions.length;i++){if(mesh.constraints.has(i)||Math.hypot(...positions[i].map((v,k)=>v-goals[i][k]))<.1)continue;let best=null;const delta=goals[i].map((v,k)=>v-positions[i][k]),distance=delta[0]**2+delta[1]**2;
  for(const direction of [delta,[delta[0],0],[0,delta[1]]])for(const alpha of [1,.5,.25]){const target=positions[i].map((v,k)=>v+alpha*direction[k]),gain=distance-target.reduce((s,v,k)=>s+(v-goals[i][k])**2,0);if(gain<.001||best&&gain<=best.gain)continue;const trial=positions.map(p=>p.slice());trial[i]=target;conform(mesh,trial);const changed=moveValid(trial,influence[i]);if(changed)best={trial,changed,gain};}
  if(best){positions=best.trial;for(const [id,p] of best.changed){polygons[id]=p;boxes[id]=box(p)}}
 }

 fitFaces();return positions;
}
function fit(model,detail,symmetry,hub,localHub){let details=cache.get(model);if(!details){details=new Map();cache.set(model,details)}let mesh=details.get(detail);if(!mesh){mesh=build(model,clamp(detail,0,100)*2,hub,localHub);details.set(detail,mesh)}const z=1-symmetry/100;let vertices=z===1?mesh.faithful.map(p=>p.slice()):z===0?mesh.vertices.map(p=>p.slice()):mesh.vertices.map((p,i)=>p.map((v,k)=>v+z*(mesh.faithful[i][k]-v)));
 if(!valid(mesh,vertices)){let alpha=z;do{alpha*=.5;vertices=mesh.vertices.map((p,i)=>p.map((v,k)=>v+alpha*(mesh.faithful[i][k]-v)))}while(alpha>1e-5&&!valid(mesh,vertices));if(!valid(mesh,vertices))vertices=mesh.vertices;}
 const pieces=mesh.faces.map(f=>{const polygon=f.ids.map(i=>vertices[i]),center=[0,1].map(k=>mean(polygon.map(p=>p[k])));return {...f,vertexIds:f.ids,polygon,start:center,end:center,u0:0,u1:1,error:0}});
 return {pieces,loops:mesh.boundaries.map(ids=>ids.map(i=>vertices[i])),cutPolygons:mesh.faces.map(f=>f.cutIds.map(i=>vertices[i])),vertices,template:mesh};
}
root.SharedMesh={fit,valid,overlaps,structureDetail};if(typeof module!=='undefined')module.exports=root.SharedMesh;
})(globalThis);
