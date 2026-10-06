/* Homepage content and CMS round-trip contracts. Visual QA is performed locally. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const fields = require('./lib/html-fields');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = matter(fs.readFileSync(path.join(root, 'content/pages/home.md'), 'utf8')).data;

test('homepage preserves the full-background factory film and company identity', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /百達醫，<br>保健食品研發與製造/);
  assert.match(html, /class="hero section-dark"/);
  assert.match(html, /<div class="hero-media"[^>]*><video data-hero-video muted loop playsinline preload="none"/);
  assert.match(html, /poster="\.\/assets\/brand\/factory-cleanroom.jpg"/);
  assert.match(html, /<source data-src="\.\/assets\/brand\/factory-loop.mp4" type="video\/mp4">/);
});

test('all homepage editable values agree with their CMS source', () => {
  const values = fields.valuesOf(html, '.');
  for (const [section, valuesInSection] of Object.entries(values)) {
    for (const [name, value] of Object.entries(valuesInSection)) assert.equal(data[section]?.[name], value, section + ' / ' + name);
  }
  const roundTrip = fields.applyFields(html, data, {
    pageDir: '.', site: 'https://shengge820.github.io/baidayi-premium-redesign/',
    exists: value => fs.existsSync(path.join(root, value.replace(/^\//, ''))),
    imageSize: () => null
  });
  assert.equal(roundTrip, html);
});

test('homepage preserves accessible landmarks, descriptions and fragment destinations', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate DOM id');
  for (const m of html.matchAll(/\b(?:aria-labelledby|href)="(#?[^" ]+)"/g)) {
    if (m[0].startsWith('aria-labelledby=') || m[1].startsWith('#')) assert.ok(ids.includes(m[1].replace(/^#/, '')), m[0]);
  }
  for (const m of html.matchAll(/<img\b[^>]+>/g)) assert.match(m[0], /\balt="[^"]+"/);
});

test('factory media remain local and the loader respects motion and data preferences', () => {
  for (const file of ['assets/brand/factory-loop.mp4', 'assets/brand/factory-cleanroom.jpg']) assert.ok(fs.existsSync(path.join(root, file)));
  const loader = fs.readFileSync(path.join(root, 'premium-site.js'), 'utf8');
  assert.match(loader, /prefers-reduced-motion: reduce/);
  assert.match(loader, /navigator.connection.saveData/);
  assert.match(loader, /if \(!reduceMotion && !saveData\)/);
});
