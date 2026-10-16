// Local regression checks only: never sends an enquiry to the live form.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const matter = require('gray-matter');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'premium-contact.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'contact/index.html'), 'utf8');

function setup(search = '') {
  const fields = {};
  for (const id of ['name', 'company', 'phone', 'email', 'launch', 'quantity', 'channel', 'message', 'stage', 'function', 'type']) {
    fields['#contact-' + id] = { value: '' };
  }
  for (const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    fields['#' + match[1]].options = Array.from(match[2].matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g), item => ({ value: item[1] ?? item[2] }));
  }
  fields['#contact-message'].name = html.match(/<textarea[^>]*name="([^"]+)"/)[1];
  const interest = { hidden: true, textContent: '' };
  const status = { textContent: '' };
  const events = {};
  const tracking = [];
  const form = {
    querySelector: selector => selector === '[data-form-interest]' ? interest : fields[selector],
    addEventListener: (name, handler) => { events[name] = handler; }
  };
  vm.runInNewContext(source, {
    URLSearchParams,
    document: { querySelector: selector => selector === '[data-premium-contact-form]' ? form : status },
    window: { location: { search }, BKETracking: { record: (event, details) => tracking.push({ event, details }) }, setTimeout: () => assert.fail('No timer may claim remote success') }
  });
  function payload() {
    const message = fields['#contact-message'];
    const formData = new Map([[message.name, message.value]]);
    events.formdata({ formData });
    return formData.get(message.name);
  }
  return { fields, interest, status, events, payload, tracking };
}

test('catalogue choices prefill only existing form options', () => {
  const expected = { biscuit: '其他／需要建議', shaker: '粉包／顆粒', candy: '其他／需要建議', capsule: '膠囊', tablet: '錠劑', powder: '粉包／顆粒', meal: '其他／需要建議', 'jelly-tea': '其他／需要建議', box: '其他／需要建議' };
  for (const [format, type] of Object.entries(expected)) {
    const view = setup('?format=' + format);
    assert.equal(view.fields['#contact-type'].value, type);
    assert.equal(view.interest.hidden, false);
    assert.match(view.payload(), /瀏覽的劑型／包材：/);
  }
});

test('unrecognised and prototype-like URL choices are ignored', () => {
  for (const value of ['unknown', '__proto__', 'constructor', '<script>']) {
    const view = setup('?format=' + encodeURIComponent(value) + '&function=invalid');
    assert.equal(view.fields['#contact-type'].value, '');
    assert.equal(view.fields['#contact-function'].value, '');
    assert.equal(view.interest.hidden, true);
  }
});

test('existing stage and function links still prefill correctly', () => {
  const view = setup('?stage=idea&function=' + encodeURIComponent('養顏美容'));
  assert.equal(view.fields['#contact-stage'].value, '只有初步想法');
  assert.equal(view.fields['#contact-function'].value, '養顏美容');
});

test('planning details reach the payload once without mutating customer text', () => {
  const view = setup('?format=powder');
  const values = { message: '  想討論粉包\n目標客群：上班族  ', company: '測試品牌', launch: '年底', quantity: '尚未確定', channel: '品牌官網／電商' };
  for (const [id, value] of Object.entries(values)) view.fields['#contact-' + id].value = value;
  const first = view.payload();
  assert.equal(view.payload(), first);
  assert.equal(view.fields['#contact-message'].value, values.message);
  assert.match(first, /想討論粉包\n目標客群：上班族/);
  for (const value of Object.values(values).slice(1)) assert.ok(first.includes(value));
  assert.equal(first.split('公司／品牌名稱：').length, 2);
});

test('ordinary enquiries preserve their original message', () => {
  const view = setup();
  view.fields['#contact-message'].value = '沒有指定劑型';
  assert.equal(view.payload(), '沒有指定劑型');
});

test('submit directs customers to the actual confirmation, not a guessed success', () => {
  const view = setup();
  view.events.submit();
  assert.match(view.status.textContent, /以新分頁顯示的結果為準/);
  assert.doesNotMatch(view.status.textContent, /謝謝你的詢問|已成功送出/);
});

