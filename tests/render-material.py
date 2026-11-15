"""Render diagnostic geometry from render-material-data.cjs (requires Pillow)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
folder=Path(sys.argv[1]); fixtures=Path(sys.argv[2])
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',22)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)
for ref in [5,20]:
    data=json.loads((folder/f'ref-{ref}.json').read_text())
    photo=Image.frombytes('RGBA',(768,768),(fixtures/f'image-model-{ref}.rgba').read_bytes()).convert('RGB')
    result=Image.new('RGB',(1160,930),'white'); d=ImageDraw.Draw(result)
    d.text((15,8),f'Reference {ref} — detail 100, symmetry 0, Fill on, cut adjustments zero',font=font,fill='black')
    box=(420,560,610,650) if ref==20 else (200,180,580,360)
    for index,frame in enumerate(data['frames']):
        overlay=photo.copy(); g=ImageDraw.Draw(overlay)
        for p in frame['polygons']:g.line([tuple(v) for v in p]+[tuple(p[0])],fill=(177,125,25),width=1)
        if frame['clipped']:
            mask=Image.new('1',(768,768))
            for p in frame['clip']:
                ring=Image.new('1',(768,768));ImageDraw.Draw(ring).polygon([tuple(v) for v in p],fill=1);mask=ImageChops.logical_xor(mask,ring)
            overlay=Image.composite(overlay,photo,mask.convert('L'))
        g=ImageDraw.Draw(overlay)
        for p in frame['cut']:g.line([tuple(v) for v in p]+[tuple(p[0])],fill=(220,25,70),width=1)
        x=10+index*580
        d.text((x,42),('v33: clipped guides' if index==0 else 'Candidate: actual cells')+f" ({len(frame['polygons'])})",font=font,fill='black')
        result.paste(overlay.resize((550,550),Image.LANCZOS),(x,77))
        d.rectangle((x+box[0]*550/768,77+box[1]*550/768,x+box[2]*550/768,77+box[3]*550/768),outline=(0,110,210),width=2)
        result.paste(overlay.crop(box).resize((550,260),Image.NEAREST),(x,641))
    d.text((15,905),'Gold: cells   Red: cut perimeter   Diagnostic render from archived photo fixture; not a browser screenshot',font=small,fill='black')
    result.save(folder/f'ref-{ref}-comparison.png')
