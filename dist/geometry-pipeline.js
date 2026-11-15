/* Persistent computation stages shared by the background worker and fallback. */
(function(root){
'use strict';
const defaults=typeof module!=='undefined'?{B:require('./branch-structure'),I:require('./image-crystal'),O:require('./cut-output'),P:require('./preview')}:{B:root.BranchStructure,I:root.ImageCrystal,O:root.CutOutput,P:root.Preview};
function create(overrides={}){
 const {B,I,O,P}={...defaults,...overrides};
 let source=null,rawKey=null,mask=null,imageMask=null,measured=null,branchReady=false,lastKey=null,lastResult=null;
 const fits=new Map();
 function process(request){
  if(request.source&&request.source.key!==source?.key){source=request.source;rawKey=null;fits.clear();branchReady=false;lastKey=null;}
  if(!source?.pixels)throw Error('No source pixels available');
  const {options:o}=request,n=source.size;
  if(source.pixels.length!==n*n*4)throw Error('Invalid source pixel dimensions');
  const nextRawKey=JSON.stringify([source.key,!!o.invert,o.threshold]);
  if(rawKey!==nextRawKey){mask=new Uint8Array(n*n);imageMask=new Uint8Array(n*n);for(let i=0;i<mask.length;i++){let value=.2126*source.pixels[4*i]+.7152*source.pixels[4*i+1]+.0722*source.pixels[4*i+2];if(o.invert)value=255-value;mask[i]=value<o.threshold?1:0;imageMask[i]=value<235?1:0;}rawKey=nextRawKey;fits.clear();branchReady=false;lastKey=null;}
  const needModel=!!(o.crystal||o.symmetry||o.hanger||o.branchesPreview||o.crystalPreview);
  const finalKey=JSON.stringify([rawKey,o,needModel]);if(finalKey===lastKey)return lastResult;
  let fitted=null;
  if(needModel){if(!branchReady){measured=B.extract(source.pixels,n,!!o.invert,0,o.threshold);branchReady=true;}const fitKey=JSON.stringify([o.detail,o.symmetry]);if(fits.has(fitKey)){fitted=fits.get(fitKey);fits.delete(fitKey);fits.set(fitKey,fitted);}else{fitted=measured?I.fit(source.pixels,n,100,!!o.invert,o.detail,o.symmetry,measured,o.threshold):null;fits.set(fitKey,fitted);while(fits.size>6)fits.delete(fits.keys().next().value);}}
  const result=O.process(mask,n,o,fitted);
  // Functions and solver state stay in the worker. The UI receives only data it
  // paints/exports, avoiding copies of masks, topology, and diagnostic graphs.
  lastResult={loops:result.loops,branches:result.branches||[],previewPolygons:result.previewPolygons||[],removed:result.removed,components:result.components,clipped:result.clipped,structuralVoids:result.structuralVoids||0,crystalMesh:result.crystalMesh?{roleCount:result.crystalMesh.roleCount}:null,modelInfo:fitted?{branchCount:fitted.branchCount,hub:{observed:fitted.hub.observed}}:null,needModel,previewBounds:P.fitBounds(imageMask,n,result.loops)};
  lastKey=finalKey;return lastResult;
 }
 return {process};
}
root.GeometryPipeline={create};if(typeof module!=='undefined')module.exports=root.GeometryPipeline;
})(globalThis);
