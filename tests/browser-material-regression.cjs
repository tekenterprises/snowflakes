const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.earcut=require('../dist/vendor/earcut.min.js');global.polygonClipping=require('../dist/vendor/polygon-clipping.min.js');require('../dist/engine.js');
const {N,W,B,S,Final}=require('../dist/reconstruction-partition.js');
function validate(cells,target,supports){
 assert(cells.length,'a complete supported partition exists');
 for(const c of cells){assert(c.polygon.every(N.finite));assert(N.area(c.polygon)>0);assert(N.facetCount(c.polygon)>=3&&N.facetCount(c.polygon)<=6);assert(N.contact(c.polygon,supports,{insert:false}),'every facet reaches a finite direct support')}
 const union=W.union(cells.map(c=>W.subject(c.polygon)));
 assert(W.mpArea(W.pc.difference(target,union))<.001,'no missing target material');
 assert(W.mpArea(W.pc.difference(union,target))<.001,'no added target material');
 assert(Math.abs(cells.reduce((s,c)=>s+N.area(c.polygon),0)-W.mpArea(union))<.001,'no interior overlap');
 assert.equal(Final.holes(union),Final.holes(target),'all actual cut holes preserved');
}
// Real browser-canvas material replay: the earlier mapped search misses this
// supported comb even though a straight fan gives six clean compact cells.
// Coordinates are canonical pixels; these are regression input, never a
// catalogue identity or a special case in the runtime.
const polygon=[[0,23.62947],[3,21.847937],[3,119.119973],[20.5,121.5],[39.5,114.5],[29.5,127.5],[45.5,126.5],[45.5,134.5],[58.5,131.5],[57.5,141.5],[75.5,149.5],[71.5,153.5],[54.5,148.5],[48.5,153.5],[38.5,142.5],[43.5,156.5],[38.5,161.5],[28.5,152.5],[27.5,138.5],[8.5,136.5],[3,168.845799],[3,288.910298],[0,329.4]];
const supports=[{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,328.1031398558771]]}];
const result=B.partition({polygon},supports,{budgetMs:30});assert(result,'certified fallback solves the supported browser material');validate(result.cells,W.subject(polygon),supports);
// The fine boundary is feasible too. Distant endpoints previously starved
// the mapped search before it reached the finite roots near the branch bay.
const fine=[[0,23.62947],[3,21.847937],[3,110.324983],[7.148667,104.614832],[5.5,107.5],[14.5,109.5],[16.5,106.5],[21.5,106.5],[23.5,112.5],[18.5,115.5],[20.5,121.5],[26.5,120.5],[32.5,114.5],[39.5,114.5],[39.5,118.5],[29.5,124.5],[29.5,127.5],[37.5,129.5],[45.5,126.5],[47.5,128.5],[45.5,134.5],[58.5,131.5],[60.5,137.5],[57.5,138.5],[57.5,141.5],[69.5,143.5],[75.5,149.5],[71.5,153.5],[68.5,151.5],[60.5,152.5],[58.5,148.5],[54.5,148.5],[52.5,153.5],[48.5,153.5],[45.5,144.5],[38.5,142.5],[38.5,150.5],[43.5,156.5],[42.5,160.5],[38.5,161.5],[34.5,160.5],[28.5,152.5],[27.5,138.5],[8.5,136.5],[3,167.630575],[3,288.910298],[0,329.4]];
const fineResult=B.partition({polygon:fine},supports,{budgetMs:30});assert(fineResult,'visibility-ranked finite roots recover the fine target');validate(fineResult.cells,W.subject(fine),supports);
assert.equal(B.partition({polygon:fine},[],{budgetMs:30}),null,'fallback never manufactures a support');
console.log('Browser material fallback preserves actual union, holes, finite direct supports and 3–6 facets.');

if(process.argv.includes('--browser')){
 const files=process.env.BROWSER_MATERIAL_FIXTURE?[process.env.BROWSER_MATERIAL_FIXTURE]:['4','1.6'].map(t=>path.resolve(__dirname,'../../review-prep/optimization-implementation/browser-6-side1-'+t+'.json'));
 for(const file of files){
 const {b}=JSON.parse(fs.readFileSync(file)),target=structuredClone(b.baseCut),s=b.branches.map((b,i)=>({kind:'branch',identity:'branch-'+i,segment:[[0,b.attachment],b.tip]})).concat(b.hexSupports,{kind:'trunk',identity:'main-trunk',segment:[[0,0],[0,b.trunkTip]]});
 const row=S.run(b,{budgetMs:3200});assert.equal(row.failed.length,0,'complete browser-side material partition');
 assert.equal(row.partitionAudit.coarsenedRegions,0,'structural fallback needs no contour edits');
 const final=Final.run(row,b);validate(final.cells,target,s);Final.validateEdgeIncidence(final.cells,final.vertices,final.baseCut);
 console.log(JSON.stringify({fixture:file,cells:final.cells.length,holes:Final.holes(final.baseCut),partitionAudit:row.partitionAudit,validation:final.validation}));
 }
}
