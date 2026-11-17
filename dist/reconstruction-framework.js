/* Accepted image-only center, straight trunks and nested trunk-constrained hexagons.
 * Pixel centers and geometry are in the supplied square artboard coordinates.
 * Evidence may be Float32; geometry remains ordinary (Float64) JS numbers.
 * Algorithms ported from the accepted center/trunk and hex V2 -> V3 -> V4 -> V6
 * prototypes. No catalogue identity or frozen output is used at runtime. */
(function(root){
'use strict';
// Capture immutable intrinsic references once. Contextified worker globals
// otherwise add a proxy lookup to every numeric evidence sample.
const {Math,Date,Float32Array,Float64Array,Uint8Array,Int32Array,Array,Number}=root;
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const median=a=>{const s=a.slice().sort((a,b)=>a-b),i=s.length>>1;return s.length%2?s[i]:(s[i-1]+s[i])/2};
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
function sample(a,n,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const get=(xx,yy)=>xx>=0&&yy>=0&&xx<n&&yy<n?a[yy*n+xx]:0;return get(ix,iy)*(1-fx)*(1-fy)+get(ix+1,iy)*fx*(1-fy)+get(ix,iy+1)*(1-fx)*fy+get(ix+1,iy+1)*fx*fy}
function clipped(a,n,x,y){return sample(a,n,clamp(x,0,n-2),clamp(y,0,n-2))}
function blur(a,n){const b=new Float32Array(a.length),c=new Float32Array(a.length),w=[1,4,6,4,1];for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let k=-2;k<=2;k++)b[y*n+x]+=a[y*n+clamp(x+k,0,n-1)]*w[k+2]/16;for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let k=-2;k<=2;k++)c[y*n+x]+=b[clamp(y+k,0,n-1)*n+x]*w[k+2]/16;return c}
// Pillow's GaussianBlur approximation: three fractional box passes per axis,
// rounding to 8-bit after each pass. L conversion uses Pillow's integer weights.
function grayscale(pixels,size,invert=false){const g=new Uint8Array(size*size);for(let i=0;i<g.length;i++){const j=i*4,v=(19595*pixels[j]+38470*pixels[j+1]+7471*pixels[j+2])>>16;g[i]=invert?255-v:v}return g}
function gaussianL(gray,n,sigma){
 if(sigma<=0)return gray.slice();const variance=sigma*sigma/3,l=Math.floor((Math.sqrt(12*variance+1)-1)/2),fraction=(2*l+1)*(l*(l+1)-3*variance)/(6*(variance-(l+1)*(l+1))),radius=l+fraction;
 const denominator=2*radius+1,inner=1/denominator,edge=fraction/denominator;let a=gray.slice();
 for(let axis=0;axis<2;axis++)for(let pass=0;pass<3;pass++){const b=new Uint8Array(a.length);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let sum=0;for(let k=-l;k<=l;k++)sum+=a[axis?clamp(y+k,0,n-1)*n+x:y*n+clamp(x+k,0,n-1)]*inner;sum+=(a[axis?clamp(y-l-1,0,n-1)*n+x:y*n+clamp(x-l-1,0,n-1)]+a[axis?clamp(y+l+1,0,n-1)*n+x:y*n+clamp(x+l+1,0,n-1)])*edge;b[y*n+x]=Math.floor(sum+.5)}a=b}return a;
}
function imageInk(pixels,size,{invert=false,blur=.7}={}){return Float32Array.from(gaussianL(grayscale(pixels,size,invert),size,blur),v=>1-v/255)}
function centerFromGray(gray,size){
 const a=Float64Array.from(gaussianL(gray,size,1.2*size/768),v=>v/255),scale=size/768,mid=size/2,offsets=[];
 for(let r=0;r<=192;r+=2)for(let j=0;j<120;j++)offsets.push([r*scale*Math.cos(j*Math.PI/60),r*scale*Math.sin(j*Math.PI/60),r]);
 let angularEnergy=0;function score(cx,cy){let residual=0,angular=0;const values=new Float64Array(120);for(let row=0;row<97;row++){let sum=0,sq=0,groupSq=0;for(let j=0;j<120;j++){const d=offsets[row*120+j],v=clipped(a,size,cx+d[0],cy+d[1]);values[j]=v;sum+=v;sq+=v*v}for(let j=0;j<20;j++){let s=0;for(let k=0;k<6;k++)s+=values[k*20+j];groupSq+=s*s/6}residual+=(sq-groupSq)*row*2;angular+=(sq-sum*sum/120)*row*2}angularEnergy=angular;return residual/Math.max(1e-9,angular)}
 const midpointScore=score(mid,mid);let best={score:midpointScore,x:mid,y:mid};for(const [step,radius]of [[4,24],[1,4],[.25,1]]){const origin=[best.x,best.y];let next=null;for(let iy=-radius/step;iy<=radius/step;iy++)for(let ix=-radius/step;ix<=radius/step;ix++){const x=origin[0]+ix*step*scale,y=origin[1]+iy*step*scale;if(Math.abs(x-mid)>24*scale||Math.abs(y-mid)>24*scale)continue;const s=score(x,y);if(!next||s<next.score||(s===next.score&&(x<next.x||(x===next.x&&y<next.y))))next={score:s,x,y}}best=next}
 score(best.x,best.y);if(angularEnergy<1e-9)return {score:1,x:mid,y:mid,center:[mid,mid],midpointScore:1,searchBoundary:false,confidence:0,found:false,status:'insufficient angular evidence'};
 const searchBoundary=Math.max(Math.abs(best.x-mid),Math.abs(best.y-mid))>=24*scale;return {...best,center:[best.x,best.y],midpointScore,searchBoundary,confidence:clamp(1-best.score,0,1),found:Number.isFinite(best.score)&&best.score<.95,status:'auto'};
}
function findCenter(pixels,size,{invert=false,centerOverride=null}={}){if(centerOverride){const center=Array.isArray(centerOverride)?centerOverride:[centerOverride.x,centerOverride.y];if(center.length!==2||!center.every(Number.isFinite))throw Error('Center override must contain two finite artboard coordinates');return {x:center[0],y:center[1],center:center.slice(),status:'manual',found:true,confidence:1,searchBoundary:false}}return centerFromGray(grayscale(pixels,size,invert),size)}
function initialTrunks(pixels,size,invert,threshold,center){
 let symmetry=0;
 const n=Math.min(384,size),scale=size/n,cx=center[0]/scale,cy=center[1]/scale,gray=new Float32Array(n*n),raw=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let total=0,count=0;for(let yy=Math.floor(y*scale);yy<Math.floor((y+1)*scale);yy++)for(let xx=Math.floor(x*scale);xx<Math.floor((x+1)*scale);xx++){const i=(yy*size+xx)*4;total+=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255;count++}let v=count?total/count:1;if(invert)v=1-v;gray[y*n+x]=1-v;raw[y*n+x]=v<threshold/255?1:0}
 // A faint threshold-level connection must not turn an inter-branch opening
 // into solid material. Only interiors enclosed by reliable edges are filled.
 const reliable=threshold>230?Uint8Array.from(gray,v=>v>1-230/255?1:0):raw;
 const enclosed=F.fillHoles(reliable,n),imageTarget=Uint8Array.from(raw,(v,i)=>v||enclosed[i]?1:0);
 let target=F.components(imageTarget,n,true).mask;
 if(target.reduce((s,v)=>s+v,0)<12)return null;
 // Estimate the common orientation from grayscale center ridges, across all six arms.
 let axis=0,best=-Infinity;
 for(let deg=0;deg<60;deg+=.5){const a=deg*Math.PI/180;let score=0;for(let k=0;k<6;k++){const t=a+k*Math.PI/3,co=Math.cos(t),si=Math.sin(t);for(let r=10;r<n*.46;r+=1.5){const x=cx+r*co,y=cy+r*si,v=sample(gray,n,x,y),flanks=(sample(gray,n,x-si*3,y+co*3)+sample(gray,n,x+si*3,y-co*3))/2;score+=(v*.5+Math.max(0,v-flanks))*(.3+r/n)}}if(score>best){best=score;axis=a}}
 // Symmetry is applied to corresponding measured branches downstream, never to a blurred image.
 symmetry=0;
 const distance=F.distance(Uint8Array.from(target,v=>1-v),n),smooth=blur(gray,n);
 const at=(a,x,y)=>sample(a,n,x,y);
 const tree=[];
 // Independent continuous-angle measurements for the six trunks. Stop at the observed tip.
 for(let arm=0;arm<6;arm++){let winner=null,value=-Infinity;const base=axis+arm*Math.PI/3;
 for(let delta=(symmetry===100?0:-9);delta<=(symmetry===100?0:9);delta+=.25){const angle=base+delta*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);let last=0,gap=0,ink=0,contrast=0;
 for(let r=2;r<n*.65;r+=.5){const x=cx+r*co,y=cy+r*si;if(x<1||y<1||x>=n-1||y>=n-1)break;const on=at(target,x,y)>.35;if(on){last=r;gap=0}else gap+=.5;if(gap>2.5&&r>n*.06)break;const v=at(smooth,x,y);ink+=v;contrast+=v-(at(smooth,x-si*3,y+co*3)+at(smooth,x+si*3,y-co*3))/2}
 const score=last*3+ink*.15+contrast*.5;if(last>8&&score>value){winner={angle,last};value=score}}
 if(!winner)continue;
 for(let pass=0;pass<2;pass++){const shifts=[],co=Math.cos(winner.angle),si=Math.sin(winner.angle);for(let r=winner.last*.15;r<winner.last*.9;r+=2){const x=cx+r*co,y=cy+r*si,limit=Math.min(n*.04,at(distance,x,y)*3+4);let left=0,right=0;for(let w=.25;w<limit;w+=.25){if(at(target,x-w*si,y+w*co)<.5)break;left=w}for(let w=.25;w<limit;w+=.25){if(at(target,x+w*si,y-w*co)<.5)break;right=w}if(left<limit-.3&&right<limit-.3)shifts.push(Math.atan((left-right)/2/r))}shifts.sort((a,b)=>a-b);if(shifts.length&&symmetry!==100)winner.angle+=shifts[shifts.length>>1]}
 let measuredLast=0,gap=0;for(let r=2;r<n*.65;r+=.25){const x=cx+r*Math.cos(winner.angle),y=cy+r*Math.sin(winner.angle);if(x<1||y<1||x>=n-1||y>=n-1)break;if(at(target,x,y)>.35){measuredLast=r;gap=0}else gap+=.25;if(gap>2.5&&r>n*.06)break}if(measuredLast>8)winner.last=measuredLast;
 const end=[cx+winner.last*Math.cos(winner.angle),cy+winner.last*Math.sin(winner.angle)],path=[[cx,cy],end],id=tree.length;tree.push({id,parent:null,arm,depth:0,start:path[0],end,path,width:1,length:winner.last,confidence:1});
 }
 if(tree.length<1)return null;
 return {axis,tree:tree.map(t=>({id:t.id,arm:t.arm,start:t.start.map(v=>v*scale),end:t.end.map(v=>v*scale)}))};
}

