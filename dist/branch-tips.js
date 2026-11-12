/* Recover hollow or weakly connected terminal caps from local image evidence. */
(function(root){
'use strict';
const B=typeof module!=='undefined'?require('./branch-structure.js'):root.BranchStructure;
const F=typeof module!=='undefined'?require('./engine.js'):root.Flake;
function refine(model){
 const {n}=model,source=model.imageTarget||model.target,material=model.target.slice(),near=F.distance(material,n),tree=model.tree.map(t=>({...t,path:t.path.map(p=>p.slice()),start:t.start.slice(),end:t.end.slice()})),seen=new Int32Array(n*n),queue=new Int32Array(n*n);
 let recovered=0;
 for(const t of tree){
  if(t.confidence<.6||t.length<5)continue;
  // Keep junctions on their own parent if that parent's measured cap moved.
  if(t.parent!==null)t.start=B.project(t.start,tree[t.parent].path).point;
  const dx=t.end[0]-t.start[0],dy=t.end[1]-t.start[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L,nx=-uy,ny=ux,w=Math.max(1.25,t.width),limit=Math.max(3,Math.min(14,w*2.5)),lo=Math.max(L*.6,L-w*4),hi=L+Math.max(8,Math.min(L*.8,w*5+3));
  const local=(x,y)=>[(x-t.start[0])*ux+(y-t.start[1])*uy,(x-t.start[0])*nx+(y-t.start[1])*ny];
  const descendants=new Set();for(const other of tree){let parent=other.parent;while(parent!==null){if(parent===t.id){descendants.add(other.id);break}parent=tree[parent].parent}}
  const neighbors=tree.filter(other=>other.id!==t.id&&other.id!==t.parent&&!descendants.has(other.id));
  const inRegion=(x,y)=>{const [r,v]=local(x,y);if(r<lo||r>hi||Math.abs(v)>limit)return false;return !neighbors.some(other=>B.project([x,y],other.path).distance<Math.abs(v)*.7)};
  let head=0,tail=0;const mark=t.id+1;
  function add(x,y){if(x<0||y<0||x>=n||y>=n)return;const i=y*n+x;if(seen[i]===mark||near[i]>1.25||!inRegion(x,y))return;seen[i]=mark;queue[tail++]=i}
  // Seed the actual shaft edges too: a translucent cap need not have a dark
  // center pixel. A one-pixel evidence gap is allowed only in this local region.
  for(let r=lo;r<=lo+2;r+=.5)for(let v=-w;v<=w;v+=.5)add(Math.round(t.start[0]+ux*r+nx*v),Math.round(t.start[1]+uy*r+ny*v));
  const points=[];
  while(head<tail){const i=queue[head++],x=i%n,y=(i/n)|0;if(source[i]){const [r,v]=local(x,y);points.push({x,y,r,v})}for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if(xx||yy)add(x+xx,y+yy)}
  if(points.length<5)continue;
  points.sort((a,b)=>a.r-b.r);const extent=points.at(-1).r,extended=extent>L+Math.max(1,Math.min(2,w*.4));
  const centeredCap=points.some(p=>p.r>extent-1.5&&Math.abs(p.v)<Math.max(2,w*1.5));
  if(extended&&centeredCap&&points.filter(p=>p.r>L+1).length>=Math.max(3,w*2)){
   const cap=points.filter(p=>p.r>extent-Math.max(1.5,Math.min(w,3))),lateral=t.parent===null?0:cap.reduce((sum,p)=>sum+p.v,0)/cap.length;
   const end=[t.start[0]+ux*(extent+.25)+nx*lateral,t.start[1]+uy*(extent+.25)+ny*lateral];
   // A cap cannot extend through another measured stem.
   const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   const crossing=tree.some(other=>{if(other.id===t.id||other.id===t.parent||descendants.has(other.id))return false;const values=[cross(t.start,end,other.start),cross(t.start,end,other.end),cross(other.start,other.end,t.start),cross(other.start,other.end,end)];return values.every(v=>Math.abs(v)>1e-6)&&values[0]*values[1]<0&&values[2]*values[3]<0});
   if(!crossing){t.end=end;t.tipRecovered=true;recovered++}
  }
  t.path=[t.start,t.end];t.length=B.length(t.path);
  // Fill only the small cap's supported cross-sections, never a global white
  // region between arms. The two observed flanks bound each added interval.
  const ex=(t.end[0]-t.start[0])/t.length,ey=(t.end[1]-t.start[1])/t.length,capStart=Math.max(lo,L-w*2),bins=new Map();
  for(const p of points){const r=(p.x-t.start[0])*ex+(p.y-t.start[1])*ey,v=-(p.x-t.start[0])*ey+(p.y-t.start[1])*ex;if(r<capStart||r>t.length+.5)continue;const k=Math.round(r),entry=bins.get(k)||[Infinity,-Infinity];entry[0]=Math.min(entry[0],v);entry[1]=Math.max(entry[1],v);bins.set(k,entry)}
  for(const [k,[low,high]] of bins){if(low>=-.4||high<=.4||high-low>limit*2)continue;for(let r=k-.5;r<=k+.5;r+=.35)for(let v=low;v<=high;v+=.35){const x=Math.round(t.start[0]+ex*r-ey*v),y=Math.round(t.start[1]+ey*r+ex*v);if(x>=0&&y>=0&&x<n&&y<n&&(model.target[y*n+x]||!neighbors.some(other=>B.project([x,y],other.path).distance<Math.abs(v)+1.5)))material[y*n+x]=1}}
 }
 // Cap repair must not seal a large opening between separate branches. Restore
 // added boundary pixels around newly enclosed background, leaving genuine
 // source-image holes and the small interiors of terminal caps intact.
 const before=F.fillHoles(model.target,n),after=F.fillHoles(material,n),visited=new Uint8Array(n*n);
 for(let i=0;i<material.length;i++)if(after[i]&&!material[i]&&!before[i]&&!visited[i]){
  let head=0,tail=1;queue[0]=i;visited[i]=1;const adjacent=new Set();
  while(head<tail){const p=queue[head++],x=p%n,y=(p/n)|0;for(let yy=Math.max(0,y-1);yy<=Math.min(n-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(n-1,x+1);xx++){const q=yy*n+xx;if(material[q]&&!model.target[q])adjacent.add(q);if(after[q]&&!material[q]&&!before[q]&&!visited[q]){visited[q]=1;queue[tail++]=q}}}
  if(tail>Math.max(100,n*n*.001))for(const p of adjacent)material[p]=0;
 }
 return {...model,tree,target:material,imageTarget:material,distance:F.distance(Uint8Array.from(material,v=>1-v),n),recoveredTips:recovered};
}
root.BranchTips={refine};if(typeof module!=='undefined')module.exports=root.BranchTips;
})(globalThis);
