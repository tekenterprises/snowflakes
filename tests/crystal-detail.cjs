// Uses the same normalized reference fixtures as tests/shared-mesh.cjs.
const assert=require('node:assert/strict'),fs=require('fs'),B=require('../dist/branch-structure'),I=require('../dist/image-crystal');
for(const [ref,formerMaximum] of [[2,385],[3,37],[6,889]]){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${ref}.rgba`)),model=B.extract(pixels,768);
 const middle=I.fit(pixels,768,100,false,50,0,model),fine=I.fit(pixels,768,100,false,100,0,model);
 assert.equal(middle.pieces.length,formerMaximum,'50% retains the v26 maximum layout');
 assert(fine.pieces.length>middle.pieces.length,'upper range retains more measured features');
 assert(fine.match>middle.match,'extra facets improve image-mask agreement, not only face count');
 assert.deepEqual(fine.tree,middle.tree,'extra polygon detail must not invent more branches');
 console.log(`Reference ${ref}: ${middle.pieces.length} → ${fine.pieces.length} cells; image overlap ${(100*middle.match).toFixed(1)}% → ${(100*fine.match).toFixed(1)}%.`);
}
