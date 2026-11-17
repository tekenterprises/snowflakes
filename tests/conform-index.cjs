const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
global.earcut=require('../dist/vendor/earcut.min.js');global.polygonClipping=require('../dist/vendor/polygon-clipping.min.js');require('../dist/engine.js');
const {N}=require('../dist/reconstruction-partition.js');

// Original linear implementation: this is the ordering/coordinate oracle,
// independent of the indexed candidate selection in the production code.
function original(input){
 const {distance,DISTANCE_TOLERANCE,cleanSpurs,onSegment,facetCount}=N,vertices=[];
 const add=p=>{let id=vertices.findIndex(q=>distance(p,q)<=DISTANCE_TOLERANCE);if(id<0){id=vertices.length;vertices.push(p.slice())}return id};
 let cells=input.map(c=>({...c,polygon:cleanSpurs(c.polygon).map(p=>vertices[add(p)])}));
 cells=cells.map(c=>{const ids=[];for(let i=0;i<c.polygon.length;i++){const a=c.polygon[i],b=c.polygon[(i+1)%c.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;ids.push(add(a));const middle=vertices.map((p,id)=>({p,id,t:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length})).filter(v=>v.t>DISTANCE_TOLERANCE&&v.t<length-DISTANCE_TOLERANCE&&onSegment(v.p,a,b)).sort((a,b)=>a.t-b.t);ids.push(...middle.map(v=>v.id))}const unique=ids.filter((id,i)=>id!==ids[(i+ids.length-1)%ids.length]);const polygon=cleanSpurs(unique.map(id=>vertices[id]));return {...c,polygon,vertices:polygon.map(add),facetCount:facetCount(polygon)}});
 return {cells,vertices};
}
const cell=(polygon,id=0)=>({polygon,id,kind:'test',growthSupport:{identity:'unchanged',segment:[[0,0],[10,0]]}});
function compare(label,input){const before=structuredClone(input),expected=original(input),actual=N.conform(input);assert.deepEqual(actual,expected,label);assert.deepEqual(input,before,label+' preserves inputs');return actual;}
const T=N.DISTANCE_TOLERANCE;
// These points are both eligible for the later point; the first ID wins even
// though its bucket is visited later, and even when it is farther away.
for(const x of [0,T,-T,128,1e8])for(const sign of [-1,1])for(const offset of [.4,.9]){
 const points=[[x+sign*.9*T,0],[x-sign*offset*T,0],[x,0]];
 const result=compare('first insertion wins '+x+':'+sign+':'+offset,points.map((p,i)=>cell([p,[10+i,10],[10+i,20]],i)));
 assert.equal(result.cells[2].vertices[0],result.cells[0].vertices[0]);
}
for(const origin of [0,-10*T,1000])for(const d of [-Number.EPSILON,0,Number.EPSILON]){
 compare('bucket borders '+origin+':'+d,[cell([[origin+T+d,0],[origin+5*T,0],[origin+5*T,5*T]]),cell([[origin+d,0],[origin+2*T,2*T],[origin-2*T,2*T]],1)]);
}
compare('projection ties and narrow cavities',[
 cell([[0,0],[10,0],[10,10],[0,10]]),cell([[5,T],[6,5],[5,-T]],1),
 cell([[5,-T],[4,5],[5,T]],2),cell([[2,0],[8,0],[8,2*T],[2,2*T]],3),
 cell([[0,0],[3,0],[3,2],[3,0],[10,0],[10,10]],4)
]);
compare('signed zero and degenerate edges',[cell([[-0,0],[0,-0],[1,0],[1,1],[-0,0]])]);
for(const size of [1e9,1e15,1e100,Number.MAX_VALUE/8])compare('sparse huge '+size,[cell([[0,0],[size,0],[size,size]]),cell([[size/2,0],[size/2,10],[0,10]],1),cell([[-size,-size],[-size,0],[0,-size]],2)]);
for(const bad of [NaN,Infinity,-Infinity]){
 const input=[cell([[0,0],[1,0],[bad,1]])];
 let expected,actual,error;try{expected=original(input)}catch(e){error=e}
 if(error)assert.throws(()=>N.conform(input),{message:error.message});else{actual=N.conform(input);assert.deepEqual(actual,expected,'non-finite input retains original behavior')}
}
let state=0x1749a2;
const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
for(let trial=0;trial<80;trial++){
 const input=[];
 for(let i=0;i<35;i++){const x=Math.floor(random()*12),y=Math.floor(random()*12),j=()=>random()<.5?0:(random()-.5)*T*2;input.push(cell([[x+j(),y+j()],[x+1+j(),y+j()],[x+1+j(),y+1+j()],[x+j(),y+1+j()]],i));}
 compare('seeded tolerance grid '+trial,input);
}
console.log('Indexed conformance exactly matches original IDs, coordinates, facets and order on adversarial and seeded inputs.');

// Saved real cell inputs are regression evidence only. Replaying them avoids
// timed partition searches changing the operation under comparison.
if(process.argv.includes('--references')){
 const directory=process.env.CONFORM_REFERENCE_DIR||path.resolve(__dirname,'../../structure-diagnostics/runtime-port');
 const results=[];
 for(let ref=1;ref<=20;ref++){
  const file=path.join(directory,'ref-'+String(ref).padStart(2,'0')+'-fresh.json'),saved=JSON.parse(fs.readFileSync(file)),input=saved.cells;
  assert(Array.isArray(input)&&input.length,'saved real cells: '+file);
  const start=performance.now(),expected=original(input),baselineMs=performance.now()-start,then=performance.now(),actual=N.conform(input),indexedMs=performance.now()-then;
  assert.deepEqual(actual,expected,'saved reference '+ref);
  const row={ref,cells:input.length,vertices:actual.vertices.length,baselineMs,indexedMs,speedup:baselineMs/indexedMs};results.push(row);console.log(JSON.stringify(row));
 }
 if(process.env.CONFORM_RESULTS)fs.writeFileSync(process.env.CONFORM_RESULTS,JSON.stringify(results,null,2));
}
if(process.argv.includes('--benchmark')){
 const file=path.resolve(process.env.CONFORM_BENCHMARK||path.join(__dirname,'../../structure-diagnostics/runtime-port/ref-06-fresh.json')),input=JSON.parse(fs.readFileSync(file)).cells;
 // Warm both functions, then run sequential baseline/candidate pairs.
 original(input);N.conform(input);
 for(let run=1;run<=3;run++){const start=performance.now(),expected=original(input),baselineMs=performance.now()-start,then=performance.now(),actual=N.conform(input),indexedMs=performance.now()-then;assert.deepEqual(actual,expected);console.log(JSON.stringify({run,cells:input.length,baselineMs,indexedMs,speedup:baselineMs/indexedMs}));}
}
