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
 *                                    overview's card grids, and the
 *                                    homepage's row of dosage forms)
 *   content/functions/<slug>.md  →  全面性服務/功能配方/<slug>/index.html and
 *                                    that direction's card on the overview
 *   content/pages/<id>.md        →  the text and images tagged data-cms on
 *                                    the hand-built pages listed in PAGES
 *   content/settings.md          →  phone, address and footer blurb
 *                                    (premium-shell.js, contact page,
 *                                    homepage structured data)
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
const { renderArticleBlocks, renderSafeMarkdown } = require('./lib/article-content');

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
      bodyBlocks: Array.isArray(d.body_blocks) ? d.body_blocks : [],
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

/* Legacy WordPress HTML remains a temporary compatibility input while those
   posts are migrated to body_blocks. Refuse executable markup at build time:
   this field is never a general-purpose HTML escape hatch. */
function assertSafeLegacyHtml(html, slug) {
  const unsafe = [
    /<(?:script|style|object|embed|form|input|button|textarea|select|svg|math)\b/i,
    /\son[a-z]+\s*=/i,
    /\s(?:srcdoc|style)\s*=/i,
    /(?:javascript|vbscript)\s*:/i,
    /data\s*:\s*text\/html/i
  ];
  if (unsafe.some(pattern => pattern.test(html))) {
    throw new Error(`content/articles/${slug}.md: unsafe legacy body_html; migrate it to body_blocks`);
  }
  for (const match of html.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)) {
    let url;
    try { url = new URL(match[1]); } catch { throw new Error(`content/articles/${slug}.md: invalid iframe URL`); }
    const allowed = url.protocol === 'https:' && ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(url.hostname);
    if (!allowed) throw new Error(`content/articles/${slug}.md: iframe host is not allowed`);
  }
}

function embeddedVideo(a, prefix) {
  const raw = String(a.videoEmbed || '');
  const provider = /(?:youtube\.com|youtu\.be)/i.test(raw) ? 'youtube' : /vimeo\.com/i.test(raw) ? 'vimeo' : '';
  if (!provider) throw new Error(`content/articles/${a.slug}.md: video_embed must be an HTTPS YouTube or Vimeo URL`);
  return renderArticleBlocks([{ type: 'video', provider, url: raw, caption: a.title }], { prefix });
}

