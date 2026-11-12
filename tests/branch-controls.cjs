const assert=require('node:assert/strict'),fs=require('fs'),I=require('../dist/image-crystal.js'),C=require('../dist/crystal.js');
const pixels=new Uint8Array(fs.readFileSync('/tmp/image-model-2.rgba'));
const low=I.fit(pixels,768,100,false,0,0),high=I.fit(pixels,768,100,false,100,0),symmetric=I.fit(pixels,768,100,false,100,100),middle=I.fit(pixels,768,100,false,100,50);
assert(high.polygons.length>low.polygons.length*3,'detail must add smaller polygons at max crystal strength');assert(high.match>low.match);assert(high.branches.length>low.branches.length);assert(symmetric.tree.length>=high.tree.length*.6,'full symmetry must retain matched fern branches, not collapse to six stems');assert.notDeepEqual(high.loops,middle.loops);assert.notDeepEqual(middle.loops,symmetric.loops);
// Compare actual coordinates, not rounded strings: values exactly halfway
// between decimals can round differently after an equivalent rotation.
for(const p of symmetric.polygons){const rotated=p.map(([x,y])=>[384+(x-384)*.5-(y-384)*Math.sqrt(3)/2,384+(x-384)*Math.sqrt(3)/2+(y-384)*.5]);assert(symmetric.polygons.some(q=>q.length===p.length&&rotated.every(a=>q.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7))),'every structural polygon must have a 60-degree counterpart')}

for(const r of [low,high,middle,symmetric])assert.equal(r.loops.filter(p=>C.area(p)>0).length,1,'cut union stays connected');
console.log('Detail 0 → 100:',low.polygons.length,'→',high.polygons.length,'polygons. Full symmetry verified on every polygon; intermediate symmetry changes shape.');
