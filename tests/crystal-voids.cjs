const assert=require('node:assert/strict'),V=require('../dist/crystal-voids'),C=require('../dist/crystal'),F=require('../dist/engine');
const n=120,outer=[[[5,5],[115,5],[115,115],[5,115]]],corners=Array.from({length:6},(_,i)=>[60+20*Math.cos(i*Math.PI/3),60+20*Math.sin(i*Math.PI/3)]),noisy=[];
for(let i=0;i<6;i++){const a=corners[i],b=corners[(i+1)%6],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);for(let k=0;k<8;k++){const t=k/8,w=k?Math.sin(k*2)*.12:0;noisy.push([a[0]+t*dx-w*dy/length,a[1]+t*dy+w*dx/length]);}}
const fitted=V.fit([noisy.slice().reverse()],outer,n,100);assert.equal(fitted.length,1);assert(fitted[0].length<noisy.length,'noise does not dictate facet count');assert(fitted[0].length>=3);assert(fitted[0].flat().every(Number.isFinite));
const before=Math.abs(C.area(noisy)),after=Math.abs(C.area(fitted[0]));assert(after/before>.8&&after/before<1.2);
const raster=C.raster(fitted,n),base=C.raster(outer,n),material=Uint8Array.from(base,(v,i)=>v&&!raster[i]?1:0),filled=F.fillHoles(material,n);assert.equal(F.components(material,n,false).count,1);assert.equal(F.components(Uint8Array.from(material,(v,i)=>filled[i]&&!v?1:0),n,false).count,1,'same open hole and connected material');
console.log('Crystal cavity fitting removes chatter while retaining the hole, connected material, and approximate area.');
