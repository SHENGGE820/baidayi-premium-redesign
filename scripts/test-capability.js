'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { parse, decode } = require('./lib/html-fields');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['全面性服務/index.html', '全面性服務/capability-c.html'];
const marked = (html, name) => html.split(`<!-- cms:${name} -->`)[1]?.split(`<!-- /cms:${name} -->`)[0].trim();
const attr = (node, name) => (node.attrs || '').match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
const hasAttr = (node, name) => new RegExp(`\\s${name}(?:\\s|=|$)`).test(node.attrs || '');
const hasClass = (node, name) => (attr(node, 'class') || '').split(/\s+/).includes(name);
const descendants = (node, predicate) => node.children.flatMap(child => [
  ...(predicate(child) ? [child] : []), ...descendants(child, predicate)
]);
const textOf = (html, node) => decode(html.slice(node.openEnd, node.innerEnd).replace(/<[^>]*>/g, '')).trim();
const categoryCards = html => descendants(parse(html), node => node.tag === 'details' && hasClass(node, 'ingredient-category'));
const rawLibrary = (html, file) => {
  const library = marked(html, file.includes('/原料成分/') ? 'ingredient-categories' : 'cap-ingredient-categories');
  assert.ok(library, file + ' raw ingredient marker must be present');
  return library;
};

