const assert=require('node:assert/strict'),R=require('../dist/branch-regions.js'),P=require('../dist/polygon-fit.js'),C=require('../dist/crystal.js');
// One branch with two broad lobes and a narrow waist. A single convex polygon
// fills the valley; connected pieces must preserve it without dropping the axis.
const profile=Array.from({length:129},(_,k)=>{const u=k/128,w=2+12*Math.max(0,1-Math.abs(u-.25)/.2,1-Math.abs(u-.75)/.2);return [-w,w]});
const high=R.pieces([[20,50],[120,50]],profile,100,100),low=R.pieces([[20,50],[120,50]],profile,0,100);
assert(high.length>1);assert(high.length>=low.length);assert(high.every(p=>p.polygon.length>=3&&p.polygon.length<=6&&P.area(p.polygon)>0));
const mask=C.raster(high.map(p=>p.polygon),150);assert(mask[50*150+70]);assert(!mask[58*150+70],'waist must not borrow width from neighboring lobes');assert(mask[58*150+45]);assert(mask[58*150+95]);
for(let x=21;x<120;x++)assert(mask[50*150+x],'shared piece joins retain the entire branch');
// Foreground ownership must not jump across white gaps to a nearby stem.
const n=64,target=new Uint8Array(n*n);for(let y=5;y<=58;y++)for(let x=0;x<n;x++)if(Math.abs(x-20)<=4||Math.abs(x-33)<=4)target[y*n+x]=1;
const tree=[20,33].map((x,id)=>({id,start:[x,5],end:[x,58]})),m=R.measure({n,target,tree});
assert.equal(m.owner[30*n+20],0);assert.equal(m.owner[30*n+33],1);assert.equal(m.owner[30*n+27],-1);for(const p of m.profiles)assert(p.every(v=>v[0]>=-4.75&&v[1]<=4.75));
console.log('Image ownership, narrow waists, shared joins, detail and 3–6-side piece limits passed.');
