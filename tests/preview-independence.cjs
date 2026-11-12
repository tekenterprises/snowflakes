// Exercise the app's render orchestration with a minimal DOM and measured-model
// doubles. Preview switches must never choose a different cut symmetry model.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),elements=new Map(),calls=[],options=[];
function node(){return {listeners:{},value:0,checked:false,style:{},classList:{toggle(){}},setAttribute(){},addEventListener(type,handler){this.listeners[type]=handler},append(){},after(){},closest(){return this},click(){}}}
function get(id){if(!elements.has(id))elements.set(id,node());return elements.get(id)}
const pixels=new Uint8Array(768*768*4).fill(255),ctx={fillRect(){},save(){},translate(){},rotate(){},drawImage(){},restore(){},getImageData(){return {data:pixels}}},model={},fitted={axis:29.95,branchCount:6,polygons:[[[0,0],[2,0],[0,2]]],match:1,hub:{observed:false},inferredBranchCount:0};
const context=vm.createContext({ReferenceLibrary:require('../dist/references.js'),console,setTimeout,clearTimeout,Image:class{},document:{getElementById:get,createElement(tag){return tag==='canvas'?{...node(),getContext(){return ctx},toDataURL(){return ''}}:node()},querySelector:()=>node(),querySelectorAll:()=>[]},Flake:{path(){return ''}},BranchStructure:{extract(){return model}},ImageCrystal:{fit(){return fitted}},Preview:{fitBounds(){return [0,0,768,768]}},CutOutput:{process(mask,n,o,f){calls.push(f);options.push(o);return {loops:[[[0,0],[1,0],[0,1]]],components:1,removed:0,branches:[[[0,0],[1,1]]]}}}});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
get('symmetry').value=100;get('crystal').checked=false;get('fill').checked=get('islands').checked=true;
vm.runInContext('crop={width:256,height:320};render()',context);
const ids=['cut','structure','overlay','crystal-layer'],names=['vector','branches','image','crystal'];
for(let bits=1;bits<16;bits++){
 vm.runInContext(`layers.clear();${names.filter((_,i)=>bits&(1<<i)).map(name=>`layers.add('${name}');`).join('')}updateLayers()`,context);
 const preview=get('preview').innerHTML;
 for(let i=0;i<4;i++)assert.equal(preview.includes(`data-layer="${names[i]}"`),!!(bits&(1<<i)),`combination ${bits}, ${names[i]}`);
 assert.strictEqual(calls.at(-1),fitted,'all layers retain the same symmetry model');assert.equal(options.at(-1).crystal,0,'guides cannot enable cut geometry');
 if((bits&(bits-1))===0){const before=get('preview').innerHTML;get(ids[Math.log2(bits)]).onclick();assert.equal(get('preview').innerHTML,before,'last visible layer cannot be hidden')}
}
vm.runInContext("layers.clear();layers.add('vector');updateLayers()",context);
get('structure').onclick();assert(get('preview').innerHTML.includes('data-layer="branches"'));get('structure').onclick();assert(!get('preview').innerHTML.includes('data-layer="branches"'));
get('symmetry').value=0;get('crystal-layer').onclick();assert(get('preview').innerHTML.includes('data-layer="crystal"'));assert.strictEqual(calls.at(-1),fitted,'crystal guides work with symmetry and geometry off');
const html=fs.readFileSync('dist/index.html','utf8');assert(!/id="(?:branch-lines|facets|crystal-info)"/.test(html),'no duplicate visibility checkboxes');
get('crystal').checked=true;get('crystal').listeners.change();assert.equal(options.at(-1).crystal,100);
get('crystal').checked=false;get('crystal').listeners.change();assert.equal(options.at(-1).crystal,0);
get('crystal').checked=true;vm.runInContext('crop=null',context);get('reset').onclick();assert.equal(get('crystal').checked,false);
console.log('All 15 layer combinations, last-layer guard, independent toggles, cut/guide independence and geometry reset pass.');
vm.runInContext('crop={width:256,height:320}',context);get('hanger').checked=true;get('hanger').listeners.change();
assert.equal(options.at(-1).hanger,true);assert.equal(get('hanger-controls').hidden,false);
assert.equal(options.at(-1).holeDiameter,3);assert.equal(options.at(-1).holeRim,1.5);assert.equal(options.at(-1).holeNeck,1);
get('gaps').value=.4;vm.runInContext('render()',context);assert.equal(options.at(-1).gaps,.4);
get('hanger').checked=false;get('hanger').listeners.change();assert.equal(get('hanger-controls').hidden,true);
get('hanger').checked=true;vm.runInContext('crop=null',context);get('reset').onclick();assert.equal(get('hanger').checked,false);assert.equal(get('gaps').value,0);
console.log('Hanger controls, millimeter defaults, gap width and reset are wired to cut options.');

get('symmetry').value=0;get('crystal').checked=false;get('hanger').checked=true;vm.runInContext("crop={width:256,height:320};render()",context);assert.strictEqual(calls.at(-1),fitted,'hanger must request the axis model even with geometry and guides off');assert(!get('status').textContent.startsWith('Could not trace'),'render should not catch an unexpected exception');
