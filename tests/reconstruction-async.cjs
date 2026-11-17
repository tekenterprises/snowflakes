const assert=require('node:assert/strict'),R=require('../dist/reconstruction'),F=global.ReconstructionFramework,B=global.ReconstructionBranches,C=global.ReconstructionCells;
async function main(){
 const originals={prepare:F.prepare,analyze:B.analyze,canonical:C.buildCanonical,build:C.build,assemble:C.assemble};let builds=0;
 const hex={polygon:Array.from({length:6},(_,i)=>[32+4*Math.cos(i*Math.PI/3),32+4*Math.sin(i*Math.PI/3)]),inferred:false};
 const frame={center:[32,32],size:64,trunks:Array.from({length:6},(_,i)=>({start:[32,32],end:[32+20*Math.cos(i*Math.PI/3),32+20*Math.sin(i*Math.PI/3)]})),hexagons:[hex]};
 const analysis={framework:frame,master:{halfAngle:Math.PI/6,trunkTip:20,pixel:1},sides:Array.from({length:12},(_,i)=>({index:i,arm:i>>1,center:[32,32],u:[1,0],v:[0,1],pixel:1,scale:1,branches:[]}))};
 try{F.prepare=()=>frame;B.analyze=()=>analysis;C.buildCanonical=()=>({cells:[]});C.build=()=>{builds++;return {cells:[],hexagons:[hex],baseCut:[],diagnostics:{}}};
  const authoritative=Error('actual material solver failed');authoritative.localFitAuthoritative=true;const failed=R.create({cellFit:async()=>{throw authoritative}});failed.analyze(new Uint8Array(),64);await assert.rejects(()=>failed.fitAsync({symmetry:0},true),e=>e===authoritative);assert.equal(builds,0,'primary solver failure must not repeat all twelve sides');
  const malformed=R.create({cellFit:async()=>[]});malformed.analyze(new Uint8Array(),64);await malformed.fitAsync({symmetry:0},true);assert.equal(builds,1,'transport/protocol failure uses one serial fallback');
  const assembly=R.create({cellFit:async()=>Array(12).fill({})});assembly.analyze(new Uint8Array(),64);C.assemble=()=>{throw Error('actual union mismatch')};await assert.rejects(()=>assembly.fitAsync({symmetry:0},true),/actual union mismatch/);assert.equal(builds,1,'assembly errors are authoritative');
 }finally{F.prepare=originals.prepare;B.analyze=originals.analyze;C.buildCanonical=originals.canonical;C.build=originals.build;C.assemble=originals.assemble;}
 console.log('Async fitting retries provider failures once and propagates actual geometry failures without a second full solve.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
