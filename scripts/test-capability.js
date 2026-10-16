'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['全面性服務/index.html', '全面性服務/capability-c.html'];
const marked = (html, name) => html.split(`<!-- cms:${name} -->`)[1]?.split(`<!-- /cms:${name} -->`)[0].trim();

test('all category covers use complete local portraits without changing function heroes', () => {
  const slugs = ['beauty','secret-garden','metabolism','protein','body-functions','energetic','gut','generation-3c','balance','action','sleep'];
  for (const file of [...pages, '全面性服務/原料成分/index.html']) {
    const html = read(file);
    assert.equal((html.match(/data-blended-category/g) || []).length, 11);
    for (const slug of slugs) {
      const cover = html.split(`id="category-${slug}"`)[1].split('</summary>')[0];
      assert.match(cover, new RegExp(`category-${slug}-portrait\\.jpg`));
      const dimensions = cover.match(/width="(\d+)" height="(\d+)"/);
      assert.ok(dimensions && Number(dimensions[2]) > Number(dimensions[1]));
      assert.ok(fs.existsSync(path.join(root, `assets/brand/category-${slug}-portrait.jpg`)));
      assert.ok(fs.existsSync(path.join(root, `assets/brand/category-${slug}-portrait-640.jpg`)));
    }
  }
  for (const slug of slugs) assert.match(read(`content/functions/${slug}.md`), new RegExp(`function-${slug}\\.jpg`));
});

test('both capability layouts expose the complete same-source ingredient library inline', () => {
  const reference = marked(read('全面性服務/原料成分/index.html'), 'ingredient-categories');
  assert.ok(reference);
  for (const file of pages) {
    const html = read(file);
    const library = marked(html, 'cap-ingredient-categories');
    assert.equal(library, reference.replaceAll('../../', '../'), file + ' must retain every original ingredient and resolve local media');
    assert.equal((library.match(/<details class="ingredient-category"/g) || []).length, 11);
    assert.match(html, /id="ingredient-search" type="search"/);
    assert.match(html, /premium-ingredients\.js\?v=20261013-01/);
    const ingredients = html.split('id="ingredients"')[1].split('id="formula"')[0];
    assert.doesNotMatch(ingredients, /href="\.\/原料成分\//, 'reading ingredients must not require leaving the development page');
    assert.doesNotMatch(ingredients, /<iframe\b/);
  }
});

test('capability dosage cards keep the three requested priorities in DOM reading order', () => {
  for (const file of pages) {
    const formats = read(file).split('id="formats"')[1].split('id="packaging"')[0];
    const labels = [...formats.matchAll(/<li>[\s\S]*?<\/span>([^<]+)<\/a><\/li>/g)].map(m => m[1]);
    assert.deepEqual(labels.slice(0, 3), ['錠狀顆粒', '粉末食品', '動／植物膠囊']);
    assert.equal(labels.length, 8, file + ' must retain every dosage');
  }
});

test('integrated libraries retain unique IDs and real summary region relationships', () => {
  for (const file of pages) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, file + ' duplicate DOM IDs');
    for (const m of html.matchAll(/\baria-(?:controls|labelledby)="([^"]+)"/g)) {
      for (const id of m[1].split(/\s+/)) assert.ok(ids.includes(id), file + ' missing ' + id);
    }
    for (const image of html.matchAll(/<img\b[^>]*>/g)) assert.match(image[0], /\balt="/);
  }
});

test('shared navigation enters the integrated library and legacy library stays usable', () => {
  assert.match(read('premium-shell.js'), /url\('全面性服務\/index\.html#ingredients'\)/);
  assert.match(read('全面性服務/原料成分/index.html'), /href="\.\.\/index\.html#ingredients"/);
  assert.match(read('premium-services.js'), /bke:cap-panel-visible/);
  assert.match(read('premium-services.js'), /category-\|materials-/);
  assert.match(read('premium-ingredients.js'), /prefers-reduced-motion: reduce/);
});
