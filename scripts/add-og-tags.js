/* Adds Open Graph / Twitter card tags to the premium pages that lack them.
 *
 * Shared links to this site currently render bare on LINE and Facebook — no
 * title, no image, no blurb — which for a B2B supplier is most of the first
 * impression a forwarded link gets.
 *
 * Every value is derived from text already approved and present on the page:
 *
 *   og:title        <title>
 *   og:description  <meta name="description">
 *   og:url          <link rel="canonical">
 *   og:image        the page's own preloaded hero, else the site default
 *
 * Nothing here writes new marketing copy. That is deliberate: product claims
 * on this site are governed by 食品標示宣稱之認定基準, so a script is the last
 * place that should be inventing a sentence about what a supplement does.
 *
 *   node scripts/add-og-tags.js          report what would change
 *   node scripts/add-og-tags.js --write  apply it
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SITE = 'https://shengge820.github.io/baidayi-premium-redesign/';
const FALLBACK_IMAGE = SITE + 'assets/premium/hero-formulation-lab.jpg';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts', 'wp-content', 'wp-includes'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name === 'index.html') out.push(f);
  }
  return out;
}

const pick = (src, re) => { const m = src.match(re); return m ? m[1].trim() : ''; };

let changed = 0;
let skipped = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('data-premium-header')) continue;

  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const title = pick(src, /<title>([\s\S]*?)<\/title>/i);
  const desc = pick(src, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonical = pick(src, /<link\s+rel="canonical"\s+href="([^"]*)"/i);

  if (!title || !canonical) {
    console.log(`  跳過（缺 title 或 canonical）  ${rel}`);
    continue;
  }

  /* Prefer the page's own hero: it is what the reader sees first, so it is
     what the link preview should show. Inner pages carry it as the
     .inner-hero-media image; the homepage instead preloads it. */
  let image = pick(src, /<div class="inner-hero-media"[^>]*>\s*<img\s+src="([^"]*)"/i)
    || pick(src, /<link\s+rel="preload"\s+as="image"\s+href="([^"]*)"/i)
    /* The news posts have no hero element; their lead is either a Vimeo embed
       or the first image in the body. A video-led post has no image at all and
       correctly falls through to the site default. */
    || pick(src, /<main\b[\s\S]*?<img\s+[^>]*src="([^"]+\.(?:jpe?g|png|webp))"/i);
  if (image) {
    image = SITE + path.posix.normalize(
      path.posix.join(path.posix.dirname(rel), image.replace(/^\.\//, ''))
    ).replace(/^\.\//, '');
  } else {
    image = FALLBACK_IMAGE;
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  /* Additive: the news posts already carry og:type/title/description from the
     article generator, so only the gaps get filled. Writing the full block
     unconditionally would give those pages two og:type tags, and og:type is
     "article" there but "website" everywhere else — a duplicate would make
     which one wins depend on the scraper. */
  const want = [
    ['og:type', 'property', 'website'],
    ['og:locale', 'property', 'zh_TW'],
    ['og:site_name', 'property', '百達醫 BKE'],
    ['og:url', 'property', canonical],
    ['og:title', 'property', title],
    ['og:description', 'property', desc],
    ['og:image', 'property', image],
    ['twitter:card', 'name', 'summary_large_image'],
  ];
  const missing = want.filter(([k, attr, v]) =>
    v && !new RegExp(`<meta\\s+${attr}="${k}"`, 'i').test(src));
  if (!missing.length) { skipped++; continue; }

  const tags = missing
    .map(([k, attr, v]) => `  <meta ${attr}="${k}" content="${esc(v)}">`)
    .join('\n');

  /* Insert after the canonical link so the head keeps a readable order:
     identity, then sharing, then assets. */
  const anchor = src.match(/^.*<link\s+rel="canonical"[^>]*>.*$/m)[0];
  const out = src.replace(anchor, anchor + '\n' + tags);

  if (WRITE) fs.writeFileSync(file, out);
  changed++;
  if (changed <= 6) console.log(`  ${rel}\n      補 ${missing.length} 個標籤，og:image → ${image.replace(SITE, '')}`);
}

console.log(`\n${changed} 頁${WRITE ? '已加入' : '待加入'} og tags，${skipped} 頁原本就有。`);
if (!WRITE && changed) console.log('加 --write 實際寫入。');
