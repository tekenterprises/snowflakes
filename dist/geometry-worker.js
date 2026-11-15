/* Geometry remains browser-local; the worker owns all persistent solver caches. */
'use strict';
importScripts('engine.js','preview.js','vendor/earcut.min.js','crystal.js','vendor/polygon-clipping.min.js','vendor/clipper.js','branch-structure.js','polygon-fit.js','branch-regions.js','branch-tips.js','structural-model.js','shared-polygons.js','crystal-core.js','silhouette-mesh.js','shared-mesh.js','boundary-fit.js','image-evidence.js','image-crystal.js','exact-symmetry.js','cut-features.js','structural-voids.js','crystal-voids.js','cavity-cells.js','cut-output.js','geometry-pipeline.js');
const pipeline=GeometryPipeline.create();
self.onmessage=event=>{const {id,request}=event.data;try{self.postMessage({id,result:pipeline.process(request)});}catch(error){self.postMessage({id,error:error.message||String(error)});}};