test('all category covers use complete local portraits without changing function heroes', () => {
  const slugs = ['beauty','secret-garden','metabolism','protein','body-functions','energetic','gut','generation-3c','balance','action','sleep'];
  for (const file of [...pages, '全面性服務/原料成分/index.html']) {
    const html = rawLibrary(read(file), file);
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
    assert.match(html, /premium-ingredients\.js\?v=20261016-01/);
    const ingredients = html.split('id="ingredients"')[1].split('id="formula"')[0];
    assert.doesNotMatch(ingredients, /href="\.\/原料成分\//, 'reading ingredients must not require leaving the development page');
    assert.doesNotMatch(ingredients, /<iframe\b/);
  }
});

test('capability dosage cards keep the three requested priorities in DOM reading order', () => {
  for (const file of pages) {
    const formats = read(file).split('id="formats"')[1].split('id="packaging"')[0];
    const cards = categoryCards(formats);
    const labels = cards.map(card => {
      const summary = card.children.find(node => node.tag === 'summary');
      const title = descendants(summary, node => node.tag === 'strong')[0];
      assert.ok(title, file + ' each dosage card needs a summary title');
      return textOf(formats, title);
    });
    assert.deepEqual(labels.slice(0, 3), ['錠狀顆粒', '粉末食品', '動／植物膠囊']);
    assert.equal(labels.length, 8, file + ' must retain every dosage');
    const sourceLabels = matter(read('content/pages/catalogue.md')).data.dosage.map(item => item.title);
    assert.deepEqual([...labels].sort(), sourceLabels.sort(), file + ' must retain every original dosage name');
  }
});

test('packaging has two cover cards and keeps every original style behind compact type cards', () => {
  const source = matter(read('content/pages/catalogue.md')).data;
  const expected = [
    { id: 'packaging-semi-finished', title: '半成品包材', section: 'package', count: 48, kinds: 8 },
    { id: 'packaging-finished', title: '成品包材', section: 'finished', count: 6, kinds: 3 }
  ];
  for (const file of pages) {
    const html = marked(read(file), 'cap-packaging-categories');
    assert.ok(html, file + ' packaging marker must be present');
    const cards = categoryCards(html);
    assert.deepEqual(cards.map(card => attr(card, 'id')), expected.map(group => group.id));
    const covers = descendants(parse(html), node => node.tag === 'img' && hasClass(node, 'ingredient-category-image'));
    assert.equal(covers.length, 2, file + ' only the two packaging groups get new category covers');
    for (const [index, group] of expected.entries()) {
      const card = cards[index];
      assert.equal(descendants(card, node => node.tag === 'details').length, 0, file + ' packaging must not require a third expansion');
      const cover = covers[index];
      const coverPath = `../assets/brand/pack-category-${group.id.slice('packaging-'.length)}-v1.jpg`;
      assert.equal(attr(cover, 'src'), coverPath);
      assert.ok(Number(attr(cover, 'height')) > Number(attr(cover, 'width')), file + ' packaging covers stay portrait');
      assert.ok(fs.existsSync(path.resolve(root, '全面性服務', coverPath)), coverPath);
      const title = descendants(card.children.find(node => node.tag === 'summary'), node => node.tag === 'strong')[0];
      assert.equal(textOf(html, title), group.title);
      const kinds = descendants(card, node => node.tag === 'section' && hasClass(node, 'development-group'));
      assert.equal(kinds.length, group.kinds, file + ' must retain all original packaging types');
      let imageCount = 0;
      for (const [kindIndex, kind] of kinds.entries()) {
        const item = source[group.section][kindIndex];
        const heading = descendants(kind, node => node.tag === 'h3')[0];
        assert.equal(textOf(html, heading), item.title);
        const original = item.link?.startsWith('page:')
          ? matter(read(`content/catalogue/${item.link.slice(5)}.md`)).data
          : null;
        const images = original?.groups?.length
          ? original.groups.flatMap(modelGroup => modelGroup.items.map(model => model.image))
          : [item.image];
        const figures = descendants(kind, node => node.tag === 'figure');
        assert.equal(figures.length, images.length, file + '/' + item.title + ' every original style must remain visible');
        for (const [modelIndex, figure] of figures.entries()) {
          const image = descendants(figure, node => node.tag === 'img' || node.tag === 'image')[0];
          const link = descendants(figure, node => node.tag === 'a')[0];
          const imagePath = '../' + images[modelIndex].replace(/^\//, '');
          assert.equal(attr(image, image.tag==='image'?'href':'src'), imagePath, file + '/' + item.title + ' original style order');
          assert.equal(attr(link, 'href'), imagePath, file + '/' + item.title + ' full-size image remains accessible');
        }
        imageCount += figures.length;
      }
      assert.equal(imageCount, group.count, file + '/' + group.title + ' original style count');
      assert.equal(descendants(card, node => node.tag === 'select' && hasAttr(node, 'data-packaging-choice')).length, 0, file + ' model selection belongs in the dialog, not the long page');
      assert.equal(descendants(card, node => node.tag === 'button' && hasAttr(node, 'data-packaging-full')).length, group.kinds, file + ' every packaging type exposes one view styles dialog action');
      assert.equal(descendants(card, node => hasClass(node, 'packaging-card-overview')).length, group.kinds, file + ' every packaging type has one compact overview');
      assert.equal(descendants(card, node => node.tag === 'img' || node.tag === 'image').length, group.count + 1, file + ' original art is preserved without duplicating thumbnail rows');
      for (const kind of kinds) {
        assert.ok(hasClass(kind,'is-source-card'),file + ' packaging retains the same white item-card framework');
        for (const figure of descendants(kind,node=>node.tag==='figure')) {
          const media=descendants(figure,node=>node.tag==='img'||node.tag==='image')[0];
          const sourcePath = attr(media,media.tag==='image'?'href':'src').replace(/^\.\.\//,'/');
          const record = JSON.parse(read('content/packaging-models.json')).models[sourcePath];
          if (!record) continue;
          const specs = descendants(figure,node=>node.tag==='dl'&&hasClass(node,'packaging-specs'))[0];
          assert.ok(specs,file+' source-sheet text must be real HTML');
          for (const value of Object.values(record.specs)) assert.ok(textOf(html,specs).includes(value),file+' missing source specification '+value);
        }
      }
    }
  }
});

test('all four libraries own separate search inputs and local summary region relationships', () => {
  for (const file of pages) {
    const html = read(file);
    const roots = descendants(parse(html), node => hasAttr(node, 'data-ingredient-library'));
    assert.equal(roots.length, 4, file + ' ingredients, formulas, dosage and packaging need independent roots');
    const expectedCards = [11, 9, 8, 2];
    const inputIds = [];
    const detailNames = new Set();
    for (const [index, library] of roots.entries()) {
      const inputs = descendants(library, node => node.tag === 'input' && attr(node, 'type') === 'search');
      assert.equal(inputs.length, 1, file + ' each library has its own search input');
      const inputId = attr(inputs[0], 'id');
      assert.ok(inputId, file + ' search input has an ID');
      inputIds.push(inputId);
      assert.equal(descendants(library, node => node.tag === 'label' && attr(node, 'for') === inputId).length, 1);
      const cards = descendants(library, node => node.tag === 'details' && hasClass(node, 'ingredient-category'));
      assert.equal(cards.length, expectedCards[index]);
      const names = new Set(cards.map(card => attr(card, 'name')));
      assert.equal(names.size, 1, file + ' one exclusive disclosure group per library');
      const name = [...names][0];
      assert.ok(name && !detailNames.has(name), file + ' disclosure groups must not close another library');
      detailNames.add(name);
      for (const card of cards) {
        const summary = card.children.find(node => node.tag === 'summary');
        assert.ok(summary, file + ' category has a direct summary');
        const controlled = descendants(card, node => attr(node, 'id') === attr(summary, 'aria-controls'));
        assert.equal(controlled.length, 1, file + ' summary must control its own region');
        assert.equal(attr(controlled[0], 'role'), 'region');
        const labelledBy = attr(controlled[0], 'aria-labelledby');
        assert.ok(labelledBy, file + ' category region has a title');
        for (const id of labelledBy.split(/\s+/)) {
          assert.equal(descendants(summary, node => attr(node, 'id') === id).length, 1, file + ' region title stays inside its own summary');
        }
      }
    }
    assert.equal(new Set(inputIds).size, 4, file + ' search IDs must be unique across roots');
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
