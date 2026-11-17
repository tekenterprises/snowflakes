'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const B = require('../dist/reconstruction-branches.js');
const F = require('../dist/reconstruction-framework.js');

// Unit probes use arbitrary pixel evidence and frames, independently of the
// catalogue. The optional golden run reads accepted outputs only in this test.
const n=128,c=[63.3,62.7],ink=new Float32Array(n*n);
for(let y=0;y<n;y++)for(let x=0;x<n;x++)ink[y*n+x]=(x+2*y)/(3*n);
const trunks=Array.from({length:6},(_,i)=>({arm:i,start:c.slice(),end:[c[0]+45*Math.cos(i*Math.PI/3),c[1]+45*Math.sin(i*Math.PI/3)]}));
const hex=Array.from({length:6},(_,i)=>[c[0]+6*Math.cos(i*Math.PI/3),c[1]+6*Math.sin(i*Math.PI/3)]);
const framework={size:n,ink,branchInk:ink,center:c,trunks,hexagons:[{polygon:hex}]};
const sides=B.prepareSides(framework);
assert.equal(sides.length,12);
for(const side of sides){
  assert(Math.abs(side.bisectorAngle-Math.PI/6)<1e-12);
  const p=B.toSource(side,8,90),k=side.pixel/side.scale;
  assert(Math.abs((p[0]-c[0])*side.v[0]+(p[1]-c[1])*side.v[1]-8*k)<1e-12);
  assert(Math.abs((p[0]-c[0])*side.u[0]+(p[1]-c[1])*side.u[1]-90*k)<1e-12);
  const value=B.sampleSide(side,8,90);
  assert(value.geometric&&value.valid);
  assert(Math.abs(value.value-(p[0]+2*p[1])/(3*n))<1e-7);
  assert(!B.sampleSide(side,-1,80).valid);
  assert(!B.sampleSide(side,100,80).valid);
  assert(!B.sampleSide(side,0,0).valid);
  assert(B.sampleSide(side,100,80).value>0,'invalid slice samples retain interpolation evidence');
  assert(B.sampleSide(side,0,0).value>0,'central exclusion retains interpolation evidence');
}
// Independent registration oracle retains the original eager sample/median path.
// It protects four-iteration arithmetic, all-trial validity, and first-win ties.
function eagerAlign(sides){
  const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
  const median=a=>{const b=a.slice().sort((x,y)=>x-y),n=b.length;return n?(n&1?b[n>>1]:(b[n/2-1]+b[n/2])/2):0;};
  const points=[];for(let y=0;y<360;y+=3)for(let x=0;x<260;x+=3)points.push([x,y]);
  let scales=sides.map(()=>1);const history=[];
  for(let iteration=0;iteration<4;iteration++){
    const records=sides.map((s,i)=>points.map(p=>B.sampleSide(s,...p,scales[i])));
    const next=scales.map((scale,i)=>{
      const med=points.map((_,j)=>{const a=[];records.forEach((r,k)=>{if(k!==i&&r[j].valid)a.push(r[j].value);});return [median(a),a.length];});
      const lo=Math.max(.78,scale-.045),hi=Math.min(1.28,scale+.045),trials=[];for(let t=lo;t<=hi+1e-7;t+=(hi-lo)/18)trials.push(t);
      const samples=trials.map(t=>points.map(p=>B.sampleSide(sides[i],...p,t))),support=[];
      for(let j=0;j<points.length;j++){const [x,y]=points[j];if(y>40&&y<300&&x>6&&med[j][1]>=6&&samples.every(a=>a[j].valid))support.push(j);}
      if(support.length<120)return scale;
      const target=support.map(j=>med[j][0]),tm=mean(target),ts=Math.max(.015,Math.sqrt(mean(target.map(v=>(v-tm)**2))));let best=-Infinity,chosen=scale;
      samples.forEach((a,t)=>{const v=support.map(j=>a[j].value),vm=mean(v),vs=Math.max(.015,Math.sqrt(mean(v.map(x=>(x-vm)**2))));let score=0;for(let j=0;j<v.length;j++)score+=(v[j]-vm)/vs*(target[j]-tm)/ts;score/=v.length;if(score>best){best=score;chosen=trials[t];}});return chosen;
    });
    const norm=Math.exp(mean(next.map(Math.log)));scales=next.map(s=>s/norm);history.push(scales.slice());
  }return {scales,history};
}
assert.deepEqual(B.align(sides),eagerAlign(sides),'gradient registration history and scales');
const constantSides=B.prepareSides({...framework,branchInk:new Float32Array(n*n).fill(.25)});
assert.deepEqual(B.align(constantSides),eagerAlign(constantSides),'strict first-win correlation ties');
assert.deepEqual(B.align(sides.slice(0,6)),eagerAlign(sides.slice(0,6)),'insufficient leave-one-out support fallback');
const narrowSides=sides.map(s=>({...s,bisectorAngle:.05}));
assert.deepEqual(B.align(narrowSides),eagerAlign(narrowSides),'fewer than 120 common valid trial points');
assert.deepEqual(B.align(narrowSides).scales,new Array(12).fill(1));
// Interpolation fast paths preserve the original clamp and operation order,
// including border coordinates, signed zero, infinities and NaNs.
function eagerSample(a,x,y){
  x=Math.max(0,Math.min(a.width-1.001,x));y=Math.max(0,Math.min(a.height-1.001,y));
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,i=iy*a.width+ix,d=a.data;
  return (d[i]*(1-fx)+d[i+1]*fx)*(1-fy)+(d[i+a.width]*(1-fx)+d[i+a.width+1]*fx)*fy;
}
const coordinates=[-Infinity,-1,-0,0,.01,2.4,n-1.001,n-1.0009,n,Infinity,NaN];
for(const x of coordinates)for(const y of coordinates)assert.equal(B.sample({data:ink,width:n,height:n},x,y),eagerSample({data:ink,width:n,height:n},x,y));
const seed=[{attachment:100,angle:60,length:40,tip:[40*Math.sin(Math.PI/3),120]}];
const extracted=B.extract(framework,{scales:new Array(12).fill(1)});
const synchronous=B.analyze(framework,{extracted:structuredClone(extracted),masterBranches:structuredClone(seed),commonAngle:60});
const deferred=B.analyze(framework,{extracted:structuredClone(extracted),masterBranches:structuredClone(seed),commonAngle:60,deferLocal:true});
assert.deepEqual(deferred.master,synchronous.master);
for(const side of deferred.sides){
  assert(!Object.hasOwn(side,'branches'));
  const fit=B.fitSide(deferred.master,side,deferred.master.branches,deferred.master.commonAngle);
  assert.equal(B.applyLocalFit(side,structuredClone(fit)),side);
}
assert.deepEqual(deferred.sides,synchronous.sides,'deferred local fits preserve slots and source coordinates');
// Exercise the private broad phase against the unchanged scalar cross oracle.
// Instrumenting the module avoids exposing geometry internals in the app API.
const branchSource=fs.readFileSync(path.resolve(__dirname,'../dist/reconstruction-branches.js'),'utf8'),sandbox={module:{exports:{}}};
vm.runInNewContext(branchSource.replace('const api={','const api={polygonBounds,inside,alignmentValid,'),sandbox);
const internals=sandbox.module.exports;
function eagerInside(p,poly){let sign=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);if(Math.abs(cross)<1e-8)continue;const s=Math.sign(cross);if(sign&&sign!==s)return false;sign=s;}return true;}
const regular=(radius,cx=0,cy=0)=>Array.from({length:6},(_,i)=>[cx+radius*Math.cos(i*Math.PI/3),cy+radius*Math.sin(i*Math.PI/3)]);
const polygons=[regular(6),regular(6).reverse(),regular(6,1e5,-1e5),regular(6,1e7,1e7),regular(1e-6),[[0,0],[1,0],[2,0]],[[0,0],[0,0],[0,0]],[[0,0],[6,0],[3,1e-9]],[[0,0],[6,0],[2,2],[6,6],[0,6]],[[0,0],[6,6],[0,6],[6,0]],[[0,0],[50000,0],[50000,.01],[0,.01]]];
assert(internals.polygonBounds(polygons[0]));
for(const index of [3,4,5,6,7,8,9])assert.equal(internals.polygonBounds(polygons[index]),null,`polygon ${index} conservative fallback`);
let randomState=0x5eed;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)|0;return (randomState>>>0)/2**32;};
for(const poly of polygons){
  const bounds=internals.polygonBounds(poly);if(bounds)assert(Object.isFrozen(bounds));
  const queries=[[0,0],[Infinity,0],[-Infinity,0],[NaN,0],[1e6,1e6],[-1e6,-1e6],[1e6+1,1e6+1]];
  for(const p of poly)for(const dx of [-1e-3,-1e-8,-1e-10,0,1e-10,1e-8,1e-3])for(const dy of [-1e-3,0,1e-3])queries.push([p[0]+dx,p[1]+dy]);
  for(let j=0;j<300;j++)queries.push([poly[0][0]+(random()-.5)*40,poly[0][1]+(random()-.5)*40]);
  for(const p of queries){
    assert.equal(internals.inside(p,poly,bounds),eagerInside(p,poly),`broad phase ${JSON.stringify(poly)} at ${p}`);
    let expected=p[0]>=0&&p[1]>=0&&p[0]<127&&p[1]<127;
    if(expected)for(const dx of [-.75,.75])for(const dy of [-.75,.75])if(eagerInside([p[0]+dx,p[1]+dy],poly))expected=false;
    assert.equal(internals.alignmentValid({sourceSize:128,sourceHex:poly},p[0],p[1],bounds),expected,`footprint broad phase at ${p}`);
  }
}
const baselineOption=process.argv.find(v=>v.startsWith('--baseline='));
if(baselineOption){
  const baseline=require(path.resolve(baselineOption.slice(11))),size=32,center=[15.5,15.5],data=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)data[y*size+x]=(x+2*y)/(3*size);
  const trunks=Array.from({length:6},(_,i)=>({end:[center[0]+10*Math.cos(i*Math.PI/3),center[1]+10*Math.sin(i*Math.PI/3)]}));
  const adversarial=[regular(6,15.5,15.5),regular(1e-6,15.5,15.5),[[10,10],[15,10],[20,10]],[[16,16],[16,16],[16,16]],[[10,10],[20,10],[15,10+1e-9]],[[10,10],[20,10],[15,15],[20,20],[10,20]],[[10,10],[20,20],[10,20],[20,10]],[[0,0],[50000,0],[50000,.01],[0,.01]]];
  for(let i=0;i<adversarial.length;i++){
    const fw={size,center,trunks,branchInk:data,hexagons:[{polygon:adversarial[i]}]},options={scales:new Array(12).fill(.1)};
    assert.deepEqual(B.extract(fw,options),baseline.extract(fw,options),`adversarial polygon ${i} exact extracted masks and nonzero image samples`);
  }
  adversarial[0][0][0]+=.25;
  const edited={size,center,trunks,branchInk:data,hexagons:[{polygon:adversarial[0]}]},options={scales:new Array(12).fill(.1)};
  assert.deepEqual(B.extract(edited,options),baseline.extract(edited,options),'bounds are refreshed after polygon edits');
}
// A distant dark lobe cannot lengthen an inferred branch past a disconnected gap.
const w=60,h=100,a=new Float32Array(w*h),valid=new Uint8Array(w*h).fill(1);
for(let y=10;y<38;y++)for(let x=0;x<w;x++)a[y*w+x]=.8;
for(let y=50;y<75;y++)for(let x=0;x<50;x++)a[y*w+x]=.8;
const branch={attachment:12,angle:60,length:65,tip:[65*Math.sin(Math.PI/3),44.5],status:'inferred'};
B.trimConnected([branch],{data:a,width:w,height:h},{data:valid,width:w,height:h});
assert(branch.length<52&&branch.length>45);
assert.equal(branch.trimReason,'first_connected_material_exit');
const unsupported={attachment:12,angle:60,length:20,tip:[17.32,22],status:'inferred'};
B.trimConnected([unsupported],{data:new Float32Array(w*h),width:w,height:h},{data:valid,width:w,height:h});
assert.equal(unsupported.status,'unresolved');
assert.equal(unsupported.reason,'no_root_connected_photographic_support');
assert(unsupported.tip.every(Number.isFinite));
assert(!fs.readFileSync(path.resolve(__dirname,'../dist/reconstruction-branches.js'),'utf8').match(/\b(?:require\(|image-model-|reference\s*===|\.npz|readFile)/));
console.log('Reconstruction branches: coordinate, mask, and connected-tip checks passed.');

if(process.argv.includes('--golden')){
  const base=path.resolve(__dirname,'../../structure-diagnostics/master-side-prototype');
  const medians=JSON.parse(fs.readFileSync(path.join(base,'full-slices-v16/results.json'))).results;
  const locals=JSON.parse(fs.readFileSync(path.join(base,'local-halfarms-v6/results.json'))).results;
  const requested=process.argv.find(v=>v.startsWith('--refs='));
  const refs=requested?requested.slice(7).split(',').map(Number):medians.map(r=>r.reference);
  let maxScale=0,maxMaster=0,maxLocal=0,localCount=0,masterCount=0;const reports=[];
  for(const row of medians){if(!refs.includes(row.reference))continue;
    const raw=fs.readFileSync(path.resolve(__dirname,`../../fixtures/image-model-${row.reference}.rgba`));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),row.inputSHA256);
    const fw={size:768,center:row.center,trunks:row.trunks,hexagons:row.hexagons,branchInk:F.imageInk(raw,768,{blur:.65})};
    const baselineArg=process.argv.find(v=>v.startsWith('--baseline=')),baseline=baselineArg?require(path.resolve(baselineArg.slice(11))):null;
    const extractionStarted=performance.now(),extracted=baseline?B.extract(fw):null,extractionMs=performance.now()-extractionStarted;
    if(baseline)assert.deepEqual(extracted,baseline.extract(fw),`ref ${row.reference} exact full extracted rasters, masks, registration and transforms`);
    const out=B.analyze(fw,{deferLocal:process.argv.includes('--deferred'),...(extracted?{extracted}:{})}),gold=locals.find(r=>r.reference===row.reference);
    if(extracted){out.timings.extraction+=extractionMs;out.timings.total+=extractionMs;}
    if(process.argv.includes('--deferred')){
      const localStarted=performance.now();for(const side of out.sides){assert(!Object.hasOwn(side,'branches'));B.applyLocalFit(side,B.fitSide(out.master,side,out.master.branches,out.master.commonAngle));}
      const localMs=performance.now()-localStarted;out.timings.local+=localMs;out.timings.total+=localMs;
    }
    if(baseline){
      for(const side of out.sides){const previous=B.applyLocalFit(structuredClone(side),baseline.fitSide(out.master,side,out.master.branches,out.master.commonAngle));assert.deepEqual(side,previous,`ref ${row.reference} side ${side.index} exact baseline fit and source geometry`);}
    }
    assert.deepEqual([out.master.height,out.master.width],row.displayShape,`ref ${row.reference} crop`);
    assert(Math.abs(out.master.rootLimit-row.masterRootLimit)<1e-8,`ref ${row.reference} median hex root`);
    assert.equal(out.master.branches.length,row.branches.length,`ref ${row.reference} shared slots`);
    assert(Math.abs(out.master.commonAngle-row.commonAngle)<1e-8,`ref ${row.reference} common angle`);
    out.registration.scales.forEach((s,i)=>maxScale=Math.max(maxScale,Math.abs(s-row.scales[i])));
    out.master.branches.forEach((b,i)=>{const q=row.branches[i],error=Math.max(Math.abs(b.attachment-q.attachment),Math.abs(b.angle-q.angle),dist(b.tip,q.tip));maxMaster=Math.max(maxMaster,error);masterCount++;assert(error<1e-5,`ref ${row.reference} shared slot ${i}: ${error}`);});
    out.sides.forEach((s,i)=>{assert.equal(s.branches.length,row.branches.length);let previous=-Infinity;s.branches.forEach((b,j)=>{
      const q=gold.sides[i].branches[j],error=Math.max(Math.abs(b.attachment-q.attachment),Math.abs(b.angle-q.angle),Math.abs(b.length-q.length),dist(b.sourceTip,q.sourceTip));maxLocal=Math.max(maxLocal,error);localCount++;
      assert(Number.isFinite(error));assert(error<1e-5,`ref ${row.reference} side ${i} local slot ${j}: ${error}`);
      assert.equal(b.status,q.status,`ref ${row.reference} side ${i} slot ${j} status`);
      assert.equal(b.slotId,j);assert(b.attachment>previous,`ref ${row.reference} side ${i} root order`);previous=b.attachment;
      assert(s.branches.every(q=>q===b||q.slotId!==b.slotId));
    });});
    reports.push({reference:row.reference,slots:out.master.branches.length,totalMs:Math.round(out.timings.total)});
    console.log(JSON.stringify(reports[reports.length-1]));
  }
  assert(maxScale<1e-8,`scale registration error ${maxScale}`);
  console.log(JSON.stringify({references:reports.length,masterCount,localCount,maxScale,maxMaster,maxLocal}));
}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
