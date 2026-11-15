const assert=require('node:assert/strict');
const O=require('../dist/cut-output'),C=require('../dist/crystal');
const square=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]],shell=square(8,8,56,56),gap=square(27,27,37,37);
const fitted={loops:[shell],mask:C.raster([shell],64),axis:0,branches:[],polygons:[shell],pieces:[{pieceSlotId:'plate',sideCount:4,polygon:shell}],cutPolygons:[shell],structuralGaps:[gap]};
const raw=fitted.mask,base={crystal:100,detail:100,symmetry:0,offset:0,round:0,gaps:0,size:100,islands:true,hanger:false};
for(const fill of [false,true]){
 const result=O.process(raw,64,{...base,fill},fitted),negative=result.baseCrystalLoops.filter(p=>C.area(p)<0),cutNegative=result.loops.filter(p=>C.area(p)<0);
 assert.equal(result.structuralVoids,0,'test fixture contains no classified photographic structural holes');
 assert.equal(negative.length,1,'canonical bay closure is cut into the actual cell union');
 assert.equal(cutNegative.length,1,'final zero-adjustment cut preserves the canonical bay closure');
 assert.equal(result.previewPolygons.length,4,'the plate cavity is represented by actual cells');
 const cells=C.raster(result.previewPolygons,64),cut=C.raster(result.baseCrystalLoops,64);assert.deepEqual(cells,cut,'preview cells and base perimeter agree');
 assert.equal(cut[32*64+32],0,'structural bay closure remains void with either fill policy');
 const sourcePatched=O.process(raw,64,{...base,fill},{...fitted,sourcePatch:{beforeCells:10}});
 assert.equal(sourcePatched.crystalMesh.targetCellCount,11,'source repairs pass their original scaffold budget');
 assert.equal(sourcePatched.crystalMesh.compactCellTarget,1,'cheap merging retains the current partition goal');
 assert.deepEqual(C.raster(sourcePatched.baseCrystalLoops,64),cut,'source budget does not change cavity material');
}
console.log('Image-supported structural gaps remain actual cell and cut cavities independently of photographic Fill policy.');
