/* Millimeter cut features, applied to vector geometry rather than preview guides. */
(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./crystal.js'):root.Crystal;
const Clipper=typeof module!=='undefined'?require('./vendor/clipper.js'):root.ClipperLib;
const SCALE=1e4;
const paths=loops=>loops.map(p=>p.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)})));
const loops=paths=>paths.map(p=>p.map(v=>[v.X/SCALE,v.Y/SCALE]));
function boolean(subject,clip,type){const c=new Clipper.Clipper(),out=new Clipper.Paths();c.AddPaths(paths(subject),Clipper.PolyType.ptSubject,true);if(clip.length)c.AddPaths(paths(clip),Clipper.PolyType.ptClip,true);c.Execute(type,out,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return loops(out)}
function offset(input,delta,open=false){const c=new Clipper.ClipperOffset(2,.05*SCALE),out=new Clipper.Paths();c.AddPaths(paths(input),Clipper.JoinType.jtRound,open?Clipper.EndType.etOpenRound:Clipper.EndType.etClosedPolygon);c.Execute(out,delta*SCALE);return loops(out)}
function closeGaps(input,width){if(!input.length||!(width>0))return input;return offset(offset(input,width/2),-width/2)}
function circle(center,radius){return Array.from({length:96},(_,i)=>{const a=i*Math.PI/48;return [center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a)]})}
function hanger(input,n,artboard,diameter,rim,neck,axis=null){
 if(!input.length)return {loops:input};
 const unit=n/artboard,radius=diameter*unit/2,wall=rim*unit,outerRadius=radius+wall;
 if(!(radius>0&&wall>0&&neck>=0))throw Error('Hanger size and rim must be positive.');
 const outer=input.filter(p=>C.area(p)>0).sort((a,b)=>C.area(b)-C.area(a))[0];if(!outer)return {loops:input};
 let tip,direction=[0,-1];
 if(axis){
  const origin=axis.start,dx=axis.end[0]-origin[0],dy=axis.end[1]-origin[1],length=Math.hypot(dx,dy);direction=[dx/length,dy/length];let farthest=-Infinity;
  // Intersect the semantic arm axis with the finished cut boundary. An extreme
  // vertex can be a cap corner even on a perfectly symmetric polygon.
  for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length],ex=b[0]-a[0],ey=b[1]-a[1],qx=a[0]-origin[0],qy=a[1]-origin[1],den=direction[0]*ey-direction[1]*ex;if(Math.abs(den)<1e-12)continue;const t=(qx*ey-qy*ex)/den,u=(qx*direction[1]-qy*direction[0])/den;if(t>=0&&u>=-1e-8&&u<=1+1e-8)farthest=Math.max(farthest,t)}
  if(Number.isFinite(farthest))tip=origin.map((v,k)=>v+farthest*direction[k]);
 }
 if(!tip){const top=Math.min(...outer.map(p=>p[1])),cap=outer.filter(p=>Math.abs(p[1]-top)<1e-5);tip=[(Math.min(...cap.map(p=>p[0]))+Math.max(...cap.map(p=>p[0])))/2,top];direction=[0,-1]}
 // The whole opening sits above the flake. The rim is always added explicitly,
 // with a round neck overlapping the original tip for a connected cut.
 // Neck length is the clear distance from the flake tip to the nearest
 // edge of the opening, independent of rim thickness.
 const center=tip.map((v,k)=>v+direction[k]*(radius+neck*unit));
 const additions=[circle(center,outerRadius),...offset([[center,tip]],wall,true)];
 const supported=boolean(input,additions,Clipper.ClipType.ctUnion);
 if(supported.some(p=>p.some(([x,y])=>x<0||y<0||x>n||y>n)))throw Error('Hanger needs more room. Reduce source scale or hanger dimensions.');
 const cut=circle(center,radius),result=boolean(supported,[cut],Clipper.ClipType.ctDifference);
 return {loops:result,center,radius,outerRadius,attachment:tip,direction};
}
root.CutFeatures={closeGaps,hanger};if(typeof module!=='undefined')module.exports=root.CutFeatures;
})(globalThis);
