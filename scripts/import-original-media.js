/* Converts the client's own photography and footage into web-ready files.
 *
 * The first pass of the redesign carried three generated "premium lab" images
 * as the hero of 45 pages. For a contract manufacturer that is exactly the
 * wrong thing to put in the most prominent slot: what a brand owner is looking
 * for is proof — a real factory, real people, real products — and generic
 * imagery any competitor could use says the opposite. The original site's
 * homepage hero was in fact the 12-second factory shoot; the redesign had
 * replaced it with a still.
 *
 * Source is the full media-library download, kept OUTSIDE the repo at
 * ../baidayi-original-assets (219MB of originals — too heavy to deploy). This
 * script picks the files the site uses and writes compressed versions to
 * assets/brand/. Re-runnable; it overwrites its own outputs.
 *
 *   node scripts/import-original-media.js
 *
 * Needs ffmpeg on PATH.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, '..', 'baidayi-original-assets', 'uploads');
const OUT = path.join(ROOT, 'assets', 'brand');
const FACTORY = path.join(SRC, '2025/09/BKE官網廠拍.mp4');

if (!fs.existsSync(SRC)) {
  console.error('Original media not found at ' + SRC);
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const kb = f => Math.round(fs.statSync(f).size / 1024) + 'KB';

/* --- the factory loop -----------------------------------------------------
 * The shoot fades to black over its last ~1.5s. Looped as-is, the homepage
 * would blink black every twelve seconds, so it is cut at 10.4s, before the
 * fade starts. No audio track: a muted autoplay loop should not carry one,
 * and dropping it saves bytes. faststart puts the index at the front so
 * playback can begin before the file finishes downloading. */
const loop = path.join(OUT, 'factory-loop.mp4');
ff(['-i', FACTORY, '-t', '10.4', '-an', '-vf', 'scale=1280:-2,fps=30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', loop]);
console.log('  factory-loop.mp4  ' + kb(loop));

/* --- stills pulled from the same shoot --------------------------------------
 * Timestamps chosen by eye from a 2fps contact sheet: each is a moment where
 * the frame is sharp and the subject reads at hero size. */
const FRAMES = {
  'factory-cleanroom': 0.5,   // corridor, staff in cleanroom suits
  'factory-powder': 2.0,      // powder hopper
  'factory-coating': 3.2,     // two staff at the coating pan
  'factory-filling': 4.6,     // capsule filling disc
  'factory-capsules': 5.8,    // finished capsules
  'factory-packaging': 8.2,   // shrink-wrap line
};
for (const [name, t] of Object.entries(FRAMES)) {
  const out = path.join(OUT, name + '.jpg');
  ff(['-ss', String(t), '-i', FACTORY, '-frames:v', '1', '-vf', 'scale=1600:-2', '-q:v', '4', out]);
  console.log(`  ${name}.jpg  ${kb(out)}`);
}

/* --- photos used as they are ---------------------------------------------- */
const PHOTOS = {
  'banner-gelatin-capsules': '2026/02/BKE-banner-動物膠囊.jpg',
  'banner-plant-capsules': '2026/02/BKE-banner-植物膠囊.jpg',
  'banner-tablets': '2026/02/BKE-banner-錠劑.jpg',
  'banner-glass-bottles': '2026/04/玻璃瓶.jpg',
  'team-booth': '2026/08/699633.jpg',        // the team at the 2026 Asia beauty & biotech expo
  'booth-visitors': '2026/08/699632.jpg',    // visitors at the same booth
  'booth-products': '2026/08/699649.jpg',    // finished packs made for clients, shown at the booth
};
for (const [name, rel] of Object.entries(PHOTOS)) {
  const out = path.join(OUT, name + '.jpg');
  ff(['-i', path.join(SRC, rel), '-vf', "scale='min(1600,iw)':-2", '-q:v', '4', out]);
  console.log(`  ${name}.jpg  ${kb(out)}`);
}

/* --- one card image per functional category -------------------------------
 * The client had an image made for each category, named after it, but never
 * published them — they sit in the media library unused. Portrait, with the
 * subject in the top half fading to a flat tone, and transparent rounded
 * corners: they are designed as cards, so they are used as cards (WebP keeps
 * the alpha). Where a name was uploaded twice, the later upload is taken. */
const CARDS = {
  action: '行動關鍵_圓角.png',
  balance: '調節體質_圓角.png',
  beauty: '養顏美容_圓角.png',
  'body-care': '體質調理_圓角.png',
  'body-functions': '調節生理機能_圓角.png',
  child: '兒童保健_圓角-1.png',
  digestive: '消化保健_圓角-1.png',
  elderly: '銀髮保健_圓角.png',
  energetic: '精神_圓角.png',
  'generation-3c': '3C-世代_圓角.png',
  gut: '維持腸道機能_圓角.png',
  meal: '纖體餐包_圓角.png',
  men: '男性調理_圓角-1.png',
  metabolism: '促進新陳代謝_圓角.png',
  protein: '蛋白補給_圓角.png',
  'secret-garden': '秘密花園_圓角.png',
  'skin-care': '膚質養護_圓角-1.png',
  sleep: '幫助入睡_圓角.png',
  slender: '窈窕清盈_圓角.png',
  women: '女性調理_圓角-1.png',
};
for (const [slug, file] of Object.entries(CARDS)) {
  const out = path.join(OUT, 'function-' + slug + '.webp');
  ff(['-i', path.join(SRC, '2026/08', file), '-vf', 'scale=720:-2',
    '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out]);
}
const cardBytes = Object.keys(CARDS).reduce((s, k) => s + fs.statSync(path.join(OUT, 'function-' + k + '.webp')).size, 0);
console.log(`  function-*.webp  ×${Object.keys(CARDS).length}  ${Math.round(cardBytes / 1024)}KB total`);

module.exports = { CARDS };
