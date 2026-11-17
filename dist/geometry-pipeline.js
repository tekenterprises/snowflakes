/* Persistent computation stages shared by the background worker and fallback. */
(function(root){
'use strict';
const defaults=typeof module!=='undefined'?{B:require('./branch-structure'),I:require('./image-crystal'),O:require('./cut-output'),P:require('./preview'),R:require('./reconstruction')}:{B:root.BranchStructure,I:root.ImageCrystal,O:root.CutOutput,P:root.Preview,R:root.Reconstruction};
function create(overrides={}){
 const {B,I,O,P,R}={...defaults,...overrides};
 let source=null,rawKey=null,mask=null,imageMask=null,measured=null,branchReady=false,lastKey=null,lastResult=null;
 const fits=new Map(),reconstruction=R&&!overrides.B&&!overrides.I?R.create({localFit:overrides.localFit,cellFit:overrides.cellFit}):null;
 function* stages(request){
  if(request.source&&JSON.stringify([request.source.key,request.source.size,request.source.centerOverride||null])!==JSON.stringify([source?.key,source?.size,source?.centerOverride||null])){source=request.source;rawKey=null;fits.clear();branchReady=false;lastKey=null;}
  if(!source?.pixels)throw Error('No source pixels available');
  const {options:o}=request,n=source.size;
  if(source.pixels.length!==n*n*4)throw Error('Invalid source pixel dimensions');
  const nextRawKey=JSON.stringify([source.key,!!o.invert,o.threshold]);
  if(rawKey!==nextRawKey){mask=new Uint8Array(n*n);imageMask=new Uint8Array(n*n);for(let i=0;i<mask.length;i++){let value=.2126*source.pixels[4*i]+.7152*source.pixels[4*i+1]+.0722*source.pixels[4*i+2];if(o.invert)value=255-value;mask[i]=value<o.threshold?1:0;imageMask[i]=value<235?1:0;}rawKey=nextRawKey;fits.clear();branchReady=false;lastKey=null;}
  const needModel=!!(o.crystal||o.symmetry||o.hanger||o.branchesPreview||o.crystalPreview);
  const finalKey=JSON.stringify([rawKey,o,needModel]);if(finalKey===lastKey)return lastResult;
  let fitted=null;
  if(needModel){if(!branchReady){measured=yield {kind:'analysis',pixels:source.pixels,size:n,options:{invert:!!o.invert,threshold:o.threshold,centerOverride:source.centerOverride}};branchReady=true;}const fitKey=JSON.stringify([o.detail,o.symmetry,!!o.fill,!!(o.crystal||o.crystalPreview)]);if(fits.has(fitKey)){fitted=fits.get(fitKey);fits.delete(fitKey);fits.set(fitKey,fitted);}else{fitted=yield {kind:'fit',options:o,needMesh:!!(o.crystal||o.crystalPreview),size:n};fits.set(fitKey,fitted);while(fits.size>6)fits.delete(fits.keys().next().value);}}
  const result=O.process(mask,n,o,fitted);
  // Functions and solver state stay in the worker. The UI receives only data it
  // paints/exports, avoiding copies of masks, topology, and diagnostic graphs.
  lastResult={loops:result.loops,branches:result.branches||[],previewPolygons:result.previewPolygons||[],previewCells:(result.previewCells||[]).map(c=>({kind:c.kind,identity:c.identity,side:c.side})),hexagons:result.hexagons||[],center:result.center||[n/2,n/2],removed:result.removed,components:result.components,clipped:result.clipped,structuralVoids:result.structuralVoids||0,crystalMesh:result.crystalMesh?{roleCount:result.crystalMesh.roleCount}:null,modelInfo:fitted?{branchCount:fitted.branchCount,hub:{observed:fitted.hub.observed}}:null,needModel,previewBounds:P.fitBounds(imageMask,n,result.loops)};
  lastKey=finalKey;return lastResult;
 }
 function compute(step,asyncMode){const {pixels,size,options}=step;
  if(step.kind==='fit')return reconstruction?(asyncMode?reconstruction.fitAsync(options,step.needMesh):reconstruction.fit(options,step.needMesh)):measured?I.fit(source.pixels,size,100,!!options.invert,options.detail,options.symmetry,measured,options.threshold):null;
  return reconstruction?(asyncMode?reconstruction.analyzeAsync(pixels,size,options):reconstruction.analyze(pixels,size,options)):B.extract(pixels,size,options.invert,0,options.threshold);
 }
 function process(request){const work=stages(request);let step=work.next();while(!step.done)step=work.next(compute(step.value,false));return step.value;}
 async function processAsync(request){const work=stages(request);let step=work.next();while(!step.done)step=work.next(await compute(step.value,true));return step.value;}
 return {process,processAsync};
}
root.GeometryPipeline={create};if(typeof module!=='undefined')module.exports=root.GeometryPipeline;
})(globalThis);
