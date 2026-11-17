'use strict';
// Internal-kernel instrumentation stays in this test realm; the application API
// and evidence records do not gain diagnostic/test switches.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const modulePath=path.resolve(__dirname,'../dist/reconstruction-framework.js');
let source=fs.readFileSync(modulePath,'utf8')
 .replace('function clipped(a,n,x,y){','function clipped(a,n,x,y){root.sampleCalls++;')
 .replace('for(let si=0;si<3;si++){const shift=', 'for(let si=0;si<3;si++){root.sampleCalls+=2;const shift=')
 .replace('const api={prepare,','const api={evidenceKernel,clipped,sample,linkedSupportCount,gaussianL,prepare,')
 .replace('return {single,neighborhood,evidence:', 'return {cacheSize:()=>edgeCache?edgeCache.reduce((s,e)=>s+(e?e.offsets.size:0),0):0,single,neighborhood,evidence:');
const realm=vm.createContext({console,performance,sampleCalls:0,module:{exports:{}},require:require('node:module').createRequire(modulePath)});
vm.runInContext(source,realm,{filename:modulePath});
const kernel=realm.module.exports.evidenceKernel,n=96,ink=new Float32Array(n*n);
let state=1729;for(let i=0;i<ink.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;ink[i]=state/0xffffffff;}
// Clamped sampling must be bit-identical to the generic interpolator at image
// boundaries and arbitrary fractional pixels, including signed/infinite inputs.
const {clipped,sample}=realm.module.exports;
for(const x of [-Infinity,-100,-0,0,.001,1.25,n-2,n-1,n+100,Infinity])for(const y of [-Infinity,-1,-0,0,.75,n-2,n,Infinity])assert(Object.is(clipped(ink,n,x,y),sample(ink,n,Math.max(0,Math.min(x,n-2)),Math.max(0,Math.min(y,n-2)))));
for(let j=0;j<1000;j++){const x=Math.sin(j*.43)*n+n/2,y=Math.cos(j*.37)*n+n/2;assert(Object.is(clipped(ink,n,x,y),sample(ink,n,Math.max(0,Math.min(x,n-2)),Math.max(0,Math.min(y,n-2)))))}
// Independent array-based oracle verifies gap1/gap2 filling and the count+4
// cap for every 13-bit pattern at both ends of the 25-sample support sequence.
function arrayLinkedCount(mask){const support=Array.from({length:25},(_,j)=>(mask>>>j)&1),linked=support.slice(),count=support.reduce((s,v)=>s+v,0);for(let gap=1;gap<=2;gap++)for(let j=0;j<25-gap-1;j++)if(support[j]&&support[j+gap+1])for(let d=1;d<=gap;d++)linked[j+d]=1;return [Math.min(linked.reduce((s,v)=>s+v,0),count+4),count]}
const {linkedSupportCount}=realm.module.exports;
for(let mask=0;mask<8192;mask++)for(const shifted of [mask,mask<<12]){const [expected,count]=arrayLinkedCount(shifted);assert.equal(linkedSupportCount(shifted,count),expected)}
for(const mask of [0,0x1ffffff,1,1<<24,(1<<24)|1,0x1555555,0xaaaaaa]){const [expected,count]=arrayLinkedCount(mask);assert.equal(linkedSupportCount(mask,count),expected)}
for(let j=0;j<10000;j++){const mask=(Math.imul(j+1,2654435761)>>>0)&0x1ffffff,[expected,count]=arrayLinkedCount(mask);assert.equal(linkedSupportCount(mask,count),expected)}
// Generic fractional-box oracle retains axis selection, all interior taps,
// clamped boundaries and per-pass Uint8 rounding independently of the l=0 path.
function genericGaussian(gray,n,sigma){
 if(sigma<=0)return gray.slice();const variance=sigma*sigma/3,l=Math.floor((Math.sqrt(12*variance+1)-1)/2),fraction=(2*l+1)*(l*(l+1)-3*variance)/(6*(variance-(l+1)*(l+1))),radius=l+fraction,denominator=2*radius+1,inner=1/denominator,edge=fraction/denominator,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let a=gray.slice();
 for(let axis=0;axis<2;axis++)for(let pass=0;pass<3;pass++){const b=new Uint8Array(a.length);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let sum=0;for(let k=-l;k<=l;k++)sum+=a[axis?clamp(y+k,0,n-1)*n+x:y*n+clamp(x+k,0,n-1)]*inner;sum+=(a[axis?clamp(y-l-1,0,n-1)*n+x:y*n+clamp(x-l-1,0,n-1)]+a[axis?clamp(y+l+1,0,n-1)*n+x:y*n+clamp(x+l+1,0,n-1)])*edge;b[y*n+x]=Math.floor(sum+.5)}a=b}return a;
}
const {gaussianL}=realm.module.exports;
for(const size of [1,2,3,7,32,97,768]){
 const gray=Uint8Array.from({length:size*size},(_,i)=>(Math.imul(i+19,1103515245)>>>15)&255),preserved=gray.slice(),sigmas=size===768?[.65,.7,1.2]:[0,.01,.2,.65,.7,1.2,Math.SQRT2-1e-9,Math.SQRT2,Math.SQRT2+1e-9,1.5,2.4,4];
 for(const sigma of sigmas){assert.deepEqual(Buffer.from(gaussianL(gray,size,sigma)),Buffer.from(genericGaussian(gray,size,sigma)),`blur ${size}px sigma ${sigma}`);assert.deepEqual(gray,preserved,'Blur preserves source gray bytes')}
 const border=new Uint8Array(size*size);border[0]=255;border[border.length-1]=255;for(const sigma of [.65,.7,1.2,2.4])assert.deepEqual(Buffer.from(gaussianL(border,size,sigma)),Buffer.from(genericGaussian(border,size,sigma)),`border blur ${size}px sigma ${sigma}`);
}
const polygon=Array.from({length:6},(_,k)=>[48+31*Math.cos(k*Math.PI/3),48+31*Math.sin(k*Math.PI/3)]),options=[];
for(const x of [-1.5,0,1.5])for(const y of [-1.5,0,1.5]){const q=polygon.map(v=>v.slice());q[2][0]+=x;q[2][1]+=y;options.push(q);}
for(const [name,evaluate,offsetCount]of [['strict',(E,p)=>E.evidence(p,true),1],['ribbon',(E,p)=>E.evidence(p),5],['band',(E,p)=>E.band(p,5),9]]){
 const E=kernel(ink,n);realm.sampleCalls=0;const expected=options.map(p=>evaluate(E,p)),uncachedSamples=realm.sampleCalls;
 realm.sampleCalls=0;let retained=0;const actual=E.neighborhood(()=>options.map(p=>{const result=evaluate(E,p);retained=Math.max(retained,E.cacheSize());return result})),cachedSamples=realm.sampleCalls;
 assert.deepEqual(actual,expected,`${name}: exact scores, sides and coverage`);
 assert(cachedSamples<uncachedSamples*.5,`${name}: unchanged edges must avoid sampling`);
 assert.equal(retained,6*offsetCount,`${name}: retains only current six directed edges and offsets`);
 assert.equal(E.cacheSize(),0,`${name}: neighborhood releases evidence`);
 console.log(JSON.stringify({evidence:name,uncachedSamples,cachedSamples,retainedOffsets:retained}));
}
const E=kernel(ink,n),raw=E.single(polygon,0,false),bridged=E.single(polygon,0,true);
assert(raw.coverage.some((v,k)=>v!==bridged.coverage[k]),'Fixture exercises raw/bridged distinction');
E.neighborhood(()=>{
 for(const bridge of [false,true,false,true])for(const offset of [-3,3,-0,0])assert.deepEqual(E.single(polygon,offset,bridge),kernel(ink,n).single(polygon,offset,bridge));
 const reversed=polygon.slice().reverse();assert.deepEqual(E.single(reversed,3),kernel(ink,n).single(reversed,3));
 const translated=polygon.map(v=>[v[0]+Number.EPSILON*32,v[1]]);assert.deepEqual(E.single(translated),kernel(ink,n).single(translated));
 // Changing all coordinates repeatedly must replace edge slots, never accumulate
 // radii, phases, or proposal histories. The production bands have nine offsets.
 for(let j=0;j<250;j++){const p=polygon.map(v=>[v[0]+j*.001,v[1]+j*.002]);E.band(p,5);assert(E.cacheSize()<=54)}
});
assert.equal(E.cacheSize(),0);
E.neighborhood(()=>{for(let j=0;j<250;j++){E.single(polygon,j*.001);assert(E.cacheSize()<=54)}});
assert.equal(E.cacheSize(),0,'Varying offsets have an explicit bound too');
assert.throws(()=>E.neighborhood(()=>{E.band(polygon,5);throw Error('abort')}),/abort/);
assert.equal(E.cacheSize(),0,'Exceptional search exit releases evidence');
realm.sampleCalls=0;E.band(polygon,5);const first=realm.sampleCalls;E.band(polygon,5);assert.equal(realm.sampleCalls,first*2,'Ordinary phase/radius sweep retains no evidence');
console.log('Hex evidence cache exactness, directed offsets, coverage modes and bounded lifetime passed.');
