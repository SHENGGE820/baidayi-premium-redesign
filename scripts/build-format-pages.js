/* Rebuilds the 劑型與包材 product pages on the premium layer.
 *
 * These pages were still the original Enfold output: the retrofit in
 * premium-legacy.css had patched their colours and fonts, but the underlying
 * layout was untouched, which is where the dead space and the centred/
 * left-aligned clash came from.
 *
 * Content is NOT invented here. Titles, section headings, 適用劑型 lines and
 * every image are read straight out of the old page, so the specs stay the
 * client's. Only the shell around them is new.
 *
 * Re-run after the old pages change:  node scripts/build-format-pages.js
 */
const fs = require('fs');
const path = require('path');

const V = '20260901-14';
const SRC = '全面性服務/一站式服務';
const HERO = '../../../assets/premium/service-packaging-studio.jpg';

const pages = [
  'pe塑膠瓶', '玻璃瓶', '口栓袋', '夾鏈鋁袋', '折角鋁袋', '排裝',
  '果凍', '異型袋', '粉末鋁包', '錠劑', '動物膠囊', '植物膠囊',
];

/* The 動物膠囊 page's own heading reads 植物膠囊 — a copy-paste slip in the
 * source, since its English heading is GELATIN CAPSULES and it sits opposite
 * the real 植物膠囊 page. Corrected here rather than carried across. */
const titleFix = { '動物膠囊': '動物膠囊' };

const decode = s => s
  .replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* The 玻璃瓶 page's English section headings are wrong at source: BOTTLE CAP
 * labels 瓶身, and TRIANGLE — left over from the tablet page — labels 瓶蓋.
 * pe塑膠瓶, the equivalent page, has BOTTLE BODY / BOTTLE CAP correctly. */
const headingFix = { '瓶身': 'BOTTLE BODY', '瓶蓋': 'BOTTLE CAP' };

/* Filenames carry the spec on the tablet and capsule pages:
 * 圓型-11.5mm.png, 大長條一字-20mm.png. Trailing -1 / -2 / _1 are WordPress
 * duplicate suffixes, not part of it.
 *
 * The bottle and pouch shots are just numbered (1.png, 2.png), which makes a
 * caption of "1" — noise, not information. Those get no caption at all. */
function caption(src) {
  const c = decodeURIComponent(src.split('/').pop())
    .replace(/\.(png|jpe?g)$/i, '')
    .replace(/[-_]\d+$/, '')
    .replace(/-$/, '')
    .replace(/-/g, ' ')
    .trim();
  return /^[\d\s.]*$/.test(c) ? '' : c;
}

