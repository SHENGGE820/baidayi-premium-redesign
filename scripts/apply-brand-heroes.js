/* Points each page's hero, and its og:image, at the client's own imagery.
 *
 * The map lives in scripts/brand-heroes.json. Only the image path changes;
 * the markup around it is left alone. Idempotent — a second run reports
 * nothing to change. The 劑型與包材 styles pages are not in the map: their
 * hero comes from content/catalogue, through scripts/build-site.js.
 *
 *   node scripts/apply-brand-heroes.js          report
 *   node scripts/apply-brand-heroes.js --write  apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SITE = 'https://shengge820.github.io/baidayi-premium-redesign/';
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand-heroes.json'), 'utf8'));

let changed = 0;
for (const [page, image] of Object.entries(MAP)) {
  if (page.startsWith('_')) continue;
  const file = path.join(ROOT, page, 'index.html');
  if (!fs.existsSync(file)) { console.log('  找不到  ' + page); continue; }
  if (!fs.existsSync(path.join(ROOT, 'assets/brand', image))) { console.log('  圖不存在  ' + image); process.exit(1); }
  const src = fs.readFileSync(file, 'utf8');
  const up = '../'.repeat(page.split('/').length);

  let out = src.replace(
    /(<div class="inner-hero-media"[^>]*>\s*<img\s+src=")[^"]+(")/,
    `$1${up}assets/brand/${image}$2`);
  out = out.replace(
    /(<meta property="og:image" content=")[^"]+(")/,
    `$1${SITE}assets/brand/${image}$2`);

  /* contact and 最新消息 open on a text masthead with no hero image; for
     those only the share-preview image changes. */
  if (out === src) continue;
  if (WRITE) fs.writeFileSync(file, out);
  changed++;
  console.log(`  ${page.padEnd(28)} → ${image}`);
}
console.log(`\n${changed} 頁${WRITE ? '已更新' : '待更新'}。`);
