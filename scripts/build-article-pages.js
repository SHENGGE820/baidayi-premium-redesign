/* Rebuilds the news posts on the premium layer.
 *
 * Article metadata (title, category, date, hero image) is read from the
 * already-migrated 最新消息 listing, so the cards and the posts they open can
 * never drift apart. The body is lifted out of the old post and sanitised —
 * not rewritten. Two of the eight posts have no prose at all, only a Vimeo
 * embed, and get a video-first layout instead.
 *
 * Re-run:  node scripts/build-article-pages.js
 */
const fs = require('fs');
const path = require('path');

const V = '20260901-14';
const LISTING = '最新消息/index.html';

/* Read the listing once — it is the source of truth for what each post is. */
function readListing() {
  const c = fs.readFileSync(LISTING, 'utf8');
  const re = /<a class="article-card reveal" href="([^"]+)" data-news-category="([^"]+)">([\s\S]*?)<\/a>/g;
  const out = [];
  let m;
  while ((m = re.exec(c))) {
    const inner = m[3];
    const slug = m[1].replace(/^\.\.\//, '').replace(/\/index\.html$/, '');
    out.push({
      slug,
      group: m[2],
      img: (inner.match(/src="([^"]+)"/) || [])[1] || '',
      cat: (inner.match(/<span>([^<]*)<\/span>/) || [])[1] || '',
      title: ((inner.match(/<h2>([\s\S]*?)<\/h2>/) || [, ''])[1]).replace(/<[^>]*>/g, '').trim(),
      summary: ((inner.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1]).replace(/<[^>]*>/g, '').trim(),
      date: (inner.match(/datetime="([^"]*)"/) || [])[1] || '',
    });
  }
  return out;
}

/* Pull the post body and strip everything that belonged to the old theme:
 * inline styles (each post carried its own colours), WordPress wrapper
 * classes, empty paragraphs left by the editor, and the lightbox anchors
 * that wrapped every image. */
function readBody(slug) {
  const file = path.join(slug, 'index.html');
  if (!fs.existsSync(file)) return null;
  const c = fs.readFileSync(file, 'utf8');
  const m = c.match(/<div class="entry-content"[^>]*>([\s\S]*)/i);
  if (!m) return null;

  let b = m[1].split(/<footer|<div class="post_delimiter"|<span class="post-meta-infos"/)[0];

  b = b
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // lightbox / attachment links around images
    .replace(/<a[^>]*href="[^"]*\.(?:png|jpe?g|gif)"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    // the raw-url fallback link inside <video>
    .replace(/<a[^>]*href="[^"]*\.mp4"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ (?:srcset|sizes|decoding|fetchpriority|itemprop|data-[a-z-]+)="[^"]*"/gi, '')
    .replace(/ class="(?:wp-[^"]*|alignnone|size-full|aligncenter)"/gi, '');

  // rebase relative asset paths: posts sit one level deep, same as before
  b = b.replace(/(src|href)="\.\.\//g, '$1="../');

  // drop paragraphs that are now empty
  b = b.replace(/<p>\s*(?:&nbsp;|<br\s*\/?>)?\s*<\/p>/gi, '');
  b = b.trim();

  /* The captured slice runs past the end of .entry-content, so it carries the
   * </div> that closed it — and sometimes its parents too. Walk the div
   * balance and cut the trailing closers that have no opener in this slice,
   * otherwise every article ships with unbalanced markup. */
  let depth = 0;
  const tags = [...b.matchAll(/<(\/?)div\b[^>]*>/gi)];
  for (const t of tags) {
    depth += t[1] ? -1 : 1;
    if (depth < 0) { b = b.slice(0, t.index).trim(); break; }
  }

  return b;
}

/* Note on the videos: each post ships a landscape and a portrait cut, but the
 * posts use three different wrapper conventions for them —
 *   bke-video-wrap desktop-video / mobile-video   (6060-2, 夏季私密)
 *   video-switcher > desktop-video / mobile-video (glp-1, 魚油)
 *   video-wrap, single landscape cut              (鈣產品)
 * The desktop/mobile switch is handled in premium-inner.css against the
 * .desktop-video / .mobile-video classes directly, which all conventions
 * share. An earlier attempt to strip and re-wrap the markup here was wrong:
 * these wrappers nest, and a non-greedy regex closes on the wrong </div>. */

const esc = s => String(s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function shell({ a, main, extraClass = '' }) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(a.title)}｜最新消息｜百達醫 BKE</title>
  <meta name="description" content="${esc(a.summary || a.title)}">
  <link rel="canonical" href="https://shengge820.github.io/baidayi-premium-redesign/${a.slug}/">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(a.title)}">
  <meta property="og:description" content="${esc(a.summary || a.title)}">
  <meta name="theme-color" content="#171713">
  <link rel="icon" href="../wp-content/uploads/2025/09/BKE-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../premium-site.css?v=${V}"><link rel="stylesheet" href="../premium-inner.css?v=${V}">
  <link rel="stylesheet" href="../premium-motion.css?v=${V}">
</head>
<body class="premium-site premium-inner article-page${extraClass}" data-root="../" data-active="insights">
  <a class="skip-link" href="#main-content">跳到主要內容</a><div data-premium-header></div>
  <main id="main-content">
    <header class="news-masthead">
      <div class="container">
        <p class="article-meta reveal"><span>${esc(a.cat)}</span><i aria-hidden="true"></i><time datetime="${esc(a.date)}">${esc(a.date)}</time></p>
        <h1 class="reveal">${esc(a.title)}</h1>
        ${a.summary ? `<p class="reveal">${esc(a.summary)}</p>` : ''}
      </div>
    </header>
    <section class="page-section page-section-ivory"><div class="container">
${main}
      <a class="article-back reveal" href="../最新消息/index.html"><span aria-hidden="true">←</span> 回到最新消息</a>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">START A PROJECT</p><h2 class="reveal">看到市場機會，<br>下一步是做對產品。</h2></div><div class="project-cta-copy reveal"><p>把您的產品構想與目標客群告訴我們，專案顧問會協助整理可行的開發路徑。</p><a class="button button-dark" href="../contact/index.html">與我們討論 <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="../premium-shell.js?v=${V}"></script><script src="../premium-site.js?v=${V}"></script>
  <script src="../premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

const articles = readListing();
let built = 0, videoOnly = 0;

for (const a of articles) {
  const body = readBody(a.slug);
  if (body === null) { console.log('  SKIP (no entry-content): ' + a.slug); continue; }

  const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const iframe = (body.match(/<iframe[\s\S]*?<\/iframe>/i) || [])[0];

  let main;
  if (text.length < 60 && iframe) {
    // No prose, just an embed — lead with the video at full width.
    main = `      <div class="article-video-lead reveal">\n        ${iframe.replace(/ style="[^"]*"/gi, '')}\n      </div>`;
    videoOnly++;
  } else {
    const hero = a.img ? `      <div class="article-hero reveal"><img src="../${a.img.replace(/^\.\.\//, '')}" alt="${esc(a.title)}"></div>\n` : '';
    main = `${hero}      <div class="article-body">\n${body}\n      </div>`;
  }

  fs.writeFileSync(path.join(a.slug, 'index.html'), shell({ a, main }));
  console.log(`  ${a.slug.slice(0, 20).padEnd(22)} ${String(text.length).padStart(5)} 字  ${text.length < 60 ? '(影片)' : ''}`);
  built++;
}
console.log(`\nrebuilt ${built} articles (${videoOnly} video-only)`);