test('payload preparation records nothing and submission records only an attempt', () => {
  const view = setup();
  view.payload();
  assert.equal(view.tracking.length, 0);
  view.events.submit();
  assert.equal(view.tracking.length, 1);
  assert.equal(view.tracking[0].event, 'quote_submit_attempt');
  assert.equal(view.tracking[0].details.inquiry_count, 0);
});

test('every dosage card has a next step and reading anchors resolve', () => {
  const catalogue = fs.readFileSync(path.join(root, '全面性服務/劑型與包材/index.html'), 'utf8');
  const dosage = catalogue.split('id="dosage"')[1].split('</section>')[0];
  // the cards are edited in the CMS, so the count can change; none may be a dead end
  const cards = dosage.match(/<(?:a|div) class="catalogue-card reveal"/g) || [];
  assert.ok(cards.length > 0);
  assert.ok(cards.every(c => c.startsWith('<a ')), 'a dosage card has no link');
  for (const match of catalogue.matchAll(/href="#([^"]+)"/g)) assert.ok(catalogue.includes('id="' + match[1] + '"'));
});

test('dosage priorities and all generated grids share the ordered CMS source', () => {
  const content = matter(fs.readFileSync(path.join(root, 'content/pages/catalogue.md'), 'utf8')).data;
  const titles = content.dosage.map(card => card.title);
  assert.deepEqual(titles.slice(0, 3), ['錠狀顆粒', '粉末食品', '動／植物膠囊']);
  for (const [file, marker] of [['index.html', 'home-formats'], ['home-v3.html', 'home-formats'], ['全面性服務/劑型與包材/index.html', 'catalogue-dosage']]) {
    const page = fs.readFileSync(path.join(root, file), 'utf8');
    const grid = page.split('<!-- cms:' + marker + ' -->')[1]?.split('<!-- /cms:' + marker + ' -->')[0];
    assert.ok(grid, file + ' must keep its build marker');
    const rendered = [...grid.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
    assert.deepEqual(rendered, titles, file + ' must preserve source order without omissions or duplicates');
    assert.match(grid, /href="[^"]*一站式服務\/錠劑\/index.html"/);
    assert.match(grid, /href="[^"]*一站式服務\/粉末食品\/index.html"/);
    assert.match(grid, /href="[^"]*一站式服務\/多元劑型-膠囊\/index.html"/);
    const links = [...grid.matchAll(/<a class="catalogue-card reveal" href="([^"]+)"/g)].map(match => match[1]);
    assert.equal(links.length, titles.length);
    for (const href of links) {
      assert(!href.includes('contact/'), file + ': dosage cards must open content');
      const destination = path.resolve(root, path.dirname(file), decodeURI(href));
      assert.ok(fs.statSync(destination).isFile(), file + ': missing destination ' + href);
      const target = fs.readFileSync(destination, 'utf8');
      assert.match(target, /<h1\b/);
      assert.doesNotMatch(target, /http-equiv="refresh"/i);
    }
  }
  assert.ok(content.dosage.every(card => card.link.startsWith('page:')));
  for (const slug of ['粉末食品', '機能餅乾', '搖搖隨身袋', '糖果劑型', '營養代餐', '果凍與茶包']) {
    const page = fs.readFileSync(path.join(root, '全面性服務/一站式服務', slug, 'index.html'), 'utf8');
    assert.match(page, /id="introduction"/);
    assert.match(page, /class="dosage-considerations"/);
    assert.match(page, /討論這個劑型/);
  }
});

test('product form priorities preserve existing option values and the blank prompt', () => {
  const view = setup();
  const options = view.fields['#contact-type'].options.map(option => option.value);
  assert.deepEqual(options.slice(0, 4), ['', '錠劑', '粉包／顆粒', '膠囊']);
  assert.deepEqual(options.slice(4), ['飲品', '果凍', '其他／需要建議']);
  assert.equal(view.fields['#contact-type'].value, '', 'reordering must not silently preselect a product');
});
