const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 const all=[],errors=[],channels=[];let helperAttempts=0,breakAt=Infinity;
 const make=url=>{const w={url,sent:[],postMessage(m){this.sent.push(m)},terminate(){this.dead=true}};all.push(w);return w};
 const scope=vm.createContext({console,Promise,Map,Set,ArrayBuffer,Uint8ClampedArray,navigator:{hardwareConcurrency:8},MessageChannel:class{constructor(){this.port1={close(){this.closed=true}};this.port2={close(){this.closed=true}};channels.push(this)}},Worker:class{constructor(url){return make(url)}}});
 vm.runInContext(fs.readFileSync('dist/geometry-client.js','utf8'),scope);
 const client=scope.GeometryClient.create({parallelWorkerFactory(){if(++helperAttempts===breakAt)throw Error('helper unavailable');return make('helper')},onError:e=>errors.push(e)}),source=key=>({key,size:2,pixels:new Uint8ClampedArray(16)}),job=key=>({key,source:source(key),options:{detail:100}});
 const first=client.request(job('A')),primary=all[0],lateMessage=primary.onmessage,lateError=primary.onerror;
 primary.onmessage({data:{type:'openLocalPool',id:1}});const children=all.filter(w=>w.url==='helper');assert.equal(children.length,4);assert.equal(primary.sent.at(-1).ports.length,4);for(const child of children)assert.equal(child.sent[0].type,'connect');
 const second=client.request(job('B'));assert(primary.dead);assert(children.every(w=>w.dead),'source replacement terminates coordinator and every sibling');assert.equal(await first,false);
 const count=all.length;lateMessage({data:{type:'openLocalPool',id:1}});lateError();children[0].onerror();assert.equal(all.length,count);assert.deepEqual(errors,[]);
 const next=all.at(-1),id=next.sent[0].id;next.onmessage({data:{type:'openLocalPool',id}});const active=all.filter(w=>w.url==='helper'&&!w.dead);assert.equal(active.length,4);active[0].onerror();assert(active.every(w=>w.dead));assert.equal(next.sent.at(-1).type,'localPoolFailed');
 next.onmessage({data:{id,result:{loops:[],tag:'B'}}});await second;
 const third=client.request(job('C'));const current=all.find(w=>!w.dead&&w.url!=='helper'),currentId=current.sent.at(-1).id;breakAt=helperAttempts+2;current.onmessage({data:{type:'openLocalPool',id:currentId}});assert.equal(current.sent.at(-1).ports.length,0,'partial helper startup falls back to no pool');assert(all.filter(w=>w.url==='helper').every(w=>w.dead));
 current.onmessage({data:{type:'closeLocalPool',id:id}});assert.equal(current.sent.at(-1).type,'localPoolStopped','prior-job close must acknowledge within the current worker generation');current.onmessage({data:{type:'closeLocalPool',id:currentId}});assert.equal(current.sent.at(-1).type,'localPoolStopped');current.onmessage({data:{id:currentId,result:{tag:'C'}}});await third;client.invalidate();client.invalidate();assert.equal(client.isBusy(),false);
 console.log('UI owns and retires sibling workers; generations reject old pool events and helper startup/failure falls back safely.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