function extract(dir) {
  const file = path.join(SRC, dir, 'index.html');
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/<div id=["']main["'][\s\S]*?<footer/i);
  if (!m) return null;
  const body = m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tokens = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>|<img[^>]+src="([^"]+\.(?:png|jpe?g))"/gi;
  let x;
  while ((x = re.exec(body))) {
    if (x[2] !== undefined) {
      const t = decode(x[2].replace(/<[^>]*>/g, ''));
      if (t) tokens.push({ t: 'h', v: t });
    } else if (x[3] && !/logo|favicon/i.test(x[3])) {
      tokens.push({ t: 'img', v: x[3].replace(/^(\.\.\/)+/, '../../../') });
    }
  }

  /* Only the English title is a heading. The Chinese title and the 適用劑型
   * line share one paragraph in the hero's subheading block, split by a <br>:
   *
   *   <h1 class="av-special-heading-tag">TABLETS</h1>
   *   <div class="av-subheading av-subheading_below">
   *     <p>錠劑<br />養顏美容、青春美麗、…</p>
   *
   * Reading heading order alone put the first SECTION heading (ROUND, SIZE 0,
   * BOTTLE BODY) in the title, which is how every page ended up misnamed. */
  const en = (body.match(/<h1[^>]*class=["'][^"']*av-special-heading-tag[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) || [, dir])[1]
    .replace(/<[^>]*>/g, '').trim() || dir;

  const sub = body.match(/av-subheading_below['"][^>]*>\s*<p>([\s\S]*?)<\/p>/i);
  let zh = dir, lead = '';
  if (sub) {
    const parts = sub[1].split(/<br\s*\/?>/i).map(s => decode(s.replace(/<[^>]*>/g, '')));
    zh = parts[0] || dir;
    lead = parts.slice(1).filter(Boolean).join(' ');
  }
  if (titleFix[dir]) zh = titleFix[dir];

  // Everything from the first h2 onward is section headings + their images.
  const groups = [];
  let cur = null, pendingEn = null;
  for (const k of tokens) {
    if (k.t === 'h') {
      if (k.v === en) continue;                       // the hero title itself
      if (/^[A-Z0-9 &/()-]+$/.test(k.v)) pendingEn = k.v;
      else if (/官網資料|詳情請洽/.test(k.v)) continue; // footnote, not a section
      else { cur = { en: headingFix[k.v] || pendingEn || '', zh: k.v, imgs: [] }; groups.push(cur); pendingEn = null; }
    } else if (k.t === 'img') {
      if (!cur) { cur = { en: pendingEn || '', zh: '', imgs: [] }; groups.push(cur); pendingEn = null; }
      cur.imgs.push(k.v);
    }
  }
  return { dir, en, zh, lead, groups: groups.filter(g => g.imgs.length) };
}

function group(g, pageZh) {
  const head = (g.en || g.zh)
    ? `<div class="spec-group-head reveal">${g.en ? `<span>${esc(g.en)}</span>` : ''}${g.zh ? `<h2>${esc(g.zh)}</h2>` : ''}</div>`
    : '';
  const items = g.imgs.map(src => {
    const cap = caption(src);
    // Numbered files give no caption, but alt text still needs to say something.
    const alt = cap || `${pageZh}${g.zh ? '－' + g.zh : ''}樣式`;
    return `<figure class="spec-item reveal"><div class="spec-media">` +
      `<img src="${src}" alt="${esc(alt)}" loading="lazy"></div>` +
      (cap ? `<figcaption>${esc(cap)}</figcaption>` : '') +
      `</figure>`;
  }).join('\n          ');
  return `<div class="spec-group">${head}\n        <div class="spec-grid">\n          ${items}\n        </div>\n      </div>`;
}

function render(d) {
  const total = d.groups.reduce((s, g) => s + g.imgs.length, 0);
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(d.zh)}｜劑型與包材｜百達醫 BKE</title>
  <meta name="description" content="${esc(d.zh)}的樣式與尺寸選項${d.lead ? '，' + esc(d.lead) : ''}。">
  <link rel="canonical" href="https://shengge820.github.io/baidayi-premium-redesign/全面性服務/一站式服務/${d.dir}/">
  <meta name="theme-color" content="#171713">
  <link rel="icon" href="../../../wp-content/uploads/2025/09/BKE-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../../premium-site.css?v=${V}"><link rel="stylesheet" href="../../../premium-inner.css?v=${V}">
  <link rel="stylesheet" href="../../../premium-motion.css?v=${V}">
</head>
<body class="premium-site premium-inner" data-root="../../../" data-active="service">
  <a class="skip-link" href="#main-content">跳到主要內容</a><div data-premium-header></div>
  <main id="main-content">
    <section class="inner-hero">
      <div class="inner-hero-media" aria-hidden="true"><img src="${HERO}" alt=""></div><div class="inner-hero-shade" aria-hidden="true"></div>
      <div class="container inner-hero-content"><p class="eyebrow reveal">${esc(d.en)}</p><h1 class="reveal">${esc(d.zh)}</h1>${d.lead ? `<p class="inner-hero-lead reveal">${esc(d.lead)}</p>` : ''}</div>
      <span class="inner-hero-index">${total} 種樣式</span>
    </section>
    <section class="page-section page-section-ivory"><div class="container">
      <div class="page-heading"><div><p class="eyebrow eyebrow-dark reveal">STYLES &amp; SIZES</p><h2 class="page-title reveal">可選的樣式<br>與尺寸。</h2></div><p class="reveal">以下為目前可提供的規格。實際可用尺寸、最小起訂量與印刷方式，會依產品內容物與生產排程確認。</p></div>
      ${d.groups.map(g => group(g, d.zh)).join('\n      ')}
      <p class="spec-note reveal">官網資料僅供參考，詳情請洽百達醫顧問。</p>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">START A PROJECT</p><h2 class="reveal">選好包材，<br>我們接著談規格。</h2></div><div class="project-cta-copy reveal"><p>提供產品內容物、預計容量與通路方向，我們會協助確認合適的包材與可行的生產條件。</p><a class="button button-dark" href="../../../contact/index.html">與包材顧問討論 <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="../../../premium-shell.js?v=${V}"></script><script src="../../../premium-site.js?v=${V}"></script>
  <script src="../../../premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

let n = 0, imgs = 0;
for (const dir of pages) {
  const d = extract(dir);
  if (!d) { console.log('SKIP (no #main): ' + dir); continue; }
  const t = d.groups.reduce((s, g) => s + g.imgs.length, 0);
  fs.writeFileSync(path.join(SRC, dir, 'index.html'), render(d));
  console.log(`  ${dir.padEnd(16)} ${d.en.padEnd(22)} ${String(t).padStart(3)} 圖  ${d.groups.length} 組`);
  n++; imgs += t;
}
console.log(`\nrebuilt ${n} pages, ${imgs} images`);
