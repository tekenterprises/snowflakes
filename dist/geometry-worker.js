/* Geometry remains browser-local; the worker owns all persistent solver caches. */
'use strict';
importScripts('engine.js','preview.js','vendor/earcut.min.js','crystal.js','vendor/polygon-clipping.min.js','vendor/clipper.js','branch-structure.js','polygon-fit.js','branch-regions.js','branch-tips.js','structural-model.js','shared-polygons.js','crystal-core.js','silhouette-mesh.js','shared-mesh.js','boundary-fit.js','image-evidence.js','image-crystal.js','exact-symmetry.js','cut-features.js','structural-voids.js','crystal-voids.js','cavity-cells.js','cut-output.js','reconstruction-framework.js','reconstruction-branches.js','reconstruction-partition.js','reconstruction-cells.js','reconstruction.js','geometry-pipeline.js','local-fit-pool.js');
let currentId=null,stopResolve=null;
const pool=typeof Worker==='function'&&typeof MessageChannel==='function'?LocalFitPool.create({
 requestPool(){self.postMessage({type:'openLocalPool',id:currentId});},
 stopPool(){return new Promise(resolve=>{stopResolve=resolve;self.postMessage({type:'closeLocalPool',id:currentId});});}
}):null;
const pipeline=GeometryPipeline.create(pool?{localFit:analysis=>pool.fit(analysis),cellFit:(analysis,canonical,options)=>pool.fitCells(analysis,canonical,options)}:{});
self.onmessage=async event=>{const message=event.data;
 if(message.type==='localPoolReady'){pool?.attach(message.ports);return;}
 if(message.type==='localPoolFailed'){pool?.fail();return;}
 if(message.type==='localPoolStopped'){if(stopResolve){const resolve=stopResolve;stopResolve=null;resolve();}return;}
 const {id,request}=message;currentId=id;
 try{self.postMessage({id,result:await pipeline.processAsync(request)});}catch(error){self.postMessage({id,error:error.message||String(error)});}
};
