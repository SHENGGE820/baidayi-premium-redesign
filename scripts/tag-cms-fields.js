/* Tags the plain-text elements and images on a hand-built page with
 * data-cms / data-cms-img labels, so scripts/build-site.js makes them
 * editable in the CMS. Run it when a new page is added to PAGES in
 * build-site.js, or a new section to an existing page; review the printed
 * labels first, then write them.
 *
 *   node scripts/tag-cms-fields.js <page.html>           show proposed labels
 *   node scripts/tag-cms-fields.js <page.html> --write   add them
 *   EXCLUDE=article.service-overview-card node …        skip cards that a
 *                                                      build step generates
 *
 * Labels are "區塊｜欄位": the section comes from its heading, repeated items
 * (steps, cards, FAQ entries) are numbered, and elements already tagged are
 * left alone. Labels can be edited by hand afterwards; the build moves the
 * value to the new name.
 */
const fs = require('fs');
const file = process.argv[2];
const WRITE = process.argv.includes('--write');
let html = fs.readFileSync(file, 'utf8');

const { parse } = require('./lib/html-fields');
const cls = n => ((n.attrs || '').match(/class="([^"]*)"/) || [, ''])[1];
const attr = (n, a) => ((n.attrs || '').match(new RegExp(`\\s${a}="([^"]*)"`)) || [, null])[1];
const walk = (n, f) => { f(n); n.children.forEach(c => walk(c, f)); };
const find = (n, p) => { let r = null; walk(n, x => { if (!r && p(x)) r = x; }); return r; };

const decode = s => s.replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const ARROW = /\s*<span aria-hidden="true">[^<]*<\/span>\s*$/;
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'strong', 'small', 'span', 'figcaption', 'dt', 'dd', 'a', 'em', 'b', 'summary', 'blockquote', 'button']);
const latin = t => /[A-Za-z]{2}/.test(t) && !/[一-鿿]/.test(t);
const short = t => decode(t.replace(/<[^>]+>/g, '')).replace(/\s+/g, '').split(/[，。、？！：；]/)[0].slice(0, 12);

