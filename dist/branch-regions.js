/* Branch ownership and image-fitted polygon pieces. No changes to detected axes. */
(function(root){
'use strict';
const B=typeof module!=='undefined'?require('./branch-structure.js'):root.BranchStructure;
const P=typeof module!=='undefined'?require('./polygon-fit.js'):root.PolygonFit;
const STEPS=128;
class Heap{constructor(){this.a=[]}push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p}this.a[i]=v}pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let k=i*2+1;if(k+1<this.a.length&&this.a[k+1][0]<this.a[k][0])k++;if(this.a[k][0]>=last[0])break;this.a[i]=this.a[k];i=k}this.a[i]=last}return first}}
function measure(model){
 if(model.regionProfiles)return model.regionProfiles;
 const {n,target,tree}=model,owner=new Int32Array(n*n).fill(-1),distance=new Float64Array(n*n).fill(Infinity),heap=new Heap();
 // Competing fronts can only travel through image foreground. A nearby branch
 // across a white gap cannot claim the pixels on the other side of that gap.
 for(const t of tree){const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy);for(let r=0;r<=L;r+=.35){const x=t.start[0]+r/L*dx,y=t.start[1]+r/L*dy,ix=Math.round(x),iy=Math.round(y);if(ix<0||iy<0||ix>=n||iy>=n)continue;const i=iy*n+ix,d=Math.hypot(ix-x,iy-y);if(target[i]&&d<distance[i]){distance[i]=d;owner[i]=t.id;heap.push([d,i])}}}
 const moves=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y)moves.push([x,y,Math.hypot(x,y)]);
 while(heap.a.length){const [d,i]=heap.pop();if(d!==distance[i])continue;const x=i%n,y=(i/n)|0;for(const [dx,dy,step] of moves){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const j=yy*n+xx;if(!target[j]||dx&&dy&&!target[y*n+xx]&&!target[yy*n+x])continue;const next=d+step;if(next<distance[j]){distance[j]=next;owner[j]=owner[i];heap.push([next,j])}}}
 const at=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<n&&y<n?owner[y*n+x]:-1};
 const profiles=tree.map(t=>{const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,values=[];for(let k=0;k<=STEPS;k++){const u=k/STEPS,x=t.start[0]+u*dx,y=t.start[1]+u*dy,sides=[];for(const sign of [-1,1]){let width=.25,foreign=0;for(let r=.25;r<n*.3;r+=.25){const xx=x+sign*nx*r,yy=y+sign*ny*r;if(B.sample(target,n,xx,yy)<.4)break;foreign=at(xx,yy)===t.id?0:foreign+.25;if(foreign>1)break;width=r}sides.push(sign*width)}values.push(sides)}return values});
 model.regionProfiles={profiles,owner};return model.regionProfiles;
}
function hull(points){const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),a=[],b=[];for(const v of p){while(a.length>1&&cross(a[a.length-2],a[a.length-1],v)<=1e-10)a.pop();a.push(v)}for(let i=p.length-1;i>=0;i--){const v=p[i];while(b.length>1&&cross(b[b.length-2],b[b.length-1],v)<=1e-10)b.pop();b.push(v)}return a.slice(0,-1).concat(b.slice(0,-1))}
function pieces(path,values,detail,strength,scale=1){
 const a=path[0],b=path[path.length-1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,count=values.length-1,tolerance=scale*(.65+.6*strength/100+3.4*(1-detail/100)**2),out=[];
 const axis=k=>[a[0]+dx*k/count,a[1]+dy*k/count],point=(k,side)=>{const c=axis(k);return [c[0]+nx*values[k][side],c[1]+ny*values[k][side]]};
 function widths(p,u){const xs=[];for(let j=0;j<p.length;j++){const q=p[j],r=p[(j+1)%p.length];if((q[0]>u)!==(r[0]>u))xs.push(q[1]+(u-q[0])*(r[1]-q[1])/(r[0]-q[0]))}return xs.length?[Math.min(...xs),Math.max(...xs)]:null}
 function candidate(i,j){const pts=[];for(let k=i;k<=j;k++)pts.push(point(k,0),point(k,1));const h=hull(pts),start=axis(i),end=axis(j),anchors=[point(i,0),point(i,1),point(j,0),point(j,1)];let polygon;
  try{polygon=P.fit(h,start,end,detail,anchors)}catch{polygon=[point(i,0),point(j,0),point(j,1),point(i,1)]}
  // Measure the fitted sides, not merely the convex hull's area. A waist must
  // split even when filling its gap would add only a small fraction of the area.
  const local=polygon.map(([x,y])=>[((x-a[0])*dx+(y-a[1])*dy)/L,-(x-a[0])*dy/L+(y-a[1])*dx/L]);let worst=0,split=-1;
  for(let k=i+1;k<j;k++){const w=widths(local,L*k/count);if(!w)continue;const error=Math.max(Math.abs(w[0]-values[k][0]),Math.abs(w[1]-values[k][1]));if(error>worst){worst=error;split=k}}
  return {polygon,start,end,u0:i/count,u1:j/count,error:worst,split};
 }
 function fit(i,j){const piece=candidate(i,j);if(piece.error>tolerance&&piece.split>i&&piece.split<j&&(j-i)*L/count>scale*2.5){fit(i,piece.split);fit(piece.split,j)}else out.push(piece)}
 fit(0,count);
 // Remove subdivision seams when a single 3–6-gon meets the same error bound.
 // Refit against the original samples so simplification cannot accumulate drift.
 for(let i=0;i<out.length-1;){const merged=candidate(Math.round(out[i].u0*count),Math.round(out[i+1].u1*count));if(merged.error<=tolerance){out.splice(i,2,merged);if(i)i--}else i++}
 return out.map(({split,...piece})=>piece);
}
root.BranchRegions={measure,pieces,STEPS};if(typeof module!=='undefined')module.exports=root.BranchRegions;
})(globalThis);
