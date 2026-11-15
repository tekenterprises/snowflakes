/* One running job plus the latest pending settings; stale results never paint. */
(function(root){
'use strict';
function create({onResult,onError,onBusy,workerFactory,pipelineFactory}={}){
 let worker=null,pipeline=null,busy=false,pending=null,latest=null,revision=0,sourceKey=null;
 const waiting=[];
 const makePipeline=pipelineFactory||(()=>root.GeometryPipeline.create());
 function settle(value){while(waiting.length)waiting.shift()(value);}
 function receive(message){if(!busy||message.id!==busy.id)return;const completed=busy;busy=false;if(message.id===revision){if(message.error){onError?.(message.error);settle(false);}else{onResult?.(message.result,completed.request);settle(message.result);}}drain();}
 function drain(){if(busy||!pending)return;const job=pending;pending=null;busy=job;
  if(worker){const request={options:job.request.options},transfers=[];if(sourceKey!==job.request.source.key){const pixels=new Uint8ClampedArray(job.request.source.pixels);request.source={...job.request.source,pixels};transfers.push(pixels.buffer);sourceKey=request.source.key;}try{worker.postMessage({id:job.id,request},transfers);}catch{fallback();}}
  else{try{pipeline=pipeline||makePipeline();receive({id:job.id,result:pipeline.process(job.request)});}catch(error){receive({id:job.id,error:error.message||String(error)});}}
 }
 try{worker=workerFactory?workerFactory():typeof root.Worker==='function'?new root.Worker('geometry-worker.js?v=35'):null;}catch{worker=null;}
 function fallback(){worker?.terminate();worker=null;sourceKey=null;busy=false;pending=latest;drain();}
 if(worker){worker.onmessage=event=>receive(event.data);worker.onerror=fallback;}
 function request(value){const job={id:++revision,request:value};latest=job;pending=job;onBusy?.();drain();return new Promise(resolve=>{if(!busy&&!pending)resolve(true);else waiting.push(resolve);});}
 return {request,whenSettled:()=>!busy&&!pending?Promise.resolve(true):new Promise(resolve=>waiting.push(resolve)),isBusy:()=>!!(busy||pending)};
}
root.GeometryClient={create};if(typeof module!=='undefined')module.exports=root.GeometryClient;
})(globalThis);
