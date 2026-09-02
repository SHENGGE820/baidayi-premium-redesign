/* Re-encodes the oversized images the live pages actually reference.
 *
 * The site was shipping 48MB of images, 30MB of it in 29 files — mostly PNGs
 * exported at full size and then displayed at a fraction of it. One article
 * alone pulled seven ~2MB PNGs. Nothing here is cropped or re-composed; the
 * images are only resized to something closer to their display size and
 * re-encoded in a format suited to their content.
 *
 * Transparency is detected rather than assumed: each source is composited
 * over white and over magenta, and if the two differ the alpha is real. The
 * catalogue product shots turned out to be genuine cutouts, so flattening
 * them onto white would have put a white box behind every product.
 *
 *   opaque      -> JPEG q82   (universal support)
 *   transparent -> WebP q82   (keeps alpha, far smaller than PNG)
 *
 * Originals are left on disk. They stop being referenced, so they cost
 * nothing at page load; deleting them is a separate decision.
 *
 * Run:  node scripts/optimise-images.js          (dry run, shows the plan)
 *       node scripts/optimise-images.js --write  (converts and rewrites refs)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WRITE = process.argv.includes('--write');
const MIN_BYTES = 300 * 1024;   // only touch images above this
const MAX_EDGE = 1400;          // long edge; article images display at 760
const QUALITY = 82;

function ff(args) {
  return execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'buffer' });
}

function walkPages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkPages(f, out);
    else if (e.name === 'index.html') out.push(f);
  }
  return out;
}

/* Composite over two very different backgrounds; identical output means the
   alpha channel carries nothing and the image is safe to flatten. */
function hasTransparency(file) {
  const tmp = path.join('scripts', '.alpha-probe');
  fs.mkdirSync(tmp, { recursive: true });
  const a = path.join(tmp, 'a.png'), b = path.join(tmp, 'b.png');
  try {
    for (const [bg, out] of [['white', a], ['magenta', b]]) {
      ff(['-f', 'lavfi', '-i', `color=${bg}:s=160x160`, '-i', file,
        '-filter_complex', '[1:v]scale=160:160[s];[0:v][s]overlay',
        '-frames:v', '1', out]);
    }
    return !fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch (e) {
    return true;   // unreadable → assume alpha, the safe direction
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// every image referenced by a live (premium) page
const refs = new Map();
for (const page of walkPages('.')) {
  const html = fs.readFileSync(page, 'utf8');
  if (!html.includes('premium-site.css')) continue;
  for (const m of html.matchAll(/src="([^"]+\.(?:png|jpe?g))"/gi)) {
    const rel = decodeURIComponent(m[1]).replace(/^(?:\.\.\/)+/, '').replace(/^\.\//, '');
    if (!refs.has(rel)) refs.set(rel, new Set());
    refs.get(rel).add(page);
  }
}

const jobs = [];
for (const [rel, pages] of refs) {
  let st; try { st = fs.statSync(rel); } catch (e) { continue; }
  if (st.size < MIN_BYTES) continue;
  jobs.push({ rel, bytes: st.size, pages: [...pages] });
}
jobs.sort((a, b) => b.bytes - a.bytes);

console.log(`${refs.size} images referenced; ${jobs.length} over ${MIN_BYTES / 1024}KB`);
console.log(WRITE ? 'converting…\n' : 'dry run — pass --write to apply\n');

let before = 0, after = 0, converted = 0;
const rename = new Map();

for (const job of jobs) {
  const alpha = hasTransparency(job.rel);
  const ext = alpha ? '.webp' : '.jpg';
  const out = job.rel.replace(/\.(png|jpe?g)$/i, ext);
  before += job.bytes;

  if (!WRITE) {
    console.log(`  ${String(Math.round(job.bytes / 1024)).padStart(5)}KB  ${alpha ? 'webp' : 'jpg '}  ${path.basename(job.rel).slice(0, 40)}`);
    continue;
  }

  try {
    const scale = `scale='min(${MAX_EDGE},iw)':'min(${MAX_EDGE},ih)':force_original_aspect_ratio=decrease`;
    if (alpha) ff(['-i', job.rel, '-vf', scale, '-c:v', 'libwebp', '-quality', String(QUALITY), out]);
    else ff(['-i', job.rel, '-vf', scale, '-q:v', '4', out]);

    const size = fs.statSync(out).size;
    if (size >= job.bytes) { fs.unlinkSync(out); after += job.bytes; continue; }  // no gain, keep original
    after += size;
    converted++;
    rename.set(job.rel, out);
    console.log(`  ${String(Math.round(job.bytes / 1024)).padStart(5)} → ${String(Math.round(size / 1024)).padStart(5)}KB  ${path.basename(out).slice(0, 40)}`);
  } catch (e) {
    after += job.bytes;
    console.log(`  FAILED  ${job.rel}`);
  }
}

if (WRITE && rename.size) {
  let touched = 0;
  for (const page of walkPages('.')) {
    let html = fs.readFileSync(page, 'utf8'), orig = html;
    for (const [from, to] of rename) {
      const fromName = path.basename(from), toName = path.basename(to);
      if (html.includes(fromName)) html = html.split(fromName).join(toName);
      if (html.includes(encodeURIComponent(fromName))) {
        html = html.split(encodeURIComponent(fromName)).join(encodeURIComponent(toName));
      }
    }
    if (html !== orig) { fs.writeFileSync(page, html); touched++; }
  }
  console.log(`\nconverted ${converted} images, rewrote refs in ${touched} pages`);
  console.log(`${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB  (saved ${((before - after) / 1024 / 1024).toFixed(1)}MB)`);
}
