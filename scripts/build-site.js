/* Builds the pages whose content lives in content/, which is what the CMS at
 * /admin edits.
 *
 *   content/articles/<slug>.md   →  <slug>/index.html (one page per post)
 *                                    最新消息/index.html (the card grid)
 *                                    index.html (the homepage's three posts)
 *   content/catalogue/<name>.md  →  全面性服務/一站式服務/<name>/index.html
 *                                    (one styles page per dosage form or
 *                                    package type)
 *   content/pages/catalogue.md   →  全面性服務/劑型與包材/index.html (the
 *                                    overview's card grids)
 *                                    admin/config.yml (the list of pages and
 *                                    enquiry presets a card can link to)
 *
 * Front matter carries the post's fields; the body is Markdown for posts
 * written in the CMS. The thirteen posts migrated from WordPress keep their
 * cleaned HTML in `body_html` instead — their bodies use layout wrappers
 * (desktop/mobile video pairs, sectioned layouts) that a Markdown round trip
 * through a rich-text editor would flatten.
 *
 * Paths in content are site-root-relative ("/wp-content/…", "/assets/…") and
 * are rewritten per page, because the site is served from a sub-path on
 * GitHub Pages.
 *
 * Generated pages carry <meta name="generator" content="bke-build …">; a page
 * with that marker whose content file is gone is deleted, so removing a post
 * in the CMS removes it from the site.
 *
 *   node scripts/build-site.js
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const V = '20260929-11';
const SITE = 'https://shengge820.github.io/baidayi-premium-redesign/';
const MARK = '<meta name="generator" content="bke-build article">';
const CATEGORIES = ['市場趨勢', '配方研發', '製造觀點', '供應觀察', '品牌動態'];

const esc = s => String(s == null ? '' : s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* "/wp-content/x" → "../wp-content/x" for a page one level down. Absolute
   URLs and anything else pass through untouched. */
function rel(p, prefix) {
  if (typeof p !== 'string' || !p) return '';
  if (p.startsWith('/') && !p.startsWith('//')) return prefix + p.slice(1);
  return p;
}
function relHtml(html, prefix) {
  return html.replace(/(\s(?:src|href|poster))="\/(?!\/)/g, `$1="${prefix}`);
}

/* ------------------------------------------------------------------ load */
function loadArticles() {
  const dir = path.join(ROOT, 'content', 'articles');
  const posts = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const file = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const d = file.data;
    const slug = f.replace(/\.md$/, '');
    const problems = [];
    if (!d.title) problems.push('title');
    if (!d.date) problems.push('date');
    if (!CATEGORIES.includes(d.category)) problems.push('category');
    if (!d.cover) problems.push('cover');
    if (problems.length) throw new Error(`content/articles/${f}: missing or invalid ${problems.join(', ')}`);
    if (/[\\/?#%]/.test(slug)) throw new Error(`content/articles/${f}: file name cannot be used as a URL`);
    const when = String(d.date instanceof Date ? d.date.toISOString() : d.date);
    return {
      slug,
      title: String(d.title).trim(),
      datetime: when.slice(0, 16),
      date: when.slice(0, 10),
      category: d.category,
      group: d.category === '品牌動態' ? 'event' : 'trend',
      summary: String(d.summary || '').trim(),
      cover: d.cover, coverAlt: d.cover_alt || d.title,
      hero: d.hero || '', heroAlt: d.hero_alt || d.title,
      videoEmbed: d.video_embed || '',
      videoLandscape: d.video_landscape || '', videoPortrait: d.video_portrait || '',
      home: d.home === true,
      bodyHtml: d.body_html || '',
      markdown: file.content.trim()
    };
  });
  posts.sort((a, b) => b.datetime.localeCompare(a.datetime) || a.slug.localeCompare(b.slug));
  return posts;
}

/* -------------------------------------------------------------- article */
function videoBlock(a, prefix) {
  const one = (src, cls) => `<div class="bke-video-wrap${cls ? ' ' + cls : ''}"><video controls preload="none" playsinline><source type="video/mp4" src="${esc(rel(src, prefix))}"></video></div>`;
  if (a.videoLandscape && a.videoPortrait) return one(a.videoLandscape, 'desktop-video') + '\n' + one(a.videoPortrait, 'mobile-video');
  if (a.videoLandscape || a.videoPortrait) return one(a.videoLandscape || a.videoPortrait, '');
  return '';
}

function articleMain(a) {
  const prefix = '../';
  const body = a.bodyHtml ? relHtml(a.bodyHtml, prefix) : relHtml(marked.parse(a.markdown), prefix);
  if (a.videoEmbed && !body.trim()) {
    return `      <div class="article-video-lead reveal">
        <iframe title="${esc(a.title)}" src="${esc(a.videoEmbed)}" width="1500" height="844" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
  }
  const hero = a.hero ? `      <div class="article-hero reveal"><img src="${esc(rel(a.hero, prefix))}" alt="${esc(a.heroAlt)}"></div>\n` : '';
  const video = videoBlock(a, prefix);
  return `${hero}      <div class="article-body">\n${video ? video + '\n' : ''}${body.trim()}\n      </div>`;
}

