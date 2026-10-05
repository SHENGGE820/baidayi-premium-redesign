/* Brings posts published on the original WordPress site into content/articles.
 *
 * Until the new site replaces it, the client's team may still post on the
 * old WordPress site. For each post in its REST API with no content file
 * here yet, this:
 *
 *   1. downloads the post page and every image and video its body uses into
 *      wp-content/uploads/… (originals, not WordPress's resized copies),
 *   2. cleans the body — WordPress wrappers, inline styles, lightbox links,
 *      empty paragraphs, a second <h1> — and picks the lead image: the
 *      square card thumbnail is dropped (the listing shows it) and the first
 *      landscape image becomes the hero,
 *   3. writes content/articles/<slug>.md, the same format the CMS writes.
 *
 * Then optimise-images.js --write compresses what came down (it rewrites the
 * content files too), and build-site.js turns them into pages.
 *
 *   node scripts/import-articles.js                  list posts not yet here
 *   node scripts/import-articles.js --write          import them
 *   node scripts/import-articles.js --refresh <slug>…
 *       re-download the named posts' bodies as they now stand on WordPress.
 *       Title, summary, category, cover and homepage flag are kept as they
 *       are in the content file, since those may have been edited in the CMS.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'articles');
const REFRESH = process.argv.includes('--refresh');
const REFRESH_SLUGS = REFRESH ? process.argv.slice(process.argv.indexOf('--refresh') + 1) : [];
const WRITE = process.argv.includes('--write') || REFRESH;
const ORIGIN = 'https://baidayi-enterprise.com';

function get(url, asText = true) {
  return new Promise((resolve, reject) => {
    https.get(encodeURI(decodeURI(url)), { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 120000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(new URL(res.headers.location, url).href, asText).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(res.statusCode + ' ' + url)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(asText ? Buffer.concat(chunks).toString('utf8') : Buffer.concat(chunks)));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout ' + url)); });
  });
}

const decode = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const plain = html => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
  .replace(/\[?&hellip;\]?|&#8230;/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
// Windows will not create names with control characters or these symbols.
const safeName = rel => rel.replace(/[\x00-\x1f<>:"|?*]/g, '');

/* Width and height from the file header: PNG and JPEG. */
function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
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
  } catch (e) { /* unknown */ }
  return null;
}

function cleanBody(html) {
  const m = html.match(/<div class="entry-content"[^>]*>([\s\S]*)/i);
  if (!m) return '';
  let b = m[1].split(/<footer|<div class="post_delimiter"|<span class="post-meta-infos"/)[0];
  b = b
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<span id="more-\d+"><\/span>/g, '')
    .replace(/<(\/?)h1\b/gi, '<$1h2')
    .replace(/<a[^>]*href="[^"]*\.(?:png|jpe?g|gif|webp)"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<a[^>]*href="[^"]*\.mp4"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ (?:srcset|sizes|decoding|fetchpriority|itemprop|data-[a-z-]+)="[^"]*"/gi, '')
    .replace(/ class="(?:wp-[^"]*|alignnone|size-full|aligncenter)"/gi, '')
    .replace(/<p>\s*(?:&nbsp;|<br\s*\/?>)?\s*<\/p>/gi, '')
    .trim();
  // the slice runs past .entry-content; cut closers with no opener in it
  let depth = 0;
  for (const t of b.matchAll(/<(\/?)div\b[^>]*>/gi)) {
    depth += t[1] ? -1 : 1;
    if (depth < 0) { b = b.slice(0, t.index).trim(); break; }
  }
  return b;
}

