/* Lists image files no live page references any more.
 *
 * scripts/optimise-images.js re-encoded 29 oversized images and repointed the
 * pages at the new files, deliberately leaving the originals in place so the
 * change was reversible. They cost nothing at page load — nothing links to
 * them — but they do sit in the repo and the deploy.
 *
 *   node scripts/audit-unused-assets.js           list them
 *   node scripts/audit-unused-assets.js --delete  remove them
 *
 * Git keeps the history either way, so a delete is recoverable.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DELETE = process.argv.includes('--delete');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scripts'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

const all = walk(ROOT);

/* Search for each candidate's filename rather than trying to enumerate every
 * filename the markup contains.
 *
 * The enumerate-then-compare approach was wrong here: it needs a regex for
 * "what a filename looks like", and any character missing from that class
 * silently turns a live file into a deletion candidate. Mine omitted "@", so
 * pie@2x.png and 47 others were reported unused and deleted — restored from
 * git, hence this rewrite.
 *
 * Substring search over the raw text has no such failure mode. It can only
 * err toward keeping a file, which is the right direction when the
 * alternative is deleting something the site still loads. */
const TEXT = /\.(html|css|js|json|xml|svg|txt|md)$/i;
const haystack = all
  .filter(f => TEXT.test(f))
  .map(f => fs.readFileSync(f, 'utf8'))
  .join('\n');

function isReferenced(base) {
  if (haystack.includes(base)) return true;
  try { if (haystack.includes(decodeURIComponent(base))) return true; } catch (e) { /* bad escape */ }
  if (haystack.includes(encodeURIComponent(base))) return true;
  return false;
}

const orphans = [];
for (const f of all) {
  if (!/\.(png|jpe?g|webp|gif)$/i.test(f)) continue;
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (!rel.startsWith('wp-content/uploads') && !rel.startsWith('assets/')) continue;
  if (isReferenced(path.basename(f))) continue;
  orphans.push({ rel, bytes: fs.statSync(f).size });
}
orphans.sort((a, b) => b.bytes - a.bytes);

const total = orphans.reduce((s, o) => s + o.bytes, 0);
console.log(`${orphans.length} unreferenced image file(s), ${(total / 1024 / 1024).toFixed(1)}MB\n`);
for (const o of orphans.slice(0, 20)) {
  console.log(`  ${String(Math.round(o.bytes / 1024)).padStart(6)}KB  ${o.rel}`);
}
if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`);

if (DELETE) {
  for (const o of orphans) fs.unlinkSync(path.join(ROOT, o.rel));
  console.log(`\nDeleted ${orphans.length} file(s), freeing ${(total / 1024 / 1024).toFixed(1)}MB.`);
} else if (orphans.length) {
  console.log('\nRun with --delete to remove them. Git history keeps them either way.');
}