function articlePage(a) {
  const ogImage = SITE + String(a.hero || a.cover || '/assets/brand/factory-cleanroom.jpg').replace(/^\//, '');
  const url = SITE + a.slug + '/';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${MARK}
  <title>${esc(a.title)}｜最新消息｜百達醫 BKE</title>
  <meta name="description" content="${esc(a.summary || a.title)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="百達醫 BKE">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(a.title)}">
  <meta property="og:description" content="${esc(a.summary || a.title)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#171713">
  <link rel="icon" href="../wp-content/uploads/2025/09/BKE-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../premium-site.css?v=${V}"><link rel="stylesheet" href="../premium-inner.css?v=${V}">
  <script src="../premium-transition-init.js?v=${V}"></script><link rel="stylesheet" href="../premium-motion.css?v=${V}">
</head>
<body class="premium-site premium-inner article-page" data-root="../" data-active="news">
  <a class="skip-link" href="#main-content">跳到主要內容</a><div data-premium-header></div>
  <main id="main-content">
    <header class="news-masthead">
      <div class="container">
        <p class="article-meta reveal"><span>${esc(a.category)}</span><i aria-hidden="true"></i><time datetime="${esc(a.date)}">${esc(a.date)}</time></p>
        <h1 class="reveal">${esc(a.title)}</h1>
        ${a.summary ? `<p class="reveal">${esc(a.summary)}</p>` : ''}
      </div>
    </header>
    <section class="page-section page-section-ivory"><div class="container">
${articleMain(a)}
      <a class="article-back reveal" href="../最新消息/index.html"><span aria-hidden="true">←</span> 回到最新消息</a>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">START A PROJECT</p><h2 class="reveal">看到市場機會，<br>下一步是做對產品。</h2></div><div class="project-cta-copy reveal"><p>把您的產品構想與目標客群告訴我們，專案顧問會協助整理可行的開發路徑。</p><a class="button button-dark" href="../contact/index.html">代工諮詢 <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="../premium-shell.js?v=${V}"></script><script src="../premium-site.js?v=${V}"></script>
  <script src="../premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------- listing / home */
const dots = d => d.replace(/-/g, '.');

function listingCard(a) {
  return `<a class="article-card reveal" href="../${a.slug}/index.html" data-news-category="${a.group}"><div class="article-card-image"><img src="${esc(rel(a.cover, '../'))}" alt="${esc(a.coverAlt)}" loading="lazy"></div><div class="article-card-copy"><span>${esc(a.category)}</span><h2>${esc(a.title)}</h2>${a.summary ? `<p>${esc(a.summary)}</p>` : ''}<time datetime="${a.date}">${dots(a.date)}</time></div></a>`;
}

function homeCard(a, featured) {
  const ind = '          ';
  return `<a class="insight-card${featured ? ' insight-card-featured' : ''} reveal" href="./${a.slug}/index.html">
${ind}  <div class="insight-image"><img src="${esc(rel(a.cover, './'))}" alt="${esc(a.title)}" loading="lazy"></div>
${ind}  <div class="insight-copy"><span>${esc(a.category)}</span><h3>${esc(a.title)}</h3>${featured && a.summary ? `<p>${esc(a.summary)}</p>` : ''}<time datetime="${a.date}">${dots(a.date)}</time></div>
${ind}</a>`;
}

/* Posts flagged for the homepage come first; if fewer than three are, the
   newest non-event posts fill the rest. */
function homePicks(posts) {
  const picks = posts.filter(p => p.home).slice(0, 3);
  for (const p of posts) {
    if (picks.length >= 3) break;
    if (!picks.includes(p) && p.group !== 'event') picks.push(p);
  }
  return picks;
}

/* Replace what sits between <!-- cms:NAME --> and <!-- /cms:NAME --> (or
   "# cms:NAME" / "# /cms:NAME" in YAML). `html` ends with the indentation
   the closing marker sits at. */
function fill(file, name, html, yaml = false) {
  const full = path.join(ROOT, file);
  const src = fs.readFileSync(full, 'utf8');
  const open = yaml ? `# cms:${name}` : `<!-- cms:${name} -->`;
  const close = yaml ? `# /cms:${name}` : `<!-- /cms:${name} -->`;
  const s = src.indexOf(open), e = src.indexOf(close);
  if (s < 0 || e < s) throw new Error(`${file}: markers for "${name}" not found`);
  const out = src.slice(0, s + open.length) + '\n' + html + src.slice(e);
  if (out !== src) fs.writeFileSync(full, out);
  return out !== src;
}

/* Width and height from the file header: PNG, JPEG, WebP. */
function imageSize(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return null; }
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const mk = b[i + 1];
      if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3FFF, b.readUInt16LE(28) & 0x3FFF];
    if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3FFF), 1 + ((n >> 14) & 0x3FFF)]; }
  }
  return null;
}

