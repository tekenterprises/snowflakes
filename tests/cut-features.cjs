const assert=require('node:assert/strict'),fs=require('fs'),C=require('../dist/crystal.js'),F=require('../dist/engine.js'),Features=require('../dist/cut-features.js'),O=require('../dist/cut-output.js'),I=require('../dist/image-crystal.js');
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]],base=[rect(80,80,160,160),rect(163,80,240,160)];
assert.strictEqual(Features.closeGaps(base,0),base,'zero leaves exact vertices untouched');
assert.equal(Features.closeGaps(base,2).filter(p=>C.area(p)>0).length,2,'narrow setting leaves wider opening');
assert.equal(Features.closeGaps(base,4).filter(p=>C.area(p)>0).length,1,'closes a gap narrower than specified width');
const defaults={crystal:0,symmetry:0,detail:100,offset:0,round:0,fill:true,islands:true,size:100,gaps:0,hanger:false,holeDiameter:3,holeRim:1.5,holeNeck:1};
const mask=C.raster(base,400),closed=O.process(mask,400,{...defaults,gaps:1});assert.equal(closed.components,1);assert(closed.mask[120*400+220],'closing must join fragments before largest-piece selection');
for(const size of [50,100,200])for(const fill of [false,true]){
 const original=[[[200,90],[210,130],[250,320],[150,320],[190,130]]],mask=C.raster(original,400),r=O.process(mask,400,{...defaults,size,fill,hanger:true,gaps:.2});
 assert.equal(r.components,1);assert.equal(r.loops.filter(p=>C.area(p)>0).length,1);const holes=r.loops.filter(p=>C.area(p)<0);assert.equal(holes.length,1,'exactly one intentional opening survives filling and closing');
 const hole=holes[0],xs=hole.map(p=>p[0]),ys=hole.map(p=>p[1]);assert(Math.abs((Math.max(...xs)-Math.min(...xs))*size/400-3)<.001,'3mm opening width');assert(Math.abs((Math.max(...ys)-Math.min(...ys))*size/400-3)<.001,'3mm opening height');const b=O.process(mask,400,{...defaults,size,fill,gaps:.2}),tipY=Math.min(...b.loops.flat().map(p=>p[1]));assert(Math.max(...ys)<tipY,'entire hole must be outside and above the final flake');
 for(let j=0;j<mask.length;j++)if(b.mask[j])assert(r.mask[j],'hanger must not cut into existing flake material');
 assert.equal((F.path(r.loops).match(/Z/g)||[]).length,2,'SVG exports exterior and hanger opening');
}
// Measure the actual cut contour, not the placement metadata. Changing rim
// thickness or hole diameter must not alter the requested tip-to-hole gap.
for(const size of [50,100,200])for(const rim of [.5,3])for(const diameter of [2,6])for(const neck of [0,1,5]){
 const r=Features.hanger([[[200,180],[250,360],[150,360]]],400,size,diameter,rim,neck),holes=r.loops.filter(p=>C.area(p)<0);
 assert.equal(holes.length,1);assert.equal(r.loops.filter(p=>C.area(p)>0).length,1);
 const nearestHoleY=Math.max(...holes[0].map(p=>p[1])),measuredGap=(180-nearestHoleY)*size/400;
 assert(Math.abs(measuredGap-neck)<.0002,`tip-to-hole gap ${measuredGap}mm must equal ${neck}mm regardless of rim ${rim}mm`);
}
console.log('Tip-to-hole neck distance verified across diameter, rim, artboard scale and zero-length settings.');
assert.throws(()=>Features.hanger([rect(100,2,200,200)],400,100,3,1.5,1),/more room/,'do not silently crop the external loop at the artboard edge');
for(const i of [1,2,3,10]){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${i}.rgba`)),raw=Uint8Array.from({length:768*768},(_,j)=>pixels[j*4]<230?1:0),fitted=I.fit(pixels,768,100,false,100,100);
 for(const crystal of [0,100]){const r=O.process(raw,768,{...defaults,crystal,symmetry:100,gaps:.3,hanger:true},fitted);assert.equal(r.components,1);assert.equal(r.loops.filter(p=>C.area(p)<0).length,1,'one top hole, not six mirrored holes');assert.equal(r.loops.filter(p=>C.area(p)>0).length,1);}
 console.log(`Reference ${i}: external hanger connected, one hole retained after gap closing, fill and symmetry.`);
}
console.log('Gap width, fragment joining, physical hole dimensions, external placement, original material preservation, SVG paths and artboard limits passed.');
