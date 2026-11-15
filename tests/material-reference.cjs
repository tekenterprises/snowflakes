const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../dist/image-evidence'),I=require('../dist/image-crystal'),O=require('../dist/cut-output'),C=require('../dist/crystal');
const n=768,pixels=new Uint8Array(fs.readFileSync('/tmp/image-model-19.rgba')),e=E.analyze(pixels,n,false,230),large=e.accepted.filter(g=>g.area>500&&g.votes>=3);
assert(large.length>=6,'photograph contains recurring substantial voids');
for(const symmetry of [0,100]){
 const fitted=I.fit(pixels,n,100,false,100,symmetry,null,230),options={crystal:100,detail:100,symmetry,offset:0,round:0,gaps:0,size:100,islands:true},open=O.process(e.raw,n,{...options,fill:false},fitted),filled=O.process(e.raw,n,{...options,fill:true},fitted);
 assert.equal(open.components,1);assert(filled.loops.length>=7,'fill retains six supported structural cavities');assert.equal(filled.structuralVoids,6);assert(open.loops.length>=7,'recurring voids survive final cut cleanup');
 const voids=symmetry?e.consensus:e.holes;let observed=0,preserved=0,restored=0;for(let i=0;i<voids.length;i++)if(voids[i]){observed++;preserved+=!open.mask[i];restored+=filled.mask[i];}
 assert(preserved/observed>.95,'supported void area remains empty');assert(restored/observed<.3,'fill retains the large structural family');
 assert(open.crystalMaterial.length>=filled.crystalMaterial.length,'guides follow the selected void policy');
 const hanger=O.process(e.raw,n,{...options,fill:true,hanger:true,holeDiameter:3,holeRim:1.5,holeNeck:1},fitted);assert.equal(hanger.loops.length,filled.loops.length+1,'hanger adds one opening while structural voids survive filling');
 console.log(`Reference 19 symmetry ${symmetry}: ${(100*preserved/observed).toFixed(1)}% supported void area retained; fill and hanger pass.`);
}
for(const ref of [18,19]){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${ref}.rgba`)),e=E.analyze(pixels,n,false,230),fitted=I.fit(pixels,n,100,false,100,0,null,230),out=O.process(e.raw,n,{crystal:100,detail:100,symmetry:0,offset:0,round:0,gaps:0,size:100,islands:true,fill:false},fitted);
 const target=C.raster([...require('../dist/engine').contours(e.filled,n,0),...require('../dist/engine').contours(e.holes,n,0)],n);
 let total=0,missing=0,added=0;for(let i=0;i<target.length;i++){total+=target[i];missing+=target[i]&&!out.mask[i]?1:0;added+=out.mask[i]&&!target[i]?1:0;}
 assert((missing+added)/total<.02,`reference ${ref}: small two-sided fitting error`);
 assert(Math.abs(added-missing)/total<.005,`reference ${ref}: no systematic expansion or contraction`);
 console.log(`Reference ${ref}: two-sided error ${(100*(missing+added)/total).toFixed(2)}%, net area bias ${(100*(added-missing)/total).toFixed(2)}%.`);
}
