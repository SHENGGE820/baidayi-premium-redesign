/* Replaces the leftover WordPress pages with redirects to their premium
 * equivalents.
 *
 * These 19 pages survived the migration unreferenced: nothing in the premium
 * site links to them, but their URLs are still live, still carry the old
 * Enfold layout, and are still in search-engine caches and whatever anyone
 * bookmarked. They were given noindex, which stops them being found again but
 * does nothing for someone arriving on an old link — they land on the ugly
 * pre-redesign page and have no way across to the new site.
 *
 * Redirecting rather than deleting: a delete turns every one of those old
 * links into a 404. A redirect keeps them working and passes the ranking
 * signal to the page that replaced it.
 *
 * GitHub Pages serves static files only, so there is no 301 available. The
 * stub does the three things a static host can:
 *
 *   meta refresh   works with JS disabled; Google treats a 0-second refresh
 *                  as a permanent redirect
 *   canonical      names the replacement explicitly
 *   location.replace   instant, and leaves no history entry, so Back does not
 *                  bounce the visitor straight back into the redirect
 *
 * No noindex here: that would tell crawlers to drop the URL rather than
 * follow it to the successor, which is the opposite of the intent.
 *
 *   node scripts/build-legacy-redirects.js          report
 *   node scripts/build-legacy-redirects.js --write  apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SITE = 'https://shengge820.github.io/baidayi-premium-redesign/';

/* Each legacy path and the premium page that now covers it. Archive pages
   (dates, categories, tags, authors) all collapse onto the news listing,
   which is the only index of posts the new site has. */
const MAP = {
  '2026/03': '最新消息',
  '2026/08': '最新消息',
  'category/最新消息': '最新消息',
  'category/最新消息/市場趨勢': '最新消息',
  'category/最新消息/活動訊息': '最新消息',
  'tag/市場趨勢': '最新消息',
  'tag/活動訊息': '最新消息',
  'author/bke-biz01': '最新消息',
  'author/supervisor01': '最新消息',

  '全面性服務': '全面性服務/一站式服務',
  '全面性服務/一站式服務/0806-2': '全面性服務/一站式服務',
  'integrated-service': '全面性服務/一站式服務',

  '認識百達醫': '認識百達醫/關於百達醫',

  /* 養顏美容 and 膠原蛋白 were single-topic pages; the functional-formula
     page is where that ground is covered now. */
  '養顏美容': '全面性服務/功能配方',
  'product/膠原蛋白': '全面性服務/功能配方',

  /* No shop on the new site — it sells nothing directly. Home is the honest
     destination rather than pretending a replacement exists. */
  'shop': '',
  'product-category/未分類': '',
  '測試': '',

  'contact_thankyou': 'contact',

  /* The old static search page, and the only thing that linked to it was the
     legacy header. Nothing in the premium site searches. */
  'search.html': '',

  /* A QA artefact from the static export — a bare list of every exported page,
     still in the pre-redesign yellow. Nothing links to it, but it is publicly
     reachable, and an internal checklist is not something a client's brand
     site should be serving. */
  'site-map.html': '',
};

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function stub(relHref, absHref, label) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>已搬遷｜百達醫 BKE</title>
<link rel="canonical" href="${esc(absHref)}">
<meta http-equiv="refresh" content="0; url=${esc(relHref)}">
<style>
  html{background:#171713}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#171713;color:#f4f0e7;text-align:center;padding:24px;
       font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
  a{color:#d9b875}
</style>
</head>
<body>
<p>此頁面已整合至<a href="${esc(relHref)}">${esc(label)}</a>，正在為您轉向…</p>
<script>location.replace(${JSON.stringify(relHref)});</script>
</body>
</html>
`;
}

const LABELS = {
  '': '首頁',
  '最新消息': '最新消息',
  '全面性服務/一站式服務': '一站式服務',
  '認識百達醫/關於百達醫': '關於百達醫',
  '全面性服務/功能配方': '功能配方',
  'contact': '專案諮詢',
};

let done = 0;
for (const [from, to] of Object.entries(MAP)) {
  const file = from.endsWith('.html') ? path.join(ROOT, from) : path.join(ROOT, from, 'index.html');
  if (!fs.existsSync(file)) { console.log(`  略過（找不到）  ${from}`); continue; }

  const current = fs.readFileSync(file, 'utf8');
  if (current.includes('http-equiv="refresh"')) { console.log(`  已是轉址  ${from}`); continue; }
  if (current.includes('data-premium-header')) {
    console.log(`  !! 拒絕：${from} 是 premium 頁，不會覆寫`);
    continue;
  }

  const fromDir = from.endsWith('.html') ? path.posix.dirname(from) : from;
  const depth = fromDir === '.' ? 0 : fromDir.split('/').length;
  const up = depth ? '../'.repeat(depth) : './';
  const relHref = to ? up + to + '/' : up;
  const absHref = SITE + (to ? to + '/' : '');

  if (WRITE) fs.writeFileSync(file, stub(relHref, absHref, LABELS[to] || to));
  done++;
  console.log(`  ${from.padEnd(34)} → ${to || '（首頁）'}`);
}

console.log(`\n${done} 頁${WRITE ? '已轉為轉址' : '待轉為轉址'}。`);
if (!WRITE && done) console.log('加 --write 實際寫入。');
