from PIL import Image
from pathlib import Path
import tempfile
p=Path(__file__).resolve().parents[1]/'dist'
for i in range(1,11):
 im=Image.open(p/f'flake-{i}.png').convert('L');im.thumbnail((346,346));canvas=Image.new('L',(384,384),255);canvas.paste(im,((384-im.width)//2,(384-im.height)//2));Path(f'/tmp/mask-{i}.bin').write_bytes(bytes(1 if v<180 else 0 for v in canvas.getdata()))

# Higher resolution masks for faithful reconstruction regression checks.
for i in range(1,11):
 im=Image.open(p/f'flake-{i}.png').convert('L').resize((553,691),Image.Resampling.BICUBIC)
 canvas=Image.new('L',(768,768),255);canvas.paste(im,(107,38))
 Path(f'/tmp/faithful-{i}.bin').write_bytes(bytes(1 if v<230 else 0 for v in canvas.getdata()))
