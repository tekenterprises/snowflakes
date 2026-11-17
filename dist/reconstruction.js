/* Accepted reconstruction stages. Source pixels and geometric analysis stay
 * worker-local; manufacturing settings never rerun photographic fitting. */
(function(root){'use strict';
if(typeof module!=='undefined'){
 root.Flake=require('./engine');root.earcut=require('./vendor/earcut.min.js');root.polygonClipping=require('./vendor/polygon-clipping.min.js');
 require('./reconstruction-partition');require('./reconstruction-cells');require('./reconstruction-framework');require('./reconstruction-branches');
}
const Framework=root.ReconstructionFramework,Branches=root.ReconstructionBranches,Cells=root.ReconstructionCells;
const mix=(a,b,z)=>a+(b-a)*z,point=(a,b,z)=>[mix(a[0],b[0],z),mix(a[1],b[1],z)];
function median(a){a=a.slice().sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2}
function regularFrame(analysis){
 const f=analysis.framework,c=f.center,ss=analysis.sides,first=ss[0],angle=Math.atan2(first.u[1],first.u[0]),radius=median(f.trunks.map(t=>Math.hypot(t.end[0]-c[0],t.end[1]-c[1])));
 return {angle,radius,c};
}
function targetAngle(u,angle){return angle+Math.round(Math.atan2(Math.sin(Math.atan2(u[1],u[0])-angle),Math.cos(Math.atan2(u[1],u[0])-angle))/(Math.PI/3))*Math.PI/3}
function pose(analysis,z){
 if(!z)return analysis;
 const {angle,radius,c}=regularFrame(analysis),m=analysis.master,half=m.halfAngle||Math.PI/6,factor=Math.tan(Math.PI/6)/Math.tan(half);
 const hexagons=analysis.framework.hexagons.map(h=>{const r=median(h.polygon.map(p=>Math.hypot(p[0]-c[0],p[1]-c[1])));return {...h,polygon:h.polygon.map(p=>{const a=targetAngle([p[0]-c[0],p[1]-c[1]],angle);return point(p,[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)],z)})}});
 const sides=analysis.sides.map(s=>{
  const ta=targetAngle(s.u,angle),sa=Math.atan2(s.u[1],s.u[0]),a=sa+z*Math.atan2(Math.sin(ta-sa),Math.cos(ta-sa)),u=[Math.cos(a),Math.sin(a)],sign=s.mirror,v=[-u[1]*sign,u[0]*sign],scale=mix(s.scale,s.pixel*m.trunkTip/radius,z);
  const hexPolygon=hexagons.at(-1).polygon.map(p=>{const dx=p[0]-c[0],dy=p[1]-c[1];return [(dx*v[0]+dy*v[1])*scale/s.pixel,(dx*u[0]+dy*u[1])*scale/s.pixel]});
  const branches=s.branches.map((b,i)=>{const target=m.branches[i]||b,tip=point(b.tip,[target.tip[0]*factor,target.tip[1]],z),attachment=mix(b.attachment,target.attachment,z);return {...b,tip,attachment,length:Math.hypot(tip[0],tip[1]-attachment),angle:Math.atan2(tip[0],tip[1]-attachment)*180/Math.PI}});
  const ink=new Float32Array(s.ink.length),geometric=new Uint8Array(ink.length),bisectorAngle=mix(s.bisectorAngle,Math.PI/6,z);
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){const i=y*s.width+x,master=Cells.sample(m.ink,m.width,m.height,x/factor,y);ink[i]=mix(s.ink[i],master,z);geometric[i]=+(x<=y*Math.tan(bisectorAngle));}
  return {...s,u,v,scale,bisectorAngle,ink,geometric,valid:geometric,branches,hexPolygon,trunkTip:mix(s.trunkTip,m.trunkTip,z)};
 });
 const trunks=analysis.framework.trunks.map((t,i)=>{const side=sides[i*2];return {...t,start:c.slice(),end:Branches.toSource(side,0,side.trunkTip)}});
 return {...analysis,sides,sides12:sides,framework:{...analysis.framework,hexagons,trunks}};
}
function canonicalMesh(analysis,guide){
 const {angle,radius,c}=regularFrame(analysis),m=analysis.master,factor=1,pixel=radius/m.trunkTip;
 const sides=analysis.sides.map(s=>{const a=targetAngle(s.u,angle),u=[Math.cos(a),Math.sin(a)],sign=s.mirror;return {...s,u,v:[-u[1]*sign,u[0]*sign],pixel,scale:1}});
 const rows=sides.map(s=>({...guide,index:s.index,cells:guide.cells.map(cell=>({...cell,polygon:cell.polygon.map(p=>[p[0]*factor,p[1]]),growthSupport:{...cell.growthSupport,point:[cell.growthSupport.point[0]*factor,cell.growthSupport.point[1]],segment:cell.growthSupport.segment.map(p=>[p[0]*factor,p[1]])}}))}));
 const framework=pose(analysis,1).framework,outer=framework.hexagons.at(-1),r=m.hexPolygon[0][1]*pixel;
 outer.polygon=outer.polygon.map(p=>{const a=targetAngle([p[0]-c[0],p[1]-c[1]],angle);return [c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]});
 return Cells.assemble({...analysis,sides,sides12:sides,framework},rows);
}
function alignedMask(analysis,posed,z,threshold){
 const n=analysis.framework.size,src=analysis.framework.branchInk,m=analysis.master,out=new Uint8Array(n*n),sides=posed.sides,center=posed.framework.center;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=x-center[0],dy=y-center[1];let best=null,score=-Infinity;for(let k=0;k<12;k+=2){const side=sides[k],along=dx*side.u[0]+dy*side.u[1];if(along>score){score=along;best=side}}
  if(dx*best.v[0]+dy*best.v[1]<0)best=sides[best.index+1];
  const lateral=Math.abs(dx*best.v[0]+dy*best.v[1])*best.scale/best.pixel,radial=score*best.scale/best.pixel,i=y*n+x,masterX=lateral*Math.tan(m.halfAngle||Math.PI/6)/Math.tan(Math.PI/6),mx=Math.round(masterX),my=Math.round(radial),central=mx>=0&&my>=0&&mx<m.width&&my<m.height&&m.hexmask[my*m.width+mx],value=central?1:Cells.sample(m.ink,m.width,m.height,masterX,radial);out[i]=+(mix(src[i],value,z)>1-threshold/255);
 }
 return out;
}
function create({localFit,cellFit}={}){
 let analysis=null;const meshes=new Map(),guides=new Map();
 function analyze(pixels,size,options={}){analysis=Branches.analyze(Framework.prepare(pixels,size,options));meshes.clear();guides.clear();return analysis;}
 async function analyzeAsync(pixels,size,options={}){
  if(!localFit)return analyze(pixels,size,options);
  const next=Branches.analyze(Framework.prepare(pixels,size,options),{deferLocal:true}),started=Date.now();let fits;
  try{fits=await localFit(next);if(!fits||fits.length!==next.sides.length)throw Error('Incomplete local fits');}
  catch{fits=next.sides.map(side=>Branches.fitSide(next.master,side,next.master.branches,next.master.commonAngle));}
  for(let i=0;i<next.sides.length;i++)Branches.applyLocalFit(next.sides[i],fits[i]);
  const elapsed=Date.now()-started;next.timings.local+=elapsed;next.timings.total+=elapsed;analysis=next;meshes.clear();guides.clear();return analysis;
 }
 function fit(options={},needMesh=true){
  if(!analysis)throw Error('No reconstruction analysis');const z=Math.max(0,Math.min(1,(options.symmetry||0)/100)),a=pose(analysis,z),f=a.framework;
  const branches=f.trunks.map(t=>[t.start,t.end]).concat(a.sides.flatMap(s=>s.branches.map(b=>[Branches.toSource(s,0,b.attachment),Branches.toSource(s,...b.tip)])));
  const model={engine:'reconstruction-v36',settings:{symmetry:z*100,detail:options.detail??100,fill:options.fill!==false},analysis:a,center:f.center,axis:Math.atan2(a.sides[0].u[1],a.sides[0].u[0])*180/Math.PI,branches,branchCount:branches.length,hub:{observed:!f.hexagons.at(-1)?.inferred},hexagons:f.hexagons,tree:f.trunks.map(t=>({...t,parent:null}))};
  if(options.symmetry)model.sourceMask=alignedMask(analysis,a,z,options.threshold??230);
  if(needMesh){const key=JSON.stringify([z,options.fill!==false,options.detail??100]);let mesh=meshes.get(key);if(!mesh){const guideKey=JSON.stringify([options.fill!==false,options.detail??100,z===1]);let canonical=guides.get(guideKey);if(!canonical){canonical=Cells.buildCanonical(analysis,{...options,regular:z===1});guides.set(guideKey,canonical);while(guides.size>6)guides.delete(guides.keys().next().value)}mesh=z===1?canonicalMesh(analysis,canonical):Cells.build(a,{...options,canonical});meshes.set(key,mesh);while(meshes.size>3)meshes.delete(meshes.keys().next().value)}model.mesh=mesh;model.hexagons=mesh.hexagons;model.polygons=mesh.cells.map(c=>c.polygon);model.previewCells=mesh.cells;model.loops=mesh.baseCut.flatMap(p=>p);}
  return model;
 }
 async function fitAsync(options={},needMesh=true){
  const z=Math.max(0,Math.min(1,(options.symmetry||0)/100));if(!cellFit||!needMesh||z===1)return fit(options,needMesh);
  const key=JSON.stringify([z,options.fill!==false,options.detail??100]);if(meshes.has(key))return fit(options,needMesh);
  const model=fit(options,false),a=model.analysis,guideKey=JSON.stringify([options.fill!==false,options.detail??100,false]);let canonical=guides.get(guideKey);
  if(!canonical){canonical=Cells.buildCanonical(analysis,options);guides.set(guideKey,canonical);while(guides.size>6)guides.delete(guides.keys().next().value);}
  const started=Date.now();let mesh;
  let rows;try{rows=await cellFit(a,canonical,options);if(!Array.isArray(rows)||rows.length!==a.sides.length)throw Error('Incomplete crystal sides');}
  catch(error){if(error.localFitAuthoritative)throw error;rows=null;mesh=Cells.build(a,{...options,canonical});}
  if(rows){mesh=Cells.assemble(a,rows);mesh.canonical=canonical;mesh.diagnostics.elapsedMs=Date.now()-started;}
  meshes.set(key,mesh);while(meshes.size>3)meshes.delete(meshes.keys().next().value);model.mesh=mesh;model.hexagons=mesh.hexagons;model.polygons=mesh.cells.map(c=>c.polygon);model.previewCells=mesh.cells;model.loops=mesh.baseCut.flatMap(p=>p);return model;
 }
 return {analyze,analyzeAsync,fit,fitAsync};
}
root.Reconstruction={create,pose,canonicalMesh};if(typeof module!=='undefined')module.exports=root.Reconstruction;
})(globalThis);