function articleMain(a) {
  const prefix = '../';
  let body = '';
  if (a.bodyBlocks.length) body = renderArticleBlocks(a.bodyBlocks, { prefix });
  else if (a.bodyHtml) {
    assertSafeLegacyHtml(a.bodyHtml, a.slug);
    body = relHtml(a.bodyHtml, prefix);
  } else if (a.markdown) body = renderSafeMarkdown(a.markdown, { prefix });
  if (a.videoEmbed && !body.trim()) {
    return `      <div class="article-video-lead reveal">
        ${embeddedVideo(a, prefix)}
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

/* ------------------------------------------------------------- homepage */
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

/* One dosage form on the homepage: the overview's card reduced to its photo
   and name, linking where the overview card links. */
function homeFormatCard(c, targets) {
  const link = c.link ? resolveLink(c.link, '.', targets, `content/pages/catalogue.md: "${c.title}" in dosage`) : null;
  const img = responsiveImg(c.image, './');
  const inner = `<span class="home-format-media"><img src="${img.src}"${img.srcset}${img.srcset ? ' sizes="(max-width: 720px) 50vw, (max-width: 1100px) 25vw, 290px"' : ''} alt="${esc(c.alt || c.title)}"${img.dims} loading="lazy"></span>` +
    `<span class="home-format-name">${esc(c.title)}${link ? `<i aria-hidden="true">${link.kind === 'contact' ? '↗' : '→'}</i>` : ''}</span>`;
  return link ? `<a class="home-format reveal" href="${esc(link.href)}">${inner}</a>` : `<div class="home-format reveal">${inner}</div>`;
}

/* ------------------------------------------------------------- listing */
const dots = d => d.replace(/-/g, '.');

function listingCard(a) {
  return `<a class="article-card reveal" href="../${a.slug}/index.html" data-news-category="${a.group}"><div class="article-card-image"><img src="${esc(rel(a.cover, '../'))}" alt="${esc(a.coverAlt)}" loading="lazy"></div><div class="article-card-copy"><span>${esc(a.category)}</span><h2>${esc(a.title)}</h2>${a.summary ? `<p>${esc(a.summary)}</p>` : ''}<time datetime="${a.date}">${dots(a.date)}</time></div></a>`;
}

/* Replace what sits between <!-- cms:NAME --> and <!-- /cms:NAME --> (or
   "# cms:NAME" in YAML, "// cms:NAME" in JavaScript). `html` ends with the
   indentation the closing marker sits at. */
function fill(file, name, html, style = 'html') {
  const full = path.join(ROOT, file);
  const src = fs.readFileSync(full, 'utf8');
  const [a, b] = { html: ['<!-- ', ' -->'], yaml: ['# ', ''], js: ['// ', ''] }[style];
  const open = `${a}cms:${name}${b}`, close = `${a}/cms:${name}${b}`;
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
  const to = dest => path.posix.relative(fromDir, dest).replace(/^(?!\.)/, './') + '/index.html';
  if (kind === 'page' && targets.pages.has(value)) return { kind, href: to(`${CAT_DIR}/${value}`) };
  if (kind === 'products' && ['all', 'metabolism', 'balance', 'women', 'elderly'].includes(value)) {
    return { kind, href: to('全面性服務/機能食品保健') + (value === 'all' ? '' : `?category=${value}#products`) };
  }
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

function overviewCard(c, photo, targets, where, fromDir = path.posix.dirname(OVERVIEW)) {
  const prefix = fromDir === '.' ? './' : '../'.repeat(fromDir.split('/').length);
  if (!c.title || !c.image) throw new Error(`content/pages/catalogue.md: a card in ${where} needs a title and an image`);
  let href = '', arrow = '', more = '';
  if (c.link) {
    const link = resolveLink(c.link, fromDir, targets, `content/pages/catalogue.md: "${c.title}" in ${where}`);
    href = link.href;
    [arrow, more] = link.kind === 'contact' ? ['↗', '與顧問討論'] : ['→', link.kind === 'products' ? '查看商品' : '查看樣式'];
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
    ...[...targets.contact].map(([key, label]) => `- { label: ${q('諮詢表單｜' + label)}, value: ${q('contact:' + key)} }`),
    ...[['all', '全部商品'], ['metabolism', '新陳代謝'], ['balance', '體質調整'], ['women', '女性保健'], ['elderly', '銀髮保健']]
      .map(([key, label]) => `- { label: ${q('機能食品保健｜' + label)}, value: ${q('products:' + key)} }`)
  ];
}

/* ------------------------------------------------------------ functions */
/* The 20 功能配方 directions: one page each listing common ingredients, and a
   card each on the 功能配方 overview (filled between per-card markers, so the
   overview keeps its grouping and order). Directions are not added or
   removed in the CMS: their names are also the contact form's choices. */
const FN_DIR = '全面性服務/功能配方';
const FN_MARK = '<meta name="generator" content="bke-build function">';
const FN_PLACEHOLDER_IMG = '/assets/premium/ingredient-placeholder.svg';

function loadFunctions() {
  const dir = path.join(ROOT, 'content', 'functions');
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const d = matter(fs.readFileSync(path.join(dir, f), 'utf8')).data;
    const slug = f.replace(/\.md$/, '');
    if (!d.title || !d.image) throw new Error(`content/functions/${f}: title and image are required`);
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`content/functions/${f}: file name must be lowercase letters, digits and dashes`);
    return {
      slug, title: String(d.title).trim(), en: String(d.title_en || '').trim(), lead: String(d.lead || '').trim(),
      summary: String(d.summary || '').trim(), image: d.image, placeholder: d.placeholder !== false,
      items: (d.items || []).filter(i => i && i.name).map(i => ({
        name: String(i.name).trim(), en: String(i.name_en || '').trim(), text: String(i.text || '').trim(),
        form: String(i.form || '').trim(), image: i.image || ''
      }))
    };
  });
}

