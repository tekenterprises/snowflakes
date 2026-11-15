const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../dist/crystal'),I=require('../dist/image-crystal'),O=require('../dist/cut-output'),B=require('../dist/branch-structure');
const root=process.env.SNOWFLAKE_FIXTURES||path.resolve(__dirname,'../../fixtures');
const area=loops=>loops.reduce((s,p)=>s+C.area(p),0);
const refs=process.argv.find(a=>a.startsWith('--refs='))?.slice(7).split(',').map(Number)||[20];
const results=[];
function checkSymmetry(polygons,axis){const c=384,buckets=new Map(),center=p=>[0,1].map(k=>p.reduce((s,v)=>s+v[k],0)/p.length),key=p=>p.map(v=>Math.floor(v/.001)).join(',');for(const p of polygons){const k=key(center(p));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p)}for(const p of polygons)for(const mirror of [false,true]){const a=mirror?2*axis:Math.PI/3,co=Math.cos(a),si=Math.sin(a),q=p.map(([x,y])=>{x-=c;y-=c;return mirror?[c+x*co+y*si,c+x*si-y*co]:[c+x*co-y*si,c+x*si+y*co]}),m=center(q),bin=m.map(v=>Math.floor(v/.001));let found=false;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(const candidate of buckets.get([bin[0]+x,bin[1]+y].join(','))||[])if(candidate.length===q.length&&q.every(v=>candidate.some(w=>Math.hypot(v[0]-w[0],v[1]-w[1])<1e-5)))found=true;assert(found,'actual cavity/material cells have full rotational and bilateral symmetry');}}
for(const ref of refs){
 const pixels=new Uint8Array(fs.readFileSync(path.join(root,`image-model-${ref}.rgba`))),raw=Uint8Array.from({length:768*768},(_,i)=>pixels[i*4]<230?1:0),measured=B.extract(pixels,768,false,0,230);
 for(const symmetry of (process.argv.includes('--only-symmetric')?[100]:process.argv.includes('--symmetric')?[0,100]:[0])){
  const start=Date.now(),fit=I.fit(pixels,768,100,false,100,symmetry,measured,230);
  for(const fill of [true,false]){
   const out=O.process(raw,768,{crystal:100,detail:100,symmetry,fill,offset:0,round:0,gaps:0,size:100,islands:true},fit);
   assert(out.previewPolygons.length,'actual preview cells');
   for(const p of out.previewPolygons){assert(p.length>=3&&p.length<=6);assert(p.flat().every(Number.isFinite));assert(C.area(p)>0);}
   const cellArea=out.previewPolygons.reduce((s,p)=>s+C.area(p),0);
   assert(Math.abs(cellArea-area(out.baseCrystalLoops))<.1,`ref ${ref}: no cell overlap/missing union area`);
   assert(Math.abs(area(out.loops)-area(out.baseCrystalLoops))<.1,`ref ${ref}: unadjusted cut belongs to cells`);
   const cellMask=C.raster(out.previewPolygons,768),baseMask=C.raster(out.baseCrystalLoops,768);
   let disagreement=0;for(let i=0;i<baseMask.length;i++)disagreement+=cellMask[i]!==baseMask[i]?1:0;
   assert(disagreement<20,`ref ${ref}: cells and base cut disagree in ${disagreement} pixels`);
   if(symmetry===100)checkSymmetry(out.previewPolygons,fit.axis*Math.PI/180);
   results.push({ref,symmetry,fill,scaffoldCells:fit.polygons.length,materialCells:out.previewPolygons.length,elapsedMs:Date.now()-start,disagreement});
  }
  console.log(JSON.stringify(results.slice(-2)));
 }
}
if(process.env.SNOWFLAKE_REPORT)fs.writeFileSync(process.env.SNOWFLAKE_REPORT,JSON.stringify(results,null,2));
