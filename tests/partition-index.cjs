const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {performance}=require('node:perf_hooks');
global.earcut=require('../dist/vendor/earcut.min.js');global.polygonClipping=require('../dist/vendor/polygon-clipping.min.js');require('../dist/engine.js');
const production=require('../dist/reconstruction-partition.js'),{W}=production;

// Frozen predicates from before broad-phase indexing. Compile these into the
// current module to compare complete W.run output without timed partitioning.
function weldPolygons(polygons){
 const WELD_TOLERANCE=3e-5,points=[];
 for(const p of polygons)for(const a of p)if(!points.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<=WELD_TOLERANCE))points.push(a.slice());
 const canonical=a=>points.find(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<=WELD_TOLERANCE);
 const rings=polygons.map(p=>p.map(canonical));
 return rings.map(p=>{const result=[];for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<=WELD_TOLERANCE**2)continue;
  const middle=points.map(q=>({q,t:((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2})).filter(({q,t})=>t>WELD_TOLERANCE/Math.sqrt(l2)&&t<1-WELD_TOLERANCE/Math.sqrt(l2)&&Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)<=WELD_TOLERANCE*Math.sqrt(l2)).sort((a,b)=>a.t-b.t);
  result.push(a,...middle.map(x=>x.q));
 }return result.filter((a,i,all)=>!i||a!==all[i-1])});
}
function adjacent(a,b){for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length],dx=q[0]-p[0],dy=q[1]-p[1],l2=dx*dx+dy*dy;if(l2<1e-12)continue;
 for(let j=0;j<b.length;j++){const r=b[j],s=b[(j+1)%b.length];if(Math.abs((r[0]-p[0])*dy-(r[1]-p[1])*dx)>1e-5*Math.sqrt(l2)||Math.abs((s[0]-p[0])*dy-(s[1]-p[1])*dx)>1e-5*Math.sqrt(l2))continue;
 const t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/l2,u=((s[0]-p[0])*dx+(s[1]-p[1])*dy)/l2;if(Math.min(1,Math.max(t,u))-Math.max(0,Math.min(t,u))>1e-7)return true;
 }}return false}
const file=path.resolve(__dirname,'../dist/reconstruction-partition.js');let source=fs.readFileSync(file,'utf8');
source=source.slice(0,source.indexOf('function weldPolygons('))+weldPolygons.toString()+'\n'+source.slice(source.indexOf('const snap='));
source=source.slice(0,source.indexOf('function adjacent('))+adjacent.toString()+'\n'+source.slice(source.indexOf('function touches('));
// Isolate the clipping library's monotonically increasing diagnostic IDs so
// equal pre-existing numerical failures also have exactly equal messages.
const vendor=path.resolve(__dirname,'../dist/vendor/polygon-clipping.min.js'),baselineClip=new Module(vendor,module);baselineClip._compile(fs.readFileSync(vendor,'utf8'),vendor);
const productionClip=global.polygonClipping;global.polygonClipping=baselineClip.exports;
const baselineModule=new Module(file,module);baselineModule.filename=file;baselineModule.paths=module.paths;baselineModule._compile(source,file);const original=baselineModule.exports.W;global.ReconstructionPartition=production;global.polygonClipping=productionClip;

const T=3e-5,rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const input=[rect(0,0,10,10),[[5,T],[5,-T],[6,2]],[[3,0],[4,0],[4,2]],rect(0,10,10,3)];
for(let i=0;i<50;i++)input.push(rect(20+(i%10)*3,Math.floor(i/10)*3,2,2));
assert.deepEqual(W.weldPolygons(input),weldPolygons(input),'large weld: ties, narrow gaps and shared vertices');
for(const scale of [1,1e8,1e15,1e100]){
 const polygons=input.map(p=>p.map(q=>[q[0]*scale,q[1]*scale]));
 assert.deepEqual(W.weldPolygons(polygons),weldPolygons(polygons),'weld at sparse/extreme scale '+scale);
}
for(const offset of [-2e-5,-1e-5,0,1e-5,2e-5,1e6])for(const scale of [1,1e6,1e15]){
 const a=rect(0,0,scale,scale),b=rect(scale+offset,0,scale,scale);
 assert.equal(W.adjacent(a,b),adjacent(a,b),'adjacency tolerance '+offset+':'+scale);
 assert.equal(W.adjacent(b,a),adjacent(b,a),'directed adjacency '+offset+':'+scale);
}
let seed=982753;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<1000;i++){
 const a=rect(Math.floor(random()*10),Math.floor(random()*10),random()*4,random()*4),b=rect(Math.floor(random()*10),Math.floor(random()*10),random()*4,random()*4);
 assert.equal(W.adjacent(a,b),adjacent(a,b),'seeded adjacency '+i);
}
console.log('Weld and finite-edge adjacency preserve exact original predicates and order.');

if(process.argv.includes('--references')||process.argv.includes('--benchmark')){
 const directory=process.env.PARTITION_REFERENCE_DIR||path.resolve(__dirname,'../../structure-diagnostics/master-side-prototype/full-crystals-v4'),refs=process.env.PARTITION_REFS?process.env.PARTITION_REFS.split(',').map(Number):process.argv.includes('--references')?Array.from({length:20},(_,i)=>i+1):[6],results=[];
 for(const ref of refs){
  const stem=path.join(directory,'ref-'+String(ref*100).padStart(4,'0')+'-'),row=JSON.parse(fs.readFileSync(stem+'input.json')),raw=new Uint8Array(fs.readFileSync(stem+'material.bin'));
  const runs=process.argv.includes('--benchmark')?4:1;
  for(let run=0;run<runs;run++){
   let start=performance.now(),a,baselineError;try{a=original.run(structuredClone(row),raw,1.6,{coarse:true,hardSeeds:true})}catch(e){baselineError=e.message}const baselineMs=performance.now()-start;
   start=performance.now();let b,candidateError;try{b=W.run(structuredClone(row),raw,1.6,{coarse:true,hardSeeds:true})}catch(e){candidateError=e.message}const candidateMs=performance.now()-start;
   assert.equal(candidateError,baselineError,'reference '+ref+' error');if(!baselineError)assert.deepEqual(b,a,'complete exact W.run reference '+ref);
   const result={ref,run,cells:b?.cells.length,baselineMs,candidateMs,speedup:baselineMs/candidateMs,error:candidateError};results.push(result);console.log(JSON.stringify(result));
   if(baselineError){
    // fitPrepared retries at the existing coarse boundary tolerance. Compare
    // the successful retry as well as the identical initial failure.
    const fallbackA=original.run(structuredClone(row),raw,4,{coarse:true,hardSeeds:false}),fallbackB=W.run(structuredClone(row),raw,4,{coarse:true,hardSeeds:false});
    assert.deepEqual(fallbackB,fallbackA,'complete exact fallback W.run reference '+ref);
    result.fallback={tolerance:4,cells:fallbackB.cells.length,exact:true};console.log(JSON.stringify({ref,run,...result.fallback}));
   }
  }
 }
 if(process.env.PARTITION_RESULTS)fs.writeFileSync(process.env.PARTITION_RESULTS,JSON.stringify(results,null,2));
}
