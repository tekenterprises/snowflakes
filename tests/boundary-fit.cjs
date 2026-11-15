const assert=require('node:assert/strict'),B=require('../dist/boundary-fit'),C=require('../dist/crystal');
// A long noisy edge should fit around its center, not its upper envelope.
const ring=[];for(let x=0;x<=100;x++)ring.push([x,10+Math.sin(x*.7)*.6]);ring.push([100,60],[0,60]);
const fitted=B.fit(ring,1.5),top=fitted.filter(p=>p[1]<15);assert(top.length<=3,'mostly straight run stays simple');assert(Math.abs(top.reduce((s,p)=>s+p[1],0)/top.length-10)<.25,'fit is centered through noise');assert(Math.abs(Math.abs(C.area(fitted))-5000)<30,'no systematic area inflation');
const tip=[[0,0],[40,0],[42,-12],[44,0],[90,0],[90,50],[0,50]],withTip=B.fit(tip,1.5);assert(withTip.some(p=>Math.hypot(p[0]-42,p[1]+12)<1),'retain a sharp supported tip');
const notch=[[0,0],[90,0],[90,50],[50,50],[50,20],[45,20],[45,50],[0,50]],withNotch=B.fit(notch,1.5);assert(withNotch.some(p=>p[1]<21&&p[0]>44&&p[0]<51),'retain deep narrow notch');
for(const p of fitted)assert(p.every(Number.isFinite));console.log('Boundary fit: centered noisy edge, bounded area bias, supported tip and notch preserved.');
