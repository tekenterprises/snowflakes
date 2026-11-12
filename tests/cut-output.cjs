const assert=require('node:assert/strict'),fs=require('fs'),O=require('../dist/cut-output.js'),C=require('../dist/crystal.js'),F=require('../dist/engine.js'),I=require('../dist/image-crystal.js'),B=require('../dist/branch-structure.js');
const square=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]],shell=square(4.1234,4.5678,55,55),hole=square(15,15,45,45).reverse(),island=square(22,22,28,28),tiny=square(8.1,8.1,8.3,8.3).reverse(),separate=square(58,58,63,63),loops=[shell,hole,island,tiny,separate];
const defaults={crystal:100,detail:100,symmetry:0,offset:0,round:0,size:100,fill:true,islands:true};
const fitted={loops,mask:C.raster(loops,64),axis:0,branches:[],polygons:[]};
for(const fill of [false,true])for(const islands of [false,true]){
 const r=O.process(fitted.mask,64,{...defaults,fill,islands},fitted),positive=r.loops.filter(p=>C.area(p)>0),negative=r.loops.filter(p=>C.area(p)<0);
 assert.equal(positive.length,islands?1:fill?2:3);assert.equal(negative.length,fill?0:2);assert.equal(r.components,positive.length);
 assert(r.loops.some(p=>p.some(v=>Math.abs(v[0]-4.1234)<1e-6&&Math.abs(v[1]-4.5678)<1e-6)),'preserve exact nonpixel exterior vertices');
 const svgPath=F.path(r.loops);assert.equal((svgPath.match(/Z/g)||[]).length,r.loops.length,'export uses exactly the cleaned boundaries');
}
assert.deepEqual(O.clean([],true,true).loops,[]);
for(const adjusted of [false,true]){const o={...defaults,offset:adjusted?.3:0,round:adjusted?.2:0};const r=O.process(fitted.mask,64,o,fitted);assert.equal(r.loops.length,1)}
let reproduced=0;
for(let i=1;i<=10;i++){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${i}.rgba`)),model=B.extract(pixels,768);
 for(const symmetry of [0,100])for(const strength of [50,100]){
  const fitted=I.fit(pixels,768,strength,false,100,symmetry,model);
  reproduced+=fitted.loops.filter(p=>C.area(p)<0).length;
  for(const adjusted of [false,true]){const o={...defaults,crystal:strength,symmetry,offset:adjusted?.2:0,round:adjusted?.1:0},r=O.process(fitted.mask,768,o,fitted);assert.equal(r.loops.length,1,`reference ${i}, symmetry ${symmetry}, strength ${strength}, adjusted ${adjusted}: fill must leave exactly one exterior`);assert(C.area(r.loops[0])>0);assert.equal(r.components,1)}
 }
 console.log(`Reference ${i}: no interior cut paths with fill enabled, at partial/full geometry, faithful/symmetric and adjusted settings.`);
}
assert(reproduced>0,'fixtures must reproduce raw polygon holes');console.log(`Reproduced ${reproduced} raw hole paths; all removed by final cut settings. Tiny subpixel holes, nested islands, fill-off and largest-piece controls also passed.`);
