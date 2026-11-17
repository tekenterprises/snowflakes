// UI orchestration double: export must flush debounced settings and await their
// geometry. Client revision/queue behavior is tested separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 const elements=new Map(),downloads=[],blobs=[];let callbacks,request,resolveJob;const images=[];
 const node=()=>({value:0,checked:false,style:{},listeners:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,f){this.listeners[k]=f},append(){},after(){},click(){if(this.download)downloads.push(this.download)}}),get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const pixels=new Uint8ClampedArray(768*768*4).fill(255),drawing={fillRect(){},save(){},translate(){},rotate(){},drawImage(){},restore(){},getImageData(){return {data:pixels}}};
 let pending=Promise.resolve();const client={request(value){request=value;callbacks.onBusy();pending=new Promise(resolve=>resolveJob=resolve);return pending},whenSettled(){return pending}};
 const context=vm.createContext({console,Blob,setTimeout,clearTimeout,Image:class{constructor(){this.width=this.height=100;images.push(this)}},ReconstructionFramework:{findCenter(){return {found:false}}},ReferenceLibrary:require('../dist/references'),GeometryClient:{create(c){callbacks=c;return client}},URL:{createObjectURL(blob){blobs.push(blob);return 'blob:export'},revokeObjectURL(){}},Flake:{path:loops=>JSON.stringify(loops)},document:{getElementById:get,createElement:tag=>tag==='canvas'?{...node(),getContext:()=>drawing,toDataURL:()=>''}:node(),querySelector:()=>node(),querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);vm.runInContext('sourceLoading=false;crop={width:100,height:100};render()',context);
 get('offset').value=.4;get('offset').listeners.input();const exporting=get('export').onclick();await Promise.resolve();assert.equal(request.options.offset,.4,'export flushes latest debounced control');assert.equal(downloads.length,0);assert(get('export').disabled);
 const loops=[[[3,4],[9,4],[9,10],[3,10]]];callbacks.onResult({loops,previewPolygons:[],branches:[],previewBounds:[0,0,768,768],components:1},request);resolveJob();await exporting;
 assert.equal(downloads.length,1);assert((await blobs[0].text()).includes(JSON.stringify(loops)),'SVG contains the completed latest cut');
 callbacks.onError('invalid');const failed=get('export').onclick();await Promise.resolve();callbacks.onError('still invalid');resolveJob();await failed;assert.equal(downloads.length,1,'failed geometry cannot export previous boundaries');
 // A new source selection invalidates export before asynchronous decoding.
 vm.runInContext('selectReference(2)',context);assert(get('export').disabled);const previousDownloads=downloads.length;await get('export').onclick();assert.equal(downloads.length,previousDownloads,'old flake cannot export while replacement is decoding');
 images.at(-1).onload();callbacks.onResult({loops,previewPolygons:[],branches:[],previewBounds:[0,0,768,768],components:1},request);resolveJob();
 get('offset').value=.6;const changedSize=get('export').onclick();await Promise.resolve();get('size').value=140;callbacks.onResult({loops,previewPolygons:[],branches:[],previewBounds:[0,0,768,768],components:1},request);resolveJob();await changedSize;assert.equal(downloads.length,previousDownloads,'controls changed during an export cannot mix old geometry with a new artboard size');
 get('size').value=100;get('offset').value=.7;const replaced=get('export').onclick();await Promise.resolve();const oldResolve=resolveJob,oldRequest=request;vm.runInContext('selectReference(3)',context);callbacks.onResult({loops,previewPolygons:[],branches:[],previewBounds:[0,0,768,768],components:1},oldRequest);oldResolve();await replaced;assert.equal(downloads.length,previousDownloads,'selection change cancels a pending export');
 console.log('Export flushes controls, waits for current geometry, and rejects stale settings, source decode races and obsolete results.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
