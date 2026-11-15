const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../dist/image-evidence'),I=require('../dist/image-crystal'),O=require('../dist/cut-output'),C=require('../dist/crystal');
const n=768,pixels=new Uint8Array(fs.readFileSync('/tmp/image-model-19.rgba')),e=E.analyze(pixels,n,false,230),large=e.accepted.filter(g=>g.area>500&&g.votes>=3);
assert(large.length>=6,'photograph contains recurring substantial voids');
for(const symmetry of [0,100]){
 const fitted=I.fit(pixels,n,100,false,100,symmetry,null,230),options={crystal:100,detail:100,symmetry,offset:0,round:0,gaps:0,size:100,islands:true},open=O.process(e.raw,n,{...options,fill:false},fitted),filled=O.process(e.raw,n,{...options,fill:true},fitted);
 assert.equal(open.components,1);assert.equal(filled.loops.length,1);assert(open.loops.length>=7,'recurring voids survive final cut cleanup');
 const voids=symmetry?e.consensus:e.holes;let observed=0,preserved=0,restored=0;for(let i=0;i<voids.length;i++)if(voids[i]){observed++;preserved+=!open.mask[i];restored+=filled.mask[i];}
 assert(preserved/observed>.95,'supported void area remains empty');assert(restored/observed>.85,'fill control restores void material');
 assert(open.crystalMaterial.length>filled.crystalMaterial.length,'guides follow the selected void policy');
 const hanger=O.process(e.raw,n,{...options,fill:true,hanger:true,holeDiameter:3,holeRim:1.5,holeNeck:1},fitted);assert.equal(hanger.loops.length,2,'intentional hanger survives filling');
 console.log(`Reference 19 symmetry ${symmetry}: ${(100*preserved/observed).toFixed(1)}% supported void area retained; fill and hanger pass.`);
}
