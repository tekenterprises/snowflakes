'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
    const out=B.analyze(fw),gold=locals.find(r=>r.reference===row.reference);
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