function refineTrunks(ink,n,center,trunks,threshold){
 const unit=n/768;
 return trunks.map(t=>{const dx=t.end[0]-center[0],dy=t.end[1]-center[1],L=Math.hypot(dx,dy),base=Math.atan2(dy,dx);let best=null;
 for(let di=0;di<=160;di++){const delta=-12+di*.15,a=base+delta*Math.PI/180,co=Math.cos(a),si=Math.sin(a);let loss=0,energy=0,count=0,line=0,lineCount=0;
 for(let r=.3*L;r<1.02*L;r+=3*unit){for(let w=3*unit;w<Math.min(70*unit,L*.24);w+=3*unit){const left=clipped(ink,n,center[0]+r*co-w*si,center[1]+r*si+w*co),right=clipped(ink,n,center[0]+r*co+w*si,center[1]+r*si-w*co);loss+=(left-right)**2;energy+=left*left+right*right;count++}line+=clipped(ink,n,center[0]+r*co,center[1]+r*si);lineCount++}
 const score=loss/Math.max(1,count)/(energy/Math.max(1,count)+.002)+.12*(1-line/Math.max(1,lineCount))+.0001*delta*delta;if(!best||score<best.score)best={score,a,delta};
 }
 let length=L;for(let r=.6*L;r<1.15*L;r+=.25*unit)if(clipped(ink,n,center[0]+r*Math.cos(best.a),center[1]+r*Math.sin(best.a))>1-threshold/255)length=r;
 return {...t,start:center.slice(),end:[center[0]+length*Math.cos(best.a),center[1]+length*Math.sin(best.a)],angleChange:best.delta};
 });
}
function polygonValid(p,c){for(let k=0;k<6;k++){const a=p[k],b=p[(k+1)%6],d=p[(k+2)%6],ex=b[0]-a[0],ey=b[1]-a[1],fx=d[0]-b[0],fy=d[1]-b[1],cross=ex*fy-ey*fx,turn=Math.atan2(cross,ex*fx+ey*fy)*180/Math.PI;if(cross<=2||ex*(c[1]-a[1])-ey*(c[0]-a[0])<=0||Math.hypot(ex,ey)<=5||turn<=22||turn>=100)return false}return true}
function nested(outer,inner){for(let k=0;k<6;k++){const a=outer[k],b=outer[(k+1)%6];for(const v of inner)if((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0])<0)return false}return true}
function familyCompatible(p,r,kept){return kept.every(h=>r>h.radius?nested(p,h.polygon):nested(h.polygon,p))}
function evidenceKernel(ink,n){
 const gx=new Float32Array(ink.length),gy=new Float32Array(ink.length);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;gx[i]=x===0?ink[i+1]-ink[i]:x===n-1?ink[i]-ink[i-1]:(ink[i+1]-ink[i-1])/2;gy[i]=y===0?ink[i+n]-ink[i]:y===n-1?ink[i]-ink[i-n]:(ink[i+n]-ink[i-n])/2}
 function single(p,offset=0,bridge=true){const sides=[],coverage=[];for(let k=0;k<6;k++){const a=p[k],b=p[(k+1)%6],ex=b[0]-a[0],ey=b[1]-a[1],L=Math.max(.001,Math.hypot(ex,ey)),nx=-ey/L,ny=ex/L,support=new Uint8Array(25);let total=0,count=0;
 for(let j=0;j<25;j++){const u=.12+j*.76/24,qx=a[0]+u*ex+nx*offset,qy=a[1]+u*ey+ny*offset,v=clipped(ink,n,qx,qy),left=clipped(ink,n,qx+nx*2.5,qy+ny*2.5),right=clipped(ink,n,qx-nx*2.5,qy-ny*2.5),response=Math.max(Math.abs(left-right)*.65,Math.max(0,v-(left+right)/2));let aligned=false;
 for(let si=0;si<3;si++){const shift=-1.5+si*1.5,x=clipped(gx,n,qx+nx*shift,qy+ny*shift),y=clipped(gy,n,qx+nx*shift,qy+ny*shift),normal=Math.abs(x*nx+y*ny),tangent=Math.abs(x*ny-y*nx);if(normal>.025&&normal>tangent*2.5){aligned=true;break}}
 if(aligned&&response>.06){support[j]=1;total+=response;count++}}
 let linkedCount=count;if(bridge){const linked=support.slice();for(let gap=1;gap<=2;gap++)for(let j=0;j<25-gap-1;j++)if(support[j]&&support[j+gap+1])for(let d=1;d<=gap;d++)linked[j+d]=1;linkedCount=Math.min(linked.reduce((s,v)=>s+v,0),count+4)}sides.push(total/25);coverage.push(linkedCount/25)}
 return {score:mean(sides.slice().sort((a,b)=>a-b).slice(0,4))+.08*mean(coverage),sides,coverage};}
 function ribbon(p,offsets,penalty=0){const records=offsets.map(o=>single(p,o,true)),sides=[],coverage=[];for(let k=0;k<6;k++){let best=-Infinity,index=0;for(let j=0;j<offsets.length;j++){const merit=records[j].sides[k]+.1*records[j].coverage[k]-penalty*Math.abs(offsets[j]);if(merit>best){best=merit;index=j}}sides.push(records[index].sides[k]);coverage.push(records[index].coverage[k])}return {score:mean(sides.slice().sort((a,b)=>a-b).slice(0,4))+.08*mean(coverage),sides,coverage}}
 return {single,evidence:(p,strict=false)=>strict?single(p,0,false):ribbon(p,[-3,-1.5,0,1.5,3]),band:(p,width)=>ribbon(p,Array.from({length:9},(_,i)=>-width+i*width/4),.002)};
}
const copy=p=>p.map(v=>v.slice());
function polygonRadius(p,c){return mean(p.map(v=>Math.hypot(v[0]-c[0],v[1]-c[1])))}
function regular(c,r,phase){return Array.from({length:6},(_,k)=>[c[0]+r*Math.cos(phase+k*Math.PI/3),c[1]+r*Math.sin(phase+k*Math.PI/3)])}
function argmax(options,fn){let best=-Infinity,winner=options[0];for(const p of options){const score=fn(p);if(score>best){best=score;winner=p}}return winner}
function snapRidges(E,p,c){const offsets=[-3,-1.5,0,1.5,3],records=offsets.map(o=>E.single(p,o)),normals=[],distances=[];for(let k=0;k<6;k++){let best=-Infinity,o=0;for(let j=0;j<5;j++){const merit=records[j].sides[k]+.1*records[j].coverage[k]-.002*Math.abs(offsets[j]);if(merit>best){best=merit;o=offsets[j]}}const a=p[k],b=p[(k+1)%6],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/L,(b[0]-a[0])/L];normals.push(n);distances.push(n[0]*a[0]+n[1]*a[1]+o)}const q=[];for(let k=0;k<6;k++){const j=(k+5)%6,a=normals[j],b=normals[k],det=a[0]*b[1]-a[1]*b[0];if(Math.abs(det)<1e-12)return p;q.push([(distances[j]*b[1]-a[1]*distances[k])/det,(a[0]*distances[k]-distances[j]*b[0])/det])}return polygonValid(q,c)?q:p}
function detectHexes(E,c,reach,trunks,strict=false){
 const established=strict?[]:detectHexes(E,c,reach,trunks,true),angles=trunks.map(t=>Math.atan2(t.end[1]-c[1],t.end[0]-c[0])),axis=Math.atan2(mean(angles.map(a=>Math.sin(6*a))),mean(angles.map(a=>Math.cos(6*a))))/6,radii=[];
 for(let r=Math.max(12,reach*.055);r<Math.min(145,reach*.47);r++)radii.push(r);if(!radii.length)return established;
 const phases=[];for(const base of [0,30])for(let d=-8;d<=8;d+=2)phases.push(axis+(base+d)*Math.PI/180);
 const scores=phases.map(phase=>radii.map(r=>E.evidence(regular(c,r,phase),strict).score)),seeds=[];
 for(let lo=radii[0];lo<radii[radii.length-1];lo+=5)for(let family=0;family<2;family++){let best=-Infinity,seed=null;for(let pi=family*9;pi<(family+1)*9;pi++)for(let ri=0;ri<radii.length;ri++)if(radii[ri]>=lo&&radii[ri]<lo+5&&scores[pi][ri]>best){best=scores[pi][ri];seed=[radii[ri],phases[pi]]}if(seed)seeds.push(seed)}
 const candidates=[];
 for(const [radius,phase]of seeds){let p=regular(c,radius,phase),options=[];for(const x of [-2,0,2])for(const y of [-2,0,2])options.push(p.map(v=>[v[0]+x,v[1]+y]));p=argmax(options,q=>E.evidence(q,strict).score);const seed=copy(p);
 for(const step of [1.5,.75])for(let repeat=0;repeat<2;repeat++)for(let k=0;k<6;k++){options=[];for(const x of [-step,0,step])for(const y of [-step,0,step]){const q=copy(p);q[k][0]+=x;q[k][1]+=y;options.push(q)}p=argmax(options,q=>{const displacement=q.map((v,j)=>(v[0]-seed[j][0])**2+(v[1]-seed[j][1])**2);return Math.sqrt(Math.max(...displacement))>Math.max(3,radius*.07)||!polygonValid(q,c)?-1:E.evidence(q,strict).score-.07*mean(displacement)/Math.max(2,radius*.04)**2})}
 if(!strict){const snapped=snapRidges(E,p,c),before=E.evidence(p),after=E.evidence(snapped),rb=E.single(p,0,false).coverage,ra=E.single(snapped,0,false).coverage;if((after.score>=before.score&&Math.min(...after.coverage)>=Math.min(...before.coverage))||(mean(ra)>=.88&&Math.min(...ra)>=.68&&mean(ra)>mean(rb)+.08))p=snapped}
 const ev=E.evidence(p,strict);if(!polygonValid(p,c)||Math.min(...ev.sides)<.04||Math.min(...ev.coverage)<.60||mean(ev.coverage)<(strict?.80:.88))continue;candidates.push({polygon:p,radius:polygonRadius(p,c),strong:strict,score:ev.score,sideContrast:ev.sides,sideCoverage:ev.coverage,rawSideCoverage:E.single(p,0,false).coverage});
 }
 const strong=established.map(h=>h.radius),selected=strict?candidates:established.concat(candidates.filter(h=>strong.length&&h.radius>Math.min(...strong)+12)),kept=[];selected.sort((a,b)=>(Number(b.strong)+b.score*mean(b.sideCoverage)**4)-(Number(a.strong)+a.score*mean(a.sideCoverage)**4));for(const h of selected){if(kept.some(k=>Math.abs(h.radius-k.radius)<Math.max(12,h.radius*.09)))continue;if(familyCompatible(h.polygon,h.radius,kept))kept.push(h)}return kept.sort((a,b)=>a.radius-b.radius);
}
function rayHits(poly,c,dirs){return dirs.map(d=>{let hit=Infinity;for(let k=0;k<6;k++){const a=poly[k],b=poly[(k+1)%6],ex=b[0]-a[0],ey=b[1]-a[1],ax=a[0]-c[0],ay=a[1]-c[1],det=d[1]*ex-d[0]*ey;if(Math.abs(det)<1e-12)continue;const r=(-ax*ey+ay*ex)/det,u=(d[0]*ay-d[1]*ax)/det;if(r>0&&u>=-.0001&&u<=1.0001)hit=Math.min(hit,r)}if(!Number.isFinite(hit))throw Error('Center lies outside hexagon proposal');return hit})}
// The accepted V3 runner's readonly Pillow mask prevented floodfill from
// mutating it; its inferred-hub stage always selected this bounded reach prior.
// Preserve that accepted geometry explicitly rather than claiming gap evidence.
function inferredRadius(ink,n,c,dirs,reach,threshold){return clamp(reach*.07,10,35)}

