/* Image measurements only. No polygon templates, angle quantization or geometry strength here. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sample(a,n,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const get=(xx,yy)=>xx>=0&&yy>=0&&xx<n&&yy<n?a[yy*n+xx]:0;return get(ix,iy)*(1-fx)*(1-fy)+get(ix+1,iy)*fx*(1-fy)+get(ix,iy+1)*(1-fx)*fy+get(ix+1,iy+1)*fx*fy}
function blur(a,n){const b=new Float32Array(a.length),c=new Float32Array(a.length),w=[1,4,6,4,1];for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let k=-2;k<=2;k++)b[y*n+x]+=a[y*n+clamp(x+k,0,n-1)]*w[k+2]/16;for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let k=-2;k<=2;k++)c[y*n+x]+=b[clamp(y+k,0,n-1)*n+x]*w[k+2]/16;return c}
class Heap{constructor(){this.a=[]}push(v){let i=this.a.length;this.a.push(v);while(i){let p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p}this.a[i]=v}pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(this.a[c][0]>=last[0])break;this.a[i]=this.a[c];i=c}this.a[i]=last}return first}}
function project(p,path){let best={distance:Infinity};for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j],dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1),q=[a[0]+u*dx,a[1]+u*dy],distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(distance<best.distance)best={point:q,distance,segment:j,u}}return best}
function simplifyOpen(p,tolerance){if(p.length<3)return p;const a=p[0],b=p[p.length-1];let best=0,index=0;for(let i=1;i<p.length-1;i++){const e=project(p[i],[a,b]).distance;if(e>best){best=e;index=i}}return best>tolerance?[...simplifyOpen(p.slice(0,index+1),tolerance).slice(0,-1),...simplifyOpen(p.slice(index),tolerance)]:[a,b]}
function length(path){let l=0;for(let i=1;i<path.length;i++)l+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);return l}
function extract(pixels,size,invert=false,symmetry=0,threshold=230){
 const n=Math.min(384,size),scale=size/n,c=n/2,gray=new Float32Array(n*n),raw=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let total=0,count=0;for(let yy=Math.floor(y*scale);yy<Math.floor((y+1)*scale);yy++)for(let xx=Math.floor(x*scale);xx<Math.floor((x+1)*scale);xx++){const i=(yy*size+xx)*4;total+=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255;count++}let v=count?total/count:1;if(invert)v=1-v;gray[y*n+x]=1-v;raw[y*n+x]=v<threshold/255?1:0}
 // A faint threshold-level connection must not turn an inter-branch opening
 // into solid material. Only interiors enclosed by reliable edges are filled.
 const reliable=threshold>230?Uint8Array.from(gray,v=>v>1-230/255?1:0):raw;
 const enclosed=F.fillHoles(reliable,n),imageTarget=Uint8Array.from(raw,(v,i)=>v||enclosed[i]?1:0);
 let target=F.components(imageTarget,n,true).mask;
 if(target.reduce((s,v)=>s+v,0)<12)return null;
 // Estimate the common orientation from grayscale center ridges, across all six arms.
 let axis=0,best=-Infinity;
 for(let deg=0;deg<60;deg+=.5){const a=deg*Math.PI/180;let score=0;for(let k=0;k<6;k++){const t=a+k*Math.PI/3,co=Math.cos(t),si=Math.sin(t);for(let r=10;r<n*.46;r+=1.5){const x=c+r*co,y=c+r*si,v=sample(gray,n,x,y),flanks=(sample(gray,n,x-si*3,y+co*3)+sample(gray,n,x+si*3,y-co*3))/2;score+=(v*.5+Math.max(0,v-flanks))*(.3+r/n)}}if(score>best){best=score;axis=a}}
 // Symmetry is applied to corresponding measured branches downstream, never to a blurred image.
 symmetry=0;
 const distance=F.distance(Uint8Array.from(target,v=>1-v),n),smooth=blur(gray,n),cost=Float32Array.from(distance,(v,i)=>(1.3-smooth[i])**2/Math.sqrt(.8+v));
 const at=(a,x,y)=>sample(a,n,x,y);
 // A continuous internal vein survives a low-percentile intensity test. Serrated
 // outer edges produce bright gaps. Medial clearance suppresses boundary ridges.
 function veinQuality(path){const a=path[0],b=path[1],values=[];let medial=0;for(let u=.35;u<.94;u+=.04){const x=a[0]+u*(b[0]-a[0]),y=a[1]+u*(b[1]-a[1]);values.push(at(gray,x,y));medial+=Math.log(.5+at(distance,x,y))}values.sort((a,b)=>a-b);const clearance=Math.exp(medial/values.length)-.5;return values[Math.floor(values.length*.2)]*clamp((clearance-2)/2,0,1)}

 const owner=new Int32Array(n*n).fill(-1),parent=new Int32Array(n*n).fill(-1),dist=new Float64Array(n*n).fill(Infinity),order=[],heap=new Heap(),tree=[];
 function pixel([x,y]){return clamp(Math.round(y),0,n-1)*n+clamp(Math.round(x),0,n-1)}
 function seedPath(path,id){for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let r=0;r<=len;r+=.4){const u=len?r/len:0,i=pixel([a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])]);if(!target[i])continue;owner[i]=id;if(dist[i]!==0){dist[i]=0;heap.push([0,i])}}}}
 // Independent continuous-angle measurements for the six trunks. Stop at the observed tip.
 for(let arm=0;arm<6;arm++){let winner=null,value=-Infinity;const base=axis+arm*Math.PI/3;
 for(let delta=(symmetry===100?0:-9);delta<=(symmetry===100?0:9);delta+=.25){const angle=base+delta*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);let last=0,gap=0,ink=0,contrast=0;
 for(let r=2;r<n*.65;r+=.5){const x=c+r*co,y=c+r*si;if(x<1||y<1||x>=n-1||y>=n-1)break;const on=at(target,x,y)>.35;if(on){last=r;gap=0}else gap+=.5;if(gap>2.5&&r>n*.06)break;const v=at(smooth,x,y);ink+=v;contrast+=v-(at(smooth,x-si*3,y+co*3)+at(smooth,x+si*3,y-co*3))/2}
 const score=last*3+ink*.15+contrast*.5;if(last>8&&score>value){winner={angle,last};value=score}}
 if(!winner)continue;
 for(let pass=0;pass<2;pass++){const shifts=[],co=Math.cos(winner.angle),si=Math.sin(winner.angle);for(let r=winner.last*.15;r<winner.last*.9;r+=2){const x=c+r*co,y=c+r*si,limit=Math.min(n*.04,at(distance,x,y)*3+4);let left=0,right=0;for(let w=.25;w<limit;w+=.25){if(at(target,x-w*si,y+w*co)<.5)break;left=w}for(let w=.25;w<limit;w+=.25){if(at(target,x+w*si,y-w*co)<.5)break;right=w}if(left<limit-.3&&right<limit-.3)shifts.push(Math.atan((left-right)/2/r))}shifts.sort((a,b)=>a-b);if(shifts.length&&symmetry!==100)winner.angle+=shifts[shifts.length>>1]}
 let measuredLast=0,gap=0;for(let r=2;r<n*.65;r+=.25){const x=c+r*Math.cos(winner.angle),y=c+r*Math.sin(winner.angle);if(x<1||y<1||x>=n-1||y>=n-1)break;if(at(target,x,y)>.35){measuredLast=r;gap=0}else gap+=.25;if(gap>2.5&&r>n*.06)break}if(measuredLast>8)winner.last=measuredLast;
 const end=[c+winner.last*Math.cos(winner.angle),c+winner.last*Math.sin(winner.angle)],path=[[c,c],end],id=tree.length;tree.push({id,parent:null,arm,depth:0,start:path[0],end,path,width:1,length:winner.last,confidence:1});seedPath(path,id);
 }
 if(tree.length<1)return null;
 for(const t of tree){const widths=[];for(let r=2;r<t.length-2;r+=1)widths.push(at(distance,t.start[0]+r/t.length*(t.end[0]-t.start[0]),t.start[1]+r/t.length*(t.end[1]-t.start[1])));widths.sort((a,b)=>a-b);t.width=widths.length?widths[Math.floor(widths.length*.4)]:1}
 // Multi-source geodesics: every predecessor stays inside the connected crystal mask.
 // Dark internal ridges and medial clearance both lower cost; no jump edges are permitted.
 const neighbors=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)neighbors.push([dx,dy,Math.hypot(dx,dy)]);
 while(heap.a.length){const [value,i]=heap.pop();if(value!==dist[i])continue;order.push(i);const x=i%n,y=(i/n)|0;for(const [dx,dy,step] of neighbors){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const j=yy*n+xx;if(!target[j])continue;if(dx&&dy&&!target[y*n+xx]&&!target[yy*n+x])continue;const next=value+step*(cost[i]+cost[j])/2;if(next<dist[j]){dist[j]=next;parent[j]=i;heap.push([next,j])}}}
 const valid=target.slice();
 function invalidate(path){for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<=l;t+=.7){const u=l?t/l:0,x=a[0]+u*(b[0]-a[0]),y=a[1]+u*(b[1]-a[1]),radius=at(distance,x,y)*1.15+1,rr=Math.ceil(radius);for(let yy=Math.max(0,Math.floor(y)-rr);yy<Math.min(n,Math.ceil(y)+rr+1);yy++)for(let xx=Math.max(0,Math.floor(x)-rr);xx<Math.min(n,Math.ceil(x)+rr+1);xx++)if((xx-x)**2+(yy-y)**2<=radius*radius)valid[yy*n+xx]=0}}}
 for(const t of tree)invalidate(t.path);
 const remaining=new Float32Array(n*n);
 for(let iteration=0;iteration<700;iteration++){
  let tip=-1,longest=0;
  // Topological order makes distance-to-current-tree an O(image area) recurrence.
  for(const i of order){const p=parent[i];remaining[i]=owner[i]>=0||p<0?0:remaining[p]+Math.hypot(i%n-p%n,((i/n)|0)-((p/n)|0));if(valid[i]&&remaining[i]>longest){longest=remaining[i];tip=i}}
  if(tip<0||longest<2.7)break;
  const ids=[];let p=tip;while(p>=0&&owner[p]<0){ids.push(p);p=parent[p]}
  if(p<0){valid[tip]=0;continue}ids.push(p);ids.reverse();const parentId=owner[p],ancestor=tree[parentId],points=ids.map(i=>[i%n,(i/n)|0]);
  // Fit a continuous straight growth axis to the distal image evidence. Search the
  // junction along the parent; never preserve the shortest-path elbow as a branch.
  function measureLine(points,useVein=false){const end=points[points.length-1],join=points[0],rawLength=length(points);let path=null,fitScore=-Infinity;
  for(let seg=1;seg<ancestor.path.length;seg++){const aa=ancestor.path[seg-1],bb=ancestor.path[seg],pl=Math.hypot(bb[0]-aa[0],bb[1]-aa[1]);for(let r=0;r<=pl;r+=.5){const u=r/pl,start=[aa[0]+u*(bb[0]-aa[0]),aa[1]+u*(bb[1]-aa[1])];if(Math.hypot(start[0]-join[0],start[1]-join[1])>Math.max(8,rawLength*.8))continue;const dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy);if(len<2)continue;
   const tangent=Math.abs((dx*(bb[0]-aa[0])+dy*(bb[1]-aa[1]))/(len*pl));if(tangent>.97)continue;
   let on=0,count=0,medial=0,ink=0,gap=0,maxGap=0;
   for(let v=.05;v<.98;v+=.04){const x=start[0]+v*dx,y=start[1]+v*dy,support=at(target,x,y);on+=support>.35?1:0;gap=support>.35?0:gap+len*.04;maxGap=Math.max(maxGap,gap);count++;if(v>.35){medial+=Math.log(.5+at(distance,x,y));const nx=-dy/len,ny=dx/len,w=Math.max(1.5,at(distance,x,y));ink+=at(smooth,x,y)-Math.max(at(smooth,x+w*nx,y+w*ny),at(smooth,x-w*nx,y-w*ny))}}
   if(on/count<.95||maxGap>1.2)continue;
   const turn=Math.acos(clamp((dx*(bb[0]-aa[0])+dy*(bb[1]-aa[1]))/(len*pl),-1,1));
   const score=medial/16+ink/16*.4+(useVein?veinQuality([start,end])*3-4*(turn-Math.PI/3)**2:0)-len*.002;if(score>fitScore){fitScore=score;path=[start,end]}
  }}
  return path;}
  let path=measureLine(points);

  if(!path){const reduced=simplifyOpen(points,1.1);let bend=null,bendScore=0;for(let k=1;k<reduced.length-1;k++){const a=reduced[k-1],b=reduced[k],c=reduced[k+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),angle=Math.abs(Math.atan2((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])));if(l1<5||l2<5||angle<.3||project(b,ancestor.path).distance<Math.max(4,ancestor.width*2))continue;const score=Math.min(l1,l2)*angle;if(score>bendScore){bend=b;bendScore=score}}
   if(bend){let at=0,d=Infinity;for(let i=0;i<points.length;i++){const e=Math.hypot(points[i][0]-bend[0],points[i][1]-bend[1]);if(e<d){at=i;d=e}}const prefix=points.slice(0,at+1),measured=measureLine(prefix);if(measured){path=measured;points.length=at+1;ids.length=at+1}}
  }
  if(!path){invalidate(points);valid[tip]=0;continue}
  // Recenter cross-sections before measuring angle. Farthest boundary pixels can
  // sit on one side of a rounded tip; they must not tilt the whole centerline.
  {const a=path[0],b=path[1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,centers=[];
   for(let u=.38;u<=.91;u+=.04){const x=a[0]+u*dx,y=a[1]+u*dy,limit=Math.max(4,at(distance,x,y)*3);let left=0,right=0;for(let r=.25;r<limit;r+=.25){if(at(target,x+r*nx,y+r*ny)<.5)break;left=r}for(let r=.25;r<limit;r+=.25){if(at(target,x-r*nx,y-r*ny)<.5)break;right=r}if(left<limit-.3&&right<limit-.3)centers.push([x+(left-right)/2*nx,y+(left-right)/2*ny,left+right])}
   if(centers.length>=5){const widths=centers.map(v=>v[2]).sort((a,b)=>a-b),median=widths[widths.length>>1],usable=centers.filter(v=>v[2]<median*1.5),mean=usable.reduce((v,p)=>[v[0]+p[0]/usable.length,v[1]+p[1]/usable.length],[0,0]);let xx=0,yy=0,xy=0;for(const p of usable){xx+=(p[0]-mean[0])**2;yy+=(p[1]-mean[1])**2;xy+=(p[0]-mean[0])*(p[1]-mean[1])}let angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle);if(ux*dx+uy*dy<0){ux=-ux;uy=-uy}
    for(let j=1;j<ancestor.path.length;j++){const p=ancestor.path[j-1],q=ancestor.path[j],vx=q[0]-p[0],vy=q[1]-p[1],den=ux*vy-uy*vx;if(Math.abs(den)<1e-5)continue;const t=((p[0]-mean[0])*vy-(p[1]-mean[1])*vx)/den,v=((p[0]-mean[0])*uy-(p[1]-mean[1])*ux)/den;if(v<0||v>1)continue;const start=[mean[0]+t*ux,mean[1]+t*uy],len=(b[0]-start[0])*ux+(b[1]-start[1])*uy;if(len<2||Math.hypot(start[0]-a[0],start[1]-a[1])>L*.4)continue;let on=0,count=0;for(let r=0;r<len;r+=.5){on+=at(target,start[0]+r*ux,start[1]+r*uy)>.35?1:0;count++}if(on/count<.95)continue;let extent=len;for(let r=len;r<len+3;r+=.25){if(at(target,start[0]+r*ux,start[1]+r*uy)<.35)break;extent=r}path=[start,[start[0]+extent*ux,start[1]+extent*uy]];break}
   }
  }
  // A polygon corner does not establish a lateral branch. Require a separated
  // protrusion, or a coherent internal dark ridge on both sides of the line.
  function support(candidate){
   const path=candidate;
  let separated=0,ridge=0,outlinedRidge=0,ridgeCount=0;
  const dx=path[1][0]-path[0][0],dy=path[1][1]-path[0][1],lineLength=Math.hypot(dx,dy),nx=-dy/lineLength,ny=dx/lineLength;
  for(const u of [.5,.65,.8,.9]){const q=[path[0][0]+u*dx,path[0][1]+u*dy],near=project(q,ancestor.path).point,L=Math.hypot(q[0]-near[0],q[1]-near[1]);let gap=0,best=0;for(let v=0;v<L;v+=.5){gap=at(target,q[0]+v/L*(near[0]-q[0]),q[1]+v/L*(near[1]-q[1]))<.3?gap+.5:0;best=Math.max(best,gap)}if(best>=1)separated++}
  for(let u=.25;u<.9;u+=.05){const x=path[0][0]+u*dx,y=path[0][1]+u*dy,w=Math.max(1.5,Math.min(3,at(distance,x,y)));const contrast=at(smooth,x,y)-Math.max(at(smooth,x+w*nx,y+w*ny),at(smooth,x-w*nx,y-w*ny));ridge+=contrast>.025?1:0;
   // A translucent branch can have a pale center and two dark edges. Require
   // paired edge evidence; a single dark contour is insufficient.
   let left=0,right=0;const limit=Math.max(2,at(distance,x,y)*1.75+1),centerInk=at(smooth,x,y);
   for(let r=.5;r<=limit;r+=.5){left=Math.max(left,at(smooth,x+r*nx,y+r*ny));right=Math.max(right,at(smooth,x-r*nx,y-r*ny))}
   outlinedRidge+=Math.min(left,right)-centerInk>.08?1:0;ridgeCount++}
  const meanClearance=[.4,.55,.7,.85].reduce((sum,u)=>sum+at(distance,path[0][0]+u*dx,path[0][1]+u*dy),0)/4;
  const pairedEdges=outlinedRidge/ridgeCount>=.4&&lineLength>at(distance,...path[0])*1.75;
  const slenderProtrusion=meanClearance<=3&&lineLength>meanClearance*3.4&&lineLength>at(distance,...path[0])*2;
  const narrowRidge=((ridge/ridgeCount>=.23||pairedEdges)&&lineLength>meanClearance*2.75)||slenderProtrusion;
   return {separated,ridge:ridge/ridgeCount,narrowRidge,accepted:separated>=1||ridge/ridgeCount>=.65||narrowRidge};
  }
  let evidence=support(path);
  // A medial fit can cut across leaf edges and fail the branch test even though
  // the image contains a continuous stem. Test the vein-corrected hypothesis
  // before discarding it. Recovery requires strong ridge or separated-tip
  // evidence; a weak facet line inside a broad plate is insufficient.
  const veinPath=measureLine(points,true);
  if(veinPath&&veinQuality(veinPath)>Math.max(.1,veinQuality(path)+.025)){
   if(evidence.accepted){path=veinPath}
   else {const refined=support(veinPath);if(refined.accepted&&(refined.separated>=1||veinQuality(veinPath)>.3)){path=veinPath;evidence=refined}}
  }
  const {separated,narrowRidge}=evidence;
  if(!evidence.accepted){invalidate(points);valid[tip]=0;continue}
  function crossing(line){const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);for(const t of tree)for(let j=1;j<t.path.length;j++)for(let k=1;k<line.length;k++){const a=line[k-1],b=line[k],c=t.path[j-1],d=t.path[j];if(orient(a,b,c)*orient(a,b,d)<-1e-7&&orient(c,d,a)*orient(c,d,b)<-1e-7)return true}return false}
  if(crossing(path)){invalidate(points);valid[tip]=0;continue}
  const len=length(path),widths=points.slice(1,-1).map(q=>at(distance,...q)).sort((a,b)=>a-b),width=widths.length?widths[Math.floor(widths.length*.5)]:1;
  // A second edge of a wide stem is not a second branch. Require a distinct distal tip.
  let duplicate=false;for(const t of tree){const near=project(path[path.length-1],t.path);if(near.distance<Math.max(1.6,Math.min(width,t.width)*.8)){duplicate=true;break}}
  if(tree.some(t=>t.parent===parentId&&Math.hypot(t.start[0]-path[0][0],t.start[1]-path[0][1])<ancestor.width*2.5&&separated===0&&len<ancestor.width*2.75&&t.length>len*3))duplicate=true;
  // Merge two edges of one terminal cap, but retain two genuinely separated tips.
  for(const t of tree){const end=path[path.length-1],span=Math.hypot(end[0]-t.end[0],end[1]-t.end[1]);if(span>Math.max(3,t.width*2.5))continue;let gap=0,maxGap=0;for(let r=0;r<span;r+=.25){const u=span?r/span:0;gap=at(target,end[0]+u*(t.end[0]-end[0]),end[1]+u*(t.end[1]-end[1]))<.35?gap+.25:0;maxGap=Math.max(maxGap,gap)}if(maxGap<.75){duplicate=true;break}}
  if(duplicate||len<Math.max(2.7,at(distance,...path[0])*(narrowRidge?.75:1.45))){invalidate(points);valid[tip]=0;continue}
  const id=tree.length;tree.push({id,parent:parentId,arm:ancestor.arm,depth:ancestor.depth+1,start:path[0],end:path[path.length-1],path,width,length:len,confidence:clamp(len/(width*3+1),0,1)});
  for(const i of ids)if(owner[i]<0)owner[i]=id;
  invalidate(points);invalidate(path);
 }
 // Sample widths from the image after all topology decisions; polygons cannot feed back into detection.
 for(const t of tree){const ws=[];for(let j=1;j<t.path.length;j++){const a=t.path[j-1],b=t.path[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let r=1;r<len;r++)ws.push(at(distance,a[0]+r/len*(b[0]-a[0]),a[1]+r/len*(b[1]-a[1])))}ws.sort((a,b)=>a-b);t.width=ws.length?ws[Math.floor(ws.length*.4)]:1}
 // The initial ridge scan only seeds trunk searches. Use all six measured
 // trunks for the shared symmetry axis; retaining the coarse seed can mirror
 // a tip around a different axis and create a second tip beside it.
 let axisX=0,axisY=0;
 for(const t of tree)if(t.parent===null){const angle=Math.atan2(t.end[1]-t.start[1],t.end[0]-t.start[0])-axis;axisX+=Math.cos(6*angle);axisY+=Math.sin(6*angle)}
 axis+=Math.atan2(axisY,axisX)/6;
 return {n,scale,gray,raw,imageTarget,imageDistance:F.distance(Uint8Array.from(imageTarget,v=>1-v),n),target,distance,tree,axis,source:'image-geodesic'};
}
function prune(model,detail){const min=2.7+45*(1-detail/100)**2,ids=new Map(),tree=[];for(const t of model.tree){if(t.parent!==null&&(!ids.has(t.parent)||t.length<min))continue;const id=tree.length;ids.set(t.id,id);tree.push({...t,id,parent:t.parent===null?null:ids.get(t.parent),sourceId:t.id})}return tree}
// Match branch observations in parent-relative coordinates. Each observation can
// contribute only once to a cluster; neighboring twigs on one arm cannot collapse.
function consensus(model){
 const roots=model.tree.filter(t=>t.parent===null),c=model.n/2,mean=a=>a.reduce((s,v)=>s+v,0)/a.length,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),children=new Map();
 for(const t of model.tree)if(t.parent!==null){if(!children.has(t.parent))children.set(t.parent,[]);children.get(t.parent).push(t)}
 const len=mean(roots.map(t=>t.length)),path=[[c,c],[c+len*Math.cos(model.axis),c+len*Math.sin(model.axis)]];
 const tree=[{id:0,parent:null,arm:0,depth:0,path,start:path[0],end:path[1],length:len,width:mean(roots.map(t=>t.width)),sources:roots.map(t=>({id:t.id,arm:t.arm,mirror:false})),u:0,angle:0}];
 for(let index=0;index<tree.length;index++){
  const p=tree[index],observations=[];
  for(const source of p.sources){const original=model.tree[source.id],parentAngle=Math.atan2(original.end[1]-original.start[1],original.end[0]-original.start[0]);for(const mirror of p.parent===null?[false,true]:[source.mirror]){
   const group=[];for(const child of children.get(original.id)||[]){const angle=wrap(Math.atan2(child.end[1]-child.start[1],child.end[0]-child.start[0])-parentAngle)*(mirror?-1:1);if(p.parent===null&&angle<=0)continue;const u=project(child.start,original.path).u;group.push({id:child.id,arm:source.arm,mirror,angle,u,length:child.length,width:child.width,key:original.id+':'+mirror})}if(group.length)observations.push(group)
  }}
  // Sequence alignment preserves proximal/distal order and permits missing
  // observations. Greedy nearest matching could swap two neighboring twigs.
  observations.sort((a,b)=>b.length-a.length);let clusters=[];
  const median=a=>{const q=a.slice().sort((a,b)=>a-b);return q.length%2?q[q.length>>1]:(q[q.length/2-1]+q[q.length/2])/2};
  const center=cluster=>({u:median(cluster.map(t=>t.u)),angle:median(cluster.map(t=>t.angle)),length:median(cluster.map(t=>t.length))});
  for(const unsorted of observations){const group=unsorted.slice().sort((a,b)=>a.u-b.u),m=clusters.length,n=group.length,dp=Array.from({length:m+1},()=>new Float64Array(n+1)),step=Array.from({length:m+1},()=>new Uint8Array(n+1));
   for(let i=1;i<=m;i++){dp[i][0]=i*1.1;step[i][0]=1}for(let j=1;j<=n;j++){dp[0][j]=j*1.1;step[0][j]=2}
   for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){const a=center(clusters[i-1]),b=group[j-1],du=Math.abs(a.u-b.u),da=Math.abs(wrap(a.angle-b.angle)),cost=du>.09||da>.55?Infinity:du/.065+da/.55+Math.min(.6,Math.abs(Math.log(a.length/b.length))*.35);const options=[dp[i-1][j-1]+cost,dp[i-1][j]+1.1,dp[i][j-1]+1.1];let k=options.indexOf(Math.min(...options));dp[i][j]=options[k];step[i][j]=k}
   const merged=[];let i=m,j=n;while(i||j){const k=step[i][j];if(k===0){merged.push([...clusters[--i],group[--j]])}else if(k===1)merged.push(clusters[--i]);else merged.push([group[--j]])}clusters=merged.reverse();
  }
  const minimum=Math.max(3,Math.ceil((p.parent===null?roots.length*2:p.sources.length)*.45));
  for(const cluster of clusters.sort((a,b)=>mean(a.map(t=>t.u))-mean(b.map(t=>t.u)))){const fineDistal=median(cluster.map(t=>t.u))>.6&&median(cluster.map(t=>t.length))<p.length*.2;const required=fineDistal?3:minimum;if(cluster.length<required||new Set(cluster.map(t=>t.arm)).size<2)continue;const u=median(cluster.map(t=>t.u)),angle=median(cluster.map(t=>t.angle)),length=median(cluster.map(t=>t.length)),a=Math.atan2(p.end[1]-p.start[1],p.end[0]-p.start[0])+angle,start=[p.start[0]+u*(p.end[0]-p.start[0]),p.start[1]+u*(p.end[1]-p.start[1])],end=[start[0]+length*Math.cos(a),start[1]+length*Math.sin(a)];tree.push({id:tree.length,parent:p.id,arm:0,depth:p.depth+1,u,angle,length,width:median(cluster.map(t=>t.width)),start,end,path:[start,end],sources:cluster})}
 }
 return {...model,tree};
}
root.BranchStructure={extract,prune,consensus,sample,project,simplifyOpen,length};if(typeof module!=='undefined')module.exports=root.BranchStructure;
})(globalThis);
