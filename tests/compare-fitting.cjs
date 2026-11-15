// Optional photographic comparison against a separately preserved checkout.
const fs=require('node:fs'),path=require('node:path'),I=require('../dist/image-crystal'),E=require('../dist/image-evidence');
const baseline=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11);if(!baseline)throw Error('Supply --baseline=<checkout>');
const Old=require(path.resolve(baseline,'dist/image-crystal'));
const root=process.env.SNOWFLAKE_FIXTURES||path.resolve(__dirname,'../../fixtures'),results=[];
const refs=process.argv.find(a=>a.startsWith('--refs='))?.slice(7).split(',').map(Number)||Array.from({length:20},(_,i)=>i+1);
for(const ref of refs){const pixels=new Uint8Array(fs.readFileSync(path.join(root,`image-model-${ref}.rgba`))),target=E.analyze(pixels,768,false,230).filled;
 const score=f=>{let missing=0,added=0;for(let i=0;i<target.length;i++){missing+=target[i]&&!f.mask[i]?1:0;added+=!target[i]&&f.mask[i]?1:0}return {cells:f.polygons.length,missing,added}};
 const before=score(Old.fit(pixels,768,100,false,100,0,null,230)),after=score(I.fit(pixels,768,100,false,100,0,null,230));
 const row={ref,before,after};results.push(row);console.log(JSON.stringify(row));
 if(process.env.SNOWFLAKE_REPORT)fs.writeFileSync(process.env.SNOWFLAKE_REPORT,JSON.stringify(results,null,2));
}
