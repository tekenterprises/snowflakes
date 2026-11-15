/* Informational pipeline timings; no pass/fail performance thresholds. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),fixtures=process.env.SNOWFLAKE_FIXTURES||path.resolve(root,'../fixtures');
const B=require('../dist/branch-structure'),I=require('../dist/image-crystal'),O=require('../dist/cut-output');
const args=process.argv.slice(2),refsArg=args.find(a=>a.startsWith('--refs=')),refs=refsArg?refsArg.slice(7).split(',').map(Number):[13,20],jsonArg=args.find(a=>a.startsWith('--json='));
const time=fn=>{const start=process.hrtime.bigint(),value=fn();return {value,ms:Number(process.hrtime.bigint()-start)/1e6}};
const rows=[];
for(const ref of refs){
 const pixels=new Uint8Array(fs.readFileSync(path.join(fixtures,`image-model-${ref}.rgba`))),size=768;
 const raw=Uint8Array.from({length:size*size},(_,i)=>pixels[4*i]<230?1:0);
 const branch=time(()=>B.extract(pixels,size,false,0,230));
 const fit=time(()=>I.fit(pixels,size,100,false,100,0,branch.value,230));
 if(!fit.value)throw Error(`reference ${ref}: image fit returned no crystal`);
 const base={crystal:100,detail:100,symmetry:0,fill:true,islands:true,offset:0,round:0,gaps:0,size:100,hanger:false};
 const cold=time(()=>O.process(raw,size,base,fit.value));
 const warm=time(()=>O.process(raw,size,base,fit.value));
 const offset=time(()=>O.process(raw,size,{...base,offset:.2},fit.value));
 const symmetricFit=time(()=>I.fit(pixels,size,100,false,100,100,branch.value,230));
 const symmetry=symmetricFit.value?time(()=>O.process(raw,size,{...base,symmetry:100},symmetricFit.value)):{ms:null,value:null};
 rows.push({ref,size,stages:{branchMs:branch.ms,fitMs:fit.ms,coldCutMs:cold.ms,warmRepeatMs:warm.ms,offsetCutMs:offset.ms,symmetricFitMs:symmetricFit.ms,symmetricCutMs:symmetry.ms},outputs:{treeNodes:branch.value?.tree?.length??null,scaffoldCells:fit.value.polygons?.length??null,coldLoops:cold.value.loops.length,warmLoops:warm.value.loops.length,offsetLoops:offset.value.loops.length,symmetricCells:symmetry.value?.previewPolygons?.length??null}});
 console.log(JSON.stringify(rows.at(-1)));
}
if(jsonArg){const output=path.resolve(root,jsonArg.slice(7)),relative=path.relative(root,output);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('--json output must stay inside the repository');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({node:process.version,fixtureRoot:'../fixtures',rows},null,2));console.log(`Wrote ${path.relative(root,output)}`)}
