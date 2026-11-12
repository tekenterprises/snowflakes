(function(root){
// Ignore isolated image dust when framing, but retain detached substantial features.
function fitBounds(mask,n,loops){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),parts=[];let largest=0;
for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;let head=0,tail=1,x0=n,y0=n,x1=0,y1=0;queue[0]=i;seen[i]=1;while(head<tail){const p=queue[head++],x=p%n,y=Math.floor(p/n);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy,j=yy*n+xx;if(xx>=0&&xx<n&&yy>=0&&yy<n&&mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j}}}largest=Math.max(largest,tail);parts.push({count:tail,x0,y0,x1,y1})}
let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;function add(x,y){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
for(const p of parts)if(p.count>=Math.max(4,largest*.001)){add(p.x0,p.y0);add(p.x1,p.y1)}
for(const loop of loops)for(const [x,y] of loop)add(x,y);
if(!Number.isFinite(x0))return [0,0,n,n];const padding=Math.max(3,Math.max(x1-x0,y1-y0)*.02);return [x0-padding,y0-padding,x1-x0+padding*2,y1-y0+padding*2];}
root.Preview={fitBounds};if(typeof module!=='undefined')module.exports=root.Preview;
})(globalThis);