function fitHexes(E,ink,n,c,trunks,threshold){const sorted=trunks.slice().sort((a,b)=>Math.atan2(a.end[1]-c[1],a.end[0]-c[0])-Math.atan2(b.end[1]-c[1],b.end[0]-c[0])),lengths=sorted.map(t=>Math.hypot(t.end[0]-c[0],t.end[1]-c[1])),dirs=sorted.map((t,k)=>[(t.end[0]-c[0])/lengths[k],(t.end[1]-c[1])/lengths[k]]),reach=median(lengths),polys=r=>dirs.map((d,k)=>[c[0]+d[0]*r[k],c[1]+d[1]*r[k]]);
 let detected=detectHexes(E,c,reach,trunks),strong=detected.filter(h=>h.strong).map(h=>h.radius),maximum=strong.length?Math.max(...strong):0;detected=detected.filter(h=>h.strong||h.radius<=maximum*1.6);let seeds=detected.map(h=>({r:rayHits(h.polygon,c,dirs),required:false}));if(!seeds.length)seeds=[{r:Array(6).fill(inferredRadius(ink,n,c,dirs,reach,threshold)),required:true}];const hexes=[];let previous=null;
 for(const record of seeds){const seed=record.r,lower=seed.map((v,k)=>Math.max(6,v*.8,previous?previous[k]+2:0)),upper=seed.map((v,k)=>Math.min(lengths[k],v*1.2));if(lower.some((v,k)=>v>upper[k]))continue;let r=seed.map((v,k)=>clamp(v,lower[k],upper[k]));const objective=q=>{const p=polys(q);if(!polygonValid(p,c))return -1e6;const average=mean(q);return E.evidence(p).score-.08*mean(q.map((v,k)=>((v-seed[k])/Math.max(3,seed[k]*.1))**2))-.03*mean(q.map(v=>(v/average-1)**2))};for(const step of [2,1,.5])for(let repeat=0;repeat<2;repeat++)for(let k=0;k<6;k++){const options=[-step,0,step].map(d=>{const q=r.slice();q[k]=clamp(q[k]+d,lower[k],upper[k]);return q});r=argmax(options,objective)}let polygon=polys(r);if(!polygonValid(polygon,c)){r=Array(6).fill(mean(seed));polygon=polys(r)}const ev=E.single(polygon,0,false),observed=!record.required&&Math.min(...ev.coverage)>=.60&&mean(ev.coverage)>=.80;hexes.push({polygon,radius:mean(r),radii:r,vertexArmIds:sorted.map(t=>t.arm),inferred:!observed,reason:record.required?'required hub inferred from bounded trunk-reach prior':'previous image outline fitted on fixed trunk rays',sideContrast:ev.sides,rawSideCoverage:ev.coverage,score:ev.score});previous=r}
 return {hexes,dirs,lengths,reach,polys,armIds:sorted.map(t=>t.arm)};
}

