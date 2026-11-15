const assert=require('node:assert/strict'),V=require('../dist/structural-voids'),F=require('../dist/engine'),C=require('../dist/crystal'),O=require('../dist/cut-output');
const n=192,c=n/2;
function source(count,angle=0){const centers=Array.from({length:count},(_,k)=>[c+48*Math.cos(angle+k*Math.PI/3),c+48*Math.sin(angle+k*Math.PI/3)]),raw=Uint8Array.from({length:n*n},(_,i)=>{const x=i%n+.5,y=Math.floor(i/n)+.5;return Math.hypot(x-c,y-c)<80&&!centers.some(p=>Math.hypot(x-p[0],y-p[1])<5)&&Math.hypot(x-(c+22),y-(c+15))>4?1:0});return {centers,raw};}
const at=(m,p)=>m[Math.floor(p[1])*n+Math.floor(p[0])];
assert.equal(V.analyze(source(3).raw,n,0).count,0,'three of six is not a majority');
const {raw,centers}=source(4),e=V.analyze(raw,n,0);assert.equal(e.count,4,'four independent arms support structural holes');for(const p of centers)assert(at(e.mask,p));assert(!at(e.mask,[c+22,c+15]),'isolated cavity remains unconfirmed');
const filled=F.fillHoles(raw,n),loops=F.contours(filled,n,0),fitted={axis:0,branches:[],polygons:[],loops,mask:filled,material:fill=>F.contours(fill?filled:raw,n,0)};
for(const crystal of [0,100])for(const symmetry of [0,100]){
 const opts={crystal,symmetry,detail:100,offset:0,round:0,gaps:0,size:100,islands:true,fill:true},out=O.process(raw,n,opts,crystal?fitted:null);
 for(const p of centers)assert(!at(out.mask,p),`structural hole retained, geometry ${crystal}, symmetry ${symmetry}`);
 assert(at(out.mask,[c+22,c+15]),'unconfirmed cavity filled');assert.equal(out.components,1);
 if(!symmetry){assert(at(out.mask,[c+48*Math.cos(4*Math.PI/3),c+48*Math.sin(4*Math.PI/3)]),'faithful mode does not invent a missing void');const open=O.process(raw,n,{...opts,fill:false},crystal?fitted:null);assert(!at(open.mask,[c+22,c+15]),'unchecked keeps unconfirmed hole');}
}
// Bilateral evidence: seven distinct observations distributed over four arms.
const points=[];for(let k=0;k<4;k++)for(const sign of [-1,1])if(!(k===3&&sign===-1)){let a=k*Math.PI/3+sign*.23;points.push([c+48*Math.cos(a),c+48*Math.sin(a)])}
const bilateral=Uint8Array.from({length:n*n},(_,i)=>Math.hypot(i%n+.5-c,Math.floor(i/n)+.5-c)<80&&!points.some(p=>Math.hypot(i%n+.5-p[0],Math.floor(i/n)+.5-p[1])<3)?1:0);
assert.equal(V.analyze(bilateral,n,0).count,7,'majority of arm sides is independent support');
console.log('Structural voids: strict arm/side majority, isolated holes filled, faithful omissions respected, non-crystal/crystal and full symmetry pass.');
