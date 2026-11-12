"""Threshold-specific centering, matching the existing image fixture preparation."""
from pathlib import Path
from PIL import Image
import subprocess,json
root=Path(__file__).resolve().parents[1]
for ref in [4]:
 for threshold in [217,245]:
  im=Image.open(root/f'dist/flake-{ref}.png').convert('RGBA')
  small=im.convert('L').resize((154,192));canvas=Image.new('L',(192,192),255);canvas.paste(small,(19,0))
  js="const F=require('./dist/engine.js'),fs=require('fs');console.log(JSON.stringify(F.findCenter(new Uint8Array(fs.readFileSync(0)),192)))"
  center=json.loads(subprocess.check_output(['node','-e',js],input=bytes(v<threshold for v in canvas.getdata()),cwd=root))
  cx=(center['x']-19)/154*256;cy=center['y']/192*320;scale=768/320*.9
  im=im.transform((768,768),Image.Transform.AFFINE,(1/scale,0,cx-384/scale,0,1/scale,cy-384/scale),resample=Image.Resampling.BICUBIC,fillcolor='white')
  Path(f'/tmp/threshold-{ref}-{threshold}.rgba').write_bytes(im.tobytes())
