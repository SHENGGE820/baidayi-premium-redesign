/* Gives every article video a poster frame taken from the video itself.
 *
 * The posts' videos are preload="none" — deliberately, so a reader who never
 * presses play never downloads a few MB of video. But with no poster either,
 * each one sat in the article as a black rectangle with a play bar, telling
 * the reader nothing about what it was.
 *
 * A frame is pulled from one second in (the opening frames are often a fade
 * from black), saved next to the video as <name>-poster.jpg, and added as the
 * <video>'s poster. preload stays "none".
 *
 *   node scripts/add-video-posters.js           report
 *   node scripts/add-video-posters.js --write   apply
 *
 * Idempotent: videos that already have a poster are left alone.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts'].includes(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (e.name === 'index.html') o.push(f);
  }
  return o;
}

let videos = 0, frames = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!/<video\b/i.test(html)) continue;
  const dir = path.dirname(file);
  let changed = false;

  html = html.replace(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi, (whole, attrs, inner) => {
    if (/\sposter=/.test(attrs) || /data-hero-video/.test(attrs)) return whole;
    // WordPress appends a cache-buster (…mp4?_=1); the file is the part before it.
    const src = (inner.match(/<source[^>]*\ssrc="([^"?]+\.mp4)(?:\?[^"]*)?"/i) || attrs.match(/\ssrc="([^"?]+\.mp4)(?:\?[^"]*)?"/i) || [])[1];
    if (!src) return whole;
    const video = path.resolve(dir, decodeURIComponent(src));
    if (!fs.existsSync(video)) { console.log('  找不到影片  ' + src); return whole; }

    const posterSrc = src.replace(/\.mp4$/i, '-poster.jpg');
    const poster = path.resolve(dir, decodeURIComponent(posterSrc));
    videos++;
    if (WRITE && !fs.existsSync(poster)) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', video, '-frames:v', '1',
        '-vf', "scale='min(1280,iw)':-2", '-q:v', '4', poster]);
      frames++;
    }
    changed = true;
    return `<video${attrs} poster="${posterSrc}">${inner}</video>`;
  });

  if (changed) {
    console.log('  ' + path.relative(ROOT, file).split(path.sep).join('/'));
    if (WRITE) fs.writeFileSync(file, html);
  }
}
console.log(`\n${videos} 支影片${WRITE ? `已加封面（新產生 ${frames} 張）` : '待加封面'}。`);
