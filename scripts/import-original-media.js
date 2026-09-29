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

/* --- functional-category cards ---------------------------------------------
 * These used to come from the client's own category series (portrait, moody,
 * one colour per category). They were replaced on 2026-09-29 by a single
 * ivory-studio card set that matches the site; see import-card-images.js.
 * Generating them here again would only recreate unreferenced files. */

