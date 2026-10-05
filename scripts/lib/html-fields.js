/* Editable text and images inside hand-built pages.
 *
 * An element carrying data-cms="區塊｜欄位" is a text field: its content is
 * plain text, where a line break is <br> (a trailing
 * <span aria-hidden="true">→</span> arrow is kept as decoration). An <img>
 * carrying data-cms-img="區塊｜欄位" is an image field, plus a "…說明" field
 * for its alt text when the image is not decorative.
 *
 * The label before the first ｜ is the section, the rest is the field; both
 * are what the CMS shows and the keys in the page's content file.
 *
 * Only fields whose value actually differs are rewritten, so a page whose
 * content matches its HTML comes out byte for byte the same.
 */
const path = require('path');

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'area', 'col', 'embed', 'track', 'param']);

/* A tag tree with source offsets; the pages are well-formed generated markup. */
function parse(src) {
  const root = { tag: '#root', children: [], start: 0, end: src.length };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(src))) {
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack[i].innerEnd = m.index; stack[i].end = re.lastIndex; stack.length = i; break; }
      }
      continue;
    }
    const node = { tag, attrs: m[3], start: m.index, openEnd: re.lastIndex, children: [], parent: stack[stack.length - 1] };
    node.parent.children.push(node);
    if (VOID.has(tag)) { node.end = re.lastIndex; continue; }
    stack.push(node);
    if (tag === 'script' || tag === 'style') re.lastIndex = src.indexOf('</' + tag, re.lastIndex);
  }
  return root;
}

const attr = (n, a) => { const m = (n.attrs || '').match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? m[1] : null; };
const walk = (n, f) => { f(n); n.children.forEach(c => walk(c, f)); };

const decode = s => s.replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const encode = s => String(s).split(/\r?\n/).map(line => esc(line.trim())).join('<br>');
const ARROW = /\s*<span aria-hidden="true">[^<]*<\/span>\s*$/;
/* tags whose text can run to a paragraph; the CMS gives them a multi-line box */
const LONG = new Set(['h1', 'h2', 'p', 'li', 'dd', 'small', 'figcaption', 'blockquote']);

