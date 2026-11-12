const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Script}=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const urls=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1].split('?')[0]);
for(const url of urls)if(!/^(?:https?:|data:)/.test(url))assert(fs.existsSync(path.join(dist,url)),`Missing asset: ${url}`);
for(const file of fs.readdirSync(dist).filter(f=>f.endsWith('.js')))new Script(fs.readFileSync(path.join(dist,file),'utf8'),{filename:file});
const refs=require('../dist/references.js');assert.equal(refs.length,20);
for(const ref of refs){const file=fs.readFileSync(path.join(dist,ref.file));assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a',ref.file);assert(file.length>1000);}
console.log('Static build verified: 20 reference images, scripts and linked assets. No compilation required.');
