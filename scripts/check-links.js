/* Every internal link, script, stylesheet, image and video on every page must
 * resolve to a file that exists.
 *
 *   node scripts/check-links.js
 *
 * Exits 1 on any broken reference. Run it after anything that moves, renames
 * or deletes files — image optimisation, imports, asset cleanups.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts'].includes(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (e.name.endsWith('.html')) o.push(f);
  }
  return o;
}

const bad = [];
let links = 0, assets = 0, pages = 0;

for (const f of walk(ROOT)) {
  pages++;
  const c = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  const rel = path.relative(ROOT, f).split(path.sep).join('/');

  const check = (u, kind) => {
    if (!u || /^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(u)) return;
    const clean = u.split('#')[0].split('?')[0];
    if (!clean) return;
    let t;
    try { t = path.resolve(dir, decodeURIComponent(clean)); } catch (e) { t = path.resolve(dir, clean); }
    if (kind === 'link') links++; else assets++;
    if (fs.existsSync(t) || fs.existsSync(path.join(t, 'index.html'))) return;
    bad.push(`${kind === 'link' ? '連結' : '資源'}  ${rel}  →  ${u}`);
  };

  for (const m of c.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) check(m[1], 'link');
  for (const m of c.matchAll(/<(?:script|img|iframe|source|video)\b[^>]*\s(?:data-)?src="([^"]*)"/gi)) check(m[1], 'asset');
  for (const m of c.matchAll(/\sposter="([^"]*)"/gi)) check(m[1], 'asset');
  for (const m of c.matchAll(/<link\b[^>]*\shref="([^"]*)"/gi)) {
    if (!/rel="canonical"/i.test(m[0])) check(m[1], 'asset');
  }
  for (const m of c.matchAll(/url\(\s*['"]?([^'")]+)/gi)) {
    if (/\.(png|jpe?g|webp|gif|svg|woff2?)$/i.test(m[1])) check(m[1], 'asset');
  }
}

console.log(`${pages} 頁：連結 ${links} 筆、資源 ${assets} 筆，失效 ${bad.length} 筆`);
bad.slice(0, 30).forEach(x => console.log('  ✗ ' + x));
if (bad.length > 30) console.log(`  … 其餘 ${bad.length - 30}`);
process.exit(bad.length ? 1 : 0);
