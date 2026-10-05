/* Builds the pages whose content lives in content/, which is what the CMS at
 * /admin edits.
 *
 *   content/articles/<slug>.md   →  <slug>/index.html (one page per post)
 *                                    最新消息/index.html (the card grid)
 *                                    index.html (the homepage's three posts)
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
 * Generated article pages carry <meta name="generator" content="bke-build
 * article">; a page with that marker whose content file is gone is deleted,
 * so removing a post in the CMS removes it from the site.
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

/* Replace what sits between <!-- cms:NAME --> and <!-- /cms:NAME -->. */
function fill(file, name, html) {
  const full = path.join(ROOT, file);
  const src = fs.readFileSync(full, 'utf8');
  const open = `<!-- cms:${name} -->`, close = `<!-- /cms:${name} -->`;
  const s = src.indexOf(open), e = src.indexOf(close);
  if (s < 0 || e < s) throw new Error(`${file}: markers for "${name}" not found`);
  const out = src.slice(0, s + open.length) + '\n' + html + '\n' + src.slice(e);
  if (out !== src) fs.writeFileSync(full, out);
  return out !== src;
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
