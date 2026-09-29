/* Brings posts published on the original WordPress site across to this one.
 *
 * The original site is still live and the client's team is still posting to
 * it — five posts went up in September alone after the redesign had been
 * migrated. Without a way to bring those across, the new site falls further
 * behind with every post.
 *
 * For each post in the WordPress REST API that has no folder here yet:
 *
 *   1. Download the post page and every image and video its body uses, into
 *      the same wp-content/uploads/… paths the rest of the site uses.
 *      WordPress serves resized copies (…-1030x1030.jpg); the body is pointed
 *      at the originals instead, since that is what gets downloaded and
 *      optimise-images.js resizes from there.
 *   2. Save the page with its asset URLs made local, still carrying its
 *      .entry-content — the input build-article-pages.js expects.
 *   3. Add a card to the 最新消息 listing, which is where build-article-pages
 *      reads each post's title, category and date from.
 *
 * Then run build-article-pages.js to turn the saved pages into premium posts,
 * and optimise-images.js --write to compress what came down.
 *
 *   node scripts/import-articles.js            list posts not yet here
 *   node scripts/import-articles.js --write    import them
 *   node scripts/import-articles.js --refresh <slug>…
 *       re-download the named posts' pages as they are now on the original
 *       site, leaving the listing cards alone — for a post edited there, or
 *       to restore a body before re-running build-article-pages.js
 *
 * Card titles are taken from the post as written, minus emoji and line breaks.
 * The existing cards were shortened by hand; review the new ones the same way.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const REFRESH = process.argv.includes('--refresh');
const REFRESH_SLUGS = REFRESH ? process.argv.slice(process.argv.indexOf('--refresh') + 1) : [];
const WRITE = process.argv.includes('--write') || REFRESH;
const ORIGIN = 'https://baidayi-enterprise.com';
const LISTING = path.join(ROOT, '最新消息', 'index.html');

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
const text = html => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
  .replace(/&hellip;|\[&hellip;\]/g, '').replace(/&#8230;/g, '').replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/\s+/g, ' ').trim();
/* Windows will not create names with control characters or these symbols; one
   upload in the media library has a \x03 in its name. */
const safeName = rel => rel.replace(/[\x00-\x1f<>:"|?*]/g, '');

(async () => {
  const posts = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/posts?per_page=100&_fields=id,date,slug,link,title,excerpt,categories,featured_media`));
  const cats = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/categories?per_page=100&_fields=id,name`));
  const catName = id => (cats.find(c => c.id === id) || {}).name || '';

  const fresh = REFRESH
    ? posts.filter(p => REFRESH_SLUGS.includes(safeName(decode(p.slug))))
    : posts.filter(p => !fs.existsSync(path.join(ROOT, safeName(decode(p.slug)), 'index.html')));
  if (REFRESH && fresh.length !== REFRESH_SLUGS.length) {
    throw new Error('not found on the original site: ' + REFRESH_SLUGS.filter(s => !fresh.some(p => safeName(decode(p.slug)) === s)).join(', '));
  }
  console.log(`原站 ${posts.length} 篇，本站缺 ${fresh.length} 篇\n`);
  if (!fresh.length) return;

  let listing = fs.readFileSync(LISTING, 'utf8');
  const cards = [];

  for (const p of fresh) {
    const slug = safeName(decode(p.slug));
    const names = p.categories.map(catName);
    const event = names.includes('活動訊息');
    console.log(`${p.date.slice(0, 10)}  ${slug}`);
    if (!WRITE) continue;

    let html = await get(p.link);

    /* Local paths, originals rather than WordPress's resized copies. */
    html = html
      .replace(/(?:https?:)?\/\/baidayi-enterprise\.com\/wp-content\/uploads\//g, '../wp-content/uploads/')
      .replace(/(\.\.\/wp-content\/uploads\/[^"'\s)]+?)-\d+x\d+(\.(?:jpe?g|png|webp|gif))/gi, '$1$2');

    const body = (html.match(/<div class="entry-content"[\s\S]*/) || [''])[0];
    const assets = new Set();
    for (const m of body.matchAll(/\.\.\/wp-content\/uploads\/([^"'\s),]+\.(?:jpe?g|png|webp|gif|mp4))/gi)) {
      assets.add(decode(m[1]));
    }

    let featured = '';
    if (p.featured_media) {
      const media = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/media/${p.featured_media}?_fields=source_url`));
      featured = decode(media.source_url.split('/wp-content/uploads/')[1]);
      assets.add(featured);
    }

    for (const rel of assets) {
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

    fs.mkdirSync(path.join(ROOT, slug), { recursive: true });
    fs.writeFileSync(path.join(ROOT, slug, 'index.html'), html);

    const title = text(p.title.rendered);
    const summary = text(p.excerpt.rendered).split(/(?<=[。！？])/)[0].slice(0, 70);
    const date = p.date.slice(0, 10);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    cards.push({ date, html:
      `      <a class="article-card reveal" href="../${slug}/index.html" data-news-category="${event ? 'event' : 'trend'}">` +
      `<div class="article-card-image"><img src="../wp-content/uploads/${featured}" alt="${esc(title)}" loading="lazy"></div>` +
      `<div class="article-card-copy"><span>${event ? '品牌動態' : '市場趨勢'}</span><h2>${esc(title)}</h2><p>${esc(summary)}</p>` +
      `<time datetime="${date}">${date.replace(/-/g, '.')}</time></div></a>` });
  }

  if (!WRITE) { console.log('\n加 --write 實際匯入。'); return; }
  if (REFRESH) { console.log('\n已重新下載，列表未變動。接著：node scripts/build-article-pages.js'); return; }

  /* Newest first, ahead of everything already in the grid. */
  cards.sort((a, b) => b.date.localeCompare(a.date));
  const anchor = '<div class="article-grid">\n';
  if (!listing.includes(anchor)) throw new Error('listing grid not found');
  listing = listing.replace(anchor, anchor + cards.map(c => c.html).join('\n') + '\n');
  fs.writeFileSync(LISTING, listing);
  console.log(`\n已匯入 ${cards.length} 篇，列表已加入卡片。接著：node scripts/build-article-pages.js`);
})().catch(e => { console.error(e.message); process.exit(1); });
