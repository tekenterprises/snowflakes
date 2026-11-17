/* Browser-local solver supervisor. Completed DTOs survive worker replacement;
 * source revisions and worker generations independently reject obsolete work. */
(function(root){
'use strict';
function create({onResult,onError,onBusy,workerFactory,pipelineFactory,resultCacheBytes=16*1024*1024,resultCacheEntries=6,parallelWorkerFactory,helperCount}={}){
 let worker=null,pipeline=null,busy=null,pending=null,latest=null,revision=0,generation=0,sourceKey=null,fallbackOnly=false,outcome=true;
 let helpers=[],poolOpened=false;
 const waiting=new Map(),cache=new Map();let cacheBytes=0,hits=0,misses=0;
 const makePipeline=pipelineFactory||(()=>root.GeometryPipeline.create());
 function sourceIdentity(source){return JSON.stringify([source.key,source.size,source.centerOverride||null]);}
 function key(request){const o=request.options;return JSON.stringify([request.source.key,request.source.size,request.source.centerOverride||null,Object.keys(o).sort().map(k=>[k,o[k]])]);}
 // This is a conservative accounting budget, not a measurement of the JS heap.
 function bytes(value,seen=new Set()){
  if(value===null||value===undefined)return 0;if(typeof value==='number')return 8;if(typeof value==='boolean')return 4;if(typeof value==='string')return value.length*2;
  if(typeof value!=='object'||seen.has(value))return 0;seen.add(value);if(ArrayBuffer.isView(value))return value.byteLength;
  let total=64;for(const k of Object.keys(value))total+=16+k.length*2+bytes(value[k],seen);return total;
 }
 function remember(job,result){
  if(!resultCacheBytes||!resultCacheEntries)return;const k=job.cacheKey,size=bytes(result)+k.length*2;if(size>resultCacheBytes)return;
  const old=cache.get(k);if(old)cacheBytes-=old.size;cache.delete(k);cache.set(k,{result,size});cacheBytes+=size;
  while(cacheBytes>resultCacheBytes||cache.size>resultCacheEntries){const k=cache.keys().next().value;cacheBytes-=cache.get(k).size;cache.delete(k);}
 }
 function settle(id,value){const list=waiting.get(id);if(list){waiting.delete(id);for(const resolve of list)resolve(value);}}
 function supersede(){for(const id of waiting.keys())settle(id,false);revision++;outcome=false;}
 function wait(id){return new Promise(resolve=>{const list=waiting.get(id)||[];list.push(resolve);waiting.set(id,list);});}
 function stopHelpers(){const old=helpers;helpers=[];poolOpened=false;for(const helper of old)try{helper.terminate();}catch{}}
 function openPool(instance,epoch,id){
  if(!busy||id!==busy.id||poolOpened)return;poolOpened=true;
  const count=helperCount??Math.min(4,Math.max(0,(root.navigator?.hardwareConcurrency||2)-1));
  if(count<2||typeof root.MessageChannel!=='function'){try{instance.postMessage({type:'localPoolReady',id,ports:[]});}catch{fallback();}return;}
  const ports=[];
  try{for(let i=0;i<count;i++){const helper=parallelWorkerFactory?parallelWorkerFactory():new root.Worker('geometry-side-worker.js?v=37');helpers.push(helper);const channel=new root.MessageChannel();ports.push(channel.port1);
    helper.onerror=helper.onmessageerror=()=>{if(epoch!==generation||worker!==instance||!helpers.includes(helper))return;stopHelpers();try{instance.postMessage({type:'localPoolFailed'});}catch{fallback();}};
    helper.postMessage({type:'connect',port:channel.port2},[channel.port2]);}
   instance.postMessage({type:'localPoolReady',id,ports},ports);
  }catch{for(const port of ports)try{port.close();}catch{}stopHelpers();try{instance.postMessage({type:'localPoolReady',id,ports:[]});}catch{fallback();}}
 }
 function retire(){generation++;stopHelpers();const old=worker;worker=null;sourceKey=null;busy=null;old?.terminate();}
 function spawn(){
  if(fallbackOnly||worker)return;
  try{const instance=workerFactory?workerFactory():typeof root.Worker==='function'?new root.Worker('geometry-worker.js?v=37'):null;if(!instance){fallbackOnly=true;return}worker=instance;const epoch=++generation;
   instance.onmessage=event=>{if(epoch!==generation||worker!==instance)return;const message=event.data;
    if(message.type==='openLocalPool'){openPool(instance,epoch,message.id);return;}
    if(message.type==='closeLocalPool'){stopHelpers();try{instance.postMessage({type:'localPoolStopped',id:message.id});}catch{fallback();}return;}
    receive(message);
   };
   instance.onmessageerror=instance.onerror=()=>{if(epoch===generation&&worker===instance)fallback();};
  }catch{fallbackOnly=true;worker=null;}
 }
 function complete(job,result,error,save=true){
  if(!error&&save)remember(job,result);
  if(job.id===revision){if(error){outcome=false;onError?.(error);settle(job.id,false);}else{outcome=result;onResult?.(result,job.request);settle(job.id,result);}}
 }
 function receive(message){if(!busy||message.id!==busy.id)return;const completed=busy;busy=null;complete(completed,message.result,message.error);drain();}
 function fallback(){const retry=(busy||pending)&&latest?.id===revision?latest:null;retire();fallbackOnly=true;pending=retry;drain();}
 function drain(){
  if(busy||!pending)return;const job=pending;pending=null;busy=job;spawn();
  if(worker){const request={options:job.request.options},transfers=[];if(sourceKey!==sourceIdentity(job.request.source)){const pixels=new Uint8ClampedArray(job.request.source.pixels);request.source={...job.request.source,pixels};transfers.push(pixels.buffer);sourceKey=sourceIdentity(request.source);}try{worker.postMessage({id:job.id,request},transfers);}catch{fallback();}}
  else{let result,error;try{pipeline=pipeline||makePipeline();result=pipeline.process(job.request);}catch(e){error=e.message||String(e)}busy=null;complete(job,result,error);drain();}
 }
 spawn();
 function request(value){
  supersede();const job={id:revision,request:value,cacheKey:key(value)};latest=job;const done=wait(job.id);onBusy?.();
  const cached=cache.get(job.cacheKey);
  if(cached){hits++;cache.delete(job.cacheKey);cache.set(job.cacheKey,cached);pending=null;if(busy)retire();complete(job,cached.result,null,false);return done;}
  misses++;if(busy&&sourceIdentity(busy.request.source)!==sourceIdentity(value.source))retire();pending=job;drain();return done;
 }
 // Selection invalidation happens before image decoding, not only on dispatch.
 function invalidate(){supersede();pending=null;latest=null;if(busy)retire();}
 return {request,invalidate,whenSettled:()=>!busy&&!pending?Promise.resolve(outcome):wait(revision),isBusy:()=>!!(busy||pending),cacheInfo:()=>({entries:cache.size,bytes:cacheBytes,hits,misses})};
}
root.GeometryClient={create};if(typeof module!=='undefined')module.exports=root.GeometryClient;
})(globalThis);
