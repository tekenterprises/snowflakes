const assert=require('node:assert/strict'),Cells=require('../dist/cavity-cells'),C=require('../dist/crystal');
const square=[[0,0],[20,0],[20,20],[0,20]],hole=[[8,8],[12,8],[12,12],[8,12]];
const piece={pieceSlotId:'branch:0',sideCount:4,polygon:square};
const solid=Cells.build([square],[],[piece],[square]);assert.strictEqual(solid.polygons[0],square);assert.equal(solid.pieces[0].pieceSlotId,piece.pieceSlotId);
const carved=Cells.build([square],[hole],[piece],[square]);
assert(Math.abs(carved.polygons.reduce((s,p)=>s+C.area(p),0)-384)<1e-6);
assert(Math.abs(carved.loops.reduce((s,p)=>s+C.area(p),0)-384)<1e-6);
assert(carved.polygons.every(p=>p.length>=3&&p.length<=6&&C.area(p)>0));
assert(carved.pieces.every(p=>p.cavity&&p.parentPieceSlotId==='branch:0'));
const cells=C.raster(carved.polygons,24),cut=C.raster(carved.loops,24);assert.deepEqual(cells,cut);assert.equal(cut[10*24+10],0);
const two=[[[0,0],[10,0],[10,20],[0,20]],[[10,0],[20,0],[20,20],[10,20]]];
const shared=Cells.build(two,[hole],[],two);assert.deepEqual(C.raster(shared.polygons,24),C.raster(shared.loops,24));
// A source-supported repair can use fewer cells than its original scaffold.
// Keep inexpensive merging, but do not retessellate merely to hit that smaller
// incidental count when the original complexity budget is already satisfied.
const owned=two.map((polygon,i)=>({polygon,slotId:0,branchId:0,pieceSlotId:'patch:'+i,arm:0,mirror:false})),tight=Cells.build(two,[hole],owned,two,{size:20}),originalBudget=Cells.build(two,[hole],owned,two,{size:20,baselineCellCount:20});
assert.equal(tight.targetCellCount,2,'default budget remains relative to input cells');
assert.equal(originalBudget.targetCellCount,22,'original scaffold retains its ten-percent allowance');
assert.equal(originalBudget.compactCellTarget,2,'cheap merging still targets the smaller partition');
assert.equal(originalBudget.compactedCells,tight.compactedCells,'cheap coordinated merging is retained');
assert(originalBudget.compactedCells>0,'fixture exercises cheap merging');
assert(tight.retessellatedPatches>0&&originalBudget.retessellatedPatches===0,'only unnecessary expensive retessellation is skipped');
assert(originalBudget.cellBudgetReached);
assert.deepEqual(C.raster(originalBudget.loops,24),C.raster(tight.loops,24),'budget changes preserve actual material');
assert(Math.abs(originalBudget.polygons.reduce((s,p)=>s+C.area(p),0)-originalBudget.loops.reduce((s,p)=>s+C.area(p),0))<1e-6,'budgeted cells still own the actual union');
const frame=[[[0,0],[20,0],[20,8],[0,8]],[[0,12],[20,12],[20,20],[0,20]],[[0,8],[8,8],[8,12],[0,12]],[[12,8],[20,8],[20,12],[12,12]]];
const repaired=Cells.build(frame,[],[],frame);assert(Math.abs(repaired.polygons.reduce((s,p)=>s+C.area(p),0)-400)<1e-6,'unsupported scaffold gap filled with cells');
const hex=(radius)=>Array.from({length:6},(_,i)=>[20+radius*Math.cos(i*Math.PI/3),20+radius*Math.sin(i*Math.PI/3)]),core=hex(15),cavity=hex(3);
const symmetric=Cells.build([core],[cavity],[{kind:'core',pieceSlotId:'core',polygon:core,sideCount:6}],[core],{symmetric:true,size:40,axis:0});
const rotate=p=>p.map(([x,y])=>[20+(x-20)*.5-(y-20)*Math.sqrt(3)/2,20+(x-20)*Math.sqrt(3)/2+(y-20)*.5]);
for(const p of symmetric.polygons){const q=rotate(p);assert(symmetric.polygons.some(r=>r.length===q.length&&q.every(a=>r.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5))),'cavity cells preserve full rotational symmetry');}
assert(!require('node:fs').readFileSync('dist/app.js','utf8').includes('clipPath id="crystal-material"'));
console.log('Cavities are actual 3–6-sided cells, with preserved parent roles and a matching cut perimeter.');