/* ------------------------------------------------------------ catalogue */
const CAT_DIR = '全面性服務/一站式服務';
const CAT_MARK = '<meta name="generator" content="bke-build catalogue">';
const OVERVIEW = '全面性服務/劑型與包材/index.html';
/* The overview's card sections; photo grids carry responsive images. */
const SECTIONS = { dosage: true, package: false, finished: false, products: true };

function loadCatalogue() {
  const dir = path.join(ROOT, 'content', 'catalogue');
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const d = matter(fs.readFileSync(path.join(dir, f), 'utf8')).data;
    const slug = f.replace(/\.md$/, '');
    if (!d.title) throw new Error(`content/catalogue/${f}: missing title`);
    if (/[\\/?#%]/.test(slug)) throw new Error(`content/catalogue/${f}: file name cannot be used as a URL`);
    const groups = (d.groups || []).map(g => ({
      en: String(g.en || '').trim(),
      name: String(g.name || '').trim(),
      items: (g.items || []).filter(i => i && i.image).map(i => ({ image: i.image, caption: String(i.caption || '').trim() }))
    })).filter(g => g.items.length);
    const cta = d.cta || {};
    return {
      slug, title: String(d.title).trim(), en: String(d.title_en || '').trim(), lead: String(d.lead || '').trim(),
      hero: d.hero || '/assets/brand/factory-packaging.jpg', groups,
      // the closing call to action; packaging wording unless the page has its own
      cta: {
        title: String(cta.title || '選好包材，\n我們接著談規格。').trim(),
        text: String(cta.text || '提供產品內容物、預計容量與通路方向，我們會協助確認合適的包材與可行的生產條件。').trim(),
        button: String(cta.button || '與包材顧問討論').trim(),
        link: cta.link || ''
      }
    };
  });
}

