/* Source-material preparation and whole-flake assembly for the accepted v4
 * crystal partition. Image arrays are sampled at canonical pixel centres.
 * 3e-5 canonical px welding is solely a numerical tolerance; the 4 px
 * coarsening limit is the separate approved artistic boundary tolerance. */
(function(root){'use strict';
const {Math,Date,Float32Array,Float64Array,Uint8Array,Int32Array,Array,Number,Set,Map,WeakMap,Object}=root;
const P=root.ReconstructionPartition;
if(!P)throw Error('ReconstructionPartition must load before ReconstructionCells');
const {N,W,S,Final,Repair}=P;
function morphology(mask,w,h,r,dilate){
 const horizontal=new Uint8Array(mask.length),out=new Uint8Array(mask.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=dilate?0:1;for(let dx=-r;dx<=r;dx++){const q=mask[y*w+Math.max(0,Math.min(w-1,x+dx))];v=dilate?(v||q):(v&&q)}horizontal[y*w+x]=v}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=dilate?0:1;for(let dy=-r;dy<=r;dy++){const q=horizontal[Math.max(0,Math.min(h-1,y+dy))*w+x];v=dilate?(v||q):(v&&q)}out[y*w+x]=v}
 return out;
}
function components(mask,w,h,diagonal,visit){
 const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
 for(let start=0;start<mask.length;start++)if(mask[start]&&!seen[start]){
  let head=0,tail=1;queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy||!diagonal&&dx&&dy)continue;const xx=x+dx,yy=y+dy;
    if(xx<0||yy<0||xx>=w||yy>=h)continue;const q=yy*w+xx;
    if(mask[q]&&!seen[q]){seen[q]=1;queue[tail++]=q}
   }
  }visit(queue.subarray(0,tail));
 }
}
function inside(x,y,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes;return yes}
function sample(a,w,h,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const at=(xx,yy)=>xx<0||yy<0||xx>=w||yy>=h?0:a[yy*w+xx];return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy}
function dimensions(side){const h=side.height||side.displayShape?.[0]||Math.max(420,Math.ceil(Math.max(side.trunkTip||0,...side.branches.map(b=>b.tip[1]))+30)),w=side.width||side.displayShape?.[1]||Math.max(260,Math.ceil(h*Math.tan(side.bisectorAngle||Math.PI/6))+5);return {w,h}}
function sideInput(analysis,side,sourceCells=[],options={}){
 const {w,h}=dimensions(side),n=Math.max(w,h)+2,hex=side.hexPolygon||[],ink=new Float32Array(w*h),geometric=new Uint8Array(w*h),central=new Uint8Array(w*h),foreground=new Uint8Array(w*h),anchor=new Uint8Array(w*h),tip=Array.isArray(side.trunkTip)?side.trunkTip[1]:side.trunkTip;
 const size=analysis.framework?.size||analysis.size||768,source=analysis.framework?.ink||analysis.ink,center=analysis.framework?.center||analysis.center;
 const c=Array.isArray(center)?center:[center.x,center.y];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;
  ink[i]=side.ink?side.ink[i]:sample(source,size,size,c[0]+side.pixel/side.scale*(y*side.u[0]+x*side.v[0]),c[1]+side.pixel/side.scale*(y*side.u[1]+x*side.v[1]));
  geometric[i]=side.geometric?side.geometric[i]:side.valid?side.valid[i]:(x<=y*Math.tan(side.bisectorAngle||Math.PI/6));
  central[i]=inside(x,y,hex)?1:0;foreground[i]=ink[i]>.055&&geometric[i]?1:0;anchor[i]=x<4&&y<=tip+1?1:0;
 }
 const centralHalo=morphology(central,w,h,1,true);for(let i=0;i<anchor.length;i++)anchor[i]|=centralHalo[i];
 const keep=new Uint8Array(w*h),pending=[];let discardedPixels=0;
 components(foreground,w,h,true,ids=>{if(ids.some(i=>anchor[i])){for(const i of ids)keep[i]=1}else pending.push(Int32Array.from(ids))});
 const halo=morphology(keep,w,h,2,true);for(const ids of pending){if(ids.length<3&&ids.some(i=>halo[i]))for(const i of ids)keep[i]=1;else discardedPixels+=ids.length}
 const closed=morphology(morphology(keep,w,h,1,true),w,h,1,false),skeleton=new Uint8Array(w*h);
 for(let y=0;y<h;y++)closed[y*w]=y<=tip+.5?1:0;
 for(let i=0;i<closed.length;i++)if(central[i]&&geometric[i])closed[i]=1;
 for(const b of side.branches){const steps=Math.max(2,Math.floor(b.length*2));for(let j=0;j<steps;j++){const f=j/(steps-1),x=Math.round(f*b.tip[0]),y=Math.round(b.attachment+f*(b.tip[1]-b.attachment));if(x>=0&&x<w&&y>=0&&y<h)skeleton[y*w+x]=1}}
 for(let y=0;y<h;y++)for(let x=0;x<Math.min(w,3);x++)skeleton[y*w+x]=1;
 const skeletonHalo=morphology(skeleton,w,h,1,true),voidAudit=[],mask=Uint8Array.from(closed),blank=Uint8Array.from(closed,(v,i)=>!v&&(!options.regular||geometric[i]&&i%w<=Math.floor(i/w)*Math.tan(side.bisectorAngle)+1e-8)?1:0);
 components(blank,w,h,false,ids=>{
  if(ids.some(i=>i%w===0||i%w===w-1||i<w||i>=w*(h-1)))return;
  if(options.regular&&ids.some(i=>{const x=i%w,y=Math.floor(i/w);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>xx>=0&&yy>=0&&xx<w&&yy<h&&xx<=yy*Math.tan(side.bisectorAngle)+1e-8&&!geometric[yy*w+xx]);}))return;
  // A bilateral domain edge is interior after reflection. Classify its enclosed
  // bays with the same photographic whiteness rule as ordinary closed voids.
  // Off-domain background does not make these cavities exterior components.
  let white=0,sum=0,onSkeleton=false;for(const i of ids){white+=ink[i]<.025?1:0;sum+=ink[i];onSkeleton||=!!skeletonHalo[i]}
  const whiteFraction=white/ids.length,meanInk=sum/ids.length,preserved=(options.fill===false?ids.length>=3:ids.length>=20)&&whiteFraction>=.8&&meanInk<.025&&!onSkeleton;
  if(!preserved)for(const i of ids)mask[i]=1;
  voidAudit.push({area:ids.length,whiteFraction,meanInk,preserved,skeletonConflict:onSkeleton});
 });
 const raw=new Uint8Array(n*n);for(let y=0;y<h;y++)for(let x=0;x<w;x++)raw[y*n+x]=mask[y*w+x]&&geometric[y*w+x]?1:0;
 const imageSize=analysis.framework?.sourceSize||size;
 const imageBounds=side.imageBounds||[[0,0],[imageSize-1,0],[imageSize-1,imageSize-1],[0,imageSize-1]].map(p=>{const dx=p[0]-c[0],dy=p[1]-c[1];return [(dx*side.v[0]+dy*side.v[1])*side.scale/side.pixel,(dx*side.u[0]+dy*side.u[1])*side.scale/side.pixel]});
 const branches=side.branches.map((b,i)=>({...b,angle:Number.isFinite(b.angle)?b.angle:Math.atan2(b.tip[0],b.tip[1]-b.attachment)*180/Math.PI,length:Number.isFinite(b.length)?b.length:Math.hypot(b.tip[0],b.tip[1]-b.attachment)}));
 const row={index:side.index,arm:side.arm,mirror:side.mirror,center:c.slice(),u:side.u.slice(),v:side.v.slice(),scale:side.scale,pixel:side.pixel,trunkTip:tip,n,branches,displayShape:[h,w],halfAngles:[side.bisectorAngle||Math.PI/6],localHex:hex,hexSupports:hex.map((p,i)=>({kind:'hex',identity:'central-hex',segment:[p,hex[(i+1)%hex.length]]})),imageBounds,sourceCells,sharedBranches:analysis.master?.branches||branches,voidAudit,discardedDisconnectedPixels:discardedPixels};
 return {row,raw};
}
// Parallel preparation stops before any deadline-sensitive search. The primary
// consumes these first-attempt booleans and runs partition/repair in side order.
function prepareSide(analysis,side,sourceCells=[],options={}){
 const prepared=sideInput(analysis,side,sourceCells,options),detail=Math.max(0,Math.min(100,options.detail??100)),tolerance=options.coarseOnly?4:1.6+2.4*(1-detail/100);
 try{prepared.base=W.run(prepared.row,prepared.raw,tolerance,{hardSeeds:tolerance<4,coarse:true,write:false,attempts:[],preserveCore:!!options.regular});}catch{prepared.base=null;}
 return prepared;
}
function fitPrepared(row,raw,options={}){
 const attempts=[];let last,prepared=options.preparedBase;
 // The original v4 coarse path is bounded and explicitly reports excluded
 // disconnected noise. No checkpoint or reference identity participates.
 const detail=Math.max(0,Math.min(100,options.detail??100)),initial=1.6+2.4*(1-detail/100);
 for(const tolerance of options.coarseOnly||initial>=4?[4]:[initial,4]){
  try{
   const base=prepared&&prepared.index===row.index&&prepared.contourTolerance===tolerance?prepared:W.run(row,raw,tolerance,{hardSeeds:tolerance<4,coarse:true,write:false,attempts,preserveCore:!!options.regular});prepared=null;
   const trial=S.run(base,{budgetMs:options.partitionBudgetMs||3200});
   if(trial.failed.length)Repair.run(trial,base);
   const result=Final.run(trial,base);result.attempts=attempts;return result;
  }catch(e){last=e;attempts.push({tolerance,reason:e.message})}
 }
 const error=Error('Crystal fit could not preserve finite supports and material: '+last?.message);error.attempts=attempts;throw error;
}
function photographicMedian(analysis,x,y){
 const values=[],frame=analysis.framework,sides=analysis.sides12||analysis.sides;
 for(const side of sides){
  if(x<0||y<0||x>y*Math.tan(side.bisectorAngle)+1e-8)continue;
  const k=side.pixel/side.scale,c=side.center||frame.center,sx=c[0]+k*(y*side.u[0]+x*side.v[0]),sy=c[1]+k*(y*side.u[1]+x*side.v[1]),size=side.sourceSize||frame.size;
  if(sx<0||sy<0||sx>=size-1||sy>=size-1)continue;
  const ink=side.sourceInk?.data||frame.branchInk||frame.ink;
  values.push(sample(ink,size,size,sx,sy));
 }
 if(!values.length)return null;values.sort((a,b)=>a-b);const n=values.length;
 return n%2?values[n>>1]:(values[n/2-1]+values[n/2])/2;
}
function prepareMaster(analysis,options={}){
 const m=analysis.master,s=analysis.sides12?.[0]||analysis.sides?.[0];if(!m||!s)throw Error('Master and twelve sides required');
 const originalHalf=m.halfAngle||m.bisectorAngle||s.bisectorAngle||Math.PI/6,halfAngle=options.regular?Math.PI/6:originalHalf,factor=options.regular?Math.tan(halfAngle)/Math.tan(originalHalf):1,width=Math.max(m.width,Math.ceil(m.height*Math.tan(halfAngle))+5),height=m.height;
 // Aligned median pixels exclude the median-vote observed central footprint.
 // Restore that known central material before subtracting one exact canonical
 // hexagon; otherwise its differing exclusion leaves a false collar-shaped gap.
 const priorInk=Float32Array.from(m.ink),priorValid=new Uint8Array(priorInk.length),centralPrior=options.regular&&m.hexmask?morphology(m.hexmask,m.width,m.height,1,true):m.hexmask;
 // Source sampling withholds an additional subpixel corner-clearance band
 // around its hex. Restore that one-pixel exclusion uncertainty for the regular
 // inferred hub before subtracting its exact polygon; it is not exterior ink.
 for(let i=0;i<priorInk.length;i++){priorValid[i]=+(m.valid[i]||centralPrior?.[i]);if(centralPrior?.[i])priorInk[i]=1;}
 const ink=new Float32Array(width*height),geometric=new Uint8Array(ink.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,seam=y*Math.tan(halfAngle);ink[i]=sample(priorInk,m.width,m.height,x/factor,y);geometric[i]=+(x<=seam+1e-8&&sample(priorValid,m.width,m.height,x/factor,y)>=.5);
  if(options.regular&&x>=seam-3&&x<=seam+2){
   // The bisector is a sampling-domain seam, not a photographed exterior.
   // Retain unmasked geometric source observations through a two-pixel guard
   // outside it; the exact half-plane clip below removes all guard material.
   // This prevents raster crop staircases becoming holes after reflection.
   const sx=Math.max(0,Math.min(x,seam-1e-7))/factor,value=photographicMedian(analysis,sx,y);
   if(value!==null){ink[i]=sample(centralPrior,m.width,m.height,sx,y)>=.5?1:value;geometric[i]=1;}
  }
 }
 const branches=m.branches.map(b=>{const tip=[b.tip[0]*factor,b.tip[1]];return {...b,tip,length:Math.hypot(tip[0],tip[1]-b.attachment),angle:Math.atan2(tip[0],tip[1]-b.attachment)*180/Math.PI}});
 const radius=m.hexPolygon?.[0]?.[1]||Math.hypot(...(m.hexPolygon?.[0]||[0,0]));
 const hexPolygon=radius>0?Array.from({length:6},(_,i)=>[radius*Math.sin(i*Math.PI/3),radius*Math.cos(i*Math.PI/3)]):m.hexPolygon||s.hexPolygon;
 // Master coordinates are the same median-pixel grid as local fitted sides.
 const side={...s,...m,index:-1,width,height,ink,geometric,valid:geometric,branches,scale:1,pixel:m.pixel||s.pixel,bisectorAngle:halfAngle,trunkTip:m.trunkTip||m.height-30,hexPolygon,imageBounds:[[0,0],[width,0],[width,height],[0,height]]};
 return sideInput(analysis,side,[],options);
}
function buildCanonical(analysis,options={}){
 const {row,raw}=prepareMaster(analysis,options);
 if(options.regular){
  let result=fitPrepared(row,raw,options);const components=r=>W.union([r.baseCut,W.subject(row.localHex)]).length;
  const before=components(result);
  if(before>1&&(options.detail??100)<100){
   // A coarse exterior chord may sever a narrow supported hub attachment.
   // Retain the finer accepted interpretation instead of drawing a connector.
   result=fitPrepared(row,raw,{...options,detail:100,coarseOnly:false});
   result.connectivityFallback={requestedDetail:options.detail,componentsBefore:before,contourTolerance:result.contourTolerance};
  }
  result.regular=true;result.coreComponents=components(result);return result;
 }
 // Faithful source fits use the accepted median v3 mesh, v4 rooted fans and
 // v5 quality refinement as guidance. Its raster central boundary is deliberate:
 // the source fits later use their own exact photographed central hexagon.
 const m=analysis.master,central=new Uint8Array(raw.length);
 for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.hexmask?.[y*m.width+x]){central[y*row.n+x]=1;raw[y*row.n+x]=0;}
 row.hexSupports=root.Flake.contours(central,row.n,.6).flatMap(ring=>ring.map((p,i)=>({kind:'hex',identity:'central-hex',segment:[p.map(v=>v-.5),ring[(i+1)%ring.length].map(v=>v-.5)]})));
 const detail=Math.max(0,Math.min(100,options.detail??100)),tolerance=options.coarseOnly?4:1.6+2.4*(1-detail/100);
 row.trunkTip=row.n; // Accepted median guide uses the finite canvas seam; source fits use measured tips.
 const base=P.MedianMesh.run(row,raw,central,tolerance),supports=row.branches.map((b,i)=>({kind:'branch',identity:'branch-'+i,segment:[[0,b.attachment],b.tip]})).concat(row.hexSupports,{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,row.n]]});
 let cells=[];const failed=[];
 for(const cell of base.cells){const result=P.GuidePartition.partition(cell,supports,{budgetMs:80})||S.partitionRegion(cell,supports,80);if(result)cells.push(...result);else failed.push(cell);}
 if(failed.length){const trial=S.run(base,{budgetMs:options.partitionBudgetMs||3200});Repair.run(trial,base);return Final.run(trial,base);}
 cells=Final.run({...base,cells,failed:[]},base).cells;
 const groups=new Map();cells.forEach((c,i)=>{const key=c.kind+':'+c.identity+':'+c.side;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)});
 const removed=new Set(),added=[],audit=[];
 for(const [key,ids]of groups){if(cells[ids[0]].kind!=='branch'||ids.length<2)continue;const before=ids.map(i=>cells[i]),oldScore=P.GuideQuality.quality(before);if(oldScore<ids.length*1.18)continue;
  const region=W.union(before.map(c=>W.subject(c.polygon))),candidate=[];let valid=true;
  for(const poly of region){if(poly.length!==1){valid=false;break}const polygon=P.GuideQuality.simple(poly[0].slice(0,-1));if(polygon.length>105){valid=false;break}const result=P.GuideQuality.partition({...before[0],polygon},before.map(c=>c.growthSupport),{budgetMs:100});if(!result){valid=false;break}candidate.push(...result)}
  if(!valid||candidate.length>Math.max(ids.length+2,Math.ceil(ids.length*1.25)))continue;const newScore=P.GuideQuality.quality(candidate);
  if(newScore<oldScore*.92&&oldScore-newScore>.25){ids.forEach(i=>removed.add(i));added.push(...candidate);audit.push({group:key,previousCells:ids.length,cells:candidate.length,previousQuality:oldScore,quality:newScore})}
 }
 cells=cells.filter((_,i)=>!removed.has(i)).concat(added);
 const result=Final.run({...base,cells,failed:[]},base);result.regular=false;result.refinementAudit=audit;return result;
}
function assemble(analysis,sides,options={}){
 const inputSides=analysis.sides12||analysis.sides,cells=[],center=analysis.framework?.center||analysis.center,c=Array.isArray(center)?center:[center.x,center.y];
 for(const row of sides){const s=inputSides[row.index],transform=p=>[c[0]+s.pixel/s.scale*(p[1]*s.u[0]+p[0]*s.v[0]),c[1]+s.pixel/s.scale*(p[1]*s.u[1]+p[0]*s.v[1])];
  for(const cell of row.cells){let polygon=cell.polygon.map(transform);if(N.area(polygon)<0)polygon.reverse();const sourceSupport=cell.growthSupport?{...cell.growthSupport,point:transform(cell.growthSupport.point),segment:cell.growthSupport.segment.map(transform)}:null;cells.push({...cell,polygon,arm:s.arm??Math.floor(s.index/2),mirror:s.mirror??s.index%2,halfArm:s.index,slotId:cell.kind==='branch'?(s.branches[Number(cell.identity.split('-')[1])]?.slotId??cell.identity):cell.identity,growthSupport:sourceSupport,masterParents:cell.masterParents||[]})}
 }
 const hexagons=analysis.framework?.hexagons||analysis.hexagons||[];
 const core=hexagons.at(-1)?.polygon||hexagons.at(-1);if(core?.length>=3){let polygon=core.map(p=>p.slice());if(N.area(polygon)<0)polygon.reverse();cells.push({polygon,kind:'core',identity:'central-hex',arm:-1,mirror:0,slotId:'central-hex',masterParents:[],growthSupport:{kind:'hex',identity:'central-hex',point:polygon[0],segment:[polygon[0],polygon[1]]}})}
 const conform=N.conform(cells),vertices=conform.vertices;
 const final=conform.cells.map((cell,id)=>({...cell,id,vertexIds:cell.vertices,facetCount:N.facetCount(cell.polygon)}));
 const grouped=[];for(let index=-1;index<12;index++){const group=final.filter(c=>(c.halfArm??-1)===index);if(group.length)grouped.push(W.union(group.map(c=>W.subject(c.polygon))))}
 const baseCut=W.union(grouped),overlap=final.reduce((s,c)=>s+N.area(c.polygon),0)-W.mpArea(baseCut);
 if(Math.abs(overlap)>.05)throw Error('Source assembly overlaps material: '+overlap);
 for(const cell of final){
  if(!cell.polygon.every(N.finite)||N.area(cell.polygon)<=0||cell.facetCount<3||cell.facetCount>6)throw Error('Invalid source-coordinate crystal facet');
  const contact=N.contact(cell.polygon,[cell.growthSupport],{insert:false});
  if(!contact)throw Error('Source-coordinate crystal lost its finite growth support');
  cell.growthSupport=contact.support;
 }
 Final.validateEdgeIncidence(final,vertices,baseCut);
 return {vertices,cells:final,baseCut,previewCells:final,branches:inputSides.flatMap(s=>s.branches),hexagons,diagnostics:{engine:'accepted-v4-inmemory',sides:sides.map(r=>({index:r.index,validation:r.validation,voidAudit:r.voidAudit,excludedUnsupported:r.excludedUnsupported,coarseningAudit:r.coarseningAudit,attempts:r.attempts})),overlapArea:overlap,materialArea:W.mpArea(baseCut),components:baseCut.length,cutHoles:Final.holes(baseCut)}};
}
function build(analysis,options={}){
 const started=Date.now(),guide=options.canonical||buildCanonical(analysis,options),sourceCells=guide.cells;
 const sides=(analysis.sides12||analysis.sides).map(side=>{const {row,raw}=sideInput(analysis,side,sourceCells,options);try{return fitPrepared(row,raw,options)}catch(error){error.sideIndex=side.index;throw error}});
 const result=assemble(analysis,sides,options);result.canonical=guide;result.diagnostics.elapsedMs=Date.now()-started;return result;
}
root.ReconstructionCells={build,buildCanonical,assemble,sideInput,prepareSide,fitPrepared,prepareMaster,morphology,components,sample,photographicMedian,geometry:P};
if(typeof module!=='undefined')module.exports=root.ReconstructionCells;
})(typeof globalThis!=='undefined'?globalThis:this);