const tree = parse(html);
const existing = new Set([...html.matchAll(/\sdata-cms(?:-img)?="([^"]+)"/g)].map(m => m[1]));
const main = find(tree, n => n.tag === 'main');
const skipNodes = [];
for (const m of html.matchAll(/<!-- cms:([a-z-]+) -->[\s\S]*?<!-- \/cms:\1 -->/g)) skipNodes.push([m.index, m.index + m[0].length]);
const skipped = n => skipNodes.some(([a, b]) => n.start >= a && n.start < b) || (() => { for (let p = n; p; p = p.parent) if (['form', 'nav'].includes(p.tag) || (n.tag !== 'img' && /aria-hidden="true"/.test(p.attrs || ''))) return true; return false; })();

/* the innermost ancestor that repeats among its siblings (same tag and first class) */
function itemOf(n, section) {
  for (let p = n.parent; p && p !== section; p = p.parent) {
    const first = cls(p).split(' ').filter(c => c !== 'reveal')[0] || '';
    if (p.tag === 'p' || (!first && !['li', 'article', 'details'].includes(p.tag))) continue;
    const key = p.tag + '.' + first;
    const sibs = p.parent.children.filter(c => c.tag + '.' + (cls(c).split(' ').filter(x => x !== 'reveal')[0] || '') === key);
    if (sibs.length >= 2) return { node: p, group: p.parent, key, index: sibs.indexOf(p) + 1 };
  }
  return null;
}
const ITEM_WORD = { 'article.proof-item': '數據N', 'li.process-step': '步驟N', 'article.certification-card': '認證N', 'div.contact-detail': '聯絡N', 'details.faq-item': '問答N', 'a.catalogue-card': '卡片N', 'div.quality-row': '第N列', 'article.research-pillar': '重點N', 'a.certificate-evidence-card': '證書N' };
// cards a later build step generates from their own content
const EXCLUDE = (process.env.EXCLUDE || '').split(',').filter(Boolean);

const marks = [];
main.children.forEach((section, si) => {
  if (section.tag === 'nav' || skipped(section)) return;
  const c = cls(section);
  const isHero = /(^|\s)(hero|inner-hero|news-masthead|contact-masthead)(\s|$)/.test(c);
  const isCta = /project-cta/.test(c);
  const h2 = find(section, n => n.tag === 'h2');
  let label = isHero ? '主視覺' : isCta ? '頁尾諮詢' : h2 ? short(html.slice(h2.openEnd, h2.innerEnd)) : (attr(section, 'aria-label') || '區塊' + (si + 1));
  // a section that already has fields keeps the name it was given
  const tagged = html.slice(section.start, section.end).match(/\sdata-cms(?:-img)?="([^"｜]+)｜/);
  if (tagged) label = tagged[1];
  const used = {};
  // numbered without a space (the CMS rejects spaces in names), skipping labels already on the page
  const name = base => {
    let k = (used[base] || 0) + 1;
    while (existing.has(`${label}｜${k > 1 ? base + k : base}`)) k++;
    used[base] = k;
    return k > 1 ? base + k : base;
  };
  let scope = label;               // changes when a later h2 opens a sub-section
  const groupNames = new Map();    // repeated groups → their word
  walk(section, n => {
    if (n === section || skipped(n)) return;
    for (let q = n; q; q = q.parent) if (EXCLUDE.includes(q.tag + '.' + cls(q).split(' ').filter(x => x !== 'reveal')[0])) return;
    if (n.tag === 'h2' && n !== h2 && !itemOf(n, section)) scope = short(html.slice(n.openEnd, n.innerEnd));
    if (/\sdata-cms(?:-img)?="/.test(n.attrs || '')) return;     // already a field
    const item = itemOf(n, section);
    let prefix = '';
    if (item) {
      if (!groupNames.has(item.group)) {
        const word = ITEM_WORD[item.key] || '第N項';
        const taken = [...groupNames.values()].some(w => w.word === word && w.scope === scope);
        groupNames.set(item.group, { word, scope, alt: taken ? '另一組' : '' });
      }
      const g = groupNames.get(item.group);
      prefix = (g.alt ? g.alt : '') + g.word.replace('N', item.index) + '｜';
    }
    const within = (scope !== label ? scope + '｜' : '') + prefix;
    if (n.tag === 'img') {
      const role = /inner-hero-media|hero-media/.test(cls(n.parent)) ? '背景圖' : '圖片';
      marks.push({ n, kind: 'img', label: `${label}｜${name(within + role)}`, text: attr(n, 'src'), key: item && item.key });
      return;
    }
    if (!TEXT_TAGS.has(n.tag) || n.innerEnd == null) return;
    const inner = html.slice(n.openEnd, n.innerEnd).replace(ARROW, '');
    if (/<(?!br\b)/i.test(inner)) return;              // has inline markup: not plain text
    const text = decode(inner).trim();
    if (!text || /^[\d.+\s/]{1,4}$/.test(text) || /^[→↗↓←\s]+$/.test(text) || text === 'SCROLL') return;
    if (/\sdata-(?!cms)[a-z-]+/.test(n.attrs || '')) return;
    if (/^(tel:|mailto:)/.test(attr(n, 'href') || '') || text === '新北市新莊區新北大道四段 187 號 15 樓') return;
    const ec = cls(n);
    const role = /catalogue-more/.test(ec) ? '連結文字' : /eyebrow|catalogue-en/.test(ec) || (n.tag === 'span' && latin(text)) ? (latin(text) ? '英文小標' : '小標')
      : ['h1', 'h2', 'h3', 'h4', 'strong', 'summary', 'dt'].includes(n.tag) ? '標題'
      : n.tag === 'a' || n.tag === 'button' ? '連結文字' : n.tag === 'small' ? '小字' : n.tag === 'li' ? '項目'
      : n.tag === 'figcaption' ? '圖說' : n.tag === 'span' ? '小標' : '說明';
    marks.push({ n, kind: 'text', label: `${label}｜${name(within + role)}`, text, key: item && item.key });
  });
});
marks.sort((a, b) => a.n.start - b.n.start);
for (const k of marks) console.log(`${k.kind === 'img' ? '[img]' : '     '} ${k.label.padEnd(26)} → ${String(k.text).replace(/\n/g, '⏎').slice(0, 50)}`);
if (process.argv.includes('--keys')) { const ks = {}; marks.forEach(k => { if (k.key) ks[k.key] = (ks[k.key] || 0) + 1; }); console.log('GROUPS', JSON.stringify(ks)); }
const dup = marks.map(k => k.label).filter((l, i, a) => a.indexOf(l) !== i);
console.log(`\n${marks.length} fields${dup.length ? '  DUPLICATES: ' + dup.join(', ') : ''}`);
if (WRITE) {
  for (const k of [...marks].reverse()) {
    const at = k.n.start + 1 + k.n.tag.length;
    html = html.slice(0, at) + (k.kind === 'img' ? ` data-cms-img="${k.label}"` : ` data-cms="${k.label}"`) + html.slice(at);
  }
  fs.writeFileSync(file, html);
  console.log('written');
}
