const assert=require('node:assert/strict'),fs=require('fs'),B=require('../dist/branch-structure.js'),I=require('../dist/image-crystal.js'),O=require('../dist/cut-output.js');
const delta=(a,b)=>Math.atan2(Math.sin(6*(a-b)),Math.cos(6*(a-b)))/6;
for(let i=1;i<=10;i++){
 const px=new Uint8Array(fs.readFileSync(`/tmp/image-model-${i}.rgba`)),m=B.extract(px,768),roots=m.tree.filter(t=>t.parent===null),angles=roots.map(t=>Math.atan2(t.end[1]-t.start[1],t.end[0]-t.start[0])),mean=Math.atan2(angles.reduce((s,a)=>s+Math.sin(6*a),0),angles.reduce((s,a)=>s+Math.cos(6*a),0))/6;
 assert(Math.abs(delta(m.axis,mean))<1e-10,'use the six measured trunks, not the coarse ridge-scan seed');
 const fitted=I.fit(px,768,100,false,100,100,m);for(const t of fitted.tree.filter(t=>t.parent===null)){const a=Math.atan2(t.end[1]-t.start[1],t.end[0]-t.start[0]);assert(Math.abs(delta(a,mean))<1e-10,'symmetric graph uses the measured mean axis')}
 // A misplaced mirror axis can cut away the actual primary tip. Check the
 // resulting extent against the independently measured mean arm length.
 const mask=Uint8Array.from({length:768*768},(_,j)=>px[j*4]<230?1:0),r=O.process(mask,768,{crystal:0,symmetry:100,detail:100,fill:true,islands:true,offset:0,round:0,size:100},fitted);
 if(i===10){const axis=m.axis+4*Math.PI/3,co=Math.cos(axis),si=Math.sin(axis),points=r.loops.flat().map(([x,y])=>{x-=384;y-=384;return [x*co+y*si,-x*si+y*co]}).filter(([u,v])=>u>200&&Math.abs(v)<40),tip=points.reduce((a,b)=>b[0]>a[0]?b:a);const meanLength=roots.reduce((s,t)=>s+t.length*m.scale,0)/roots.length;assert(Math.abs(tip[0]-meanLength)<8,'symmetry must retain the measured primary tip length')}
 console.log(`Reference ${i}: measured axis ${(m.axis*180/Math.PI).toFixed(3)}°, graph and cut aligned.`);
}
