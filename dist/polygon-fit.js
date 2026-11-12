/* Maximum-area convex 3–6-gon, constrained to retain the branch centerline.
 * Dynamic programming considers every retained edge; this is not vertex chopping.
 */
(function(root){
'use strict';
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0]},0))/2;
function fit(polygon,start,end,detail=100,anchors=[]){
 if(polygon.length<3)throw Error('A fitted polygon needs at least three vertices');
 const p=polygon.slice(),signed=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0]},0);if(signed<0)p.reverse();
 // The observed tip is the fixed vertex. Tangential ties choose the closest
 // tip corner, making the result independent of world-axis orientation.
 const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy)||1;let first=0,best=-Infinity;
 for(let i=0;i<p.length;i++){const projection=((p[i][0]-start[0])*dx+(p[i][1]-start[1])*dy)/length,score=projection-Math.hypot(p[i][0]-end[0],p[i][1]-end[1])*1e-7;if(score>best){first=i;best=score}}
 const q=p.slice(first).concat(p.slice(0,first)),n=q.length,valid=Array.from({length:n},()=>new Uint8Array(n));
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(i!==j)valid[i][j]=[start,end,...anchors].every(a=>cross(q[i],q[j],a)>=-1e-7)?1:0;
 const dp=Array.from({length:7},()=>new Float64Array(n).fill(-Infinity)),previous=Array.from({length:7},()=>new Int32Array(n).fill(-1));
 for(let j=1;j<n;j++)if(valid[0][j])dp[2][j]=0;
 const fullArea=area(q)*2,penalty=.005+.015*(1-detail/100);let answer=null,objective=Infinity;
 for(let k=3;k<=Math.min(6,n);k++){
  for(let j=k-1;j<n;j++)for(let i=k-2;i<j;i++){if(!valid[i][j]||!Number.isFinite(dp[k-1][i]))continue;const candidate=dp[k-1][i]+cross(q[0],q[i],q[j]);if(candidate>dp[k][j]){dp[k][j]=candidate;previous[k][j]=i}}
  for(let j=k-1;j<n;j++){if(!valid[j][0]||!Number.isFinite(dp[k][j]))continue;const score=1-dp[k][j]/fullArea+penalty*(k-3);if(score>=objective-1e-10)continue;const indices=[j];let at=j;for(let v=k;v>2;v--){at=previous[v][at];indices.push(at)}indices.push(0);indices.reverse();const candidate=indices.map(i=>q[i]);if(area(candidate)<1e-10)continue;objective=score;answer=candidate}
 }
 if(!answer)throw Error('Could not fit a 3–6 sided polygon around the measured branch');
 return answer;
}
root.PolygonFit={fit,area};if(typeof module!=='undefined')module.exports=root.PolygonFit;
})(globalThis);
