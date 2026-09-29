/* Removes CSS for classes that no live page or script produces.
 *
 * Components get removed from the markup — the old solutions dropdown, the
 * homepage's stage cards and function showcase, the WordPress compatibility
 * layer — and their styles linger, which makes the stylesheets harder to read
 * and every later change riskier, since nobody can tell which rules still
 * matter.
 *
 * A class counts as used if its name appears as a token anywhere in the live
 * HTML or JS (class attributes, classList calls, selector strings) — erring
 * toward keeping. Within a rule only the selectors naming a dead class are
 * dropped; the rule survives if any selector remains. @keyframes and
 * @font-face are left alone.
 *
 *   node scripts/prune-css.js           report
 *   node scripts/prune-css.js --write   apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const FILES = ['premium-site.css', 'premium-inner.css', 'premium-motion.css'];

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts', 'wp-content', 'wp-includes', 'assets'].includes(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o); else if (/\.(html|js)$/.test(e.name)) o.push(f);
  }
  return o;
}
const corpus = walk(ROOT)
  .filter(f => !(f.endsWith('.html') && fs.readFileSync(f, 'utf8').includes('http-equiv="refresh"')))
  .map(f => fs.readFileSync(f, 'utf8')).join('\n');
const usedCache = new Map();
const used = cls => {
  if (!usedCache.has(cls)) usedCache.set(cls, new RegExp(`(^|[^a-z0-9_-])${cls.replace(/-/g, '\\-')}([^a-z0-9_-]|$)`, 'i').test(corpus));
  return usedCache.get(cls);
};
const deadIn = sel => [...sel.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map(m => m[1]).filter(c => !used(c));

/* Split a stylesheet into top-level items: comments, rules, at-blocks. */
function parse(css) {
  const items = [];
  let i = 0;
  while (i < css.length) {
    const ws = css.slice(i).match(/^\s+/);
    if (ws) { items.push({ type: 'ws', text: ws[0] }); i += ws[0].length; continue; }
    if (css.startsWith('/*', i)) {
      const e = css.indexOf('*/', i) + 2;
      items.push({ type: 'comment', text: css.slice(i, e) }); i = e; continue;
    }
    const brace = css.indexOf('{', i);
    const semi = css.indexOf(';', i);
    if (semi >= 0 && (brace < 0 || semi < brace)) {   // @import / @charset
      items.push({ type: 'stmt', text: css.slice(i, semi + 1) }); i = semi + 1; continue;
    }
    // find the matching close brace
    let depth = 0, j = brace;
    for (; j < css.length; j++) {
      if (css.startsWith('/*', j)) { j = css.indexOf('*/', j) + 1; continue; }
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (depth === 0) break; }
    }
    const prelude = css.slice(i, brace);
    const inner = css.slice(brace + 1, j);
    items.push(prelude.trim().startsWith('@')
      ? { type: 'at', prelude, inner }
      : { type: 'rule', prelude, inner });
    i = j + 1;
  }
  return items;
}

const removed = [];
function prune(items, ctx) {
  const out = [];
  for (const it of items) {
    if (it.type === 'rule') {
      const sels = it.prelude.split(',');
      const keep = sels.filter(s => deadIn(s).length === 0);
      if (keep.length === sels.length) { out.push(it); continue; }
      sels.filter(s => !keep.includes(s)).forEach(s => removed.push(`${ctx}${s.trim().replace(/\s+/g, ' ')}`));
      if (keep.length) out.push({ ...it, prelude: keep.join(',').replace(/^\s*\n/, '') });
      else out.push({ type: 'gone' });
      continue;
    }
    if (it.type === 'at' && /^\s*@(media|supports)/.test(it.prelude)) {
      const inner = prune(parse(it.inner), ctx + it.prelude.trim() + ' ');
      if (inner.every(x => x.type === 'ws' || x.type === 'gone' || x.type === 'comment')
          && inner.some(x => x.type === 'gone')) { out.push({ type: 'gone' }); continue; }
      out.push({ ...it, inner: serialize(inner) });
      continue;
    }
    out.push(it);
  }
  /* A comment directly followed by nothing but removed rules described them;
     drop it too, so no explanation outlives what it explains. */
  for (let k = 0; k < out.length; k++) {
    if (out[k].type !== 'comment') continue;
    let m = k + 1, sawGone = false, sawLive = false;
    while (m < out.length && out[m].type !== 'comment') {
      if (out[m].type === 'gone') sawGone = true;
      else if (out[m].type !== 'ws') { sawLive = true; break; }
      m++;
    }
    if (sawGone && !sawLive) out[k] = { type: 'gone' };
  }
  return out;
}
function serialize(items) {
  let s = '';
  for (const it of items) {
    if (it.type === 'gone') continue;
    if (it.type === 'ws' || it.type === 'comment' || it.type === 'stmt') s += it.text;
    else s += it.prelude + '{' + it.inner + '}';
  }
  return s.replace(/\n{3,}/g, '\n\n');
}

let before = 0, after = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const n0 = removed.length;
  const out = serialize(prune(parse(src), ''));
  before += src.length; after += out.length;
  console.log(`\n${f}: ${removed.length - n0} selectors removed, ${src.length} → ${out.length} bytes`);
  removed.slice(n0).forEach(r => console.log('   - ' + r.slice(0, 110)));
  if (WRITE) fs.writeFileSync(path.join(ROOT, f), out);
}
console.log(`\n合計 ${removed.length} 個選擇器，${before} → ${after} bytes${WRITE ? '' : '（加 --write 實際寫入）'}`);
