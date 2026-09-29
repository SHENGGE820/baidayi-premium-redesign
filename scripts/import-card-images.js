/* Converts the card image set for dosage forms and functional directions.
 *
 * The set (premium-redesign-v1: 8 dosage, 20 function, 1536x1024 PNG, 3:2)
 * was made for this site: one ivory-limestone studio look throughout, where
 * the cards had carried two unrelated styles — the old site's stock photos
 * with a cream fade, and a colourful, moody category series. The images are
 * illustrative; they are not presented as the client's products.
 *
 * Each image is written twice to assets/brand/ — 1200x800 and 640x427 JPEG —
 * so pages can offer both through srcset and a phone loads the small one.
 *
 *   node scripts/import-card-images.js [source-dir]
 *
 * The source defaults to where the set was produced; pass another directory
 * to use a copy. Needs ffmpeg on PATH.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'brand');
const SRC = process.argv[2] ||
  'C:/Users/USER/.codex/.chatgpt-projects/g-p-6a72e24439588191a50aa0bc9bdf6dac/output/premium-redesign-v1';

const DOSAGE = ['biscuit', 'shake-pouch', 'gummy', 'capsules', 'tablets-granules', 'powder', 'meal-replacement', 'jelly-tea'];
const FUNCTIONS = ['action', 'balance', 'beauty', 'body-care', 'body-functions', 'child', 'digestive', 'elderly',
  'energetic', 'generation-3c', 'gut', 'meal', 'men', 'metabolism', 'protein', 'secret-garden', 'skin-care',
  'sleep', 'slender', 'women'];

if (!fs.existsSync(SRC)) { console.error('Card image set not found at ' + SRC); process.exit(2); }

const names = [...DOSAGE.map(n => 'dosage-' + n), ...FUNCTIONS.map(n => 'function-' + n)];
let bytes = 0;
for (const name of names) {
  const src = path.join(SRC, name + '.png');
  if (!fs.existsSync(src)) { console.error('missing: ' + src); process.exit(1); }
  for (const [w, suffix] of [[1200, ''], [640, '-640']]) {
    const out = path.join(OUT, name + suffix + '.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${w}:-2:flags=lanczos`, '-q:v', w > 1000 ? '4' : '5', out]);
    bytes += fs.statSync(out).size;
  }
}
console.log(`${names.length} images × 2 sizes → assets/brand/  (${(bytes / 1048576).toFixed(1)}MB total)`);
module.exports = { DOSAGE, FUNCTIONS };
