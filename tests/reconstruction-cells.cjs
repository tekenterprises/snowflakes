const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.earcut=require('../dist/vendor/earcut.min.js');global.polygonClipping=require('../dist/vendor/polygon-clipping.min.js');require('../dist/engine.js');require('../dist/reconstruction-partition.js');const R=require('../dist/reconstruction-cells.js');
const {N,W,Final}=R.geometry;
function validate(row){
 assert(row.cells.length,'cells are present');
 const cut=W.union(row.cells.map(c=>W.subject(c.polygon)));
 assert(W.mpArea(W.pc.difference(cut,row.baseCut))<.01,'cell union equals actual base cut');
 assert(W.mpArea(W.pc.difference(row.baseCut,cut))<.01,'actual cut contains no uncovered material');
 assert(Math.abs(row.cells.reduce((s,c)=>s+N.area(c.polygon),0)-W.mpArea(cut))<.01,'cell interiors do not overlap');
 for(const c of row.cells){assert(c.polygon.every(N.finite));assert(N.area(c.polygon)>0);assert(N.facetCount(c.polygon)>=3&&N.facetCount(c.polygon)<=6,'actual facet count');assert(N.contact(c.polygon,[c.growthSupport],{insert:false}),'finite direct growth support');}
 Final.validateEdgeIncidence(row.cells,row.vertices,cut);
}
const input={index:0,n:82,displayShape:[80,48],branches:[{attachment:20,tip:[20,52],angle:32.005383208083494,length:Math.hypot(20,32)}],sharedBranches:[{attachment:20,tip:[20,52],angle:32.005383208083494,length:Math.hypot(20,32)}],localHex:[[0,0],[8,5],[0,10]],hexSupports:[],halfAngles:[Math.PI/6],trunkTip:70,sourceCells:[],imageBounds:[[0,0],[82,0],[82,82],[0,82]]};input.hexSupports=input.localHex.map((p,i)=>({kind:'hex',identity:'central-hex',segment:[p,input.localHex[(i+1)%3]]}));
const mask=new Uint8Array(input.n**2);for(let y=0;y<70;y++)for(let x=0;x<Math.min(y/Math.sqrt(3),10);x++)mask[y*input.n+x]=1;
validate(R.fitPrepared(input,mask));
// Fill retains supported structural cavities; disabling it also retains small
// genuinely white enclosed source cavities without borrowing another side's hole.
{
 const width=48,height=80,ink=new Float32Array(width*height),geometric=new Uint8Array(width*height);
 for(let y=0;y<70;y++)for(let x=0;x<Math.min(20,y/Math.sqrt(3));x++){ink[y*width+x]=.9;geometric[y*width+x]=1;}
 for(let y=40;y<43;y++)for(let x=10;x<13;x++)ink[y*width+x]=0;
 const side={index:0,width,height,ink,geometric,branches:[],trunkTip:70,hexPolygon:[[0,0],[5,5],[0,10]],u:[0,1],v:[1,0],pixel:1,scale:1,bisectorAngle:Math.PI/6};
 const analysis={center:[0,0],size:80},filled=R.sideInput(analysis,side,[],{fill:true}),faithful=R.sideInput(analysis,side,[],{fill:false});
 assert.equal(filled.raw[41*filled.row.n+11],1);assert.equal(faithful.raw[41*faithful.row.n+11],0);
 assert(faithful.row.voidAudit.some(h=>h.preserved&&h.area===9));
}
// A photographed material field remains material at the bilateral domain
// seam even when the median validity crop has a one-pixel staircase there.
// Reflection must not turn that crop uncertainty into manufactured cavities.
{
 const size=256,width=48,height=80,center=[128,128],photo=new Float32Array(size*size).fill(.9),half=Math.PI/6+.01,valid=new Uint8Array(width*height),ink=new Float32Array(width*height),hexmask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(x<=y*Math.tan(half)){valid[i]=1;ink[i]=.9;}if(Math.hypot(x,y)<8)hexmask[i]=1;}
 const hex=Array.from({length:6},(_,i)=>[8*Math.sin(i*Math.PI/3),8*Math.cos(i*Math.PI/3)]),sides=[];
 for(let arm=0;arm<6;arm++)for(const mirror of [-1,1]){const a=arm*Math.PI/3,u=[Math.cos(a),Math.sin(a)];sides.push({index:sides.length,arm,mirror,center,u,v:[-u[1]*mirror,u[0]*mirror],pixel:1,scale:1,width,height,bisectorAngle:half,sourceSize:size,sourceInk:{data:photo,width:size,height:size},branches:[],trunkTip:70,hexPolygon:hex});}
 const analysis={framework:{size,ink:photo,branchInk:photo,center,hexagons:[{polygon:hex.map(p=>[p[0]+128,p[1]+128])}]},master:{width,height,ink,valid,hexmask,branches:[],halfAngle:half,pixel:1,trunkTip:70,hexPolygon:hex},sides};
 const guide=R.buildCanonical(analysis,{regular:true}),frame={...analysis.framework,hexagons:[{polygon:guide.localHex.map(p=>[p[1]+128,p[0]+128])}]};
 const mesh=R.assemble({...analysis,framework:frame},sides.map(side=>({...guide,index:side.index})));
 validate(mesh);assert.equal(Final.holes(mesh.baseCut),0,'material-supported seam produces no false holes');
 const contains=(p,ring)=>{let value=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>p[1])!==(ring[j][1]>p[1])&&p[0]<(ring[j][0]-ring[i][0])*(p[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])value=!value;return value;};
 for(let y=18;y<65;y+=.25){const p=[128+y,128+y*Math.tan(Math.PI/6)-.1];assert(mesh.baseCut.some(poly=>contains(p,poly[0])&&!poly.slice(1).some(r=>contains(p,r))),'actual cell union covers photographed material immediately inside the domain seam');}

}
// These original binary material checkpoints exercise the port independently
// of extraction changes. They are test evidence only, never runtime inputs.
if(process.argv.includes('--references')){
 const dir=path.resolve(__dirname,'../../structure-diagnostics/master-side-prototype/full-crystals-v4');
 for(let ref=1;ref<=20;ref++){
  const stem='ref-'+String(ref*100).padStart(4,'0'),row=JSON.parse(fs.readFileSync(path.join(dir,stem+'-input.json'))),raw=new Uint8Array(fs.readFileSync(path.join(dir,stem+'-material.bin'))),start=Date.now();
  const result=R.fitPrepared(row,raw,{partitionBudgetMs:2200});validate(result);console.log(ref,result.cells.length,Date.now()-start,JSON.stringify(result.validation));
 }
}
console.log('In-memory v4 cells preserve actual union, finite supports, facet bounds and shared incidence.');
if(process.argv.includes('--fresh')){
 const F=require('../dist/reconstruction-framework.js'),B=require('../dist/reconstruction-branches.js'),diag=path.resolve(__dirname,'../../structure-diagnostics/runtime-port');fs.mkdirSync(diag,{recursive:true});
 const refs=process.env.CRYSTAL_REFS?process.env.CRYSTAL_REFS.split(',').map(Number):Array.from({length:20},(_,i)=>i+1),summary=[];
 for(const ref of refs){const started=Date.now();let stage='analysis';try{
  const pixels=new Uint8ClampedArray(fs.readFileSync(path.resolve(__dirname,'../../fixtures/image-model-'+ref+'.rgba'))),analysis=B.analyze(F.prepare(pixels,768)),analysisMs=Date.now()-started;
  stage='canonical';const guide=R.buildCanonical(analysis);stage='source';const model=R.build(analysis,{canonical:guide});validate(model);
  const row={ref,status:'passed',analysisMs,geometryMs:Date.now()-started-analysisMs,cells:model.cells.length,canonicalCells:guide.cells.length,components:model.baseCut.length,holes:Final.holes(model.baseCut),overlapArea:model.diagnostics.overlapArea,maximumSideMissingArea:Math.max(...model.diagnostics.sides.map(s=>s.validation.interpretedMissingArea)),maximumSideExcessArea:Math.max(...model.diagnostics.sides.map(s=>s.validation.interpretedExcessArea))};
  summary.push(row);fs.writeFileSync(path.join(diag,'ref-'+String(ref).padStart(2,'0')+'-fresh.json'),JSON.stringify(model));console.log(JSON.stringify(row));
 }catch(error){const row={ref,status:'failed',stage,reason:error.message,attempts:error.attempts,elapsedMs:Date.now()-started};summary.push(row);console.log(JSON.stringify(row));process.exitCode=1;}
 fs.writeFileSync(path.join(diag,process.env.CRYSTAL_REFS?'fresh-geometry-summary-'+refs.join('-')+'.json':'fresh-geometry-summary.json'),JSON.stringify(summary,null,2));
 }
}
if(process.argv.includes('--seam-references')){
 const F=require('../dist/reconstruction-framework.js'),B=require('../dist/reconstruction-branches.js'),Engine=require('../dist/reconstruction.js');
 for(const [ref,holes]of [[3,0],[14,6]]){
  const pixels=new Uint8ClampedArray(fs.readFileSync(path.resolve(__dirname,'../../fixtures/image-model-'+ref+'.rgba'))),analysis=B.analyze(F.prepare(pixels,768)),guide=R.buildCanonical(analysis,{regular:true,fill:true,detail:100}),mesh=Engine.canonicalMesh(analysis,guide);
  validate(mesh);assert.equal(mesh.baseCut.length,1);assert.equal(Final.holes(mesh.baseCut),holes,'photographed seam cavities are preserved without manufacturing absent holes');
  console.log(JSON.stringify({ref,regularSymmetry:true,cells:mesh.cells.length,holes:Final.holes(mesh.baseCut)}));
 }
}