/* A link chosen in the CMS — "page:<name>" for a styles page or a hand-built
   page beside them, "contact:<preset>" for the enquiry form — as a path
   relative to the page in `fromDir`. */
function resolveLink(link, fromDir, targets, where) {
  const kind = String(link).split(':')[0], value = String(link).slice(kind.length + 1);
  const to = dest => path.posix.relative(fromDir, dest) + '/index.html';
  if (kind === 'page' && targets.pages.has(value)) return { kind, href: to(`${CAT_DIR}/${value}`) };
  if (kind === 'contact' && targets.contact.has(value)) return { kind, href: `${to('contact')}?format=${value}` };
  throw new Error(`${where} links to "${link}", which does not exist`);
}

function specGroup(g, page, prefix) {
  const head = (g.en || g.name)
    ? `<div class="spec-group-head reveal">${g.en ? `<span>${esc(g.en)}</span>` : ''}${g.name ? `<h2>${esc(g.name)}</h2>` : ''}</div>`
    : '';
  const items = g.items.map(it => {
    // numbered shots have no caption, but the alt text still needs to say something
    const alt = it.caption || `${page.title}${g.name ? '－' + g.name : ''}樣式`;
    return `<figure class="spec-item reveal"><div class="spec-media">` +
      `<img src="${esc(rel(it.image, prefix))}" alt="${esc(alt)}" loading="lazy"></div>` +
      (it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : '') +
      `</figure>`;
  }).join('\n          ');
  return `<div class="spec-group">${head}\n        <div class="spec-grid">\n          ${items}\n        </div>\n      </div>`;
}

