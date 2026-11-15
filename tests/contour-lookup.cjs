const assert=require('node:assert/strict'),Surface=require('../dist/silhouette-mesh');
const square=[[46,46],[54,46],[54,54],[46,54]],notch=[[20,20],[40,20],[45,10],[55,10],[60,20],[80,20],[80,80],[20,80]];
const tree=Array.from({length:6},(_,arm)=>({parent:null,arm,start:[50,50],end:[50+40*Math.cos(arm*Math.PI/3),50+40*Math.sin(arm*Math.PI/3)],length:40}));
const model=loops=>({n:100,scale:1,axis:0,tree,boundaryEvidence:{size:100,loops}});
const dense=ring=>ring.flatMap((a,i)=>Array.from({length:16},(_,k)=>a.map((v,j)=>v+k/16*(ring[(i+1)%ring.length][j]-v))));
for(const ring of [square,dense(square)]){
 const m=model([ring]);
 assert.deepEqual(Surface.project(m,[50,50],0),[50,46],'equal-distance edges keep the first contour edge');
 assert.deepEqual(Surface.project(m,[50,50],0,[1,0]),[50,46],'forward boundary correspondence selects the top side');
 assert.deepEqual(Surface.project(m,[50,50],0,[-1,0]),[50,54],'opposite-side edges are rejected before projection');
 assert.deepEqual(Surface.project(m,[46,46],0),[46,46],'shared-corner distance ties remain exact');
}
for(const ring of [notch,dense(notch)]){
 const m=model([ring]),feature=Surface.feature(m,[30,20],[70,20],0,[[30,20],[70,20]]);
 assert(feature,'supported contour protrusion remains available');
 assert.deepEqual(feature.target,[45,10],'equal-height feature corners retain contour order');
 assert.equal(feature.u,.375);
 assert.equal(feature.residual,10);
 assert.equal(feature.priority,400);
 assert.deepEqual(feature.contour[0],[30,20]);
 assert.deepEqual(feature.contour.at(-1),[70,20]);
 assert.equal(Surface.feature(m,[65,20],[75,20],0,[[65,20],[75,20]]),null,'one straight contour interval creates no feature');
}
const shared=model([dense(square)]),scaled={...shared,scale:2};
assert.deepEqual(Surface.project(shared,[50,50],0),[50,46]);
assert.deepEqual(Surface.project(scaled,[100,100],0),[100,92],'one evidence object supports distinct artboard scales');
assert.deepEqual(Surface.project(shared,[50,50],0),[50,46],'a second scale preserves the cached first scale');
const featureModel=model([dense(notch)]);
assert.deepEqual(Surface.feature(featureModel,[30,20],[70,20],0,[[30,20],[70,20]]).target,[45,10]);
const scaledFeature=Surface.feature({...featureModel,scale:2},[60,40],[140,40],0,[[60,40],[140,40]]);
assert.deepEqual(scaledFeature.target,[90,20],'feature lookup caches evidence separately at each scale');
assert.equal(scaledFeature.priority,1600);
console.log('Contour lookup: exact edge/corner ties, tangent correspondence and supported protrusions survive indexed lookup.');