/* src, srcset (when a -640 copy sits beside it), width and height */
function responsiveImg(image, prefix) {
  const size = imageSize(path.join(ROOT, image.replace(/^\//, '')));
  const small = image.replace(/(\.[a-z]+)$/i, '-640$1');
  const src = esc(rel(image, prefix));
  const srcset = size && fs.existsSync(path.join(ROOT, small.replace(/^\//, ''))) ? ` srcset="${esc(rel(small, prefix))} 640w, ${src} ${size[0]}w"` : '';
  return { src, srcset, dims: size ? ` width="${size[0]}" height="${size[1]}"` : '' };
}

function ingredientCard(it, p) {
  return `<article class="catalogue-card reveal">` +
    `<div class="catalogue-media"><img src="${esc(rel(it.image || FN_PLACEHOLDER_IMG, p))}" alt="${it.image ? esc(it.name + '原料') : ''}" loading="lazy"></div>` +
    `<div class="catalogue-copy">${it.en ? `<span class="catalogue-en">${esc(it.en)}</span>` : ''}<h3>${esc(it.name)}</h3>` +
    `${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.form ? `<p class="ingredient-meta"><b>形式</b>　${esc(it.form)}</p>` : ''}</div></article>`;
}

/* The ingredient library exposes the original eleven categories inline,
   using the same source data as each direction page. */
const INGREDIENT_CATEGORIES = ['beauty', 'secret-garden', 'metabolism', 'protein', 'body-functions', 'energetic', 'gut', 'generation-3c', 'balance', 'action', 'sleep'];
function ingredientCategory(c, index) {
  const p = '../../';
  const image = responsiveImg(c.image, p);
  const categorySearch = `${c.title} ${c.en}`;
  const allSearch = [categorySearch, ...c.items.map(it => `${it.name} ${it.en} ${it.text} ${it.form}`)].join(' ');
  const materials = c.items.map(it => {
    const search = `${it.name} ${it.en} ${it.text} ${it.form}`;
    return `<article class="ingredient-material${it.image ? ' has-image' : ''}" data-search="${esc(search)}"><div class="ingredient-material-copy">` +
      (it.en ? `<p class="ingredient-material-en">${esc(it.en)}</p>` : '') + `<h3>${esc(it.name)}</h3>` +
      (it.text ? `<p class="ingredient-material-description">${esc(it.text)}</p>` : '') +
      (it.form ? `<p class="ingredient-material-form"><span>形式</span>${esc(it.form)}</p>` : '') + `</div>` +
      (it.image ? `<img class="ingredient-material-image" src="${esc(rel(it.image, p))}" alt="${esc(it.name + '原料')}" loading="lazy">` : '') + `</article>`;
  }).join('\n              ');
  return `        <details class="ingredient-category" name="ingredient-category" id="category-${c.slug}" data-category-search="${esc(categorySearch)}" data-search="${esc(allSearch)}">
          <summary aria-controls="materials-${c.slug}"><span class="ingredient-category-visual"><img class="ingredient-category-image" src="${image.src}"${image.srcset} sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 290px" alt="" width="1200" height="800" loading="lazy"><span class="ingredient-category-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="ingredient-category-selected" aria-hidden="true">已展開</span></span><span class="ingredient-category-copy"><span class="ingredient-category-title"><span>${esc(c.en)}</span><strong id="category-${c.slug}-title">${esc(c.title)}</strong></span><span class="ingredient-category-preview">${c.items.slice(0, 2).map(it => esc(it.name)).join('・')}</span><span class="ingredient-category-action"><span>${c.items.length} 項原料</span><span class="ingredient-category-action-label"><span class="ingredient-card-open-label">查看原料</span><span class="ingredient-card-close-label">收合原料</span><i aria-hidden="true"></i></span></span></span></summary>
          <div class="ingredient-category-panel" id="materials-${c.slug}" role="region" aria-labelledby="category-${c.slug}-title">
            <div class="ingredient-panel-heading"><div><p>INGREDIENT SELECTION</p><h3>${esc(c.title)}<span>原料清單</span></h3></div><button type="button" class="ingredient-panel-close" data-close-ingredients aria-label="收合${esc(c.title)}原料清單">收合 <span aria-hidden="true">×</span></button></div>
            <div class="ingredient-material-grid">
              ${materials || '<p>本分類原料資料整理中。</p>'}
            </div>
            <div class="ingredient-category-next"><p>有想使用的原料？提供名稱與預計劑型，與顧問一起確認規格。</p><a class="text-link" href="${p}contact/index.html">討論這類原料 <span aria-hidden="true">↗</span></a></div>
          </div>
        </details>`;
}

function functionPage(c) {
  const p = '../../../';
  const title = `${c.title}原料｜功能配方｜百達醫 BKE`;
  const desc = `${c.title}方向常用的原料選項與規格形式，供品牌在配方規劃階段參考。`;
  const url = `${SITE}${FN_DIR}/${c.slug}/`;
  const hero = responsiveImg(c.image, p);
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${FN_MARK}
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
${c.placeholder ? '  <meta name="robots" content="noindex">\n' : ''}  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="百達醫 BKE">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(SITE + c.image.replace(/^\//, ''))}">
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
    <section class="inner-hero inner-hero-card">
      <div class="inner-hero-shade" aria-hidden="true"></div>
      <div class="container inner-hero-content">
        <div class="inner-hero-copy">${c.en ? `<p class="eyebrow reveal">${esc(c.en)}</p>` : ''}<h1 class="reveal">${esc(c.title)}</h1>${c.lead ? `<p class="inner-hero-lead reveal">${esc(c.lead)}</p>` : ''}</div>
        <figure class="inner-hero-card-media" aria-hidden="true"><img src="${hero.src}"${hero.srcset}${hero.srcset ? ' sizes="(max-width: 900px) 100vw, 560px"' : ''} alt=""${hero.dims}></figure>
      </div>
    </section>
    <section class="page-section page-section-ivory"><div class="container">
${c.placeholder ? '      <p class="placeholder-note reveal"><strong>版面示意</strong>　本頁原料資料與圖片為暫代內容，僅供版面確認；實際品項、規格與說明待百達醫提供後替換。</p>\n' : ''}      <div class="page-heading"><div><p class="eyebrow eyebrow-dark reveal">COMMON MATERIALS</p><h2 class="page-title reveal">這個方向<br>常用的原料。</h2></div><p class="reveal">以下列出此配方方向較常被指定的原料與其形式。實際可用品項、規格與最小採購量，會依配方設計與供應狀況調整。</p></div>
      <div class="catalogue-grid catalogue-grid-ingredient">
        ${c.items.map(it => ingredientCard(it, p)).join('\n        ')}
      </div>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">DISCUSS YOUR FORMULA</p><h2 class="reveal">想用哪一支原料，<br>我們一起確認。</h2></div><div class="project-cta-copy reveal"><p>提供產品訴求與預計劑型，我們會協助評估原料選項、規格與可行的配方組合。</p><a class="button button-dark" href="${p}contact/index.html">與研發顧問討論 <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="${p}premium-shell.js?v=${V}"></script><script src="${p}premium-site.js?v=${V}"></script>
  <script src="${p}premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

function functionCard(c) {
  const img = responsiveImg(c.image, '../../');
  return `<article class="service-overview-card has-media reveal" id="${c.slug}">` +
    `<img class="function-card-media" src="${img.src}"${img.srcset}${img.srcset ? ' sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 380px"' : ''} alt=""${img.dims} loading="lazy">` +
    `${c.en ? `<span>${esc(c.en)}</span>` : ''}<h3>${esc(c.title)}</h3>${c.summary ? `<p>${esc(c.summary)}</p>` : ''}` +
    `<a class="function-card-cta" href="./${c.slug}/index.html">查看常用原料 <span aria-hidden="true">→</span></a></article>`;
}

/* ------------------------------------------------------------ page text */
/* Hand-built pages whose text and images are editable: elements tagged
   data-cms / data-cms-img (scripts/lib/html-fields.js), plus each page's
   title and description. Values live in content/pages/<id>.md. */
const fields = require('./lib/html-fields');
const PAGES = [
  { id: 'home', label: '首頁', file: 'index.html' },
  { id: 'about', label: '關於百達醫', file: '認識百達醫/關於百達醫/index.html' },
  { id: 'quality', label: '研發、品質與認證', file: '研發科技/index.html' },
  { id: 'process', label: '合作流程', file: '全面性服務/一站式服務/index.html' },
  { id: 'catalogue', label: '劑型與包材總覽', file: '全面性服務/劑型與包材/index.html', lists: ['dosage', 'package', 'finished', 'products'] },
  { id: 'capsules', label: '動／植物膠囊', file: '全面性服務/一站式服務/多元劑型-膠囊/index.html' },
  { id: 'functions', label: '功能配方方向', file: '全面性服務/功能配方/index.html' },
  { id: 'esg', label: '綠色永續', file: '認識百達醫/綠色永續/index.html' },
  { id: 'news', label: '最新消息（列表頁）', file: '最新消息/index.html' },
  { id: 'contact', label: '代工諮詢', file: 'contact/index.html' }
];
const SEO = '搜尋與分享';

/* 分享說明 (og:description) is only stored when a page's share preview says
   something other than its search description; blank, it follows that. */
function seoOf(html) {
  const get = re => fields.decode((html.match(re) || [, ''])[1]).trim();
  const seo = { 網頁標題: get(/<title>([^<]*)<\/title>/), 搜尋說明: get(/<meta name="description" content="([^"]*)">/) };
  const og = get(/<meta property="og:description" content="([^"]*)">/);
  if (og && og !== seo.搜尋說明) seo.分享說明 = og;
  return seo;
}
function applySeo(html, seo) {
  if (!seo) return html;
  const now = seoOf(html);
  const set = (re, value) => { html = html.replace(re, (m, a, b) => a + esc(value) + b); };
  if (seo.網頁標題 && String(seo.網頁標題).trim() !== now.網頁標題) {
    const t = String(seo.網頁標題).trim();
    set(/(<title>)[^<]*(<\/title>)/, t);
    set(/(<meta property="og:title" content=")[^"]*(">)/, t);
  }
  const line = v => String(v || '').trim().replace(/\s*\n\s*/g, ' ');
  if (line(seo.搜尋說明) && line(seo.搜尋說明) !== now.搜尋說明) {
    set(/(<meta name="description" content=")[^"]*(">)/, line(seo.搜尋說明));
  }
  const share = line(seo.分享說明) || line(seo.搜尋說明) || now.搜尋說明;
  if (share !== (now.分享說明 || now.搜尋說明)) set(/(<meta property="og:description" content=")[^"]*(">)/, share);
  return html;
}

/* The overview's card lists, edited on the same CMS page as its text. */
const CARD_LISTS_YAML = `          - label: 多元劑型（卡片）
            label_singular: 卡片
            name: dosage
            widget: list
            summary: "{{fields.title}}"
            hint: 顯示於「劑型與包材」的多元劑型區塊。
            fields: &card
              - { label: 標題, name: title, widget: string }
              - { label: 英文小標, name: en, widget: string, required: false }
              - { label: 說明, name: text, widget: string, required: false }
              - { label: 圖片, name: image, widget: image }
              - { label: 圖片說明, name: alt, widget: string, required: false, hint: 給看不到圖片的讀者；空白時使用標題。 }
              - { label: 連結到, name: link, widget: select, required: false, options: *links, hint: 樣式頁或預先選好劑型的諮詢表單；空白則卡片不能點。新增的樣式頁約 2 分鐘後出現在選單。 }
              - { label: 連結文字, name: more, widget: string, required: false, hint: 例如「查看樣式」；箭頭會自動加上。空白時依連結種類自動填。 }
          - { label: 包材規劃（卡片）, label_singular: 卡片, name: package, widget: list, summary: "{{fields.title}}", fields: *card }
          - { label: 成品包材（卡片）, label_singular: 卡片, name: finished, widget: list, summary: "{{fields.title}}", fields: *card }
          - { label: 機能食品保健（卡片）, label_singular: 卡片, name: products, widget: list, summary: "{{fields.title}}", fields: *card }`;

function pagesConfig(entries, indent) {
  const seoField = { label: SEO, name: SEO, widget: 'object', collapsed: true, fields: [
    { label: '網頁標題', name: '網頁標題', widget: 'string', hint: '瀏覽器分頁、搜尋結果與分享預覽的標題。' },
    { label: '搜尋說明', name: '搜尋說明', widget: 'text', hint: '搜尋結果下方的說明，建議 80 字內。' },
    { label: '分享說明', name: '分享說明', widget: 'text', required: false, hint: 'LINE、Facebook 分享預覽的說明；空白時與搜尋說明相同。' }
  ] };
  const lines = [];
  for (const { page, html } of entries) {
    lines.push(`- name: ${page.id}`, `  label: ${JSON.stringify(page.label)}`, `  file: content/pages/${page.id}.md`, '  format: frontmatter', '  fields:');
    if (page.lists) lines.push(...CARD_LISTS_YAML.split('\n').map(l => l.slice(6)));
    for (const f of [seoField, ...fields.cmsFields(html, path.posix.dirname(page.file))]) lines.push('    - ' + JSON.stringify(f));
  }
  return lines.map(l => indent + l).join('\n') + '\n' + indent;
}

/* ------------------------------------------------------------- settings */
/* Company details shown in the footer of every page, on the contact page,
   in the homepage's structured data and in the contact form's fallback
   message. Kept in content/settings.md (網站設定 in the CMS). */
function companyDetails() {
  const s = matter(fs.readFileSync(path.join(ROOT, 'content', 'settings.md'), 'utf8')).data;
  const phone = String(s.電話 || '').trim(), address = String(s.地址 || '').trim(), tagline = String(s.頁尾簡介 || '').trim();
  if (!/^\+?\d[\d\s-]{6,}$/.test(phone)) throw new Error(`content/settings.md: 電話 "${phone}" is not a phone number`);
  if (!address || !tagline) throw new Error('content/settings.md: 地址 and 頁尾簡介 are required');
  const local = (phone.startsWith('+886') ? '0' + phone.replace(/^\+886[\s-]*/, '') : phone).replace(/\s+/g, '-');
  const parts = address.match(/^(.{2}[市縣])(.{1,3}?[區鄉鎮市])(.+)$/);
  return {
    phone, address, tagline, local,
    tel: (phone.startsWith('+') ? '+' : '') + phone.replace(/\D/g, ''),
    intl: phone.replace(/\s+/g, '-'),
    region: parts ? parts[1] : '', locality: parts ? parts[2] : '', street: parts ? parts[3].trim() : address
  };
}

function applySettings(co) {
  let changed = [];
  const js = v => JSON.stringify(v).replace(/</g, '\\u003c');
  // footer, on every page
  const shell = { phone: esc(co.phone), tel: co.tel, address: esc(co.address), tagline: esc(co.tagline) };
  if (fill('premium-shell.js', 'settings', `  var SITE = ${js(shell)};\n  `, 'js')) changed.push('premium-shell.js');
  if (fill('premium-contact.js', 'phone', `  var PHONE = ${js(co.local)};\n  `, 'js')) changed.push('premium-contact.js');
  // contact page
  const cfile = path.join(ROOT, 'contact', 'index.html');
  let c = fs.readFileSync(cfile, 'utf8');
  const edits = [];
  (function walk(n) {
    const which = n.attrs && (n.attrs.match(/\sdata-cms-setting="([^"]+)"/) || [])[1];
    if (which === '電話') edits.push([n.start, n.end, c.slice(n.start, n.openEnd).replace(/href="tel:[^"]*"/, `href="tel:${co.tel}"`) + esc(co.phone) + '</a>']);
    else if (which === '地址') edits.push([n.openEnd, n.innerEnd, esc(co.address)]);
    n.children.forEach(walk);
  })(fields.parse(c));
  const before = c;
  for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) c = c.slice(0, s) + r + c.slice(e);
  if (c !== before) { fs.writeFileSync(cfile, c); changed.push('contact'); }
  // homepage structured data
  const hfile = path.join(ROOT, 'index.html');
  const h = fs.readFileSync(hfile, 'utf8');
  const ld = h.match(/(<script type="application\/ld\+json">)([^<]*)(<\/script>)/);
  if (ld) {
    const data = JSON.parse(ld[2]);
    const next = JSON.parse(ld[2]);
    next.telephone = co.intl;
    if (next.address) Object.assign(next.address, { streetAddress: co.street, addressLocality: co.locality, addressRegion: co.region });
    if (JSON.stringify(next) !== JSON.stringify(data)) {
      fs.writeFileSync(hfile, h.replace(ld[0], ld[1] + js(next) + ld[3]));
      changed.push('index.html');
    }
  }
  return changed;
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
const optionsChanged = fill('admin/config.yml', 'catalogue-links', linkOptions(targets).map(o => indent + o).join('\n') + '\n' + indent, 'yaml');

console.log(`catalogue: ${catalogue.length} pages (${catWritten} written, ${catRemoved} removed); overview ${overviewChanged ? 'updated' : 'unchanged'}; CMS link list ${optionsChanged ? 'updated' : 'unchanged'}`);

// 功能配方 directions
const directions = loadFunctions();
let fnWritten = 0, fnCards = 0;
for (const c of directions) {
  const dir = path.join(ROOT, FN_DIR, c.slug);
  const file = path.join(dir, 'index.html');
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old !== null && !old.includes(FN_MARK) && !old.includes('catalogue-grid-ingredient')) {
    throw new Error(`${FN_DIR}/${c.slug}/ exists and is not a direction page`);
  }
  const html = functionPage(c);
  fs.mkdirSync(dir, { recursive: true });
  if (old !== html) { fs.writeFileSync(file, html); fnWritten++; }
  if (fill(`${FN_DIR}/index.html`, 'function-' + c.slug, '        ' + functionCard(c) + '\n        ')) fnCards++;
}
console.log(`functions: ${directions.length} pages (${fnWritten} written); overview cards ${fnCards ? fnCards + ' updated' : 'unchanged'}`);
// the homepage's row of dosage forms
overviewChanged = fill('index.html', 'home-formats', (overview.dosage || []).map(c => '          ' + homeFormatCard(c, targets)).join('\n') + '\n        ') || overviewChanged;

const ingredientIndex = INGREDIENT_CATEGORIES.map((slug, index) => {
  const category = directions.find(c => c.slug === slug);
  if (!category) throw new Error(`Ingredient library category "${slug}" is missing from content/functions/`);
  return ingredientCategory(category, index);
}).join('\n');
const ingredientIndexChanged = fill('全面性服務/原料成分/index.html', 'ingredient-categories', ingredientIndex + '\n        ');
console.log(`ingredients: ${INGREDIENT_CATEGORIES.length} inline categories (${ingredientIndexChanged ? 'updated' : 'unchanged'})`);

// page text and images
const pageOpts = dir => ({
  pageDir: dir, site: SITE,
  exists: p => fs.existsSync(path.join(ROOT, decodeURI(p).replace(/^\//, ''))),
  imageSize: p => imageSize(path.join(ROOT, decodeURI(p).replace(/^\//, '')))
});
const pageEntries = [];
let pagesWritten = 0, contentSynced = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page.file);
  const dir = path.posix.dirname(page.file);
  const cfile = path.join(ROOT, 'content', 'pages', page.id + '.md');
  const stored = fs.existsSync(cfile) ? matter(fs.readFileSync(cfile, 'utf8')).data : {};
  const src = fs.readFileSync(file, 'utf8');
  let html = applySeo(src, stored[SEO]);
  html = fields.applyFields(html, stored, pageOpts(dir));
  if (html !== src) { fs.writeFileSync(file, html); pagesWritten++; }
  /* The content file mirrors the page's fields: stored values where given,
     the page's own text for anything new; fields no longer on the page go. */
  const data = {};
  for (const k of page.lists || []) data[k] = stored[k] || [];
  Object.assign(data, { [SEO]: seoOf(html) }, fields.valuesOf(html, dir));
  if (JSON.stringify(data) !== JSON.stringify(stored)) {
    fs.mkdirSync(path.dirname(cfile), { recursive: true });
    fs.writeFileSync(cfile, matter.stringify('', data, { lineWidth: -1 }));
    contentSynced++;
  }
  pageEntries.push({ page, html });
}
const pagesIndent = fs.readFileSync(path.join(ROOT, 'admin', 'config.yml'), 'utf8').match(/^( *)# cms:pages/m)[1];
const pagesConfigChanged = fill('admin/config.yml', 'pages', pagesConfig(pageEntries, pagesIndent), 'yaml');
const settingsChanged = applySettings(companyDetails());

console.log(`pages: ${PAGES.length} (${pagesWritten} written, ${contentSynced} content files synced); CMS page forms ${pagesConfigChanged ? 'updated' : 'unchanged'}; settings ${settingsChanged.length ? 'applied to ' + settingsChanged.join(', ') : 'unchanged'}`);
