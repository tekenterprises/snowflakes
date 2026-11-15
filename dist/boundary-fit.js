/* Robust orthogonal fitting of ordered contour runs, with bounded corner movement. */
(function(root){
'use strict';
const dist=(p,a,b)=>{let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
function segments(p,tol){const q=[...p,p[0]],cuts=[0];function split(a,b){let error=0,at=0;for(let i=a+1;i<b;i++){let d=dist(q[i],q[a],q[b]);if(d>error){error=d;at=i}}if(error>tol&&b-a>1){split(a,at);split(at,b)}else cuts.push(b)}const mid=Math.floor(p.length/2);split(0,mid);split(mid,p.length);return {q,cuts};}
function line(points){let weights=points.map(()=>1),center,dir;for(let iter=0;iter<4;iter++){let sum=weights.reduce((s,v)=>s+v,0);center=[0,1].map(k=>points.reduce((s,p,i)=>s+weights[i]*p[k],0)/sum);let xx=0,xy=0,yy=0;points.forEach((p,i)=>{let x=p[0]-center[0],y=p[1]-center[1],w=weights[i];xx+=w*x*x;xy+=w*x*y;yy+=w*y*y});let angle=.5*Math.atan2(2*xy,xx-yy);dir=[Math.cos(angle),Math.sin(angle)];weights=points.map(p=>Math.min(1,.8/(Math.abs((p[0]-center[0])*dir[1]-(p[1]-center[1])*dir[0])||1)))}return {center,dir};}
function fit(p,tol=1.5){if(p.length<4)return p;const {q,cuts}=segments(p,tol),lines=cuts.slice(1).map((end,i)=>line(q.slice(cuts[i],end+1))),v=lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],cross=a.dir[0]*b.dir[1]-a.dir[1]*b.dir[0],original=q[cuts[i]];if(Math.abs(cross)<.08)return original;const delta=b.center.map((x,k)=>x-a.center[k]),t=(delta[0]*b.dir[1]-delta[1]*b.dir[0])/cross,point=a.center.map((x,k)=>x+t*a.dir[k]);return Math.hypot(point[0]-original[0],point[1]-original[1])<=2.5?point:original});
 // Reject a refit that would erase a tip or create a large new deviation.
 for(let i=0;i<v.length;i++){let end=cuts[i+1];if(q.slice(cuts[i],end+1).some(p=>dist(p,v[i],v[(i+1)%v.length])>tol*1.5)){v[i]=q[cuts[i]];v[(i+1)%v.length]=q[end]}}
 // Keep a simple ring; refitting must not create crossings in narrow features.
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<v.length;i++)for(let j=i+2;j<v.length;j++){
  if(i===0&&j===v.length-1)continue;
  const a=v[i],b=v[(i+1)%v.length],c=v[j],d=v[(j+1)%v.length];
  if(cross(a,b,c)*cross(a,b,d)<-1e-9&&cross(c,d,a)*cross(c,d,b)<-1e-9)return p;
 }
 return v;
}

root.BoundaryFit={fit};if(typeof module!=='undefined')module.exports=root.BoundaryFit;
})(globalThis);
