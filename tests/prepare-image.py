from pathlib import Path
from PIL import Image
import subprocess,json
root=Path(__file__).resolve().parents[1]
for i in range(1,11):
 im=Image.open(root/f'dist/flake-{i}.png').convert('RGBA')
 small=im.convert('L').resize((154,192));canvas=Image.new('L',(192,192),255);canvas.paste(small,(19,0));mask=bytes(v<230 for v in canvas.getdata())
 js="const F=require('./dist/engine.js'),fs=require('fs');console.log(JSON.stringify(F.findCenter(new Uint8Array(fs.readFileSync(0)),192)))"
 center=json.loads(subprocess.check_output(['node','-e',js],input=mask,cwd=root))
 cx=(center['x']-19)/154*256;cy=center['y']/192*320;scale=768/320*.9
 im=im.transform((768,768),Image.Transform.AFFINE,(1/scale,0,cx-384/scale,0,1/scale,cy-384/scale),resample=Image.Resampling.BICUBIC,fillcolor='white')
 Path(f'/tmp/image-model-{i}.rgba').write_bytes(im.tobytes())

 # Rotation fixtures verify the detector rather than image-coordinate exceptions.
 if i==2:
  for degrees in [-15,15,30]:
   rotated=im.rotate(-degrees,resample=Image.Resampling.BICUBIC,center=(384,384),fillcolor='white')
   Path(f'/tmp/rotated-fern-{degrees}.rgba').write_bytes(rotated.tobytes())

# Subpixel placement and resizing must not change a twig's parent assignment.
variants=[dict(dx=dx,dy=dy,scale=1,angle=0) for dx in [-1,-.5,0,.5,1] for dy in [-1,-.5,0,.5,1]]
variants += [dict(dx=.5,dy=-.5,scale=s,angle=a) for s in [.9,.95,1.05,1.1] for a in [-15,0,15]]
im=Image.frombytes('RGBA',(768,768),Path('/tmp/image-model-2.rgba').read_bytes())
for i,v in enumerate(variants):
 s=v['scale'];dx=v['dx'];dy=v['dy']
 transformed=im.transform(im.size,Image.Transform.AFFINE,(1/s,0,384-(384+dx)/s,0,1/s,384-(384+dy)/s),resample=Image.Resampling.BICUBIC,fillcolor='white').rotate(-v['angle'],resample=Image.Resampling.BICUBIC,center=(384,384),fillcolor='white')
 Path(f'/tmp/twig-variant-{i}.rgba').write_bytes(transformed.tobytes())
Path('/tmp/twig-variants.json').write_text(json.dumps(variants))