(async () => {
  const posts = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/posts?per_page=100&_fields=id,date,slug,link,title,excerpt,categories,featured_media`));
  const cats = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/categories?per_page=100&_fields=id,name`));
  const catName = id => (cats.find(c => c.id === id) || {}).name || '';
  const fileFor = p => path.join(OUT, safeName(decode(p.slug)) + '.md');

  const todo = REFRESH
    ? posts.filter(p => REFRESH_SLUGS.includes(safeName(decode(p.slug))))
    : posts.filter(p => !fs.existsSync(fileFor(p)));
  if (REFRESH && todo.length !== REFRESH_SLUGS.length) {
    throw new Error('not found on the original site: ' + REFRESH_SLUGS.filter(s => !todo.some(p => safeName(decode(p.slug)) === s)).join(', '));
  }
  console.log(`原站 ${posts.length} 篇，${REFRESH ? '重新下載' : '本站缺'} ${todo.length} 篇\n`);

  for (const p of todo) {
    const slug = safeName(decode(p.slug));
    console.log(`${p.date.slice(0, 10)}  ${slug}`);
    if (!WRITE) continue;

    let html = await get(p.link);
    html = html
      .replace(/(?:https?:)?\/\/baidayi-enterprise\.com\/wp-content\/uploads\//g, '/wp-content/uploads/')
      .replace(/(\/wp-content\/uploads\/[^"'\s)]+?)-\d+x\d+(\.(?:jpe?g|png|webp|gif))/gi, '$1$2');
    let body = cleanBody(html);

    // download everything the body references, plus the featured image
    const wanted = new Set([...body.matchAll(/\/wp-content\/uploads\/([^"'\s),?]+\.(?:jpe?g|png|webp|gif|mp4))/gi)].map(m => decode(m[1])));
    let cover = '';
    if (p.featured_media) {
      const media = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/media/${p.featured_media}?_fields=source_url`));
      cover = decode(media.source_url.split('/wp-content/uploads/')[1]);
      wanted.add(cover);
    }
    for (const rel of wanted) {
      const dest = path.join(ROOT, 'wp-content', 'uploads', safeName(rel));
      if (fs.existsSync(dest)) continue;
      try {
        const buf = await get(`${ORIGIN}/wp-content/uploads/${rel}`, false);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        console.log(`    ↓ ${rel}  ${Math.round(buf.length / 1024)}KB`);
      } catch (e) {
        console.log(`    ✗ ${rel}  ${e.message}`);
      }
    }

    // lead image: drop square thumbnails, promote the first landscape image
    let hero = '', heroAlt = '';
    for (const tag of [...body.matchAll(/<img[^>]*>/gi)].map(m => m[0])) {
      const src = (tag.match(/src="([^"]+)"/) || [, ''])[1];
      if (!src.startsWith('/wp-content/')) continue;
      const size = imageSize(path.join(ROOT, decode(src).replace(/^\//, '')));
      if (size && Math.abs(size[0] - size[1]) / size[0] < 0.05) { body = body.replace(tag, ''); continue; }
      hero = src; heroAlt = (tag.match(/alt="([^"]*)"/) || [, ''])[1];
      body = body.replace(tag, '');
      break;
    }
    body = body.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '').replace(/<figure>\s*<\/figure>/gi, '').trim();

    const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const iframe = (body.match(/<iframe[^>]*src="([^"]+)"/i) || [])[1];
    const names = p.categories.map(catName);

    const existing = fs.existsSync(fileFor(p)) ? matter.read(fileFor(p)).data : null;
    const data = existing && REFRESH ? { ...existing } : {
      title: plain(p.title.rendered),
      date: p.date.slice(0, 16),
      category: names.includes('活動訊息') ? '品牌動態' : '市場趨勢',
      summary: plain(p.excerpt.rendered).split(/(?<=[。！？])/)[0].slice(0, 70),
      cover: '/wp-content/uploads/' + cover,
      cover_alt: plain(p.title.rendered),
      home: false
    };
    delete data.hero; delete data.hero_alt; delete data.video_embed; delete data.body_html;
    if (text.length < 60 && iframe) {
      data.video_embed = iframe.replace(/&amp;/g, '&');
    } else {
      if (hero) { data.hero = hero; if (heroAlt) data.hero_alt = heroAlt; }
      data.body_html = body;
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(fileFor(p), matter.stringify('', data, { lineWidth: -1 }));
  }

  if (!WRITE && todo.length) console.log('\n加 --write 匯入。新文章的標題與摘要沿用原文，可在後台再修。');
  else if (WRITE && todo.length) console.log('\n完成。接著：node scripts/optimise-images.js --write，再 node scripts/build-site.js');
})().catch(e => { console.error(e.message); process.exit(1); });
