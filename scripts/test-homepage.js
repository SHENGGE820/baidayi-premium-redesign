/* Homepage content and CMS round-trip contracts. Visual QA is performed locally. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const vm = require('node:vm');
const fields = require('./lib/html-fields');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = matter(fs.readFileSync(path.join(root, 'content/pages/home.md'), 'utf8')).data;

test('homepage preserves the full-background factory film and company identity', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /保健食品代工，<br>配方到包裝一站完成。/);
  assert.match(html, /class="hero section-dark"/);
  assert.match(html, /<div class="hero-media"[^>]*>\s*<video data-hero-video muted loop playsinline preload="none"/);
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

test('factory media remain local', () => {
  for (const file of ['assets/brand/factory-loop.mp4', 'assets/brand/factory-cleanroom.jpg']) assert.ok(fs.existsSync(path.join(root, file)));
});

function runHomepageLoader({ reducedMotion = false, saveData = false, refusePlay = false } = {}) {
  const state = { loads: 0, plays: 0, handledRejections: 0, observers: 0, revealed: false };
  const listeners = {};
  const source = { getAttribute: () => './assets/brand/factory-loop.mp4' };
  const video = {
    paused: true,
    querySelector: () => source,
    load: () => { state.loads++; },
    play: () => {
      state.plays++;
      return { catch: handler => {
        if (refusePlay) { state.handledRejections++; handler(new Error('Autoplay refused')); }
      } };
    }
  };
  const document = {
    visibilityState: 'visible',
    body: { classList: { contains: () => false } },
    querySelector: selector => selector === '[data-hero-video]' ? video : null,
    querySelectorAll: selector => selector === '.reveal' ? [{ classList: { add: () => { state.revealed = true; } } }] : [],
    addEventListener: (type, callback) => { listeners[type] = callback; }
  };
  class Observer {
    constructor() { state.observers++; }
    observe() {}
    unobserve() {}
  }
  const window = { matchMedia: () => ({ matches: reducedMotion }), addEventListener() {}, IntersectionObserver: Observer };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'premium-site.js'), 'utf8'), {
    window, document, navigator: { connection: { saveData } }, IntersectionObserver: Observer
  });
  return { state, source, video, document, listeners };
}

test('the factory film starts with both normal and reduced interface motion', () => {
  for (const reducedMotion of [false, true]) {
    const { state, source } = runHomepageLoader({ reducedMotion });
    assert.equal(source.src, './assets/brand/factory-loop.mp4');
    assert.equal(state.loads, 1);
    assert.equal(state.plays, 1);
    if (reducedMotion) {
      assert.equal(state.observers, 0, 'interface entrance animation stays disabled');
      assert.equal(state.revealed, true, 'copy remains immediately visible');
    }
  }
});

test('data saving retains the poster without fetching or starting the factory film', () => {
  for (const reducedMotion of [false, true]) {
    const { state, source } = runHomepageLoader({ reducedMotion, saveData: true });
    assert.equal(source.src, undefined);
    assert.equal(state.loads, 0);
    assert.equal(state.plays, 0);
  }
});

test('a paused factory film retries when a reduced-motion tab becomes visible', () => {
  const { state, document, video, listeners } = runHomepageLoader({ reducedMotion: true });
  document.visibilityState = 'hidden';
  listeners.visibilitychange();
  assert.equal(state.plays, 1);
  document.visibilityState = 'visible';
  listeners.visibilitychange();
  assert.equal(state.plays, 2);
  video.paused = false;
  listeners.visibilitychange();
  assert.equal(state.plays, 2);
});

test('an autoplay refusal is handled without breaking the homepage', () => {
  const { state } = runHomepageLoader({ reducedMotion: true, refusePlay: true });
  assert.equal(state.plays, 1);
  assert.equal(state.handledRejections, 1);
  assert.equal(state.revealed, true);
});
