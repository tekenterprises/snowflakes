const assert=require('node:assert/strict');
const O=require('../dist/cut-output'),F=require('../dist/engine'),Voids=require('../dist/structural-voids'),C=require('../dist/crystal');
const mask=new Uint8Array(64*64);for(let y=8;y<56;y++)for(let x=8;x<56;x++)mask[y*64+x]=1;
const loops=[[[8,8],[56,8],[56,56],[8,56]]],fitted={loops,mask:C.raster(loops,64),axis:0,branches:[],polygons:[],material(fill){return fill?loops:loops}};
const options={crystal:100,detail:70,symmetry:0,offset:0,round:0,size:100,fill:true,islands:true,gaps:0,hanger:false,holeDiameter:4,holeRim:1,holeNeck:1};
let analyses=0,blends=0,contours=0;
const analyze=Voids.analyze,blend=Voids.blend,findContours=F.contours;
Voids.analyze=(raw,size)=>{analyses++;return {mask:new Uint8Array(raw.length),consensus:new Uint8Array(raw.length),count:1}};
Voids.blend=(e,size,symmetry)=>{blends++;return e.mask};
F.contours=(...a)=>{contours++;return findContours(...a)};
try{
 const first=O.process(mask,64,options,fitted),counts=[analyses,blends,contours];
 const again=O.process(mask,64,options,fitted);
 assert.deepEqual(again,first,'unchanged repeated processing stays exact');
 assert.deepEqual([analyses,blends,contours],counts,'warm identical request reuses structural and fitted work');
 O.process(mask,64,{...options,offset:.2},fitted);
 O.process(mask,64,{...options,hanger:true},fitted);
 assert.deepEqual([analyses,blends,contours],counts,'manufacturing controls reuse evidence and fitted cavities');
 O.process(mask,64,{...options,detail:71},fitted);
 assert.equal(analyses,counts[0]);assert.equal(blends,counts[1]);assert(contours>counts[2],'detail changes refit cavity contours');
 O.process(mask,64,{...options,symmetry:50},fitted);
 assert.equal(analyses,counts[0]);assert.equal(blends,counts[1]+1,'symmetry change blends cached classification anew');
 const unfilled=O.process(mask,64,{...options,fill:false},fitted);
 assert.equal(analyses,counts[0],'fill-off skips structural work');
 assert.notDeepEqual(unfilled,first,'fill policy is not served from the fill-on fitted cache');
}finally{Voids.analyze=analyze;Voids.blend=blend;F.contours=findContours;}
console.log('Cut output caches structural evidence and fitted cavities across manufacturing-only changes, with setting-dependent invalidation.');