function interiorSupport(poly,gray,n){let total=0,on=0;const ymin=Math.max(0,Math.floor(Math.min(...poly.map(p=>p[1])))),ymax=Math.min(n-1,Math.ceil(Math.max(...poly.map(p=>p[1]))));for(let y=ymin;y<=ymax;y++){const hits=[];for(let k=0;k<6;k++){const a=poly[k],b=poly[(k+1)%6];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))hits.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))}if(hits.length<2)continue;const lo=Math.max(0,Math.ceil(Math.min(...hits))),hi=Math.min(n-1,Math.floor(Math.max(...hits)));for(let x=lo;x<=hi;x++){total++;if(gray[y*n+x]<250)on++}}return total?on/total:0}
function extendHexes(E,frame,c,gray,n,version){const {dirs,lengths,reach,polys,armIds}=frame,old=frame.hexes,r0=version===4?Math.min(...old.map(h=>h.radius)):Math.max(...old.map(h=>h.radius)),lo=version===4?r0+12:r0+Math.max(12,r0*.20),hi=version===4?Math.min(150,reach*.47):Math.min(240,reach*.70,Math.min(...lengths)*.80),proposals=[];
 for(let r=lo;r<hi;r++)proposals.push({r,score:E.evidence(polys(Array(6).fill(r))).score});proposals.sort((a,b)=>b.score-a.score);const seeds=[];for(const proposal of proposals){const radius=proposal.r;if(old.some(h=>Math.abs(radius-h.radius)<Math.max(10,h.radius*.08))||seeds.some(r=>Math.abs(radius-r)<7))continue;seeds.push(radius);if(seeds.length>=14)break}const candidates=[];
 for(const seed of seeds){let r=Array(6).fill(seed);const width=clamp(seed*.06,3,8),objective=q=>{const p=polys(q);return !polygonValid(p,c)?-1e6:E.band(p,width).score-.06*mean(q.map(v=>((v-seed)/Math.max(3,seed*.08))**2))};for(const step of [2,1,.5])for(let k=0;k<6;k++){r=argmax([-step,0,step].map(d=>{const q=r.slice();q[k]=clamp(q[k]+d,seed*.88,seed*1.12);return q}),objective)}const polygon=polys(r),radius=mean(r),ev=E.single(polygon,0,false),band=E.band(polygon,width),linked=band.coverage,direct=Math.min(...ev.coverage)>=.60&&mean(ev.coverage)>=.80,controlStep=Math.max(12,seed*.15),controls=[E.band(polys(r.map(v=>Math.max(6,v-controlStep))),width),E.band(polys(r.map(v=>v+controlStep)),width)],prominence=(band.score-mean(controls.map(e=>e.score)))/Math.max(.02,band.score),coherentPeak=Math.min(...linked)>=.55&&mean(linked)>=.68&&Math.min(...band.sides)>=.05&&Math.min(...ev.sides)>=.04&&prominence>=.25,sideProminence=band.sides.map((v,k)=>(v-(controls[0].sides[k]+controls[1].sides[k])/2)/Math.max(.02,v)),repeatablePeak=version===6&&Math.min(...linked)>=.55&&Math.min(...ev.sides)>=.05&&sideProminence.filter(v=>v>.15).length>=5&&Math.min(...sideProminence)>-.05&&mean(sideProminence)>.30,supported=repeatablePeak||coherentPeak||direct||(Math.min(...linked)>=.68&&mean(linked)>=.88&&Math.min(...band.sides)>=.06);
 if(!supported||!polygonValid(polygon,c))continue;if(old.length>1&&radius>Math.max(...old.map(h=>h.radius))*1.6&&!repeatablePeak)continue;const materialSupport=interiorSupport(polygon,gray,n);if(!direct&&materialSupport<.90)continue;if(!familyCompatible(polygon,radius,old))continue;candidates.push({polygon,radius,radii:r,vertexArmIds:armIds.slice(),inferred:!direct,reason:'shared outward image search from existing hub',sideContrast:ev.sides,rawSideCoverage:ev.coverage,linkedSideCoverage:linked,score:ev.score,added:true,...(version===6?{added_v6:true}:{}),bandWidth:width,bandSideContrast:band.sides,prominence,controlStep,coherentPeak,repeatablePeak,sideProminence,interiorMaterialSupport:materialSupport});
 }
 const kept=old.slice();for(const h of candidates.sort((a,b)=>b.score-a.score)){if(kept.some(k=>Math.abs(h.radius-k.radius)-(version===6?h.bandWidth/Math.cos(Math.PI/6):0)<Math.max(12,k.radius*.20)))continue;if(familyCompatible(h.polygon,h.radius,kept)){kept.push(h);break}}frame.hexes=kept.sort((a,b)=>a.radius-b.radius);return frame;
}
function prepare(pixels,size,{invert=false,threshold=230,centerOverride=null}={}){
 if(!Number.isInteger(size)||size<32||!pixels||pixels.length!==size*size*4)throw Error('Framework requires a square RGBA raster of at least 32 pixels');const start=now(),timings={},gray=grayscale(pixels,size,invert),ink=Float32Array.from(gaussianL(gray,size,.7*size/768),v=>1-v/255),branchInk=Float32Array.from(gaussianL(gray,size,.65*size/768),v=>1-v/255),trunkInk=Float32Array.from(gaussianL(gray,size,1.2*size/768),v=>1-v/255);timings.image=now()-start;let t=now();const centerResult=centerOverride?findCenter(pixels,size,{invert,centerOverride}):centerFromGray(grayscale(pixels,size,invert),size),center=centerResult.center;timings.center=now()-t;t=now();const initial=initialTrunks(pixels,size,invert,threshold,center);if(!initial||initial.tree.length!==6)throw Error('Image evidence does not establish six straight trunks');const trunks=refineTrunks(trunkInk,size,center,initial.tree,threshold);timings.trunks=now()-t;t=now();const E=evidenceKernel(ink,size),frame=fitHexes(E,ink,size,center,trunks,threshold);timings.hexFit=now()-t;t=now();extendHexes(E,frame,center,gray,size,4);timings.hexExtend4=now()-t;t=now();extendHexes(E,frame,center,gray,size,6);timings.hexExtend6=now()-t;timings.total=now()-start;
 return {size,ink,branchInk,center,trunks,hexagons:frame.hexes,axis:initial.axis,diagnostics:{algorithm:'accepted-center-trunks-hex-v6',center:centerResult,timings,threshold,invert,coordinates:'supplied square artboard pixel centers'}};
}
const api={prepare,extract:prepare,findCenter,imageInk};root.ReconstructionFramework=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
