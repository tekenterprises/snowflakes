const assert=require('node:assert/strict'),{create}=require('../dist/geometry-client'),Pipeline=require('../dist/geometry-pipeline');
async function main(){
 const sent=[],painted=[],fake={postMessage(message,transfer){sent.push({message,transfer})},terminate(){this.stopped=true}};
 const client=create({workerFactory:()=>fake,onResult:(result,request)=>painted.push([result,request.key])});
 const source={key:'a',size:2,pixels:new Uint8ClampedArray(16)},job=(key,s=source)=>({key,source:s,options:{detail:key}});
 const first=client.request(job(1));client.request(job(2));const latest=client.request(job(3));
 assert.equal(sent.length,1);assert.equal(source.pixels.byteLength,16,'transfer must preserve UI pixels');
 fake.onmessage({data:{id:1,result:'obsolete'}});
 assert.deepEqual(painted,[],'obsolete geometry cannot paint');assert.equal(sent.length,2);assert.equal(sent[1].message.request.options.detail,3,'only latest queued controls run');assert(!sent[1].message.request.source,'same source is retained in worker');
 fake.onmessage({data:{id:3,result:'current'}});await Promise.all([first,latest]);assert.deepEqual(painted,[['current',3]]);assert(!client.isBusy());
 client.request(job(4,{...source,key:'b'}));assert.equal(sent.at(-1).message.request.source.key,'b');fake.onmessage({data:{id:4,result:'new image'}});await client.whenSettled();
 let fallbackCalls=0;const failing={postMessage(){throw Error('blocked')},terminate(){}};
 const fallback=create({workerFactory:()=>failing,pipelineFactory:()=>({process(){fallbackCalls++;return 'fallback'}}),onResult:r=>assert.equal(r,'fallback')});await fallback.request(job(5));assert.equal(fallbackCalls,1);assert(!fallback.isBusy());
 const crashing={postMessage(){},terminate(){}},recovered=[];const recovery=create({workerFactory:()=>crashing,pipelineFactory:()=>({process:r=>r.key}),onResult:r=>recovered.push(r)});recovery.request(job('old'));const recoveryDone=recovery.request(job('latest'));crashing.onerror();await recoveryDone;assert.deepEqual(recovered,['latest'],'worker startup/runtime failure retries only current controls');
 let failures=[];const broken=create({workerFactory:()=>null,pipelineFactory:()=>({process(){throw Error('bad geometry')}}),onError:e=>failures.push(e)});await broken.request(job(6));assert.deepEqual(failures,['bad geometry']);
 const counts={extract:0,fit:0,cut:0},fitted={branchCount:6,hub:{observed:true}};
 const pipeline=Pipeline.create({B:{extract(){counts.extract++;return {}}},I:{fit(){counts.fit++;return fitted}},O:{process(){counts.cut++;return {loops:[],branches:[],previewPolygons:[]}}},P:{fitBounds(){return [0,0,2,2]}}});
 const options={threshold:230,invert:false,detail:100,symmetry:0,crystal:100,fill:true};
 const run=patch=>pipeline.process({source,options:{...options,...patch}});
 const a=run({});assert.strictEqual(run({}),a);assert.deepEqual(counts,{extract:1,fit:1,cut:1});
 run({offset:1});assert.deepEqual(counts,{extract:1,fit:1,cut:2});
 run({symmetry:100});assert.deepEqual(counts,{extract:1,fit:2,cut:3});run({});assert.equal(counts.fit,2,'returning to prior fit reuses it');
 run({threshold:180});assert.equal(counts.extract,2);assert.equal(counts.fit,3);
 pipeline.process({source:{...source,key:'new'},options});assert.equal(counts.extract,3,'new upload invalidates analysis');
 for(let detail=0;detail<8;detail++)run({detail});const before=counts.fit;run({detail:0});assert.equal(counts.fit,before+1,'fit history is bounded');
 assert.throws(()=>pipeline.process({source:{key:'invalid',size:3,pixels:source.pixels},options}),/dimensions/);
 console.log('Background client coalesces settings, rejects stale results, retains source pixels, falls back on worker errors, and bounds/invalidate stage caches.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
