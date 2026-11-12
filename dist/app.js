const $=id=>document.getElementById(id),N=768,work=document.createElement('canvas');work.width=work.height=N;$('preview').setAttribute('viewBox',`0 0 ${N} ${N}`);const wc=work.getContext('2d',{willReadFrequently:true});let original=null,crop=null,center=[.5,.5],manualCenter=false,settingCenter=false,selected=1,previewBounds=[0,0,N,N],result=null,modelCache=null,branchCache=null,sourceVersion=0,timer,referenceIndex=1,loadVersion=0,sourceName='Reference 02 · Fern dendrite';
const layers=new Set(['vector','image']),layerButtons={cut:'vector',structure:'branches',overlay:'image','crystal-layer':'crystal'};
const references=ReferenceLibrary;
const defaults={threshold:230,scale:90,angle:0,symmetry:0,detail:100,offset:0,round:0,gaps:0,holeDiameter:3,holeRim:1.5,holeNeck:1,size:100};
function opts(){let o={};for(const k in defaults)o[k]=Number($(k).value);o.size=Math.max(20,Math.min(500,o.size||100));o.crystal=$('crystal').checked?100:0;o.hanger=$('hanger').checked;o.fill=$('fill').checked;o.islands=$('islands').checked;return o}
function labels(){const o=opts();$('hanger-controls').hidden=!o.hanger;for(const k in defaults){if(!$(k+'Val'))continue;$(k+'Val').textContent=o[k]+(['offset','round','gaps','holeDiameter','holeRim','holeNeck'].includes(k)?' mm':k==='angle'?'°':['scale','symmetry','detail','crystal'].includes(k)?'%':'')}$('sizeLabel').textContent=o.size+' mm artboard';$('specimen').textContent=sourceName}
function setCrop(){if(!original)return;sourceVersion++;modelCache=null;setCenterMode(false);crop=document.createElement('canvas');let sheet=$('layout').value==='sheet';const sw=original.width/(sheet?5:1),sh=original.height/(sheet?2:1);crop.width=Math.round(sw);crop.height=Math.round(sh);crop.getContext('2d').drawImage(original,sheet?(selected%5)*sw:0,sheet?Math.floor(selected/5)*sh:0,sw,sh,0,0,crop.width,crop.height);autoCenter();$('cells').hidden=false;document.querySelectorAll('#cells button').forEach((b,i)=>{const active=i===(sheet?selected:referenceIndex);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});if(sheet)sourceName=`Uploaded sheet · Crystal ${selected+1}`;render()}
function autoCenter(){if(!crop)return;const n=192,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d'),fit=n/Math.max(crop.width,crop.height),left=(n-crop.width*fit)/2,top=(n-crop.height*fit)/2;x.fillStyle=$('invert').checked?'black':'white';x.fillRect(0,0,n,n);x.drawImage(crop,left,top,crop.width*fit,crop.height*fit);const pixels=x.getImageData(0,0,n,n).data,a=new Uint8Array(n*n);for(let i=0;i<a.length;i++){let v=.2126*pixels[4*i]+.7152*pixels[4*i+1]+.0722*pixels[4*i+2];if($('invert').checked)v=255-v;a[i]=v<Number($('threshold').value)?1:0}const found=Flake.findCenter(a,n);center=found.found?[(found.x-left)/(crop.width*fit),(found.y-top)/(crop.height*fit)]:[.5,.5];manualCenter=false;$('center-status').textContent=found.found?'Center: auto-aligned across six arms':'Center not detected — tap the image';}
$('auto-center').onclick=()=>{setCenterMode(false);autoCenter();render()};
for(const id of ['threshold','invert'])$(id).addEventListener('change',()=>{if(!manualCenter)autoCenter();render()});
function render(){
 if(!crop)return;labels();const o=opts(),scale=N/Math.max(crop.width,crop.height)*o.scale/100,invert=$('invert').checked;
 wc.fillStyle=invert?'black':'white';wc.fillRect(0,0,N,N);wc.save();wc.translate(N/2,N/2);wc.rotate(o.angle*Math.PI/180);wc.drawImage(crop,-center[0]*crop.width*scale,-center[1]*crop.height*scale,crop.width*scale,crop.height*scale);wc.restore();
 const data=wc.getImageData(0,0,N,N).data,mask=new Uint8Array(N*N),imageMask=new Uint8Array(N*N);
 for(let i=0;i<mask.length;i++){let v=data[i*4]*.2126+data[i*4+1]*.7152+data[i*4+2]*.0722;if(invert)v=255-v;mask[i]=v<o.threshold?1:0;imageMask[i]=v<235?1:0}
 try{
  let fitted=null;const needModel=o.crystal||o.symmetry||o.hanger||layers.has('branches')||layers.has('crystal');
  if(needModel){
   const sourceKey=JSON.stringify([sourceVersion,center,o.scale,o.angle,invert,o.threshold]);
   if(!branchCache||branchCache.key!==sourceKey)branchCache={key:sourceKey,value:BranchStructure.extract(data,N,invert,0,o.threshold)};
   const fitKey=JSON.stringify([sourceKey,o.detail,o.symmetry]);
   if(!modelCache||modelCache.key!==fitKey)modelCache={key:fitKey,value:branchCache.value?ImageCrystal.fit(data,N,o.crystal||100,invert,o.detail,o.symmetry,branchCache.value,o.threshold):null};
   fitted=modelCache.value;
  }
  result=CutOutput.process(mask,N,o,fitted);
  result.previewPolygons=fitted?.polygons||[];
  $('crystal-stats').textContent=!fitted?(needModel?'No supported branch structure detected.':'Geometry is off.'):`${fitted.branchCount} branches`+(o.crystal?`${fitted.inferredBranchCount?` · ${fitted.inferredBranchCount} inferred`:""} · ${fitted.polygons.length} pieces (3–6 sides) · ${(fitted.match*100).toFixed(1)}% mask overlap · core ${fitted.hub.observed?'image-fitted':'inferred'}`:' · geometry is off');
  previewBounds=Preview.fitBounds(imageMask,N,result.loops);paint();
  $('pathcount').textContent=result.loops.length+' closed '+(result.loops.length===1?'boundary':'boundaries');
  $('vertices').textContent=result.loops.reduce((s,p)=>s+p.length,0).toLocaleString()+' vertices';$('export').disabled=!result.loops.length;
  $('status').textContent=!result.loops.length?'No shape detected. Adjust the threshold.':result.clipped?'Touches the artboard edge. Reduce source scale.':result.components>1?`${result.components} disconnected pieces.`:result.removed?`${result.removed} detached fragments removed.`:'';
  $('status').hidden=!$('status').textContent;
 }catch(e){$('status').hidden=false;$('status').textContent='Could not trace this setting: '+e.message;$('export').disabled=true}
}
function paint(){
 if(!result)return;
 $('preview').setAttribute('viewBox',previewBounds.join(' '));
 const image=layers.has('image')?`<g data-layer="image"><image href="${work.toDataURL('image/png')}" width="${N}" height="${N}"/></g>`:'';
 const polygons=layers.has('crystal')?'<g data-layer="crystal">'+(result.previewPolygons||[]).map(p=>`<path d="${Flake.path([p])}" fill="#dba94b" fill-opacity="0.09" stroke="#bd8c35" stroke-opacity=".65" stroke-width=".7"/>`).join('')+'</g>':'';
 const branches=layers.has('branches')?'<g data-layer="branches">'+(result.branches||[]).map(p=>`<path d="M${p[0].join(',')}L${p[1].join(',')}" stroke="#087cca" stroke-width="1.4" fill="none"/>`).join('')+'</g>':'';
 const vector=layers.has('vector')?`<g data-layer="vector"><path d="${Flake.path(result.loops)}" fill="none" stroke="${layers.has('image')?'#dc2850':'#16746c'}" stroke-width="1.2"/></g>`:'';
 $('preview').innerHTML=image+polygons+branches+vector+`<path d="M${N/2-12},${N/2}h24 M${N/2},${N/2-12}v24" stroke="#168c79" stroke-width="2"/>`;
}
function updateLayers(){for(const [id,layer] of Object.entries(layerButtons)){$(id).classList.toggle('active',layers.has(layer));$(id).setAttribute('aria-pressed',String(layers.has(layer)))}render()}
for(const [id,layer] of Object.entries(layerButtons))$(id).onclick=()=>{if(layers.has(layer)){if(layers.size===1)return;layers.delete(layer)}else layers.add(layer);updateLayers()};
function schedule(){clearTimeout(timer);labels();timer=setTimeout(render,70)}
for(const k in defaults)$(k).addEventListener('input',schedule);for(const k of ['invert','fill','islands','crystal','hanger'])$(k).addEventListener('change',render);
$('size').addEventListener('change',()=>{$('size').value=opts().size;render()});$('layout').addEventListener('change',()=>{referenceIndex=null;selected=0;renderReferences($('layout').value==='sheet');setCrop()});
function renderReferences(sheet=false){
 $('cells').innerHTML='';
 const entries=sheet?Array.from({length:10},(_,i)=>({id:i+1,label:'Uploaded crystal '+(i+1)})):references;
 entries.forEach((entry,i)=>{const b=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');img.alt='';
 if(sheet&&original){const thumb=document.createElement('canvas');thumb.width=thumb.height=64;thumb.getContext('2d').drawImage(original,(i%5)*original.width/5,Math.floor(i/5)*original.height/2,original.width/5,original.height/2,0,0,64,64);img.src=thumb.toDataURL('image/png')}else img.src=entry.file;
 label.textContent=entry.id;b.append(img,label);b.title=entry.label;b.setAttribute('aria-label','Reference '+entry.id+': '+entry.label);b.setAttribute('aria-pressed',String(i===(sheet?selected:referenceIndex)));
 b.onclick=()=>{if(sheet){selected=i;setCrop()}else selectReference(i)};$('cells').append(b)});
}
function selectReference(i){const entry=references[i];if(!entry)return;load(entry.file,`Reference ${String(entry.id).padStart(2,'0')} · ${entry.label}`,false,i)}
function setCenterMode(active){settingCenter=active;$('preview-hint').hidden=!active;$('set-center').setAttribute('aria-pressed',String(active));$('set-center').textContent=active?'Cancel':'Set center';$('preview').style.cursor=active?'crosshair':'default';$('preview-hint').textContent=active?'Tap the crystal center':'';}
$('set-center').onclick=()=>{if(!settingCenter){layers.add('image');updateLayers()}setCenterMode(!settingCenter)};
$('preview').onclick=e=>{if(!settingCenter||!crop)return;const svg=$('preview'),matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(p.x<0||p.y<0||p.x>N||p.y>N)return;const o=opts(),scale=N/Math.max(crop.width,crop.height)*o.scale/100,t=o.angle*Math.PI/180,dx=p.x-N/2,dy=p.y-N/2;center=[Math.max(0,Math.min(1,center[0]+(dx*Math.cos(t)+dy*Math.sin(t))/(scale*crop.width))),Math.max(0,Math.min(1,center[1]+(-dx*Math.sin(t)+dy*Math.cos(t))/(scale*crop.height)))];manualCenter=true;$('center-status').textContent='Center: manually positioned';setCenterMode(false);render()};
$('reset').onclick=()=>{setCenterMode(false);for(const k in defaults)$(k).value=defaults[k];$('crystal').checked=$('hanger').checked=false;$('fill').checked=$('islands').checked=true;$('invert').checked=false;autoCenter();render()};
function load(src,name,sheet,index=null){const request=++loadVersion;let im=new Image();im.onload=()=>{if(request===loadVersion){original=im;sourceName=name;referenceIndex=index;selected=0;if(index!==null)$('invert').checked=false;$('layout').value=sheet?'sheet':'single';renderReferences(sheet);setCrop()}if(src.startsWith('blob:'))URL.revokeObjectURL(src)};im.onerror=()=>{if(request===loadVersion){$('status').hidden=false;$('status').textContent='Image could not be read. Please choose a PNG, JPEG, WebP or BMP.'}if(src.startsWith('blob:'))URL.revokeObjectURL(src)};im.src=src}
$('upload').onchange=e=>{let f=e.target.files[0];if(f)load(URL.createObjectURL(f),f.name,false)};
document.querySelector('.upload').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('upload').click()}};
$('export').onclick=()=>{clearTimeout(timer);render();if(!result?.loops.length)return;let size=opts().size,svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size}mm" height="${size}mm" viewBox="0 0 ${N} ${N}"><title>Snowflake cut boundaries</title><desc>Millimeter artboard; closed contours; no kerf compensation. Inspect narrow features for your material.</desc><path d="${Flake.path(result.loops)}" fill="none" stroke="#000000" stroke-width="${.01*N/size}"/></svg>`;let url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=`snowflake-${referenceIndex===null?selected+1:references[referenceIndex].id}-${size}mm.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
// Separate procedural examples leave the supplied reference a single click away.
function demo(kind){let c=document.createElement('canvas');c.width=c.height=384;let x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,384,384);x.translate(192,192);x.strokeStyle='#263f39';x.lineCap='round';for(let arm=0;arm<6;arm++){x.save();x.rotate(arm*Math.PI/3);x.lineWidth=kind==='plate'?18:4;x.beginPath();x.moveTo(0,0);x.lineTo(0,-165);x.stroke();for(let j=1;j<8;j++){let y=-j*19,len=(8-j)*(kind==='stellar'?5:8);for(let side of [-1,1]){x.lineWidth=kind==='plate'?13:3;x.beginPath();x.moveTo(0,y);x.lineTo(side*len,y-len*.7);x.stroke();if(kind==='fern')for(let k=1;k<5;k++){let t=k/5;x.lineWidth=1.7;x.beginPath();x.moveTo(side*len*t,y-len*.7*t);x.lineTo(side*(len*t+7),y-len*.7*t-12);x.stroke()}}}x.restore()}++loadVersion;referenceIndex=null;original=c;$('invert').checked=false;$('layout').value='single';renderReferences();sourceName=kind[0].toUpperCase()+kind.slice(1)+' · procedural demo';setCrop()}
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>demo(b.dataset.demo));const ref=document.createElement('button');ref.textContent='↩ All 20 reference flakes';ref.className='reference-button';ref.onclick=()=>selectReference(1);document.querySelector('.demos').after(ref);
for(const k in defaults)$(k).value=defaults[k];
renderReferences();selectReference(1);
