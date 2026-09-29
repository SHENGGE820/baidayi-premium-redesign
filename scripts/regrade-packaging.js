/* Re-grades the packaging renders on 劑型與包材 onto the site's palette.
 *
 * The ten renders were made for the old site: each product sits on a baked-in
 * backdrop running from charcoal at the top, through white, to the old brand's
 * pale yellow at the bottom. On the redesign they were the only images still
 * carrying that yellow, and the charcoal band made the cards read much heavier
 * than every other card grid.
 *
 * The backdrop is the same vertical gradient in every file, and nothing but
 * backdrop touches the left and right edges. So for each row the backdrop
 * colour is measured at the edges, and each pixel is moved toward the new
 * backdrop colour for that row in proportion to how close it is to the old
 * one. Backdrop pixels move all the way; the product — well away from the
 * backdrop colour — barely moves, so the amber glass and the pink blister
 * card keep their colour. The new backdrop runs sand → paper → ivory, the
 * site's own tokens.
 *
 *   node scripts/regrade-packaging.js
 *
 * Reads the originals from ../baidayi-original-assets, writes
 * assets/brand/pack-*.jpg. Needs ffmpeg/ffprobe on PATH.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, '..', 'baidayi-original-assets', 'uploads', '2026', '04');
const OUT = path.join(ROOT, 'assets', 'brand');
const W = 720;

const FILES = {
  'pack-pe-bottle': '各類包裝按鈕_PE塑膠瓶.jpg',
  'pack-box': '各類包裝按鈕_包裝外盒.jpg',
  'pack-zip-foil': '各類包裝按鈕_夾鏈鋁袋.jpg',
  'pack-gusset-foil': '各類包裝按鈕_折角鋁袋.jpg',
  'pack-blister': '各類包裝按鈕_排裝.jpg',
  'pack-jelly-foil': '各類包裝按鈕_果凍條鋁袋.png',
  'pack-powder-foil': '各類包裝按鈕_粉末鋁袋.jpg',
  'pack-spout-pouch': '各類包裝按鈕_飲品口栓袋.jpg',
  'pack-glass-bottle': '各類包裝按鈕_飲品玻璃瓶.jpg',
  'pack-shaped-pouch': '各類包裝按鈕_飲品異型袋.jpg',
};

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const SAND = hex('#ddd5c6'), PAPER = hex('#fbf9f4'), IVORY = hex('#f4f0e7');
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/* sand at the top, paper by just past the middle, settling to ivory. */
const target = t => t < 0.55 ? lerp(SAND, PAPER, t / 0.55) : lerp(PAPER, IVORY, (t - 0.55) / 0.45);

if (!fs.existsSync(SRC)) { console.error('Original media not found at ' + SRC); process.exit(2); }

for (const [name, file] of Object.entries(FILES)) {
  const src = path.join(SRC, file);
  const [sw, sh] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src])
    .toString().trim().split(',').map(Number);
  const H = Math.round(W * sh / sw / 2) * 2;

  /* The renders have rounded corners that leave a hairline of dark pixels at
     the edge; a 1% crop removes it before the edges are sampled.
     Flatten onto white first: one of the renders is a PNG, and dropping its
     alpha channel directly would expose whatever colour sits under it. */
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=white:s=${W}x${H}`, '-i', src,
    '-filter_complex', `[1:v]crop=iw*0.98:ih*0.98,scale=${W}:${H}[p];[0:v][p]overlay=shortest=1,format=rgb24`,
    '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 64 * 1024 * 1024 });

  const px = Buffer.from(raw);
  const EDGE = 12;
  for (let y = 0; y < H; y++) {
    const bg = [0, 0, 0];
    let n = 0;
    for (const x0 of [3, W - 3 - EDGE]) {
      for (let x = x0; x < x0 + EDGE; x++) {
        const i = (y * W + x) * 3;
        bg[0] += px[i]; bg[1] += px[i + 1]; bg[2] += px[i + 2]; n++;
      }
    }
    bg[0] /= n; bg[1] /= n; bg[2] /= n;
    const tg = target(y / (H - 1));
    const delta = tg.map((v, c) => v - bg[c]);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const dist = Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2]));
      const m = Math.min(1, Math.max(0, 1 - (dist - 6) / 40));
      for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, Math.max(0, Math.round(px[i + c] + delta[c] * m)));
    }
  }

  const out = path.join(OUT, name + '.jpg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-',
    '-q:v', '3', out], { input: px });
  console.log(`  ${name}.jpg  ${W}x${H}  ${Math.round(fs.statSync(out).size / 1024)}KB`);
}
