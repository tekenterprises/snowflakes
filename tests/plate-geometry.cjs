const assert=require('node:assert/strict'),fs=require('fs'),B=require('../dist/branch-structure.js'),I=require('../dist/image-crystal.js'),P=require('../dist/shared-polygons.js'),C=require('../dist/crystal.js');
// Pixel chatter on a broad, otherwise simple hexagonal plate must not become
// dozens of facets. A genuine waist still needs separate connected pieces.
function records(waist=false){return Array.from({length:6},(_,id)=>({id,length:120,values:Array.from({length:129},(_,k)=>{let w=k<32?8+k*.7:k<96?30.4:30.4-(k-96)*.9;if(waist&&k>52&&k<76)w=10;const noise=.3*Math.sin(k*7+id);return [-w+noise,w+noise]})}));}
const simple=P.schedule(records(),100,true),waisted=P.schedule(records(true),100,true);
assert(simple.length<=3,`simple plate has ${simple.length} pieces`);assert(waisted.length>simple.length,'preserve the real waist');
for(const p of [...simple,...waisted])assert(p.polygons.every(q=>q.length>=3&&q.length<=6));
console.log(`Synthetic plates: ${simple.length} simple pieces; ${waisted.length} with a real waist.`);
if(process.argv.includes('--images'))for(const ref of [3,9]){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/image-model-${ref}.rgba`)),model=B.extract(pixels,768),fine=I.fit(pixels,768,100,false,100,0,model),symmetric=I.fit(pixels,768,100,false,100,100,model),coarse=I.fit(pixels,768,100,false,0,0,model);
 assert(fine.pieces.length<=100,`plate ${ref}: excessive subdivision`);assert(fine.pieces.length>coarse.pieces.length,'detail still changes the fit');assert.equal(fine.pieces.length,symmetric.pieces.length);
 assert.equal(fine.loops.filter(p=>C.area(p)>0).length,1,'one connected plate');
 // Compare to the image-measured profile, not the fitter itself.
 const mask=fine.alignedTrace();let intersection=0,union=0;
 for(let i=0;i<mask.length;i++){intersection+=mask[i]&&fine.mask[i]?1:0;union+=mask[i]||fine.mask[i]?1:0;}
 assert(intersection/union>.93,`plate ${ref}: outline overlap ${intersection/union}`);
 console.log(`Reference ${ref}: ${fine.pieces.length} polygons, ${Math.round(intersection/union*100)}% overlap with measured profile; detail and symmetry verified.`);
}
