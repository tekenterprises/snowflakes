'use strict';
// Mocks exercise scheduling/failure semantics. Actual classic helper imports run
// in Node worker threads below; these are not browser latency measurements.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker,MessageChannel}=require('node:worker_threads');
const Pool=require('../dist/local-fit-pool.js'),B=require('../dist/reconstruction-branches.js');
const code=fs.readFileSync(path.resolve(__dirname,'../dist/local-fit-pool.js'),'utf8');
const plain=value=>structuredClone(value);
const expected=(master,side)=>({branches:[{index:side.index,value:side.sourceInk.data[0]+master.commonAngle}],commonAngle:master.commonAngle});
function mockModule(serial,cells){const context=vm.createContext({setTimeout,clearTimeout,Promise,ReconstructionCells:cells,ReconstructionBranches:{fitSide(master,side){serial.push(side.index);return expected(master,side);}}});vm.runInContext(code,context);return context.LocalFitPool;}
function analysis(value=1){const sourceInk={data:new Float32Array([value,2,3,4]),width:2,height:2};return {framework:{center:[2,3],size:2,sourceSize:4},master:{branches:[{tip:[1,2]}],commonAngle:60},sides:Array.from({length:12},(_,index)=>({index,sourceInk,sourceHex:[[0,0]],center:[2,3],u:[1,0],v:[0,1],ink:new Float32Array([index])}))};}
function mockPort({delay=()=>1,error=()=>false,hang=()=>false,throwOn=()=>false,late=false,prepare}={}){
  let current,previous;const jobs=[],inits=[],finished=[];
  const port={closed:false,jobs,inits,finished,start(){},close(){this.closed=true;},postMessage(data){
    if(throwOn(data))throw new Error('clone failure');const message=structuredClone(data);
    if(message.type==='init'){previous=current;current=message;inits.push(message);return;}
    jobs.push(message);assert(!Object.hasOwn(message.side,'sourceInk'));assert(message.side.sourceHex);assert(message.side.center);
    if(hang(message))return;
    const reply=port.onmessage,init=current;
    if(late&&previous)setTimeout(()=>reply&&reply({data:{type:'fit',runId:previous.runId,index:message.index,fit:{bad:true}}}),0);
    setTimeout(()=>{const failed=error(message);if(!failed)finished.push(message.index);reply&&reply({data:{type:failed?'error':'fit',runId:message.runId,index:message.index,fit:failed?undefined:prepare&&init.mode==='cells'?prepare(init,message):expected(init.master,{...message.side,sourceInk:init.sourceInk})}});},delay(message));
  }};return port;
}
async function unit(){
  {
    const serial=[],module=mockModule(serial);let requests=0;const pool=module.create({requestPool(){requests++;pool.attach([]);}}),input=analysis();input.sides.reverse();
    assert.deepEqual(plain(await pool.fit(input)),analysis().sides.map(s=>expected(input.master,s)));await pool.fit(input);assert.equal(requests,1);assert.equal(serial.length,24);await pool.dispose();
  }
  {
    const serial=[],module=mockModule(serial),ports=[mockPort({delay:m=>12-m.index,late:true}),mockPort({delay:()=>1,late:true}),mockPort({delay:()=>3,late:true})];let requests=0,stops=0;
    const pool=module.create({requestPool(){requests++;pool.attach(ports);},stopPool(){stops++;}});
    for(const value of [1,17]){const input=analysis(value);assert.deepEqual(plain(await pool.fit(input)),input.sides.map(s=>expected(input.master,s)));assert.equal(input.sides[0].sourceInk.data.byteLength,16);}
    assert.equal(requests,1);assert.deepEqual(serial,[]);ports.forEach(p=>assert.equal(p.inits.length,2));assert(ports.every(p=>p.inits[0].runId!==p.inits[1].runId));await pool.dispose();assert.equal(stops,1);assert(ports.every(p=>p.closed));
  }
  {
    const serial=[],module=mockModule(serial),ports=[mockPort({delay:m=>m.index===4?40:1}),mockPort({delay:()=>15,error:()=>true})];let stopped=false;
    let completed;
    const pool=module.create({requestPool(){pool.attach(ports);},stopPool(){completed=ports.flatMap(p=>p.finished);return new Promise(resolve=>setTimeout(()=>{stopped=true;resolve();},3));}}),input=analysis();
    const output=await pool.fit(input);assert(stopped);assert.deepEqual(plain(output),input.sides.map(s=>expected(input.master,s)));assert(completed.length>0);assert.deepEqual(serial,input.sides.filter(s=>!completed.includes(s.index)).map(s=>s.index));
    // A delayed reply retained its old handler but cannot replace a completed fit.
    await new Promise(resolve=>setTimeout(resolve,45));assert.deepEqual(plain(output),input.sides.map(s=>expected(input.master,s)));await pool.dispose();
  }
  for(const mode of ['ready-timeout','task-timeout','init-clone','job-clone','messageerror','external-fail','dispose']){
    const serial=[],module=mockModule(serial),port=mockPort({hang:()=>true,throwOn:m=>(mode==='init-clone'&&m.type==='init')||(mode==='job-clone'&&m.type==='fit')});let stops=0;
    const pool=module.create({readyTimeoutMs:8,taskTimeoutMs:8,requestPool(){if(mode!=='ready-timeout')pool.attach([port]);if(mode==='external-fail')setTimeout(()=>pool.fail(),1);if(mode==='dispose')setTimeout(()=>pool.dispose(),1);if(mode==='messageerror')setTimeout(()=>port.onmessageerror&&port.onmessageerror(),1);},stopPool(){stops++;}}),input=analysis();
    assert.deepEqual(plain(await pool.fit(input)),input.sides.map(s=>expected(input.master,s)),mode);assert.equal(serial.length,12,mode);assert.equal(stops,1,mode);
    const late=mockPort();pool.attach([late]);assert(late.closed);await pool.dispose();assert.equal(stops,1);
  }
  console.log('Local fit pool: ordering, reuse, clone safety, late runs, failure retention and serial fallback passed.');
}
async function cellUnit(){
  for(const mode of ['prepared','error','missing','clone','serial']){
    const calls=[],localInputs=[],canonical={cells:[{polygon:[[0,0],[0,1],[1,0]]}]},options={detail:73,fill:false,partitionBudgetMs:3210};let preparedDone=0;
    const ports=Array.from({length:3},()=>mockPort({delay:m=>12-m.index,error:m=>mode==='error'&&m.index===4,throwOn:m=>mode==='clone'&&m.type==='fit'&&m.index===4,prepare(init,message){
      preparedDone++;assert.deepEqual(init.framework,{center:[2,3],size:2,sourceSize:4});assert.deepEqual(init.canonical,canonical);assert.deepEqual(init.options,options);
      if(mode==='missing'&&message.index===4)return {};
      return {row:{index:message.index},raw:new Uint8Array([message.index]),base:message.index===3?null:{index:message.index}};
    }}));
    let helpersStopped=false;
    const C={sideInput(input,side,cells,received){localInputs.push(side.index);assert.equal(cells,canonical.cells);assert.equal(received,options);return {row:{index:side.index},raw:new Uint8Array([side.index])};},fitPrepared(row,raw,received){
      if(mode!=='clone'&&mode!=='serial')assert.equal(preparedDone,mode==='error'?11:12,'all helpers finish before the first timed fit');
      if(mode==='clone')assert(helpersStopped,'failed helpers stop before timed fits');
      assert.equal(received.detail,options.detail);assert.equal(received.partitionBudgetMs,options.partitionBudgetMs);assert(!received.parallelMaterialOnly);calls.push(row.index);return {index:row.index,raw:raw[0]};
    }};
    const module=mockModule([],C),pool=module.create({requestPool(){pool.attach(mode==='serial'?[]:ports);},stopPool(){helpersStopped=true;}});
    const input=analysis(),before=structuredClone(input);if(mode==='prepared')await pool.fit(input);
    const rows=await pool.fitCells(input,canonical,options);
    assert.deepEqual(calls,Array.from({length:12},(_,i)=>i));assert.deepEqual(plain(rows),calls.map(index=>({index,raw:index})));assert.deepEqual(input,before);
    if(mode==='prepared'){assert.deepEqual(localInputs,[]);assert.equal(rows.parallelStats.accepted,12);}
    if(mode==='error'||mode==='missing')assert.deepEqual(localInputs,[4]);
    if(mode==='serial')assert.equal(localInputs.length,12);
    await pool.dispose();
  }
  console.log('Cell helpers prepare material only; timed fits run in primary index order after helpers finish, with original-option fallbacks.');
}
const dist=path.resolve(__dirname,'../dist');
function actualHelpers(count=3){
  const workers=[],ports=[];
  for(let i=0;i<count;i++){
    const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const scope=vm.createContext({console});scope.self=scope;scope.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(workerData,file),'utf8'),scope,{filename:file}));scope.importScripts('geometry-side-worker.js');parentPort.on('message',data=>scope.onmessage({data}));`,{eval:true,workerData:dist});
    const channel=new MessageChannel();worker.postMessage({type:'connect',port:channel.port2},[channel.port2]);workers.push(worker);ports.push(channel.port1);
  }
  return {ports,stop:()=>Promise.all(workers.map(worker=>worker.terminate()))};
}
function synthetic(){
  const n=64,center=[31.3,30.7],ink=new Float32Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++)ink[y*n+x]=(x+2*y)/(3*n);
  const trunks=Array.from({length:6},(_,arm)=>({arm,start:center.slice(),end:[center[0]+25*Math.cos(arm*Math.PI/3),center[1]+25*Math.sin(arm*Math.PI/3)]}));
  const polygon=Array.from({length:6},(_,i)=>[center[0]+4*Math.cos(i*Math.PI/3),center[1]+4*Math.sin(i*Math.PI/3)]);
  const framework={size:n,center,branchInk:ink,trunks,hexagons:[{polygon}]};
  return B.analyze(framework,{scales:new Array(12).fill(1),masterBranches:[{attachment:100,angle:60,length:40,tip:[40*Math.sin(Math.PI/3),120]}],commonAngle:60,deferLocal:true});
}
async function actual(){
  let helpers;const pool=Pool.create({requestPool(){helpers=actualHelpers();pool.attach(helpers.ports);},stopPool(){return helpers&&helpers.stop();},taskTimeoutMs:60000});
  try{
    const inputs=[['synthetic',synthetic()]],refs=process.argv.find(value=>value.startsWith('--refs='));
    if(refs){
      const F=require('../dist/reconstruction-framework.js'),records=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../structure-diagnostics/master-side-prototype/full-slices-v16/results.json'))).results;
      for(const reference of refs.slice(7).split(',').map(Number)){
        const row=records.find(row=>row.reference===reference);assert(row,`Missing ref ${reference}`);
        const raw=fs.readFileSync(path.resolve(__dirname,`../../fixtures/image-model-${reference}.rgba`));
        const digest=require('node:crypto').createHash('sha256').update(raw).digest('hex');assert.equal(digest,row.inputSHA256);
        const cache=path.resolve(__dirname,`../../structure-diagnostics/runtime-port/integration/final/analysis-${String(reference).padStart(2,'0')}.bin`);
        const input=fs.existsSync(cache)?require('node:v8').deserialize(fs.readFileSync(cache)):B.analyze({size:768,center:row.center,trunks:row.trunks,hexagons:row.hexagons,branchInk:F.imageInk(raw,768,{blur:.65})},{deferLocal:true});
        inputs.push([reference,input]);
      }
    }
    for(const [reference,input] of inputs){
      const before=structuredClone(input),serialStarted=performance.now(),expected=input.sides.map(side=>B.fitSide(input.master,side,input.master.branches,input.master.commonAngle)),serialNodeMs=performance.now()-serialStarted;
      const started=performance.now(),output=await pool.fit(input),parallelNodeMs=performance.now()-started;assert.deepEqual(output,expected,`all 12 exact helper fits: ${reference}`);assert.deepEqual(input,before,'primary buffers and analysis retained');
      console.log(JSON.stringify({reference,sides:output.length,exact:true,serialNodeMs:Math.round(serialNodeMs),parallelNodeMs:Math.round(parallelNodeMs)}));
    }
  }finally{await pool.dispose();}
}
async function actualCells(){
  const requested=process.argv.find(value=>value.startsWith('--cell-refs='));if(!requested)return;
  global.earcut=require('../dist/vendor/earcut.min.js');global.polygonClipping=require('../dist/vendor/polygon-clipping.min.js');require('../dist/engine.js');require('../dist/reconstruction-partition.js');const C=require('../dist/reconstruction-cells.js');
  const refs=requested.slice(12)==='all'?Array.from({length:20},(_,i)=>i+1):requested.slice(12).split(',').map(Number),options={detail:100,fill:true};
  const packets=new Map();let helpers;const pool=Pool.create({requestPool(){helpers=actualHelpers();helpers.ports.forEach(port=>port.on('message',message=>{if(message.type==='fit')packets.set(message.index,structuredClone(message.fit));}));pool.attach(helpers.ports);},stopPool(){return helpers&&helpers.stop();},taskTimeoutMs:60000});
  const {N,W,Final}=C.geometry;
  // Polygon-clipping assigns global monotonic segment IDs in error strings;
  // those IDs and elapsed-time diagnostics are not geometry or fidelity.
  const view=row=>({cells:row.cells,vertices:row.vertices,baseCut:row.baseCut,interpretedMaterial:row.interpretedMaterial,validation:row.validation,contourTolerance:row.contourTolerance,attemptTolerances:row.attempts?.map(attempt=>attempt.tolerance)});
  function check(row){
    const union=W.union(row.cells.map(cell=>W.subject(cell.polygon)));
    assert(W.mpArea(W.pc.difference(union,row.baseCut))<.01);assert(W.mpArea(W.pc.difference(row.baseCut,union))<.01);
    assert(Math.abs(row.cells.reduce((sum,cell)=>sum+N.area(cell.polygon),0)-W.mpArea(union))<.01);
    for(const cell of row.cells){assert(cell.polygon.every(N.finite));assert(N.facetCount(cell.polygon)>=3&&N.facetCount(cell.polygon)<=6);assert(N.contact(cell.polygon,[cell.growthSupport],{insert:false}));}
  }
  try{for(const reference of refs){
    const cache=path.resolve(__dirname,`../../structure-diagnostics/runtime-port/integration/final/analysis-${String(reference).padStart(2,'0')}.bin`),input=require('node:v8').deserialize(fs.readFileSync(cache)),before=structuredClone(input),canonical=C.buildCanonical(input,options);
    const prepared=input.sides.map(side=>C.prepareSide(input,side,canonical.cells,options)),serialStarted=performance.now();
    const serial=input.sides.map(side=>{const {row,raw}=C.sideInput(input,side,canonical.cells,options);return C.fitPrepared(row,raw,options);}),serialNodeMs=performance.now()-serialStarted;
    packets.clear();const started=performance.now(),pooled=await pool.fitCells(input,canonical,options),parallelNodeMs=performance.now()-started;
    assert.deepEqual(input,before,'cell stages preserve primary source buffers');
    for(let i=0;i<serial.length;i++){assert.deepEqual(packets.get(i),prepared[i],`ref ${reference} side ${i}: exact cloned first material target and typed rasters`);assert.deepEqual(view(pooled[i]),view(serial[i]),`ref ${reference} side ${i}: exact prepared/serial cut, facets, supports and fidelity`);check(pooled[i]);}
    const serialMesh=C.assemble(input,serial,options),pooledMesh=C.assemble(input,pooled,options);
    assert.deepEqual(pooledMesh.baseCut,serialMesh.baseCut,`ref ${reference}: actual whole-flake union`);assert.deepEqual(pooledMesh.cells,serialMesh.cells,`ref ${reference}: assembled facets and finite branch support`);
    console.log(JSON.stringify({reference,cellStage:true,exact:true,sides:pooled.length,components:pooledMesh.baseCut.length,holes:Final.holes(pooledMesh.baseCut),cells:pooledMesh.cells.length,parallelStats:pooled.parallelStats,serialNodeMs:Math.round(serialNodeMs),parallelNodeMs:Math.round(parallelNodeMs)}));
  }}finally{await pool.dispose();}
}
(async()=>{await unit();await cellUnit();await actual();await actualCells();})().catch(error=>{console.error(error);process.exitCode=1;});