function split(label) {
  const i = label.indexOf('｜');
  if (i < 1) throw new Error(`data-cms="${label}": expected "區塊｜欄位"`);
  // Sveltia CMS rejects field names with spaces, dots and the like
  if (/[\s.*[\]"'`]/.test(label)) throw new Error(`data-cms="${label}": no spaces or punctuation like . * [ ] in a label`);
  return [label.slice(0, i), label.slice(i + 1)];
}

/* "../assets/x.jpg" on a page in pageDir → "/assets/x.jpg" */
const rootPath = (src, pageDir) => '/' + path.posix.normalize(path.posix.join(pageDir, decodeURI(src)));

/* Every field on the page, in document order. */
function fieldsOf(html, pageDir) {
  const out = [];
  walk(parse(html), n => {
    const t = attr(n, 'data-cms');
    if (t && n.innerEnd != null) {
      const inner = html.slice(n.openEnd, n.innerEnd);
      const arrow = (inner.match(ARROW) || [''])[0];
      const body = inner.slice(0, inner.length - arrow.length);
      if (/<(?!br\b)/i.test(body)) throw new Error(`data-cms="${t}": content must be plain text`);
      const value = decode(body).trim();
      const eyebrow = /(^|\s)eyebrow(\s|$)/.test(attr(n, 'class') || '');
      out.push({ label: t, kind: 'text', node: n, value, long: (LONG.has(n.tag) && !eyebrow) || value.includes('\n') });
    }
    const i = attr(n, 'data-cms-img');
    if (i && n.tag === 'img') {
      out.push({ label: i, kind: 'img', node: n, value: rootPath(attr(n, 'src'), pageDir) });
      const alt = attr(n, 'alt');
      if (alt) out.push({ label: i + '說明', kind: 'alt', node: n, value: decode(alt) });
    }
  });
  const seen = new Set();
  for (const f of out) {
    if (seen.has(f.label)) throw new Error(`two fields labelled "${f.label}"`);
    seen.add(f.label);
    [f.section, f.name] = split(f.label);
  }
  return out;
}

/* Rewrite the fields whose value in `values` ({section: {field: value}})
   differs from the page. `opts`: pageDir, imageSize(rootPath) → [w, h]|null,
   exists(rootPath) → bool, site (absolute URL of the site root). */
function applyFields(html, values, opts) {
  const fields = fieldsOf(html, opts.pageDir);
  const prefix = opts.pageDir === '.' ? './' : '../'.repeat(opts.pageDir.split('/').length);
  const rel = p => prefix + p.replace(/^\//, '');
  const edits = [];
  const imgs = new Map();
  for (const f of fields) {
    const v = values[f.section] && values[f.section][f.name];
    if (v == null || String(v).trim() === '' || String(v).trim() === f.value) continue;
    const n = f.node;
    if (f.kind === 'text') {
      const inner = html.slice(n.openEnd, n.innerEnd);
      const arrow = (inner.match(ARROW) || [''])[0];
      const lead = inner.match(/^\s*/)[0];
      const trail = inner.slice(0, inner.length - arrow.length).match(/\s*$/)[0];
      edits.push([n.openEnd, n.innerEnd, lead + encode(String(v).trim()) + trail + arrow]);
    } else {
      const e = imgs.get(n) || {};
      if (f.kind === 'img') e.src = String(v).trim(); else e.alt = String(v).trim();
      imgs.set(n, e);
    }
  }
  for (const [n, e] of imgs) {
    let tag = html.slice(n.start, n.end);
    if (e.alt != null) tag = tag.replace(/\salt="[^"]*"/, ` alt="${esc(e.alt)}"`);
    if (e.src) {
      if (!opts.exists(e.src)) throw new Error(`${attr(n, 'data-cms-img')}: ${e.src} does not exist`);
      const size = opts.imageSize(e.src);
      const small = e.src.replace(/(\.[a-z]+)$/i, '-640$1');
      tag = tag.replace(/\ssrc="[^"]*"/, ` src="${esc(rel(e.src))}"`);
      if (/\ssrcset="/.test(tag)) {
        tag = size && opts.exists(small)
          ? tag.replace(/\ssrcset="[^"]*"/, ` srcset="${esc(rel(small))} 640w, ${esc(rel(e.src))} ${size[0]}w"`)
          : tag.replace(/\ssrcset="[^"]*"/, '').replace(/\ssizes="[^"]*"/, '');
      }
      if (/\swidth="/.test(tag)) {
        tag = size ? tag.replace(/\swidth="[^"]*"/, ` width="${size[0]}"`).replace(/\sheight="[^"]*"/, ` height="${size[1]}"`)
          : tag.replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '');
      }
      // a thumbnail that opens the full image (the certificate cards): point
      // the link at the original, not WordPress's resized copy, if it is there
      let a = n.parent;
      for (let up = 0; a && a.tag !== 'a' && up < 3; up++) a = a.parent;
      if (a && a.tag === 'a' && /\.(jpe?g|png|webp)$/i.test(attr(a, 'href') || '')) {
        const full = e.src.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
        edits.push([a.start, a.openEnd, html.slice(a.start, a.openEnd).replace(/\shref="[^"]*"/, ` href="${esc(rel(opts.exists(full) ? full : e.src))}"`)]);
      }
      // the page's hero is also its share preview
      if (/inner-hero-media/.test(attr(n.parent, 'class') || '')) {
        const og = html.match(/<meta property="og:image" content="[^"]*">/);
        if (og) edits.push([og.index, og.index + og[0].length, `<meta property="og:image" content="${esc(opts.site + e.src.replace(/^\//, ''))}">`]);
      }
    }
    edits.push([n.start, n.end, tag]);
  }
  edits.sort((a, b) => b[0] - a[0]);
  for (const [s, e, r] of edits) html = html.slice(0, s) + r + html.slice(e);
  return html;
}

/* The page's current values, grouped by section: {section: {field: value}}. */
function valuesOf(html, pageDir) {
  const out = {};
  for (const f of fieldsOf(html, pageDir)) (out[f.section] = out[f.section] || {})[f.name] = f.value;
  return out;
}

/* CMS field definitions for the page's sections, in page order. */
function cmsFields(html, pageDir) {
  const sections = new Map();
  for (const f of fieldsOf(html, pageDir)) {
    if (!sections.has(f.section)) sections.set(f.section, []);
    const def = { label: f.name, name: f.name };
    if (f.kind === 'img') {
      Object.assign(def, { widget: 'image' });
      if (f.value.startsWith('/wp-content/uploads/')) Object.assign(def, { media_folder: '/wp-content/uploads', public_folder: '/wp-content/uploads' });
    } else if (f.kind === 'alt') {
      Object.assign(def, { widget: 'string', required: false, hint: '給看不到圖片的讀者（例如螢幕閱讀器）。' });
    } else {
      Object.assign(def, { widget: f.long ? 'text' : 'string' });
      if (f.value.includes('\n')) def.hint = '換行會照樣換行。';
    }
    sections.get(f.section).push(def);
  }
  return [...sections].map(([name, fields]) => ({ label: name, name, widget: 'object', collapsed: true, fields }));
}

module.exports = { parse, fieldsOf, applyFields, valuesOf, cmsFields, decode, encode };
