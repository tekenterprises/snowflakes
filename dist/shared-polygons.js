/* One subdivision and vertex-role schedule for every corresponding branch. */
(function(root){
'use strict';
const R=typeof module!=='undefined'?require('./branch-regions.js'):root.BranchRegions;
const S=typeof module!=='undefined'?require('./structural-model.js'):root.StructuralModel;
const cache=new WeakMap();
const average=a=>a.reduce((s,v)=>s+v,0)/a.length;
const robust=a=>{const q=a.slice().sort((a,b)=>a-b),trim=Math.floor(q.length*.15);return average(q.slice(trim,q.length-trim))};
function schedule(records,detail,isRoot){
 const count=R.STEPS,length=robust(records.map(r=>r.length)),breadth=robust(records.map(r=>Math.max(...r.values.map(v=>v[1]-v[0])))),plate=isRoot&&breadth/length>.25;
 // Broad unbranched regions are facets, not dense stacks of width samples.
 // Remove subpixel edge chatter only there; thin branch profiles stay untouched.
 if(plate)records=records.map(r=>({...r,values:r.values.map((v,k)=>k===0||k===count?v.slice():[0,1].map(side=>{const a=r.values.slice(Math.max(0,k-1),Math.min(count+1,k+2)).map(v=>v[side]).sort((a,b)=>a-b);return a[Math.floor(a.length/2)]}))}));
 const tolerance=plate?.9+.025*breadth+3*(1-detail/100)**2:.35+4.3*(1-detail/100)**2,minimumSpan=.75+1.75*(1-detail/100),mean=Array.from({length:count+1},(_,k)=>[0,1].map(side=>robust(records.map(r=>r.values[k][side]))));
 if(isRoot)for(const v of mean){const w=(v[1]-v[0])/2;v[0]=-w;v[1]=w}
 function candidate(i,j){
  const span=j-i,base=(values,k,s)=>values[i][s]+(values[j][s]-values[i][s])*(k-i)/span;
  const peaks=[{k:-1,error:0},{k:-1,error:0}];
  for(let k=i+1;k<j;k++)for(const s of [0,1]){const error=(mean[k][s]-base(mean,k,s))*(s?1:-1);if(error>peaks[s].error)peaks[s]={k,error}}
  // A single role per flank yields at most six true sides. A common tip role
  // permits triangles without dropping one side's join anchor independently.
  const triangle=j===count&&(mean[j][1]-mean[j][0])<Math.min(1.1,(mean[i][1]-mean[i][0])*.3);
  const extras=peaks.map(p=>p.error>.2&&p.k>i&&p.k<j);
  if(isRoot&&extras.some(Boolean)){extras[0]=extras[1]=true;const k=peaks[0].error>=peaks[1].error?peaks[0].k:peaks[1].k;peaks[0].k=peaks[1].k=k}
  const roles=triangle?[[i,0],[j,2],[i,1]]:[[i,0],...(extras[0]?[[peaks[0].k,0]]:[]),[j,0],[j,1],...(extras[1]?[[peaks[1].k,1]]:[]),[i,1]];
  function shape(values){return roles.map(([k,s])=>{if(s===2)return [k/count,0];let w=values[k][s];if(k>i&&k<j){const chord=base(values,k,s),bulge=(w-chord)*(s?1:-1);w=chord+(s?1:-1)*Math.max(.025,bulge)}return [k/count,w]})}
  const polygons=records.map(r=>shape(r.values)),meanPolygon=roles.map((role,k)=>[role[0]/count,robust(polygons.map(p=>p[k][1]))]);
  if(isRoot){for(let k=0;k<roles.length;k++){const [u,s]=roles[k];if(s===2)continue;const other=roles.findIndex(([v,t])=>v===u&&t===1-s);if(other>k){const w=(meanPolygon[other][1]-meanPolygon[k][1])/2;meanPolygon[k][1]=-w;meanPolygon[other][1]=w}}}
  function width(p,k,s){if(triangle){const t=(k-i)/span;return p[s?2:0][1]*(1-t)}const vertices=p.filter((v,index)=>roles[index][1]===s).sort((a,b)=>a[0]-b[0]),u=k/count;for(let z=1;z<vertices.length;z++){const a=vertices[z-1],b=vertices[z];if(u<=b[0]+1e-9)return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0])}return vertices.at(-1)[1]}
  const edges=plate?polygons.map((p,index)=>[0,1].map(s=>p.filter((_,k)=>roles[k][1]===s||roles[k][1]===2).sort((a,b)=>a[0]-b[0]).map(([u,w])=>[u*records[index].length,w]))):null;
  function outsideError(index,k,s){
   if(!plate)return Math.abs(width(polygons[index],k,s)-records[index].values[k][s]);
   const x=k/count*records[index].length,y=records[index].values[k][s],vertices=edges[index][s];let d=Infinity;
   for(let q=1;q<vertices.length;q++){const a=vertices[q-1],b=vertices[q],dx=b[0]-a[0],dy=b[1]-a[1],z=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a[0]-z*dx,y-a[1]-z*dy))}return d;
  }
  let error=0,split=-1;
  for(let k=i+1;k<j;k++){const e=Math.max(...records.map((r,index)=>Math.max(...[0,1].map(s=>outsideError(index,k,s)))));if(e>error){error=e;split=k}}
  return {u0:i/count,u1:j/count,polygons,meanPolygon,roles,error,split};
 }
 if(plate){
  // Globally minimize the number of 3–6-gons within the outside-profile bound.
  // Image-supported facet boundaries break ties; texture cannot earn extra pieces.
  const best=Array(count+1).fill(null);best[0]={pieces:[],cost:0};
  for(let j=1;j<=count;j++)for(let i=0;i<j;i++){
   if(!best[i]||best[j]&&best[i].pieces.length+1>best[j].pieces.length)continue;
   const p=candidate(i,j);if(p.error>tolerance)continue;
   const evidence=i?robust(records.map(r=>r.seams?.[i]||0)):0;
   const cost=best[i].cost+p.error/tolerance-.5*evidence;
   if(!best[j]||best[i].pieces.length+1<best[j].pieces.length||cost<best[j].cost)best[j]={pieces:[...best[i].pieces,p],cost};
  }
  return best[count].pieces;
 }
 const out=[];
 function fit(i,j){const p=candidate(i,j);if(p.error>tolerance&&p.split>i&&p.split<j&&(j-i)*length/count>minimumSpan){fit(i,p.split);fit(p.split,j)}else out.push(p)}
 fit(0,count);
 for(let i=0;i<out.length-1;){const p=candidate(Math.round(out[i].u0*count),Math.round(out[i+1].u1*count));if(p.error<=tolerance){out.splice(i,2,p);if(i)i--}else i++}
 return out;
}
function facetEvidence(model,t,values){
 const {gray,n}=model,dx=(t.end[0]-t.start[0])/t.length,dy=(t.end[1]-t.start[1])/t.length;
 return values.map((v,k)=>{const u=k/R.STEPS,x=t.start[0]+dx*t.length*u,y=t.start[1]+dy*t.length*u;let supported=0,total=0,contrast=0;
  for(const side of [0,1])for(let q=2;q<=9;q++){const w=v[side]*q/10,px=x-dy*w,py=y+dx*w;
   const at=d=>bilinear(gray,n,px+dx*d,py+dy*d),a=at(-1.2),b=at(0),c=at(1.2),edge=Math.max(Math.abs(c-a),b-(a+c)/2);
   total++;if(edge>.08){supported++;contrast+=edge}
  }
  return supported/total>=.6?Math.min(1,contrast/total*3):0;
 });
}
function bilinear(a,n,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;if(ix<0||iy<0||ix+1>=n||iy+1>=n)return 0;return a[iy*n+ix]*(1-fx)*(1-fy)+a[iy*n+ix+1]*fx*(1-fy)+a[(iy+1)*n+ix]*(1-fx)*fy+a[(iy+1)*n+ix+1]*fx*fy}
function prepare(model,detail){
 let details=cache.get(model);if(!details){details=new Map();cache.set(model,details)}if(details.has(detail))return details.get(detail);
 const profiles=R.measure(model).profiles,keep=S.selected(model,detail),groups=new Map();
 for(const t of model.tree){if(!keep.has(t.slotId))continue;if(!groups.has(t.slotId))groups.set(t.slotId,[]);groups.get(t.slotId).push({id:t.id,length:t.length,seams:t.parent===null?facetEvidence(model,t,profiles[t.id]):null,values:profiles[t.id].map(v=>t.mirror?[-v[1],-v[0]]:v.slice())})}
 const result=new Map();for(const [slotId,records] of groups)result.set(slotId,{records,pieces:schedule(records,detail,model.slots[slotId].parent===null)});details.set(detail,result);return result;
}
function fit(model,tree,detail,symmetry){
 const groups=prepare(model,detail),z=symmetry/100,out=[];
 for(const t of tree){const group=groups.get(t.slotId),index=group.records.findIndex(r=>r.id===t.localId),dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy),sign=t.mirror?-1:1;
  for(let j=0;j<group.pieces.length;j++){const piece=group.pieces[j],polygon=piece.polygons[index].map(([u,w],k)=>{const width=(w*(1-z)+piece.meanPolygon[k][1]*z)*sign*model.scale;return [t.start[0]+u*dx-dy/L*width,t.start[1]+u*dy+dx/L*width]}),axis=u=>[t.start[0]+u*dx,t.start[1]+u*dy];
   if(t.mirror)polygon.reverse();
   out.push({branchId:t.id,slotId:t.slotId,pieceSlotId:t.slotId+':'+j,sideCount:polygon.length,u0:piece.u0,u1:piece.u1,start:axis(piece.u0),end:axis(piece.u1),error:piece.error*model.scale,polygon});
  }
 }
 return out;
}
// The trace uses every measured section, without the 3–6-sided fitting step.
// Average widths only after corresponding branches have been registered.
function trace(model,tree,symmetry){
 const profiles=R.measure(model).profiles,groups=new Map(),z=symmetry/100;
 for(const t of model.tree){if(!groups.has(t.slotId))groups.set(t.slotId,[]);groups.get(t.slotId).push(profiles[t.id].map(v=>t.mirror?[-v[1],-v[0]]:v));}
 const means=new Map();for(const [id,records] of groups){const mean=records[0].map((_,k)=>[0,1].map(s=>robust(records.map(p=>p[k][s]))));if(model.slots[id].parent===null)for(const v of mean){const w=(v[1]-v[0])/2;v[0]=-w;v[1]=w}means.set(id,mean)}
 return tree.map(t=>{const local=profiles[t.localId].map(v=>t.mirror?[-v[1],-v[0]]:v),mean=means.get(t.slotId),dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy),sign=t.mirror?-1:1;
  const sides=[0,1].map(s=>local.map((v,k)=>{const u=k/R.STEPS,w=(v[s]*(1-z)+mean[k][s]*z)*sign*model.scale;return [t.start[0]+u*dx-dy/L*w,t.start[1]+u*dy+dx/L*w]}));return sides[0].concat(sides[1].reverse());
 });
}
root.SharedPolygons={fit,prepare,schedule,trace};if(typeof module!=='undefined')module.exports=root.SharedPolygons;
})(globalThis);
