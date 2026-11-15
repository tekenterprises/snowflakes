// Execute the actual classic worker in an isolated Node worker thread. This
// checks imports, structured-clone results, retained input and fallback parity;
// it is not a browser interaction or a browser timing measurement.
const assert=require('node:assert/strict'),path=require('node:path'),{Worker}=require('node:worker_threads'),Pipeline=require('../dist/geometry-pipeline');
const dist=path.resolve(__dirname,'../dist'),worker=new Worker(`
const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope=vm.createContext({console,navigator:{userAgent:'Node worker test'}});scope.self=scope;scope.postMessage=value=>parentPort.postMessage(value);scope.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(workerData,file),'utf8'),scope,{filename:file}));scope.importScripts('geometry-worker.js');parentPort.on('message',data=>scope.onmessage({data}));
`,{eval:true,workerData:dist});
let id=0;function ask(request){return new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:++id,request})})}
async function main(){try{
 const size=64,pixels=new Uint8ClampedArray(size*size*4).fill(255);for(let y=8;y<56;y++)for(let x=12;x<52;x++)if(!(x>24&&x<36&&y>24&&y<36)){const i=4*(y*size+x);pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 const source={key:'synthetic-ring',size,pixels},options={threshold:230,invert:false,detail:100,symmetry:0,crystal:0,fill:false,islands:true,gaps:0,offset:0,round:0,size:100,hanger:false},pipeline=Pipeline.create();
 for(const patch of [{},{offset:.2},{fill:true},{invert:true}]){const o={...options,...patch},request={options:o,...(id===0?{source}:{})},reply=await ask(request);assert(!reply.error,reply.error);assert.deepEqual(reply.result,pipeline.process({source,options:o}),'worker and synchronous pipeline must agree');}
 const n=192,flake=new Uint8ClampedArray(n*n*4).fill(255);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let inside=false;for(let arm=0;arm<6;arm++){const a=arm*Math.PI/3,u=(x-n/2)*Math.cos(a)+(y-n/2)*Math.sin(a),v=-(x-n/2)*Math.sin(a)+(y-n/2)*Math.cos(a);if(u>=0&&u<74&&Math.abs(v)<5)inside=true;}if(inside){const i=4*(y*n+x);flake[i]=flake[i+1]=flake[i+2]=0;}}
 const crystalSource={key:'six-arm-generated',size:n,pixels:flake},crystalOptions={...options,crystal:100,crystalPreview:true};
 const crystal=await ask({source:crystalSource,options:crystalOptions});assert(!crystal.error,crystal.error);assert(crystal.result.previewPolygons.length,'worker builds real crystal cells');assert.deepEqual(crystal.result,pipeline.process({source:crystalSource,options:crystalOptions}),'crystal geometry survives actual worker imports and structured clone');
 const invalid=await ask({source:{key:'bad',size:2,pixels:new Uint8Array(1)},options});assert.match(invalid.error,/dimensions/);
 console.log('Actual worker imports and retained-input processing match the fallback, including holes, Fill, offset, inversion and errors.');
 }finally{await worker.terminate()}}
main().catch(error=>{console.error(error);process.exitCode=1});