function cataloguePage(c, targets) {
  const p = '../../../';
  const total = c.groups.reduce((s, g) => s + g.items.length, 0);
  const ctaHref = c.cta.link
    ? resolveLink(c.cta.link, `${CAT_DIR}/${c.slug}`, targets, `content/catalogue/${c.slug}.md: the call to action`).href
    : `${p}contact/index.html`;
  const title = `${c.title}｜劑型與包材｜百達醫 BKE`;
  const desc = `${c.title}的樣式與尺寸選項${c.lead ? '，' + c.lead : ''}。`;
  const url = `${SITE}${CAT_DIR}/${c.slug}/`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${CAT_MARK}
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="百達醫 BKE">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(SITE + c.hero.replace(/^\//, ''))}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#171713">
  <link rel="icon" href="${p}wp-content/uploads/2025/09/BKE-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${p}premium-site.css?v=${V}"><link rel="stylesheet" href="${p}premium-inner.css?v=${V}">
  <script src="${p}premium-transition-init.js?v=${V}"></script><link rel="stylesheet" href="${p}premium-motion.css?v=${V}">
</head>
<body class="premium-site premium-inner" data-root="${p}" data-active="capability">
  <a class="skip-link" href="#main-content">跳到主要內容</a><div data-premium-header></div>
  <main id="main-content">
    <section class="inner-hero">
      <div class="inner-hero-media" aria-hidden="true"><img src="${esc(rel(c.hero, p))}" alt=""></div><div class="inner-hero-shade" aria-hidden="true"></div>
      <div class="container inner-hero-content">${c.en ? `<p class="eyebrow reveal">${esc(c.en)}</p>` : ''}<h1 class="reveal">${esc(c.title)}</h1>${c.lead ? `<p class="inner-hero-lead reveal">${esc(c.lead)}</p>` : ''}</div>
      <span class="inner-hero-index">${total} 種樣式</span>
    </section>
    <section class="page-section page-section-ivory"><div class="container">
      <div class="page-heading"><div><p class="eyebrow eyebrow-dark reveal">STYLES &amp; SIZES</p><h2 class="page-title reveal">可選的樣式<br>與尺寸。</h2></div><p class="reveal">以下為目前可提供的規格。實際可用尺寸、最小起訂量與印刷方式，會依產品內容物與生產排程確認。</p></div>
      ${c.groups.map(g => specGroup(g, c, p)).join('\n      ')}
      <p class="spec-note reveal">官網資料僅供參考，詳情請洽百達醫顧問。</p>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">START A PROJECT</p><h2 class="reveal">${c.cta.title.split(/\s*\n\s*/).map(esc).join('<br>')}</h2></div><div class="project-cta-copy reveal"><p>${esc(c.cta.text)}</p><a class="button button-dark" href="${esc(ctaHref)}">${esc(c.cta.button)} <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="${p}premium-shell.js?v=${V}"></script><script src="${p}premium-site.js?v=${V}"></script>
  <script src="${p}premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

/* What an overview card may link to: a styles page (generated, or one of the
   hand-built pages beside them, like the capsule chooser), or the enquiry
   form with one of the presets premium-contact.js recognises. */
function linkTargets(catalogue) {
  const pages = new Map(catalogue.map(c => [c.slug, c.title]));
  for (const e of fs.readdirSync(path.join(ROOT, CAT_DIR), { withFileTypes: true })) {
    const file = path.join(ROOT, CAT_DIR, e.name, 'index.html');
    if (!e.isDirectory() || pages.has(e.name) || !fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(CAT_MARK) || /http-equiv="refresh"/i.test(html)) continue;
    pages.set(e.name, ((html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || e.name).trim());
  }
  const map = fs.readFileSync(path.join(ROOT, 'premium-contact.js'), 'utf8').match(/var formatMap = \{([\s\S]*?)\};/);
  if (!map) throw new Error('premium-contact.js: formatMap not found');
  const contact = new Map([...map[1].matchAll(/'?([a-z-]+)'?\s*:\s*\['([^']+)'/g)].map(m => [m[1], m[2]]));
  return { pages, contact };
}

function overviewCard(c, photo, targets, where) {
  const prefix = '../../';
  if (!c.title || !c.image) throw new Error(`content/pages/catalogue.md: a card in ${where} needs a title and an image`);
  let href = '', arrow = '', more = '';
  if (c.link) {
    const link = resolveLink(c.link, path.posix.dirname(OVERVIEW), targets, `content/pages/catalogue.md: "${c.title}" in ${where}`);
    href = link.href;
    [arrow, more] = link.kind === 'page' ? ['→', '查看樣式'] : ['↗', '與顧問討論'];
  }
  const alt = esc(c.alt || c.title);
  const src = esc(rel(c.image, prefix));
  let img = `<img src="${src}" alt="${alt}" loading="lazy">`;
  if (photo) {
    const size = imageSize(path.join(ROOT, c.image.replace(/^\//, '')));
    const small = c.image.replace(/(\.[a-z]+)$/i, '-640$1');
    const srcset = size && fs.existsSync(path.join(ROOT, small.replace(/^\//, '')))
      ? ` srcset="${esc(rel(small, prefix))} 640w, ${src} ${size[0]}w" sizes="(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 290px"` : '';
    img = `<img src="${src}"${srcset} alt="${alt}"${size ? ` width="${size[0]}" height="${size[1]}"` : ''} loading="lazy">`;
  }
  const copy = (c.en ? `<span class="catalogue-en">${esc(c.en)}</span>` : '') + `<h3>${esc(c.title)}</h3>` +
    (c.text ? `<p>${esc(c.text)}</p>` : '') +
    (href ? `<span class="catalogue-more">${esc(c.more || more)} ${arrow}</span>` : '');
  const inner = `<div class="catalogue-media">${img}</div><div class="catalogue-copy">${copy}</div>`;
  return href ? `<a class="catalogue-card reveal" href="${esc(href)}">${inner}</a>` : `<div class="catalogue-card reveal">${inner}</div>`;
}

/* The CMS's "連結到" dropdown, rewritten so a new styles page shows up there. */
function linkOptions(targets) {
  const q = s => JSON.stringify(s);
  return [
    ...[...targets.pages].map(([slug, title]) => `- { label: ${q('樣式頁｜' + title)}, value: ${q('page:' + slug)} }`),
    ...[...targets.contact].map(([key, label]) => `- { label: ${q('諮詢表單｜' + label)}, value: ${q('contact:' + key)} }`)
  ];
}

/* ----------------------------------------------------------------- run */
const posts = loadArticles();
const keep = new Set(posts.map(p => p.slug));
let written = 0, removed = 0;

for (const a of posts) {
  const dir = path.join(ROOT, a.slug);
  const file = path.join(dir, 'index.html');
  if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes(MARK) && !fs.readFileSync(file, 'utf8').includes('article-page')) {
    throw new Error(`${a.slug}/ exists and is not an article page; choose another file name`);
  }
  const html = articlePage(a);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) { fs.writeFileSync(file, html); written++; }
}

// posts deleted in the CMS: remove their generated pages
for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!e.isDirectory() || keep.has(e.name)) continue;
  const file = path.join(ROOT, e.name, 'index.html');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(MARK)) {
    fs.rmSync(path.join(ROOT, e.name), { recursive: true });
    removed++;
  }
}

const listingChanged = fill('最新消息/index.html', 'article-cards', posts.map(a => '      ' + listingCard(a)).join('\n') + '\n      ');
const homeChanged = fill('index.html', 'home-articles', homePicks(posts).map((a, i) => '          ' + homeCard(a, i === 0)).join('\n') + '\n          ');

console.log(`articles: ${posts.length} (${written} written, ${removed} removed); listing ${listingChanged ? 'updated' : 'unchanged'}; homepage ${homeChanged ? 'updated' : 'unchanged'}`);

const catalogue = loadCatalogue();
const targets = linkTargets(catalogue);
let catWritten = 0, catRemoved = 0;
for (const c of catalogue) {
  const dir = path.join(ROOT, CAT_DIR, c.slug);
  const file = path.join(dir, 'index.html');
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old !== null && !old.includes(CAT_MARK) && !old.includes('class="spec-group"')) {
    throw new Error(`${CAT_DIR}/${c.slug}/ exists and is not a styles page; choose another name`);
  }
  const html = cataloguePage(c, targets);
  fs.mkdirSync(dir, { recursive: true });
  if (old !== html) { fs.writeFileSync(file, html); catWritten++; }
}
// styles pages deleted in the CMS
const catKeep = new Set(catalogue.map(c => c.slug));
for (const e of fs.readdirSync(path.join(ROOT, CAT_DIR), { withFileTypes: true })) {
  const file = path.join(ROOT, CAT_DIR, e.name, 'index.html');
  if (e.isDirectory() && !catKeep.has(e.name) && fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(CAT_MARK)) {
    fs.rmSync(path.join(ROOT, CAT_DIR, e.name), { recursive: true });
    catRemoved++;
  }
}

const overview = matter(fs.readFileSync(path.join(ROOT, 'content', 'pages', 'catalogue.md'), 'utf8')).data;
let overviewChanged = false;
for (const [section, photo] of Object.entries(SECTIONS)) {
  const cards = (overview[section] || []).map(c => '        ' + overviewCard(c, photo, targets, section));
  overviewChanged = fill(OVERVIEW, 'catalogue-' + section, cards.join('\n') + '\n      ') || overviewChanged;
}
const indent = fs.readFileSync(path.join(ROOT, 'admin', 'config.yml'), 'utf8').match(/^( *)# cms:catalogue-links/m)[1];
const optionsChanged = fill('admin/config.yml', 'catalogue-links', linkOptions(targets).map(o => indent + o).join('\n') + '\n' + indent, true);

console.log(`catalogue: ${catalogue.length} pages (${catWritten} written, ${catRemoved} removed); overview ${overviewChanged ? 'updated' : 'unchanged'}; CMS link list ${optionsChanged ? 'updated' : 'unchanged'}`);
