// Produce reproducible diagnostic geometry, not browser screenshots.
const fs=require('node:fs'),path=require('node:path');
const baseline=process.argv[2],out=process.argv[3];if(!baseline||!out)throw Error('Usage: node tests/render-material-data.cjs baseline-checkout output-directory');
fs.mkdirSync(out,{recursive:true});
for(const ref of [5,20]){const pixels=new Uint8Array(fs.readFileSync(path.resolve(__dirname,`../../fixtures/image-model-${ref}.rgba`))),raw=Uint8Array.from({length:768*768},(_,i)=>pixels[i*4]<230?1:0),options={crystal:100,detail:100,symmetry:0,fill:true,offset:0,round:0,gaps:0,size:100,islands:true};
 const frames=[];for(const source of [path.resolve(baseline),path.resolve(__dirname,'..')]){const I=require(path.join(source,'dist/image-crystal')),O=require(path.join(source,'dist/cut-output')),fit=I.fit(pixels,768,100,false,100,0,null,230),result=O.process(raw,768,options,fit);frames.push({polygons:result.previewPolygons||fit.polygons,cut:result.loops,clip:result.crystalMaterial,clipped:source===path.resolve(baseline)});}
 fs.writeFileSync(path.join(out,`ref-${ref}.json`),JSON.stringify({ref,options,frames}));console.log(`Rendered geometry ${ref}: ${frames.map(f=>f.polygons.length).join(' -> ')} cells`);
}
