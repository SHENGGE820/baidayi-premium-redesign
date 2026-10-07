/* content/support-faq.json is the only editable FAQ source. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'content', 'support-faq.json');
const OUTPUT = path.join(ROOT, 'premium-support-knowledge.js');
const EXTERNAL_LINKS = new Set(['https://shengge820.github.io/supplement-oem-quote/#est']);

function fail(where, message) { throw new Error(`support-faq.json ${where}: ${message}`); }
function object(value, where, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(where, 'must be an object');
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(where, 'contains an unknown field');
}
function text(value, where, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(where, `must be nonempty text up to ${max} characters`);
}
function safeLink(href, where, root) {
  text(href, where, 600);
  if (EXTERNAL_LINKS.has(href)) return;
  if (href.trim() !== href || /[\\\u0000]/.test(href) || /^[\/#]|^[a-z][a-z0-9+.-]*:/i.test(href)) fail(where, 'must use a site-root-relative file or the approved demo URL');
  const rawPath = href.split(/[?#]/)[0];
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { fail(where, 'invalid URL encoding'); }
  if (!decoded || decoded.startsWith('/') || decoded.includes('\\') || decoded.split('/').some(part => part === '.' || part === '..' || part.startsWith('.')) || /%[a-f0-9]{2}/i.test(decoded)) fail(where, 'unsafe file path');
  const target = path.resolve(root, decoded);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(where, 'file is outside the website');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile() || path.extname(target).toLowerCase() !== '.html') fail(where, 'HTML destination does not exist');
}

function validateKnowledge(data, root = ROOT) {
  object(data, 'root', ['version', 'faqs']);
  if (typeof data.version !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.version)) fail('version', 'must be YYYY-MM-DD');
  if (!Array.isArray(data.faqs) || !data.faqs.length || data.faqs.length > 100) fail('faqs', 'must contain 1 to 100 entries');
  const ids = new Set();
  data.faqs.forEach((faq, index) => {
    const at = `faqs[${index}]`;
    object(faq, at, ['id', 'question', 'aliases', 'answer', 'links']);
    if (typeof faq.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(faq.id) || ids.has(faq.id)) fail(`${at}.id`, 'must be a unique lowercase identifier');
    ids.add(faq.id);
    text(faq.question, `${at}.question`, 300);
    text(faq.answer, `${at}.answer`, 4000);
    if (!Array.isArray(faq.aliases) || !faq.aliases.length || faq.aliases.length > 100) fail(`${at}.aliases`, 'must contain 1 to 100 aliases');
    faq.aliases.forEach((alias, aliasIndex) => text(alias, `${at}.aliases[${aliasIndex}]`, 100));
    if (!Array.isArray(faq.links) || faq.links.length > 10) fail(`${at}.links`, 'must be an array of up to 10 links');
    faq.links.forEach((link, linkIndex) => {
      const linkAt = `${at}.links[${linkIndex}]`;
      object(link, linkAt, ['label', 'href']);
      text(link.label, `${linkAt}.label`, 120);
      safeLink(link.href, `${linkAt}.href`, root);
    });
  });
  return data;
}

function renderKnowledge(data) {
  // Also safe if a future consumer embeds this generated source inline.
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return '/* Generated from content/support-faq.json. Edit that source and run npm run build:support. */\nwindow.BKE_SUPPORT_KNOWLEDGE = ' + json + ';\n';
}

function buildSupportKnowledge(options = {}) {
  const data = validateKnowledge(JSON.parse(fs.readFileSync(SOURCE, 'utf8').replace(/^\uFEFF/, '')));
  const generated = renderKnowledge(data);
  const previous = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (options.check && previous !== generated) throw new Error('FAQ source and generated knowledge differ. Run npm run build:support.');
  if (!options.check && previous !== generated) fs.writeFileSync(OUTPUT, generated);
  console.log(`support: ${data.faqs.length} FAQs (${options.check ? 'consistent' : previous === generated ? 'unchanged' : 'generated'})`);
}
module.exports = { validateKnowledge, renderKnowledge, buildSupportKnowledge };
if (require.main === module) buildSupportKnowledge({ check: process.argv.includes('--check') });
