// Exercise the real reconstruction route, not the legacy injection seam.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../dist/reconstruction'),O=require('../dist/cut-output'),Cells=global.ReconstructionCells,{N,W,Final}=Cells.geometry;
const options={threshold:230,detail:100,symmetry:0,crystal:100,fill:true,islands:true,offset:0,round:0,gaps:0,size:100,hanger:false};
function inside(p,ring){let v=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v}return v}
function loopsMP(loops){const p=loops.filter(r=>N.area(r)>0).map(r=>[r]);for(const h of loops.filter(r=>N.area(r)<0)){const outer=p.find(r=>inside(h[0],r[0]));assert(outer);outer.push(h)}return p}
function validate(model){
 const mesh=model.mesh,union=W.union(mesh.cells.map(c=>W.subject(c.polygon))),area=W.mpArea(union);
 assert(W.mpArea(W.pc.difference(union,mesh.baseCut))<.01);assert(W.mpArea(W.pc.difference(mesh.baseCut,union))<.01);
 assert(Math.abs(mesh.cells.reduce((a,c)=>a+N.area(c.polygon),0)-area)<.05);
 for(const c of mesh.cells){assert(c.polygon.every(N.finite));assert(N.area(c.polygon)>0);assert(N.facetCount(c.polygon)>=3&&N.facetCount(c.polygon)<=6);assert(N.contact(c.polygon,[c.growthSupport],{insert:false}));}
 Final.validateEdgeIncidence(mesh.cells,mesh.vertices,mesh.baseCut);
 const mask=new Uint8Array(model.analysis.framework.size**2),result=O.process(mask,model.analysis.framework.size,{...options,...model.settings},model);
 const outers=result.loops.filter(p=>N.area(p)>0).map(p=>[p]);for(const hole of result.loops.filter(p=>N.area(p)<0)){const parent=outers.find(p=>inside(hole[0],p[0]));assert(parent,'cut hole has outer boundary');parent.push(hole)}assert(W.mpArea(W.pc.difference(mesh.baseCut,outers))<.01);assert(W.mpArea(W.pc.difference(outers,mesh.baseCut))<.01);
 assert(result.loops.length);return mesh;
}
// Visibility alone must never fill supported holes or change source contours.
const size=128,mask=new Uint8Array(size*size);for(let y=8;y<120;y++)for(let x=8;x<120;x++)mask[y*size+x]=1;
for(let arm=0;arm<6;arm++){const a=arm*Math.PI/3,cx=64+30*Math.cos(a),cy=64+30*Math.sin(a);for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x-cx)**2+(y-cy)**2<36)mask[y*size+x]=0;}
const traceOptions={...options,crystal:0},trace=O.process(mask,size,traceOptions),guides=O.process(mask,size,traceOptions,{engine:'reconstruction-v36',branches:[],hexagons:[],center:[64,64],tree:[]});assert.deepEqual(require('../dist/crystal').raster(guides.loops,size),require('../dist/crystal').raster(trace.loops,size));assert.equal(guides.structuralVoids,trace.structuralVoids);
if(process.argv.includes('--references')){
 const dir=process.env.SNOWFLAKE_FIXTURES||path.resolve(__dirname,'../../fixtures'),selected=process.argv.filter(s=>/^\d+$/.test(s)).map(Number),refs=selected.length?selected:[18];
 for(const ref of refs){const pixels=fs.readFileSync(path.join(dir,`image-model-${ref}.rgba`)),engine=R.create(),start=Date.now(),analysis=engine.analyze(pixels,768),frozen=JSON.stringify([analysis.framework.center,analysis.framework.trunks,analysis.framework.hexagons,analysis.sides.map(s=>s.branches)]);
  for(const symmetry of [0,50,100]){const model=engine.fit({...options,symmetry}),mesh=validate(model);assert.equal(mesh.diagnostics.components,1,'whole material remains connected');
   if(symmetry===100){const c=analysis.framework.center,a=Math.atan2(analysis.sides[0].u[1],analysis.sides[0].u[0]),transform=(p,reflect=false)=>p.map(ring=>ring.map(([x,y])=>{const dx=x-c[0],dy=y-c[1];if(reflect){const u=dx*Math.cos(a)+dy*Math.sin(a),v=-dx*Math.sin(a)+dy*Math.cos(a);return [c[0]+u*Math.cos(a)+v*Math.sin(a),c[1]+u*Math.sin(a)-v*Math.cos(a)]}return [c[0]+dx*.5-dy*Math.sqrt(3)/2,c[1]+dx*Math.sqrt(3)/2+dy*.5]}));for(const reflect of [false,true]){const other=mesh.baseCut.map(p=>transform(p,reflect));assert(W.mpArea(W.pc.difference(mesh.baseCut,other))<.01);assert(W.mpArea(W.pc.difference(other,mesh.baseCut))<.01);}}
   console.log(JSON.stringify({ref,symmetry,cells:mesh.cells.length,components:mesh.diagnostics.components,holes:mesh.diagnostics.cutHoles}));
  }
  assert.equal(JSON.stringify([analysis.framework.center,analysis.framework.trunks,analysis.framework.hexagons,analysis.sides.map(s=>s.branches)]),frozen,'poses do not mutate accepted image fits');
  const first=engine.fit({...options,symmetry:100,fill:false,detail:50}),second=engine.fit({...options,symmetry:100,fill:true,detail:100}),again=engine.fit({...options,symmetry:100,fill:false,detail:50});validate(first);validate(second);assert.deepEqual(first.mesh.baseCut,again.mesh.baseCut,'Fill/detail order cannot contaminate cached guides');
  const inputMask=Uint8Array.from({length:768*768},(_,i)=>pixels[4*i]<230?1:0);
  for(const symmetry of [0,50,100]){const settings={...options,crystal:0,symmetry},plain=engine.fit(settings,false),withGuides=engine.fit(settings,true),a=O.process(inputMask,768,settings,plain),b=O.process(inputMask,768,settings,withGuides);assert.deepEqual(require('../dist/crystal').raster(a.loops,768),require('../dist/crystal').raster(b.loops,768),'crystal guide visibility cannot change a source cut');}
  const full=engine.fit({...options,symmetry:100}),manufactured=O.process(inputMask,768,{...options,symmetry:100,offset:.1,round:.1,gaps:.15},full),center=analysis.framework.center;
  const rotated=manufactured.loops.map(r=>r.map(([x,y])=>{const dx=x-center[0],dy=y-center[1];return [center[0]+dx*.5-dy*Math.sqrt(3)/2,center[1]+dx*Math.sqrt(3)/2+dy*.5]})),maskA=require('../dist/crystal').raster(manufactured.loops,768),maskB=require('../dist/crystal').raster(rotated,768);let mismatches=0;for(let i=0;i<maskA.length;i++)mismatches+=maskA[i]!==maskB[i];const material=loopsMP(manufactured.loops),rotatedMaterial=loopsMP(rotated);assert(W.mpArea(W.pc.difference(material,rotatedMaterial))<.01,'manufacturing keeps exact rotational symmetry around the fitted center');assert(W.mpArea(W.pc.difference(rotatedMaterial,material))<.01);
  console.log(JSON.stringify({ref,totalMs:Date.now()-start,manufacturingRasterTies:mismatches}));
 }
}
console.log('Reconstruction source-cut visibility and requested real-image union/symmetry/cache regressions passed.');
