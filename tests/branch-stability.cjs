const assert=require('node:assert/strict'),fs=require('fs'),B=require('../dist/branch-structure.js');
const variants=JSON.parse(fs.readFileSync('/tmp/twig-variants.json'));let worstTip=0,worstJoin=0;
for(const [i,v] of variants.entries()){
 const angle=v.angle*Math.PI/180,transform=([x,y])=>{x=(x-384)*v.scale+v.dx;y=(y-384)*v.scale+v.dy;return [384+x*Math.cos(angle)-y*Math.sin(angle),384+x*Math.sin(angle)+y*Math.cos(angle)]},tip=transform([480,248]),join=transform([470,334]);
 const m=B.extract(new Uint8Array(fs.readFileSync(`/tmp/twig-variant-${i}.rgba`)),768),matches=m.tree.filter(t=>Math.hypot(t.end[0]*2-tip[0],t.end[1]*2-tip[1])<4);
 assert.equal(matches.length,1,`variant ${i}: one centerline reaches the twig tip`);const t=matches[0];
 assert.equal(t.depth,1,`variant ${i}: attach to main arm, not neighboring blade`);assert.equal(m.tree[t.parent].parent,null);
 const joinError=Math.hypot(t.start[0]*2-join[0],t.start[1]*2-join[1]);assert(joinError<9,`variant ${i}: center-vein junction error ${joinError}px`);
 worstTip=Math.max(worstTip,Math.hypot(t.end[0]*2-tip[0],t.end[1]*2-tip[1]));worstJoin=Math.max(worstJoin,joinError);
}
console.log(`${variants.length} translated/resized/rotated fern inputs: exactly one twig, correct parent. Worst tip ${worstTip.toFixed(2)}px, junction ${worstJoin.toFixed(2)}px on 768px artboard.`);
