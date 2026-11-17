'use strict';
// Exact replay and sequential baseline/candidate timing, outside the default suite.
// Usage: node tests/alignment-performance.cjs --baseline=/absolute/baseline/dist/reconstruction-branches.js [--refs=3,6,18,20] [--runs=3] [--local]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const B=require('../dist/reconstruction-branches.js');
const F=require('../dist/reconstruction-framework.js');
const option=(name,fallback)=>{const a=process.argv.find(v=>v.startsWith(`--${name}=`));return a?a.slice(name.length+3):fallback;};
const baselinePath=option('baseline');
assert(baselinePath,'Supply --baseline pointing to the unchanged baseline module.');
const old=require(path.resolve(baselinePath));
const refs=option('refs','3,6,18,20').split(',').map(Number),runs=Number(option('runs','3'));
const records=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../structure-diagnostics/master-side-prototype/full-slices-v16/results.json'))).results;
const codeSHA256=module=>crypto.createHash('sha256').update(fs.readFileSync(module)).digest('hex');
console.log(JSON.stringify({measurement:'Sequential local Node CPU, not browser latency',baseline:codeSHA256(path.resolve(baselinePath)),candidate:codeSHA256(path.resolve(__dirname,'../dist/reconstruction-branches.js')),runs,refs}));
for(const reference of refs){
  const row=records.find(r=>r.reference===reference);assert(row,`Missing reference ${reference}`);
  const raw=fs.readFileSync(path.resolve(__dirname,`../../fixtures/image-model-${reference}.rgba`));
  const inputSHA256=crypto.createHash('sha256').update(raw).digest('hex');assert.equal(inputSHA256,row.inputSHA256);
  const fw={size:768,center:row.center,trunks:row.trunks,hexagons:row.hexagons,branchInk:F.imageInk(raw,768,{blur:.65})};
  const samples=[];
  for(let run=0;run<runs;run++){
    const order=run%2?['candidate','baseline']:['baseline','candidate'],results={},timings={};
    for(const label of order){const engine=label==='baseline'?old:B;let start=performance.now();const registration=engine.align(engine.prepareSides(fw));timings[`${label}AlignmentMs`]=performance.now()-start;
      start=performance.now();const extracted=engine.extract(fw);timings[`${label}ExtractionMs`]=performance.now()-start;results[label]={registration,extracted};
      if(process.argv.includes('--local')){const analyzed=engine.analyze(fw,{extracted:structuredClone(extracted)});timings[`${label}DetectionMs`]=analyzed.timings.detection;timings[`${label}LocalMs`]=analyzed.timings.local;results[label].analyzed={master:analyzed.master,sides:analyzed.sides,registration:analyzed.registration};}
    }
    assert.deepEqual(results.candidate.registration,results.baseline.registration,`ref ${reference} run ${run} exact alignment history`);
    assert.deepEqual(results.candidate.extracted,results.baseline.extracted,`ref ${reference} run ${run} exact extracted rasters and transforms`);
    if(process.argv.includes('--local'))assert.deepEqual(results.candidate.analyzed,results.baseline.analyzed,`ref ${reference} run ${run} exact master and all local fits`);
    samples.push(timings);console.log(JSON.stringify({reference,run:run+1,inputSHA256,...timings,exact:true}));
  }
  const median=a=>{a.sort((x,y)=>x-y);const n=a.length;return n&1?a[n>>1]:(a[n/2-1]+a[n/2])/2;};
  const summary=Object.fromEntries(Object.keys(samples[0]).map(k=>[k,median(samples.map(v=>v[k]))]));
  console.log(JSON.stringify({reference,medians:summary,alignmentSpeedup:summary.baselineAlignmentMs/summary.candidateAlignmentMs,extractionSpeedup:summary.baselineExtractionMs/summary.candidateExtractionMs}));
}
