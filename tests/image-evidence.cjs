const assert=require('node:assert/strict'),fs=require('fs'),B=require('../dist/branch-structure.js'),I=require('../dist/image-crystal.js'),O=require('../dist/cut-output.js'),F=require('../dist/engine.js'),C=require('../dist/crystal.js'),P=require('../dist/shared-polygons.js');
const options={detail:100,crystal:100,symmetry:0,fill:true,islands:true,offset:0,round:0,gaps:0,size:100};
// Test annotations only: image-supported terminal cap interiors and an open
// inter-arm background region. Runtime code has no specimen coordinates.
for(const threshold of [217,245]){
 const pixels=new Uint8Array(fs.readFileSync(`/tmp/threshold-4-${threshold}.rgba`)),mask=Uint8Array.from({length:768*768},(_,i)=>pixels[i*4]<threshold?1:0),model=B.extract(pixels,768,false,0,threshold),fitted=I.fit(pixels,768,100,false,100,0,model,threshold),out=O.process(mask,768,options,fitted);
 let white=0;for(let y=250;y<290;y++)for(let x=305;x<330;x++)white+=out.mask[y*768+x];assert.equal(white,0,'hole filling must not fill the open white region between arms');
 for(const [x,y] of [[337,159],[274,224],[599,320],[259,518],[333,606]]){let yes=0,count=0;for(let v=-6;v<=6;v++)for(let u=-6;u<=6;u++)if(u*u+v*v<36){count++;yes+=out.mask[(y+v)*768+x+u]}assert(yes/count>.35,`threshold ${threshold}: recover cap ${x},${y}`)}
 console.log(`Threshold ${threshold}: five observed terminal caps retained; open inter-arm background preserved after hole filling.`);
}
// One instance's fine waist must influence the shared subdivision. A percentile
// over twelve instances used to discard these local details entirely.
const records=Array.from({length:12},(_,id)=>({id,length:100,values:Array.from({length:129},(_,k)=>[-4,id===0&&Math.abs(k-64)<8?1:4])}));
const fine=P.schedule(records,100,false),coarse=P.schedule(records,0,false);assert(fine.length>coarse.length);assert(fine.every(p=>p.error<=.36),'max detail bounds the worst instance, not a population percentile');for(const p of fine)assert(p.polygons.every(q=>q.length>=3&&q.length<=6&&q.length===p.roles.length));
const pixels=new Uint8Array(fs.readFileSync('/tmp/image-model-6.rgba')),mask=Uint8Array.from({length:768*768},(_,i)=>pixels[i*4]<230?1:0),model=B.extract(pixels,768),fitted=I.fit(pixels,768,100,false,100,100,model),trace=O.process(mask,768,{...options,crystal:0,symmetry:100},fitted),geometry=O.process(mask,768,{...options,symmetry:100},fitted),old=O.process(mask,768,{...options,crystal:0,symmetry:100},{axis:fitted.axis});
// A compact faceted mesh intentionally has a different boundary from the raw
// profile trace. Check their shared branch skeleton, not near-identical masks.
let common=0,union=0;for(let i=0;i<mask.length;i++){common+=trace.mask[i]&&geometry.mask[i]?1:0;union+=trace.mask[i]||geometry.mask[i]?1:0}let retained=0,samples=0;for(const t of fitted.tree)for(const u of [.2,.5,.8]){const x=Math.round(t.start[0]+u*(t.end[0]-t.start[0])),y=Math.round(t.start[1]+u*(t.end[1]-t.start[1]));let a=false,b=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){a ||= !!trace.mask[(y+dy)*768+x+dx];b ||= !!geometry.mask[(y+dy)*768+x+dx];}samples++;retained+=a&&b?1:0;}assert(retained/samples>.97,'trace and compact facets retain the same branch skeleton');assert(trace.removed<old.removed,'registered symmetry must stop breaking fine branches into fragments');assert.equal(trace.components,1);
// Independently rotate vector vertices, rather than comparing raster pixels.
const edges=trace.loops.flatMap(p=>p.map((a,i)=>[a,p[(i+1)%p.length]]));for(const ring of trace.loops)for(let i=0;i<ring.length;i+=11){const a=ring[i],dx=a[0]-384,dy=a[1]-384,p=[384+dx*.5-dy*Math.sqrt(3)/2,384+dx*Math.sqrt(3)/2+dy*.5];assert(Math.min(...edges.map(e=>B.project(p,e).distance))<.00001,'exact sixfold cut edges')}
const zero=O.process(mask,768,{...options,crystal:0},fitted),without=O.process(mask,768,{...options,crystal:0});assert.deepEqual(zero.loops,without.loops,'zero symmetry preserves the original trace');
console.log(`Fine dendrite: registered non-crystal symmetry overlaps crystal ${Math.round(100*common/union)}%; fewer lost fragments; exact sixfold edges; zero-symmetry trace unchanged.`);
