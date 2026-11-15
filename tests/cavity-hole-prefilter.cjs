const assert=require('node:assert/strict'),crypto=require('node:crypto'),Cells=require('../dist/cavity-cells');
const hole=Array.from({length:64},(_,j)=>[10+6*Math.cos(j*2*Math.PI/64),10+6*Math.sin(j*2*Math.PI/64)]),holes=Array.from({length:20},(_,i)=>hole.map(([x,y])=>[x+i*2,y]));
const cells=Array.from({length:36},(_,i)=>{const a=i*Math.PI/18,r=25;return [[50,50],[50+r*Math.cos(a),50+r*Math.sin(a)],[50+(r+12)*Math.cos(a+.1),50+(r+12)*Math.sin(a+.1)],[50+(r+4)*Math.cos(a+.2),50+(r+4)*Math.sin(a+.2)]];});
const output=Cells.build(cells,holes,[],cells),digest=crypto.createHash('sha256').update(JSON.stringify({polygons:output.polygons,pieces:output.pieces,loops:output.loops,cutPolygons:output.cutPolygons})).digest('hex');
assert.equal(digest,'ec8275562337bc44520243b46461d2cf69692395b522b9196f1f95f40e4548b6','integer hole AABB prefilter preserves exact synthetic cavity output');
const outer=[[0,0],[20,0],[20,20],[0,20]];
const far=[[30,0],[40,0],[40,10],[30,10]],leftHalf=[[0,0],[10,0],[10,20],[0,20]];
assert.equal(Cells._unionXorArea([[outer],[far]],[leftHalf]),300,'XOR fallback sums differences across every output component');
console.log(`Prepared hole paths preserve exact synthetic cavity output (${digest}).`);
