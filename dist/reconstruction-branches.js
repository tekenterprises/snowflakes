/* Photo-derived shared half-arm slots and local straight-axis fits.
 * Canonical coordinates are lateral x / radial y, with median trunk length 320.
 * Only rotation, reflection and uniform scale are used. Geometry stays Float64;
 * raster evidence is Float32. No catalogue identities or cached geometry.
 */
(function (root) {
  'use strict';
  const {Math,Date,Float32Array,Float64Array,Uint8Array,Int32Array,Array,Number,Set,Map}=root;
  const PI = Math.PI, D = PI / 180, clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
  const median = a => { if (!a.length) return 0; const b=Array.from(a).sort((x,y)=>x-y),n=b.length; return n&1?b[n>>1]:(b[n/2-1]+b[n/2])/2; };
  const range = (a,b,step=1) => {const r=[]; for(let x=a;x<=b+1e-7;x+=step)r.push(x);return r;};
  const unique = a => Array.from(new Set(a)).sort((x,y)=>x-y);
  const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const now = () => typeof performance!=='undefined'?performance.now():Date.now();
  function raster(data,width,height) { return {data,width,height}; }
  function sample(a,x,y) {
    // Interior probes dominate local fitting. Preserve the clamp's inclusive
    // zero, NaN propagation and upper bound without nested min/max calls.
    if(x<=0)x=0;else if(x>a.width-1.001)x=Math.max(0,a.width-1.001);
    if(y<=0)y=0;else if(y>a.height-1.001)y=Math.max(0,a.height-1.001);
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,i=iy*a.width+ix,d=a.data;
    return (d[i]*(1-fx)+d[i+1]*fx)*(1-fy)+(d[i+a.width]*(1-fx)+d[i+a.width+1]*fx)*fy;
  }
  // A conservative broad phase for one synchronous operation. Bounds are never
  // attached to sides or cached across possible edits to the source polygon.
  // For coordinates within this limit, crossError bounds subtraction/product
  // roundoff conservatively. Tiny, concave and poorly conditioned polygons keep
  // the original cross tests. The existing 1e-8 cross tolerance is unchanged.
  const boundsLimit=1e6,crossError=128*Number.EPSILON*boundsLimit*boundsLimit;
  function polygonBounds(poly){
    if(poly.length<3||poly.length>32)return null;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,cx=0,cy=0;
    for(const p of poly){if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>boundsLimit||Math.abs(p[1])>boundsLimit)return null;minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);cx+=p[0]/poly.length;cy+=p[1]/poly.length;}
    const a=poly[0],b=poly[1],c=poly[2],turn=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(turn)<=crossError||Math.abs(cx)>boundsLimit||Math.abs(cy)>boundsLimit)return null;
    const sign=Math.sign(turn);let lower=Infinity;
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1];
      // Every nonincident vertex must lie strictly on the interior side. This
      // excludes collinear edges and self intersections as well as concavity.
      for(let j=0;j<poly.length;j++){if(j===i||j===(i+1)%poly.length)continue;const p=poly[j];if(sign*(ex*(p[1]-a[1])-ey*(p[0]-a[0]))<=crossError)return null;}
      lower=Math.min(lower,sign*(ex*(cy-a[1])-ey*(cx-a[0]))-crossError);
    }
    if(lower<1)return null;
    // Relaxing each half plane by epsilon is contained in a homothetic
    // expansion around this interior point by 1+epsilon/lower. Include both
    // arithmetic error and the original tolerance, then round bounds outward.
    const pad=(1e-8+crossError)/lower*Math.max(maxX-cx,cx-minX,maxY-cy,cy-minY)+128*Number.EPSILON*boundsLimit;
    return Object.freeze([minX-pad,minY-pad,maxX+pad,maxY+pad]);
  }
  function outsideBounds(x,y,bounds,footprint=0){
    return bounds&&(x<bounds[0]-footprint||y<bounds[1]-footprint||x>bounds[2]+footprint||y>bounds[3]+footprint)&&Math.abs(x)<=boundsLimit-footprint&&Math.abs(y)<=boundsLimit-footprint;
  }
  function insideXY(x,y,poly,bounds){
    if(outsideBounds(x,y,bounds))return false;
    let sign=0;
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
      if(Math.abs(cross)<1e-8)continue;const s=Math.sign(cross);if(sign&&sign!==s)return false;sign=s;}
    return true;
  }
  function inside(p,poly,bounds){return insideXY(p[0],p[1],poly,bounds);}
  function rayExit(c,u,poly) {
    let exit=0;
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],den=u[0]*ey-u[1]*ex;
      if(Math.abs(den)<1e-10)continue;const qx=a[0]-c[0],qy=a[1]-c[1],t=(qx*ey-qy*ex)/den,f=(qx*u[1]-qy*u[0])/den;
      if(t>=0&&f>=-1e-8&&f<=1+1e-8)exit=Math.max(exit,t);}
    return exit;
  }
  function toSource(side,x,y) {
    if(Array.isArray(x)){y=x[1];x=x[0];}else if(typeof x==='object'){y=x.y;x=x.x;}
    const k=side.pixel/side.scale,c=side.center;
    return [c[0]+k*(y*side.u[0]+x*side.v[0]),c[1]+k*(y*side.u[1]+x*side.v[1])];
  }
  function sampleSide(side,x,y,scale=side.scale,bounds) {
    const k=side.pixel/scale,sx=side.center[0]+k*(y*side.u[0]+x*side.v[0]),sy=side.center[1]+k*(y*side.u[1]+x*side.v[1]);
    const geometric=x>=0&&y>=0&&x<=y*Math.tan(side.bisectorAngle)+1e-8&&sx>=0&&sy>=0&&sx<side.sourceSize-1&&sy<side.sourceSize-1;
    let valid=geometric;
    if(valid&&!outsideBounds(sx,sy,bounds,.75))for(const dx of [-.75,.75])for(const dy of [-.75,.75])if(insideXY(sx+dx,sy+dy,side.sourceHex,bounds))valid=false;
    return {value:sample(side.sourceInk,sx,sy),geometric,valid};
  }
  function prepareSides(framework) {
    const c=framework.center, n=framework.size, poly=framework.hexagons[framework.hexagons.length-1].polygon;
    const vectors=framework.trunks.map(t=>[t.end[0]-c[0],t.end[1]-c[1]]),lengths=vectors.map(v=>Math.hypot(...v)),pixel=median(lengths)/320;
    if(!(pixel>0)||!Number.isFinite(pixel))throw new Error('ReconstructionBranches requires finite nonzero trunks');
    const units=vectors.map((v,i)=>v.map(x=>x/lengths[i])),angles=units.map(v=>Math.atan2(v[1],v[0]));
    const sourceInk=raster(framework.branchInk||framework.ink,n,n),sides=[];
    for(let arm=0;arm<units.length;arm++)for(const sign of [-1,1]){
      const u=units[arm],v=[-u[1]*sign,u[0]*sign],gaps=angles.map(a=>((sign*(a-angles[arm]))%(2*PI)+2*PI)%(2*PI)).filter(g=>g>1e-5);
      const side={index:sides.length,arm,mirror:sign,center:c.slice(),u:u.slice(),v,scale:1,pixel,angle:angles[arm],bisectorAngle:Math.min(...gaps)/2,sourceInk,sourceSize:n,sourceHex:poly};
      side.trunkTip=[0,lengths[arm]/pixel];side.rootExit=rayExit(c,u,poly);sides.push(side);
    }
    return sides;
  }
  // The scratch buffer is owned by one synchronous extraction/alignment call.
  // Stable insertion order matches the numeric Array.sort median for equal values.
  function maskedMedian(values,valid,index,omit=-1,scratch=new Float64Array(values.length)){
    let n=0;for(let j=0;j<values.length;j++)if(j!==omit&&valid[j][index]){const v=values[j][index];let k=n;while(k&&scratch[k-1]>v){scratch[k]=scratch[k-1];k--;}scratch[k]=v;n++;}
    return [n?(n&1?scratch[n>>1]:(scratch[n/2-1]+scratch[n/2])/2):0,n];
  }
  function alignmentValid(side,sx,sy,bounds){
    if(!(sx>=0&&sy>=0&&sx<side.sourceSize-1&&sy<side.sourceSize-1))return false;
    if(outsideBounds(sx,sy,bounds,.75))return true;
    for(let dx=-.75;dx<=.75;dx+=1.5)for(let dy=-.75;dy<=.75;dy+=1.5)if(insideXY(sx+dx,sy+dy,side.sourceHex,bounds))return false;
    return true;
  }
  function align(sides) {
    // Keep the original y-major point order and static support predicates. Points
    // outside this domain never contribute to any trial's correlation score.
    const points=[];for(let y=0;y<360;y+=3)for(let x=0;x<260;x+=3)if(y>40&&y<300&&x>6)points.push([x,y]);
    const len=points.length,frames=sides.map(side=>{const x=new Float64Array(len),y=new Float64Array(len),geometric=new Uint8Array(len),tan=Math.tan(side.bisectorAngle);
      for(let j=0;j<len;j++){const p=points[j];x[j]=p[1]*side.u[0]+p[0]*side.v[0];y[j]=p[1]*side.u[1]+p[0]*side.v[1];geometric[j]=+(p[0]<=p[1]*tan+1e-8);}
      return {x,y,geometric,bounds:polygonBounds(side.sourceHex)};});
    const values=sides.map(()=>new Float64Array(len)),valid=sides.map(()=>new Uint8Array(len)),counts=new Int32Array(len),scratch=new Float64Array(sides.length),support=new Int32Array(len),target=new Float64Array(len),trialValues=new Float64Array(len);
    let scales=sides.map(()=>1);const history=[];
    for(let iteration=0;iteration<4;iteration++){
      counts.fill(0);
      sides.forEach((side,i)=>{const f=frames[i],k=side.pixel/scales[i],mask=valid[i],ink=values[i];
        for(let j=0;j<len;j++){const sx=side.center[0]+k*f.x[j],sy=side.center[1]+k*f.y[j],ok=f.geometric[j]&&alignmentValid(side,sx,sy,f.bounds);mask[j]=+ok;if(ok){ink[j]=sample(side.sourceInk,sx,sy);counts[j]++;}}
      });
      const next=scales.map((scale,i)=>{
        const side=sides[i],f=frames[i],trials=range(Math.max(.78,scale-.045),Math.min(1.28,scale+.045),(Math.min(1.28,scale+.045)-Math.max(.78,scale-.045))/18),factors=trials.map(t=>side.pixel/t);let n=0;
        for(let j=0;j<len;j++){
          if(!f.geometric[j]||counts[j]-valid[i][j]<6)continue;
          let ok=true;for(const k of factors)if(!alignmentValid(side,side.center[0]+k*f.x[j],side.center[1]+k*f.y[j],f.bounds)){ok=false;break;}
          if(ok)support[n++]=j;
        }
        if(n<120)return scale;
        let sum=0;for(let j=0;j<n;j++){target[j]=maskedMedian(values,valid,support[j],i,scratch)[0];sum+=target[j];}
        const tm=sum/n;sum=0;for(let j=0;j<n;j++)sum+=(target[j]-tm)**2;const ts=Math.max(.015,Math.sqrt(sum/n));
        let best=-Infinity,chosen=scale;
        trials.forEach((t,trial)=>{const k=factors[trial];let sum=0;
          for(let j=0;j<n;j++){const index=support[j];trialValues[j]=sample(side.sourceInk,side.center[0]+k*f.x[index],side.center[1]+k*f.y[index]);sum+=trialValues[j];}
          const vm=sum/n;sum=0;for(let j=0;j<n;j++)sum+=(trialValues[j]-vm)**2;const vs=Math.max(.015,Math.sqrt(sum/n));let score=0;
          for(let j=0;j<n;j++)score+=(trialValues[j]-vm)/vs*(target[j]-tm)/ts;score/=n;if(score>best){best=score;chosen=t;}
        });
        return chosen;
      });
      const norm=Math.exp(mean(next.map(Math.log)));scales=next.map(s=>s/norm);history.push(scales.slice());
    }
    return {scales,history};
  }
  function extract(framework,options={}) {
    const sides=prepareSides(framework),registration=options.scales?{scales:options.scales.slice(),history:[]}:align(sides);
    sides.forEach((s,i)=>s.scale=registration.scales[i]);
    let xmax=0,ymax=0;const n=framework.size-1,c=framework.center;
    for(const s of sides)for(const p of [[0,0],[n,0],[n,n],[0,n]]){const dx=p[0]-c[0],dy=p[1]-c[1];xmax=Math.max(xmax,(dx*s.v[0]+dy*s.v[1])*s.scale/s.pixel);ymax=Math.max(ymax,(dx*s.u[0]+dy*s.u[1])*s.scale/s.pixel);}
    const width=Math.ceil(xmax)+2,height=Math.ceil(ymax)+2,len=width*height,ink=new Float32Array(len),count=new Uint8Array(len),valid=new Uint8Array(len),hexmask=new Uint8Array(len),hexVotes=new Uint8Array(len);let materialX=0,materialY=0;
    for(const s of sides){const sourceBounds=polygonBounds(s.sourceHex);s.width=width;s.height=height;s.ink=new Float32Array(len);s.valid=new Uint8Array(len);s.geometric=new Uint8Array(len);s.localRootLimit=s.rootExit*s.scale/s.pixel;s.trunkTip=[0,Math.hypot(framework.trunks[s.arm].end[0]-c[0],framework.trunks[s.arm].end[1]-c[1])*s.scale/s.pixel];
      s.hexPolygon=s.sourceHex.map(p=>{const dx=p[0]-c[0],dy=p[1]-c[1];return [(dx*s.v[0]+dy*s.v[1])*s.scale/s.pixel,(dx*s.u[0]+dy*s.u[1])*s.scale/s.pixel];});
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,q=sampleSide(s,x,y,s.scale,sourceBounds);s.ink[i]=q.value;s.valid[i]=+q.valid;s.geometric[i]=+q.geometric;if(s.geometric[i]&&s.ink[i]>.055){materialX=Math.max(materialX,x);materialY=Math.max(materialY,y);}}
    }
    // The median central exclusion uses six votes, in addition to the exact
    // footprint exclusion in each source slice. Local fits retain local masks.
    const values=sides.map(s=>s.ink),masks=sides.map(s=>s.valid),medianScratch=new Float64Array(sides.length);
    // Only the proven expanded rectangle can receive an inside vote. Keep the
    // original full scan when bounds or the query-coordinate proof are absent.
    for(const side of sides){const bounds=polygonBounds(side.hexPolygon),bounded=bounds&&width-1<=boundsLimit&&height-1<=boundsLimit;
      const xmin=bounded?Math.max(0,Math.ceil(bounds[0])):0,xmax=bounded?Math.min(width-1,Math.floor(bounds[2])):width-1,ymin=bounded?Math.max(0,Math.ceil(bounds[1])):0,ymax=bounded?Math.min(height-1,Math.floor(bounds[3])):height-1;
      for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const i=y*width+x;if(hexVotes[i]<6&&insideXY(x,y,side.hexPolygon,bounds))hexVotes[i]++;}
    }
    for(let i=0;i<len;i++){hexmask[i]=+(hexVotes[i]>=6);
      const q=hexmask[i]?[0,0]:maskedMedian(values,masks,i,-1,medianScratch);ink[i]=q[0];count[i]=q[1];valid[i]=+(q[1]>=6&&!hexmask[i]);}
    const displayWidth=Math.min(width,Math.max(225,materialX+24)),displayHeight=Math.min(height,Math.max(360,materialY+24));
    function crop(data){const out=new data.constructor(displayWidth*displayHeight);for(let y=0;y<displayHeight;y++)out.set(data.subarray(y*width,y*width+displayWidth),y*displayWidth);return out;}
    for(const side of sides){side.ink=crop(side.ink);side.valid=crop(side.valid);side.geometric=crop(side.geometric);side.width=displayWidth;side.height=displayHeight;}
    return {sides,master:{width:displayWidth,height:displayHeight,fullWidth:width,fullHeight:height,ink:crop(ink),count:crop(count),valid:crop(valid),hexmask:crop(hexmask),rootLimit:median(sides.map(s=>s.localRootLimit))+1},registration};
  }
  function closeMask(ink,width,height,threshold,valid,fill) {
    const n=width*height,a=new Uint8Array(n),d=new Uint8Array(n),out=new Uint8Array(n);
    for(let i=0;i<n;i++)a[i]=+(ink[i]>threshold);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){let v=0;for(let dy=-1;dy<=1&&!v;dy++)for(let dx=-1;dx<=1;dx++)v|=a[clamp(y+dy,0,height-1)*width+clamp(x+dx,0,width-1)];d[y*width+x]=v;}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){let v=1;for(let dy=-1;dy<=1&&v;dy++)for(let dx=-1;dx<=1;dx++)v&=d[clamp(y+dy,0,height-1)*width+clamp(x+dx,0,width-1)];out[y*width+x]=v;}
    if(fill){for(let y=0;y<height;y++)out[y*width]=1;
      const exterior=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
      const add=i=>{if(!out[i]&&!exterior[i]){exterior[i]=1;queue[tail++]=i;}};
      for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
      while(head<tail){const i=queue[head++],x=i%width,y=(i/width)|0;if(x)add(i-1);if(x<width-1)add(i+1);if(y)add(i-width);if(y<height-1)add(i+width);}
      for(let i=0;i<n;i++)out[i]=+!exterior[i];
    }
    if(valid)for(let i=0;i<n;i++)out[i]&=valid[i];
    return raster(out,width,height);
  }
  function gradient(master,mask){const {width:w,height:h,data:d}=master,gx=new Float32Array(d.length),gy=new Float32Array(d.length),mag=new Float32Array(d.length),tangent=new Float32Array(d.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(mask&&!mask.data[i])continue;gx[i]=(d[y*w+Math.min(w-1,x+1)]-d[y*w+Math.max(0,x-1)])/(x&&x<w-1?2:1);gy[i]=(d[Math.min(h-1,y+1)*w+x]-d[Math.max(0,y-1)*w+x])/(y&&y<h-1?2:1);mag[i]=Math.hypot(gx[i],gy[i]);tangent[i]=((Math.atan2(-gy[i],gx[i])/D)%180+180)%180;}
    return {gx,gy,mag,tangent};
  }
  function direction(ctx,start){const hist=new Float64Array(46),{w,h,g,mask}=ctx;
    for(let y=Math.ceil(start+15);y<h;y++)for(let x=9;x<w;x++){const i=y*w+x,a=g.tangent[i],m=g.mag[i];if(mask.data[i]&&m>.018&&a>25&&a<78)for(let j=0;j<hist.length;j++)hist[j]+=m*Math.exp(-.5*((a-(j+30))/3)**2);}
    let best=-1,angle=30;for(let j=0;j<hist.length;j++){const score=hist[j]*Math.exp(-.5*((j+30-50)/12)**2);if(score>best){best=score;angle=j+30;}}return angle;
  }
  function orientationSupport(ctx,tip,t,angle){const {w,h,g,mask}=ctx,k=1/Math.tan(angle*D);let n=0,d=0;
    const xmin=Math.max(8,Math.floor(tip[0]*.2)+1),xmax=Math.min(w-1,Math.ceil(tip[0]*.9)-1);
    for(let x=xmin;x<=xmax;x++)for(let y=Math.max(0,Math.floor(t+k*x-12)+1);y<Math.min(h,t+k*x+12);y++){const i=y*w+x,m=g.mag[i];if(!mask.data[i]||m<=.018)continue;let delta=Math.abs(g.tangent[i]-angle);delta=Math.min(delta,180-delta);n+=m*Math.exp(-.5*(delta/8)**2);d+=m;}
    return n/Math.max(.001,d);
  }
  function widthCost(ctx,tip,angle,start){const k=1/Math.tan(angle*D),t=tip[1]-k*tip[0];if(t<start||t>ctx.h-3)return [1000,t];
    const s=Math.sin(angle*D),c=Math.cos(angle*D);let balance=0,hit=0;
    for(let j=0;j<24;j++){const x=Math.max(6,tip[0]*.40)+(tip[0]*.90-Math.max(6,tip[0]*.40))*j/23,y=t+k*x;hit+=+(sample(ctx.sil,x,y)>.5);let up=1,down=1;
      for(let d=1;d<=40;d++){if(sample(ctx.sil,x+d*c,y-d*s)<=.5)break;up++;}for(let d=1;d<=40;d++){if(sample(ctx.sil,x-d*c,y+d*s)<=.5)break;down++;}balance+=Math.abs(up-down)/(up+down);}
    return [balance/24+2*(1-hit/24),t];
  }
  function axisCost(ctx,tip,angle,start){const r=widthCost(ctx,tip,angle,start);if(r[0]>=1000)return r;const s=Math.sin(angle*D),c=Math.cos(angle*D);let left=0,right=0;
    for(let j=0;j<22;j++){const x=Math.max(6,tip[0]*.35)+(tip[0]*.88-Math.max(6,tip[0]*.35))*j/21,y=r[1]+x/Math.tan(angle*D);for(let off=2;off<=22;off++){const weight=Math.exp(-.5*(off/11)**2);left+=weight*(.65*sample(ctx.sil,x-off*c,y+off*s)+.35*sample(ctx.master,x-off*c,y+off*s));right+=weight*(.65*sample(ctx.sil,x+off*c,y-off*s)+.35*sample(ctx.master,x+off*c,y-off*s));}}
    return [r[0]+.55*Math.abs(left-right)/Math.max(1,left+right),r[1]];
  }
  function candidates(ctx,start){const {w,h,sil,mask}=ctx,k=1/Math.sqrt(3),ext=new Float64Array(h-2),smooth=new Float64Array(h-2),peaks=[];
    for(let t=0;t<h-2;t++)for(let x=0;x<w;x++){const y=t+k*x;if(y<h-1&&sample(mask,x,y)>.99&&sample(sil,x,y)>.5)ext[t]=x;}
    const weights=[1,3,6,8,6,3,1];for(let t=0;t<ext.length;t++)for(let j=-3;j<=3;j++)smooth[t]+=weights[j+3]*ext[clamp(t+j,0,ext.length-1)]/28;
    for(let i=5;i<ext.length-5;i++){if(smooth[i]<14||!(smooth[i]>=smooth[i-1]&&smooth[i]>smooth[i+1]))continue;let lo=i-1,hi=i+1;while(lo>0&&smooth[lo]<=smooth[i])lo--;while(hi<ext.length-1&&smooth[hi]<=smooth[i])hi++;let low=smooth[i],high=smooth[i];for(let j=lo;j<=i;j++)low=Math.min(low,smooth[j]);for(let j=i;j<=hi;j++)high=Math.min(high,smooth[j]);const prominence=smooth[i]-Math.max(low,high);if(prominence<4)continue;let peak=Math.max(0,i-3);for(let j=peak;j<Math.min(ext.length,i+4);j++)if(ext[j]>ext[peak])peak=j;const tip=[ext[peak],peak+k*ext[peak]];if(tip[0]<14||peak<start-8)continue;peaks.push({tip,prominence,seed:peak,clipped:sample(mask,tip[0]+3,tip[1])<.99,origin:'envelope'});}
    const out=[];for(const p of peaks.sort((a,b)=>b.prominence-a.prominence))if(!out.some(q=>Math.abs(p.seed-q.seed)<13||dist(p.tip,q.tip)<15))out.push(p);return out.sort((a,b)=>a.seed-b.seed);
  }
  function shoulders(ctx,start){const pts=[];for(let y=0;y<ctx.h-3;y++){let x=0;for(let j=0;j<ctx.w;j++)if(ctx.sil.data[y*ctx.w+j])x=j;if(x>8&&y>start+10)pts.push([x,y]);}
    function simplify(p){if(p.length<3)return p;const a=p[0],b=p[p.length-1],vx=b[0]-a[0],vy=b[1]-a[1],n=Math.max(1e-6,Math.hypot(vx,vy));let index=0,max=0;for(let i=0;i<p.length;i++){const d=Math.abs(vx*(p[i][1]-a[1])-vy*(p[i][0]-a[0]))/n;if(d>max){max=d;index=i;}}if(max<3)return [a,b];return simplify(p.slice(0,index+1)).slice(0,-1).concat(simplify(p.slice(index)));}
    const poly=simplify(pts),out=[];for(let i=1;i<poly.length-1;i++){const a=poly[i-1],b=poly[i],c=poly[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],turn=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])/D;if(Math.min(Math.hypot(...u),Math.hypot(...v))<12||turn<22||turn>125||b[0]<14)continue;const seed=b[1]-b[0]/Math.sqrt(3);if(sample(ctx.mask,b[0]+3,b[1])<.99||seed<start-8)continue;out.push({tip:b.slice(),prominence:Math.min(20,turn/3),seed,clipped:false,shoulder:true,origin:'contour_corner'});}return out;
  }
  function capInRegion(ctx,oldtip,angle,radius,shift=null,target=null){const s=Math.sin(angle*D),c=Math.cos(angle*D),pts=[];let max=-Infinity,minDistance=Infinity;
    for(let y=target?0:Math.max(0,Math.ceil(oldtip[1]-radius));y<=(target?ctx.h-1:Math.min(ctx.h-1,Math.floor(oldtip[1]+radius)));y++)for(let x=target?0:Math.max(0,Math.ceil(oldtip[0]-radius));x<=(target?ctx.w-1:Math.min(ctx.w-1,Math.floor(oldtip[0]+radius)));x++){
      if(!ctx.sil.data[y*ctx.w+x]||(!target&&(x-oldtip[0])**2+(y-oldtip[1])**2>radius**2))continue;
      if(shift!==null&&Math.abs((x-oldtip[0])*c-(y-oldtip[1])*s-shift)>=7)continue;
      const projection=x*s+y*c;if(target){const ds=(x-target[0])**2+(y-target[1])**2;if(ds<minDistance){minDistance=ds;pts.length=0;}if(ds<=minDistance+.01)pts.push([x,y,projection]);}else{pts.push([x,y,projection]);max=Math.max(max,projection);}
    }
    if(!pts.length)return null;if(target)max=Math.max(...pts.map(p=>p[2]));const cap=pts.filter(p=>p[2]>=max-1),cx=mean(cap.map(p=>p[0])),cy=mean(cap.map(p=>p[1]));let best=cap[0];for(const p of cap)if((p[0]-cx)**2+(p[1]-cy)**2<(best[0]-cx)**2+(best[1]-cy)**2)best=p;return best.slice(0,2);
  }
  function jointRefine(ctx,branches,common,start,complete=true){
    if(!branches.length)return [branches,common];
    if(complete&&branches.some(b=>b.competingCaps)){
      const anchored=jointRefine(ctx,branches.map((b,i)=>{const q={...b,_anchorSlot:i};delete q.competingCaps;return q;}),common,start,false);
      anchored[0].forEach(b=>{const old=branches[b._anchorSlot];delete b._anchorSlot;if(old.competingCaps){b.competingCaps=old.competingCaps;b.shaftRootAnchor=b.attachment;b.capSearchAngle=common;}});branches=anchored[0];common=anchored[1];
    }
    const offers=branches.map(b=>{const old=b.tip,radius=Math.max(8,Math.min(32,.30*old[0])),plate=b.competingCaps||[];let target=null;
      if(plate.length){const a=b.capSearchAngle*D;let best=-Infinity;for(const t of [old,...plate]){const score=t[0]*Math.sin(a)+t[1]*Math.cos(a);if(score>best){best=score;target=t;}}}
      const candidates=[];for(const angle of range(Math.max(22,common-18),Math.min(78,common+14)))for(const shift of plate.length?[0]:[-8,0,8]){
        const tip=capInRegion(ctx,old,angle,radius,plate.length?null:shift,target);if(!tip)continue;const [cost,t]=axisCost(ctx,tip,angle,start);if(cost>1.25)continue;const support=orientationSupport(ctx,tip,t,angle),penalty=plate.length?.20*((t-b.shaftRootAnchor)/Math.max(6,.08*old[0]))**2:0;
        const score=support-penalty-.15*cost-.00035*(angle-common)**2-(plate.length?0:.00005*dist(tip,old)**2);candidates.push({score,angle,tip,t,cost,support});
      }
      return {b,candidates,baseline:orientationSupport(ctx,old,b.attachment,b.angle)-.15*b.medialCost-.00035*(b.angle-common)**2};
    });
    let best=null;for(const family of range(Math.max(22,common-18),Math.min(78,common+14))){const picked=[],gains=[];
      for(const o of offers){const eligible=o.candidates.filter(v=>Math.abs(v.angle-family)<=4&&(sample(ctx.mask,v.tip[0]+3,v.tip[1])<.99||sample(ctx.sil,v.tip[0]+4*Math.sin(family*D),v.tip[1]+4*Math.cos(family*D))<.5));if(!eligible.length)break;let choice=eligible[0];for(const v of eligible)if(v.score-.003*(v.angle-family)**2>choice.score-.003*(choice.angle-family)**2)choice=v;picked.push(choice);gains.push(choice.score-o.baseline);}
      if(picked.length!==branches.length)continue;const before=branches.map(b=>b.attachment).sort((a,b)=>a-b),after=picked.map(v=>v.t).sort((a,b)=>a-b);if(before.length>1&&before.slice(1).some((v,i)=>{const ratio=(after[i+1]-after[i])/Math.max(1,v-before[i]);return ratio<.60||ratio>1.67;}))continue;
      const weights=branches.map(b=>b.tip[0]**2),score=gains.reduce((s,v,i)=>s+v*weights[i],0)/weights.reduce((s,v)=>s+v,0)-.0002*(family-common)**2;if(!best||score>best.score)best={score,family,picked};
    }
    if(!best)return [branches,common];const completing=branches.some((b,i)=>b.competingCaps&&dist(best.picked[i].tip,b.tip)>8);
    if(best.score<.025&&!completing)return [branches,common];if(!completing&&Math.abs(best.family-common)>8&&mean(best.picked.map(v=>v.support))<.25)return [branches,common];
    const updated=branches.map((b,i)=>{const v=best.picked[i];return {...b,angle:v.angle,tip:v.tip,attachment:v.t,length:v.tip[0]/Math.sin(v.angle*D),medialCost:v.cost,orientationSupport:v.support,cropLimited:sample(ctx.mask,v.tip[0]+3,v.tip[1])<.99,jointFit:true};}).sort((a,b)=>a.attachment-b.attachment);
    if(updated.some((b,i)=>i&&b.attachment-updated[i-1].attachment<13)||updated.some((b,i)=>updated.slice(0,i).some(q=>dist(b.tip,q.tip)<18)))return [branches,common];return [updated,best.family];
  }
  function blur5(ctx){const out=new Float32Array(ctx.w*ctx.h);for(let y=0;y<ctx.h;y++)for(let x=0;x<ctx.w;x++){let s=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)s+=ctx.master.data[((y+dy+ctx.h)%ctx.h)*ctx.w+(x+dx+ctx.w)%ctx.w];out[y*ctx.w+x]=s/25;}return raster(out,ctx.w,ctx.h);}
  function repairWeak(ctx,branches,common,start){const blur=blur5(ctx),corrected=[],out=branches.map(b=>({...b})),evidenceAngle=direction(ctx,start);
    for(const b of out){const [x,y]=b.tip,poor=!b.cropLimited&&b.medialCost>.6&&b.orientationSupport<.25&&x>=30;if((!b.cropLimited&&!poor)||sample(blur,Math.round(x),Math.round(y))>=.10)continue;const radius=poor?Math.max(12,Math.min(32,.6*x)):Math.max(12,Math.min(26,.25*x)),a=(poor?b.angle:evidenceAngle)*D,points=[];let max=-Infinity;
      for(let yy=Math.max(0,Math.ceil(y-radius));yy<=Math.min(ctx.h-1,Math.floor(y+radius));yy++)for(let xx=Math.max(0,Math.ceil(x-radius));xx<=Math.min(ctx.w-1,Math.floor(x+radius));xx++){
        if(!ctx.mask.data[yy*ctx.w+xx]||blur.data[yy*ctx.w+xx]<.16||(xx-x)**2+(yy-y)**2>radius**2)continue;if(branches.some(q=>(q.tip[1]<y&&yy<=(q.tip[1]+y)/2)||(q.tip[1]>y&&yy>=(q.tip[1]+y)/2)))continue;if(corrected.some(q=>Math.hypot(xx-q.tip[0],yy-q.tip[1])<18))continue;const p=xx*Math.sin(a)+yy*Math.cos(a);points.push([xx,yy,p]);max=Math.max(max,p);
      }
      if(!points.length)continue;const cap=points.filter(p=>p[2]>=max-1),center=[mean(cap.map(p=>p[0])),mean(cap.map(p=>p[1]))];let tip=cap[0];for(const p of cap)if(dist(p,center)<dist(tip,center))tip=p;tip=tip.slice(0,2);if(dist(tip,b.tip)<4)continue;const angle=poor?b.angle:Math.atan2(tip[0],tip[1]-b.attachment)/D;if(angle<25||angle>75)continue;b.previousWeakTip=b.tip;b.tip=tip;b.angle=angle;corrected.push(b);
    }
    if(!corrected.length)return [branches,common];const family=corrected.length>=2?median(corrected.map(b=>b.angle)):common;
    for(const b of out){b.angle=clamp(b.angle,family-4,family+4);const [x,y]=b.tip,a=b.angle*D;b.attachment=y-x/Math.tan(a);b.length=x/Math.sin(a);if(b.attachment<start)return [branches,common];b.cropLimited=sample(ctx.mask,x+3,y)<.99;}
    out.sort((a,b)=>a.attachment-b.attachment);if(out.some((b,i)=>i&&b.attachment-out[i-1].attachment<13)||out.some((b,i)=>out.slice(0,i).some(q=>dist(b.tip,q.tip)<18)))return [branches,common];return [out,family];
  }
  function reconsider(ctx,branches){const blur=blur5(ctx),ordered=branches.slice().sort((a,b)=>a.attachment-b.attachment);return ordered.filter((b,i)=>{
    const initial=b.previousWeakTip||b.tip,tipSupport=sample(blur,Math.round(initial[0]),Math.round(initial[1])),shaft=orientationSupport(ctx,b.tip,b.attachment,b.angle);
    for(const j of [i-1,i+1]){if(j<0||j>=ordered.length)continue;const q=ordered[j],ratio=Math.min(b.tip[0],q.tip[0])/Math.max(b.tip[0],q.tip[0]);let coverage=0,bridge=0;
      for(let k=0;k<20;k++){const x=(.65+.30*k/19)*Math.min(b.tip[0],q.tip[0]),y0=b.attachment+x/Math.tan(b.angle*D),y1=q.attachment+x/Math.tan(q.angle*D);for(let l=0;l<9;l++){const y=y0+(y1-y0)*(.25+.5*l/8);coverage+=+(sample(ctx.mask,x,y)>.99);bridge+=+(sample(ctx.sil,x,y)>.5);}}
      coverage/=180;bridge/=180;const prom=b.score/Math.max(1,q.score);if(ratio>=.8&&coverage>=.95&&bridge>=.9&&prom<.2&&tipSupport<.10&&shaft<.25)return false;if(b.origin==='contour_corner'&&ratio>=.65&&coverage>=.95&&bridge>=.9&&prom<.25&&shaft<.15)return false;
    }return true;
  });}
  function detectBranches(master){const {width:w,height:h}=master,m=raster(master.ink,w,h),mask=raster(master.valid,w,h),sil=closeMask(master.ink,w,h,.065,master.valid,true),ctx={w,h,master:m,mask,sil};
    const safe=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=1;for(let dy=-2;dy<=2&&v;dy++)for(let dx=-2;dx<=2;dx++)v&=master.valid[clamp(y+dy,0,h-1)*w+clamp(x+dx,0,w-1)];safe[y*w+x]=v;}ctx.g=gradient(m,raster(safe,w,h));const start=master.rootLimit,tips=candidates(ctx,start),originalCount=tips.length;
    if(tips.length<=2)for(const p of shoulders(ctx,start))if(tips.every(q=>dist(p.tip,q.tip)>=22))tips.push(p);
    if(!tips.length)return {branches:[],sil,common:60};const initial=direction(ctx,start),trials=range(Math.max(30,initial-10),Math.min(76,initial+12)),reliable=tips.filter(p=>originalCount>1&&p.clipped&&p.tip[0]>=.9*Math.max(...tips.map(q=>q.tip[0])));let common=initial;
    if(reliable.length){let best=-Infinity;for(const a of trials){let sum=0,weight=0;for(const p of reliable){const t=p.tip[1]-p.tip[0]/Math.tan(a*D);if(t<start)continue;const cost=axisCost(ctx,p.tip,a,start)[0],shaft=orientationSupport(ctx,p.tip,t,a),v=shaft-.5*cost*clamp((.30-shaft)/.08,0,1);sum+=v*p.tip[0]**2;weight+=p.tip[0]**2;}const score=weight?sum/weight-.00035*(a-initial)**2:-1;if(score>best){best=score;common=a;}}}
    const substantial=tips.filter(p=>p.origin==='envelope'&&p.tip[0]>=.7*Math.max(...tips.map(q=>q.tip[0]))),required=substantial.map(p=>Math.atan2(p.tip[0],Math.max(.01,p.tip[1]-start))/D);if(required.length&&Math.max(...required)>common+4&&Math.max(...required)<=74)common=Math.max(common,Math.max(...required)-3);
    const branches=[];for(const p of tips){if(!p.clipped){const radius=Math.max(5,Math.min(14,p.tip[0]*.20)),a=common*D,points=[];let max=-Infinity;for(let y=Math.max(0,Math.ceil(p.tip[1]-radius));y<=Math.min(h-1,Math.floor(p.tip[1]+radius));y++)for(let x=Math.max(0,Math.ceil(p.tip[0]-radius));x<=Math.min(w-1,Math.floor(p.tip[0]+radius));x++)if(sil.data[y*w+x]&&(x-p.tip[0])**2+(y-p.tip[1])**2<=radius**2){const proj=x*Math.sin(a)+y*Math.cos(a);points.push([x,y,proj]);max=Math.max(max,proj);}if(points.length){const cap=points.filter(p=>p[2]>=max-1);p.tip=[mean(cap.map(p=>p[0])),mean(cap.map(p=>p[1]))];}}
      let best=null;for(const a of range(common-4,common+4,.5)){const [cost,t]=axisCost(ctx,p.tip,a,start),score=cost+.008*(a-common)**2;if(!best||score<best.score)best={cost,t,a,score};}const support=orientationSupport(ctx,p.tip,best.t,best.a),gate=widthCost(ctx,p.tip,best.a,start)[0];if(gate>1.25||(gate>.85&&support<.15)||(p.origin==='contour_corner'&&best.t-start<3&&best.cost>.2))continue;
      branches.push({origin:p.origin,attachment:best.t,angle:best.a,length:p.tip[0]/Math.sin(best.a*D),score:p.prominence,tip:p.tip,medialCost:best.cost,cropLimited:p.clipped,orientationSupport:support});
    }
    const keep=[];for(const b of branches.sort((a,b)=>b.score-a.score))if(!keep.some(q=>Math.abs(b.attachment-q.attachment)<13||dist(b.tip,q.tip)<18))keep.push(b);
    if(keep.length){const familyCost=a=>mean(keep.map(b=>axisCost(ctx,b.tip,a,start)[0])),old=familyCost(common);let candidate=40,best=Infinity;for(const a of range(40,72)){const value=familyCost(a)+.0006*(a-60)**2;if(value<best){best=value;candidate=a;}}const next=familyCost(candidate);
      if(old-next>.10&&next<old*.70&&Math.max(...keep.map(b=>b.orientationSupport))<.25){const local=range(Math.max(30,common-10),Math.min(76,common+10)),familySupport=a=>mean(keep.map(b=>orientationSupport(ctx,b.tip,b.tip[1]-b.tip[0]/Math.tan(a*D),a)));let shaft=local[0],support=-Infinity;for(const a of local){const score=familySupport(a);if(score>support){support=score;shaft=a;}}const target=support-familySupport(common)>.08?shaft:(keep.length>=3?candidate:common),previous=common;common=clamp(target,common-6,common+6);for(const b of keep){b.angle+=common-previous;[b.medialCost,b.attachment]=axisCost(ctx,b.tip,b.angle,start);b.length=b.tip[0]/Math.sin(b.angle*D);b.orientationSupport=orientationSupport(ctx,b.tip,b.attachment,b.angle);}}
    }
    const sameCrystal=(a,b)=>{if(Math.min(a.tip[0],b.tip[0])/Math.max(a.tip[0],b.tip[0])<.82||dist(a.tip,b.tip)>.65*Math.min(a.tip[0],b.tip[0]))return false;let hits=0;for(let i=0;i<25;i++){const f=.1+.8*i/24;hits+=+(sample(sil,a.tip[0]*(1-f)+b.tip[0]*f-3,a.tip[1]*(1-f)+b.tip[1]*f)>.5);}return hits/25>.92;};
    const quality=b=>{let best=-1000;for(const a of range(25,75)){const [cost,t]=axisCost(ctx,b.tip,a,start);if(cost<1.6)best=Math.max(best,orientationSupport(ctx,b.tip,t,a)-.2*cost);}return best;};
    const ranked=originalCount<=2?keep.map(b=>[b,quality(b)]).sort((a,b)=>b[1]-a[1]).map(v=>v[0]):keep,uniqueBranches=[];
    for(const b of ranked){const owner=originalCount<=2&&uniqueBranches.find(q=>sameCrystal(b,q));if(owner){(owner.competingCaps||(owner.competingCaps=[])).push(b.tip);}else uniqueBranches.push(b);}
    let result=jointRefine(ctx,uniqueBranches,common,start);result=repairWeak(ctx,result[0],result[1],start);const accepted=reconsider(ctx,result[0]).filter(b=>{const x=Math.round(b.tip[0]),y=Math.round(b.tip[1]),i=y*w+x;return b.attachment>=start&&master.count[i]>=6&&!master.hexmask[i];});return {branches:accepted.sort((a,b)=>a.attachment-b.attachment),sil,common:result[1]};
  }
  function recoverConsensus(master,sides,branches){const added=[];for(const b of branches){if(!b.previousWeakTip)continue;const tip=b.previousWeakTip,a=b.angle*D,root=tip[1]-tip[0]/Math.tan(a);if(Math.abs(root-b.attachment)<13||dist(tip,b.tip)<18||root<master.rootLimit||branches.some(q=>Math.abs(root-q.attachment)<13||dist(tip,q.tip)<18))continue;
      const voters=[];for(const side of sides){const ink=raster(side.ink,side.width,side.height),valid=raster(side.valid,side.width,side.height);let best={score:0,shaft:0,tip:0};for(const dr of [-6,0,6]){let coverage=0,shaft=0;for(let j=0;j<20;j++){const x=(.25+.65*j/19)*tip[0],y=root+dr+x/Math.tan(a);coverage+=+(sample(valid,x,y)>.99);const band=mean([-3,0,3].map(d=>sample(ink,x+d*Math.cos(a),y-d*Math.sin(a))));shaft+=+(band>.10);}if(coverage/20<.95)continue;const end=mean([-3,0,3].flatMap(dx=>[-3,0,3].map(dy=>sample(ink,tip[0]+dx,tip[1]+dr+dy)))),score=shaft/20*Math.min(1,end/.15);if(score>best.score)best={score,shaft:shaft/20,tip:end};}if(best.shaft>=.60&&best.tip>=.15)voters.push(side.index);}
      if(voters.length>=6&&new Set(voters.map(i=>i>>1)).size>=3){const item={...b,origin:'side_consensus',attachment:root,tip:tip.slice(),length:tip[0]/Math.sin(a),consensusSides:voters};delete item.previousWeakTip;added.push(item);}
    }return branches.concat(added).sort((a,b)=>a.attachment-b.attachment);}
  function fitBaseline(master,mastermask,ink,valid,slots,common,localroot){
    const ms=closeMask(master.data,master.width,master.height,.065,mastermask.data,true),ls=closeMask(ink.data,ink.width,ink.height,.065,valid.data,true),F=[],O=[];
    for(let i=0;i<19;i++)for(let j=0;j<7;j++){F.push(.15+.93*i/18);O.push(-12+4*j);}
    const offers=slots.map((b,i)=>{
      const root=b.attachment,length=b.length,angle=b.angle,a=angle*D,template=[],tm=[],ts=[];let tn=0;
      for(let j=0;j<F.length;j++){const x=length*F[j]*Math.sin(a)+O[j]*Math.cos(a),y=root+length*F[j]*Math.cos(a)-O[j]*Math.sin(a);template.push(sample(master,x,y));tm.push(sample(mastermask,x,y)>.99);ts.push(sample(ms,x,y)>.5);tn+=+tm[j];}
      let lower=Math.max(localroot+1,root-Math.max(16,Math.min(48,.40*length))),upper=root+Math.max(16,Math.min(48,.40*length));if(i)lower=Math.max(lower,(slots[i-1].attachment+root)/2+2);if(i+1<slots.length)upper=Math.min(upper,(slots[i+1].attachment+root)/2-2);if(lower>upper)return null;
      const roots=unique([...range(lower,upper,3),clamp(root,lower,upper)]),angles=range(common-8,common+8,2),lengths=unique([1,...range(.65,1.35,.10)]).map(v=>v*length),candidates=[];
      for(const R of roots)for(const A of angles){const S=Math.sin(A*D),C=Math.cos(A*D);for(const L of lengths){
        let n=0,os=0,tt=0,oo=0,t2=0,ot=0,agree=0;for(let j=0;j<F.length;j++){if(!tm[j])continue;const x=L*F[j]*S+O[j]*C,y=R+L*F[j]*C-O[j]*S;if(sample(valid,x,y)<=.99)continue;const obs=sample(ink,x,y),target=template[j];n++;os+=obs;tt+=target;oo+=obs*obs;t2+=target*target;ot+=obs*target;agree+=+((sample(ls,x,y)>.5)===ts[j]);}
        const coverage=n/Math.max(1,tn),corr=(ot-os*tt/Math.max(1,n))/Math.sqrt(Math.max(1e-8,(oo-os*os/Math.max(1,n))*(t2-tt*tt/Math.max(1,n))));agree/=Math.max(1,n);
        let linevalid=0,continuity=0,shaftFraction=0,shaftStrength=0,left=0,right=0;
        for(let j=0;j<24;j++){const f=.05+.91*j/23,x=L*f*S,y=R+L*f*C;linevalid+=+(sample(valid,x,y)>.99);continuity+=+(sample(ls,x,y)>.5);const band=(sample(ink,x-3*C,y+3*S)+sample(ink,x,y)+sample(ink,x+3*C,y-3*S))/3;shaftFraction+=+(band>.08);shaftStrength+=clamp(band/.20,0,1);for(const off of [4,8,12]){left+=sample(ink,x-off*C,y+off*S);right+=sample(ink,x+off*C,y-off*S);}}
        linevalid/=24;continuity/=24;shaftFraction/=24;shaftStrength/=24;left/=72;right/=72;const balance=Math.abs(left-right)/Math.max(.05,left+right),ends=[-4,0,4,8].map(q=>sample(ls,(L+q)*S,R+(L+q)*C)),terminal=.5*(ends[0]+ends[1]-ends[2]-ends[3]);let tipInk=0;for(const dx of [-2,0,2])for(const dy of [-2,0,2])tipInk+=sample(ink,L*S+dx,R+L*C+dy);tipInk/=9;
        let score=.50*corr+.15*agree+.15*terminal+.25*shaftStrength-.12*balance-.035*((R-root)/Math.max(16,.25*length))**2-.025*((A-angle)/6)**2-.025*((L/length-1)/.3)**2;
        if(!(coverage>=.65&&linevalid>=.95&&continuity>=.65&&ends[0]>.4&&sample(valid,L*S,R+L*C)>.99&&shaftFraction>=.50&&tipInk>=.08))score=-1e6;
        candidates.push({score,R,A,L,corr,shaftFraction,shaftStrength,coverage,continuity});
      }}return {candidates,bounds:[lower,upper]};
    });
    let family=common,bestCount=-1,bestScore=-Infinity;for(const f of range(common-6,common+6,2)){const vals=[];for(const o of offers){if(!o)continue;let score=-1e6;for(const c of o.candidates)if(Math.abs(c.A-f)<=4)score=Math.max(score,c.score);if(score>-1e5)vals.push(score);}const score=vals.length?mean(vals)-.001*(f-common)**2:-1e6;if(vals.length>bestCount||(vals.length===bestCount&&(score>bestScore||(score===bestScore&&f>family)))){family=f;bestCount=vals.length;bestScore=score;}}
    const out=slots.map((b,i)=>{const o=offers[i];if(!o)return {slot:i,status:'unresolved',reason:'no_root_interval_outside_local_hex'};let choice=null;for(const c of o.candidates)if(Math.abs(c.A-family)<=4&&(!choice||c.score>choice.score))choice=c;if(!choice||choice.score<-1e5)return {slot:i,status:'unresolved',reason:'no_supported_feasible_match'};
      const R=choice.R,A=choice.A,a=A*D;let L=choice.L;const ds=range(Math.max(.60*b.length,L-10),Math.min(1.40*b.length,L+10),.5),support=ds.map(d=>{const x=d*Math.sin(a),y=R+d*Math.cos(a);return mean([-2,0,2].map(off=>sample(ink,x+off*Math.cos(a),y-off*Math.sin(a))))>.08&&sample(valid,x,y)>.99;});let nearest=Infinity;
      for(let j=0;j<ds.length-1;j++)if(support[j]&&!support[j+1]&&Math.abs(ds[j]-choice.L)<nearest){nearest=Math.abs(ds[j]-choice.L);L=ds[j];}
      const tip=[L*Math.sin(a),R+L*Math.cos(a)],confident=choice.corr>=.18&&choice.score>=.22&&choice.shaftFraction>=.70;
      return {slot:i,status:confident?'fitted':'inferred',attachment:R,angle:A,length:L,tip,score:choice.score,correlation:choice.corr,shaftFraction:choice.shaftFraction,shaftStrength:choice.shaftStrength,coverage:choice.coverage,continuity:choice.continuity,rootBounds:o.bounds,cropLimited:sample(valid,tip[0]+3*Math.sin(a),tip[1]+3*Math.cos(a))<.99};
    });return {out,family,ls};
  }
  function lineSupport(mask,root,tip){let hits=0;for(let j=0;j<40;j++){const f=.12+.83*j/39;hits+=+(sample(mask,f*tip[0],root+f*(tip[1]-root))>.5);}return hits/40;}
  function shaftMidpoints(mask,valid,root,tip){const delta=[tip[0],tip[1]-root],length=Math.hypot(...delta),u=delta.map(x=>x/length),v=[u[1],-u[0]],points=[];
    for(let j=0;j<18;j++){const s=(.25+.60*j/17)*length,bits=[],vm=[];for(let n=-24;n<=24;n++){const x=s*u[0]+n*v[0],y=root+s*u[1]+n*v[1],ok=x>=0&&y>=0&&x<mask.width-1&&y<mask.height-1&&sample(valid,x,y)>.99;vm.push(ok);bits.push(ok&&sample(mask,x,y)>.5);}let chosen=null;
      for(let lo=0;lo<bits.length;lo++){if(!bits[lo])continue;let hi=lo;while(hi+1<bits.length&&bits[hi+1])hi++;if(lo&&hi<bits.length-1&&vm[lo-1]&&vm[hi+1]&&hi-lo+1>=3&&hi-lo+1<=40&&lo-24<=3&&hi-24>=-3){const mid=(lo+hi)/2-24;if(Math.abs(mid)<=9&&(chosen===null||Math.abs(mid)<Math.abs(chosen)||(Math.abs(mid)===Math.abs(chosen)&&mid<chosen)))chosen=mid;}lo=hi;}
      if(chosen!==null)points.push([s*u[0]+chosen*v[0],root+s*u[1]+chosen*v[1]]);
    }return points;
  }
  function refineShafts(result,ink,valid,slots,localroot){const {out,family,ls:mask}=result;
    for(let i=0;i<out.length;i++){if(out[i].status!=='unresolved')continue;const s=slots[i];let lo=Math.max(localroot+2,s.attachment-16),hi=s.attachment+16;if(i&&out[i-1].status!=='unresolved')lo=Math.max(lo,out[i-1].attachment+3);if(i+1<out.length&&out[i+1].status!=='unresolved')hi=Math.min(hi,out[i+1].attachment-3);const root=clamp(s.attachment,lo,hi),angle=clamp(s.angle,family-4,family+4),a=angle*D;let length=.5,last=false;for(const d of range(.5,s.length,.5)){last=sample(valid,d*Math.sin(a),root+d*Math.cos(a))>.99;if(last)length=d;}out[i]={slot:i,status:'inferred',reason:'baseline_missing_local_match',attachment:root,angle,length,tip:[length*Math.sin(a),root+length*Math.cos(a)],rootBounds:[lo,hi],cropLimited:!last};}
    const original=out.map(b=>({...b}));for(let i=0;i<out.length;i++){const b=out[i];b.refinement='retained_baseline';if(b.status!=='fitted')continue;const root=b.attachment,tip=b.tip;let points=shaftMidpoints(mask,valid,root,tip);if(points.length<9)continue;points=points.filter(p=>p[0]/tip[0]>.15&&p[0]/tip[0]<.9);if(points.length<9||Math.max(...points.map(p=>p[0]/tip[0]))-Math.min(...points.map(p=>p[0]/tip[0]))<.35)continue;
      let roots=points.map(p=>{const f=p[0]/tip[0];return (p[1]-tip[1]*f)/(1-f);}),proposal=median(roots),mad=median(roots.map(r=>Math.abs(r-proposal)));const kept=roots.map((r,j)=>Math.abs(r-proposal)<=Math.max(2,2.5*mad)?j:-1).filter(j=>j>=0);if(kept.length<9||mad>5)continue;proposal=median(kept.map(j=>roots[j]));points=kept.map(j=>points[j]);
      let lo=Math.max(localroot+2,root-16,b.rootBounds[0]),hi=Math.min(root+16,b.rootBounds[1]);if(i)lo=Math.max(lo,original[i-1].attachment+3);if(i+1<out.length)hi=Math.min(hi,original[i+1].attachment-3);lo=Math.max(lo,tip[1]-tip[0]/Math.tan((family-4)*D));hi=Math.min(hi,tip[1]-tip[0]/Math.tan((family+4)*D));if(lo>hi)continue;const proposed=clamp(proposal,lo,hi),angle=Math.atan2(tip[0],tip[1]-proposed)/D,length=Math.hypot(tip[0],tip[1]-proposed),residual=r=>{const slope=(tip[1]-r)/tip[0];return median(points.map(p=>Math.abs(p[1]-r-slope*p[0])/Math.sqrt(1+slope*slope)));},before=residual(root),after=residual(proposed);
      if(before-after<.6||after>.8*before||length<.6*slots[i].length||length>1.4*slots[i].length||lineSupport(mask,proposed,tip)<lineSupport(mask,root,tip)||lineSupport(valid,proposed,tip)<1)continue;
      b.baselineGeometry={attachment:root,angle:b.angle,length:b.length,tip:tip.slice()};Object.assign(b,{attachment:proposed,angle,length,refinement:'paired_boundary_root',shaftMidpointCount:points.length,midpointResidualBefore:before,midpointResidualAfter:after,rootCorrection:proposed-root});
    }return result;
  }
  function evaluateLocal(ink,mask,valid,R,A,L,prior,candidate=false){const s=Math.sin(A*D),c=Math.cos(A*D);let support=0,gap=0,run=0,center=0,pairedCount=0,width=0,vm=true,tipink;
    // Candidate scores are read only when feasible. Check the unchanged guards
    // first; an unsupported trial cannot win and needs no paired-width probes.
    // Baseline evaluations retain every metric even when they are infeasible.
    if(candidate){
      for(let j=0;j<32;j++){const f=.12+.84*j/31,x=L*f*s,y=R+L*f*c;if(!(sample(valid,x,y)>.99&&x>=0&&y>=0&&x<ink.width-1&&y<ink.height-1))return {feasible:false};}
      if(!(sample(valid,L*s,R+L*c)>.99))return {feasible:false};
      tipink=mean([-2,0,2].map(off=>sample(ink,L*s+off*c,R+L*c-off*s)));if(!(tipink>.045))return {feasible:false};
    }
    for(let j=0;j<32;j++){const f=.12+.84*j/31,x=L*f*s,y=R+L*f*c,material=sample(mask,x,y)>.5;if(!candidate)vm=vm&&sample(valid,x,y)>.99&&x>=0&&y>=0&&x<ink.width-1&&y<ink.height-1;support+=+material;if(!material){run++;gap=Math.max(gap,run);}else run=0;let left=0,right=0,liveleft=material,liveright=material;
      for(let d=1;d<25;d++){liveleft=liveleft&&sample(mask,x-d*c,y+d*s)>.5;liveright=liveright&&sample(mask,x+d*c,y-d*s)>.5;left+=+liveleft;right+=+liveright;if(!liveleft&&!liveright)break;}
      if(material&&left<24&&right<24&&left+right>=3){center+=1-Math.abs(left-right)/Math.max(3,left+right);pairedCount++;}width+=Math.min(left,right);
    }
    support/=32;gap/=32;center/=Math.max(1,pairedCount);const pairedFraction=pairedCount/32; width/=32;const ends=[-4,-2,0,2,4,6].map(q=>sample(mask,(L+q)*s,R+(L+q)*c)),terminal=(ends[0]+ends[1]+ends[2]-ends[3]-ends[4]-ends[5])/3;if(!candidate)tipink=mean([-2,0,2].map(off=>sample(ink,L*s+off*c,R+L*c-off*s)));const priorcost=.055*((R-prior.attachment)/14)**2+.04*((A-prior.angle)/4)**2+.04*((L/prior.length-1)/.20)**2;
    const score=.45*support-.70*gap+.22*center*Math.min(1,pairedFraction/.55)+.10*Math.min(1,width/5)+.24*terminal-priorcost,feasible=vm&&sample(valid,L*s,R+L*c)>.99&&tipink>.045;
    return {score,feasible,photoSupport:support,longestBackgroundGap:gap,shaftCentering:center,pairedFraction,terminalEvidence:terminal};
  }
  function jointLocal(result,ink,valid,slots,localroot){const {out,family}=result,mask=closeMask(ink.data,ink.width,ink.height,.055,valid.data,false),old=out.map(b=>({...b}));
    for(let i=0;i<out.length;i++){const b=out[i],prior=old[i],root=prior.attachment,length=prior.length,angle=prior.angle;let lo=Math.max(localroot+2,root-20),hi=root+20;if(i)lo=Math.max(lo,(old[i-1].attachment+root)/2+2);if(i+1<out.length)hi=Math.min(hi,(old[i+1].attachment+root)/2-2);if(lo>hi)continue;
      const baseline=evaluateLocal(ink,mask,valid,root,angle,length,prior),roots=unique([...range(lo,hi,2),root]),angles=unique([...range(family-4,family+4),angle]),lengths=unique([length,...range(Math.max(.6*slots[i].length,.75*length),Math.min(1.4*slots[i].length,1.25*length),2)]);let best={R:root,A:angle,L:length,...baseline};
      for(const R of roots)for(const A of angles)for(const L of lengths){const v=evaluateLocal(ink,mask,valid,R,A,L,prior,true);if(v.feasible&&(!best.feasible||v.score>best.score))best={R,A,L,...v};}
      let changed=best.feasible&&best.score>=baseline.score+.045;if(changed&&best.photoSupport+.025<baseline.photoSupport)changed=false;if(changed&&best.longestBackgroundGap>baseline.longestBackgroundGap+.001)changed=false;if(!changed)best={R:root,A:angle,L:length,...baseline};
      const a=best.A*D,reliable=best.feasible&&best.photoSupport>=.85&&best.longestBackgroundGap<=.125;b.previousGeometry={attachment:root,angle,length,tip:prior.tip.slice(),status:prior.status};Object.assign(b,{attachment:best.R,angle:best.A,length:best.L,tip:[best.L*Math.sin(a),best.R+best.L*Math.cos(a)],rootBounds:[Math.min(lo,root),Math.max(hi,root)],jointRefined:changed,jointScore:best.score,jointBaselineScore:baseline.score,status:reliable?'fitted':'inferred',reason:reliable?'local_photographic_axis':'incomplete_local_photographic_support'});
      const metrics=['photoSupport','longestBackgroundGap','shaftCentering','pairedFraction','terminalEvidence'];b.localEvidence=Object.fromEntries(metrics.map(k=>[k,best[k]]));b.priorEvidence=Object.fromEntries(metrics.map(k=>[k,baseline[k]]));
    }return result;
  }
  function trimConnected(branches,ink,valid,probe){for(const b of branches){if(b.status!=='inferred')continue;const a=b.angle*D;let last=null,gap=0;
      for(let d=.5;d<=b.length+1e-7;d+=.5){const x=d*Math.sin(a),y=b.attachment+d*Math.cos(a),q=probe?probe(x,y):{value:sample(ink,x,y),valid:x>=0&&y>=0&&x<ink.width-1&&y<ink.height-1&&sample(valid,x,y)>.99};if(q.value>.055&&q.valid){last=d;gap=0;}else gap++;if(gap>3)break;}
      if(last===null){b.status='unresolved';b.reason='no_root_connected_photographic_support';b.length=0;b.tip=[0,b.attachment];continue;}
      if(last<b.length-.5){b.beforeTrim={length:b.length,tip:b.tip.slice()};b.length=last;b.tip=[last*Math.sin(a),b.attachment+last*Math.cos(a)];b.trimReason='first_connected_material_exit';}
    }return branches;}
  function fitSide(master,side,slots,common,options={}){const m=raster(master.ink,master.width,master.height),mm=raster(master.valid,master.width,master.height),ink=raster(side.ink,side.width,side.height),valid=raster(side.valid,side.width,side.height);
    const result=jointLocal(refineShafts(fitBaseline(m,mm,ink,valid,slots,common,side.localRootLimit),ink,valid,slots,side.localRootLimit),ink,valid,slots,side.localRootLimit);
    trimConnected(result.out,ink,valid,options.probe||((x,y)=>sampleSide(side,x,y)));return {branches:result.out,commonAngle:result.family};
  }
  // Install a completed local result on its original side after either a
  // synchronous fit or an asynchronous worker fit. Source coordinates and slot
  // correspondence use this one shared path in both cases.
  function applyLocalFit(side,fit){
    side.commonAngle=fit.commonAngle;side.branches=fit.branches.map((b,i)=>({...b,id:'branch-'+i,slotId:i,sourceRoot:toSource(side,0,b.attachment),sourceTip:toSource(side,b.tip)}));return side;
  }
  function analyze(framework,options={}){
    const started=now(),extracted=options.extracted||extract(framework,options),afterExtraction=now(),{master,sides}=extracted;
    const detected=options.masterBranches?{branches:options.masterBranches,common:options.commonAngle||60}:detectBranches(master);master.branches=recoverConsensus(master,sides,detected.branches);master.commonAngle=detected.common;master.pixel=sides[0].pixel;master.halfAngle=median(sides.map(s=>s.bisectorAngle));master.bisectorAngle=master.halfAngle;master.trunkTip=median(sides.map(s=>Array.isArray(s.trunkTip)?s.trunkTip[1]:s.trunkTip));master.trunkPoint=[0,master.trunkTip];
    // Canonical central exclusion is the union of transformed observed hexes.
    // The representative outer hex is radially median, preserving six vertices.
    master.hexPolygon=range(0,5).map(i=>{const a=i*PI/3;const radii=sides.map(s=>rayExit([0,0],[Math.sin(a),Math.cos(a)],s.hexPolygon));const r=median(radii);return [r*Math.sin(a),r*Math.cos(a)];});
    const afterDetection=now();master.branches.forEach((b,i)=>{b.id='branch-'+i;b.slot=i;b.slotId=i;});
    for(const side of sides){side.trunkPoint=Array.isArray(side.trunkTip)?side.trunkTip:[0,side.trunkTip];side.trunkTip=side.trunkPoint[1];side.halfAngle=side.bisectorAngle;if(options.deferLocal){delete side.branches;delete side.commonAngle;continue;}const fit=options.localFit===false?{branches:master.branches.map(b=>({...b,tip:b.tip.slice(),status:'inferred'})),commonAngle:master.commonAngle}:fitSide(master,side,master.branches,master.commonAngle);applyLocalFit(side,fit);}
    return {framework,master,sides,registration:extracted.registration,timings:{extraction:afterExtraction-started,detection:afterDetection-afterExtraction,local:now()-afterDetection,total:now()-started}};
  }
  const api={analyze,extract,align,prepareSides,sampleSide,toSource,sourceTransform:toSource,detectBranches,fitSide,applyLocalFit,trimConnected,sample,closeMask};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ReconstructionBranches=api;
})(typeof globalThis!=='undefined'?globalThis:this);
