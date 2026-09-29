// Local checks for the inquiry list (premium-inquiry.js) and how it reaches
// the enquiry payload (premium-contact.js). Never sends anything anywhere.
//
//   node scripts/test-inquiry.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const inquirySource = fs.readFileSync(path.join(root, 'premium-inquiry.js'), 'utf8');
const contactSource = fs.readFileSync(path.join(root, 'premium-contact.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'contact/index.html'), 'utf8');
const ORIGIN = 'https://shengge820.github.io';
// Values built inside the vm sandbox have that realm's prototypes; compare as plain data.
const plain = value => JSON.parse(JSON.stringify(value));

function memoryStorage(initial) {
  const data = new Map(initial ? [['bke-inquiry-v1', initial]] : []);
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), raw: data };
}

/* Runs the module with no document, so only the data layer initialises. */
function load(storage) {
  const window = {
    location: { href: ORIGIN + '/baidayi-premium-redesign/contact/', origin: ORIGIN },
    get localStorage() { if (storage === 'throws') throw new Error('blocked'); return storage; }
  };
  vm.runInNewContext(inquirySource, { window, URL });
  return window.BKEInquiry;
}

const style = n => ({ id: 'style:' + n, kind: 'style', group: '錠劑', name: '圓型 ' + n + 'mm', img: ORIGIN + '/x/' + n + '.png' });

test('add, has, remove and clear keep one entry per id', () => {
  const api = load(memoryStorage());
  assert.equal(api.add(style(8)).ok, true);
  assert.equal(api.add(style(8)).ok, true, 'adding twice is harmless');
  assert.equal(api.list().length, 1);
  assert.equal(api.has('style:8'), true);
  api.add({ id: 'function:beauty', kind: 'function', group: '功能方向', name: '養顏美容' });
  assert.equal(api.remove('style:8').length, 1);
  assert.equal(api.has('style:8'), false);
  api.clear();
  assert.deepEqual(plain(api.list()), []);
});

test('the list is capped rather than growing without bound', () => {
  const api = load(memoryStorage());
  for (let i = 0; i < 60; i++) assert.equal(api.add(style(i)).ok, true);
  const over = api.add(style(99));
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'full');
  assert.equal(api.list().length, 60);
});

test('tampered storage is cleaned on every read', () => {
  const api = load(memoryStorage(JSON.stringify([
    'not an object', null, 42,
    { id: 'a', kind: 'bogus', name: 'n' },
    { id: '', kind: 'style', name: 'n' },
    { id: 'b', kind: 'style', name: '<img src=x onerror=alert(1)>', img: 'javascript:alert(1)', page: 'https://evil.example/' },
    { id: 'b', kind: 'style', name: 'duplicate id' },
    { id: 'c', kind: 'format', name: 'x'.repeat(500), img: '//evil.example/a.png' }
  ])));
  const items = api.list();
  assert.equal(items.length, 2);
  assert.equal(items[0].name, '<img src=x onerror=alert(1)>', 'kept as text; the page layer renders it with textContent');
  assert.equal(items[0].img, '', 'javascript: URL dropped');
  assert.equal(items[0].page, '', 'cross-origin URL dropped');
  assert.equal(items[1].name.length, 80, 'overlong names are trimmed');
  assert.equal(items[1].img, '', 'protocol-relative cross-origin URL dropped');
});

test('unreadable or blocked storage degrades to an empty list', () => {
  assert.deepEqual(plain(load(memoryStorage('{not json')).list()), []);
  const blocked = load('throws');
  assert.deepEqual(plain(blocked.list()), []);
  assert.equal(blocked.add(style(8)).reason, 'storage');
});

test('summary lines name each pick and link uncaptioned styles to their image', () => {
  const api = load(memoryStorage());
  api.add({ id: 's', kind: 'style', group: 'PE塑膠瓶', name: '瓶身 第 3 款', img: ORIGIN + '/u/11.png' });
  api.add({ id: 'f', kind: 'format', group: '多元劑型', name: '機能餅乾', img: ORIGIN + '/u/b.webp' });
  api.add({ id: 'fn', kind: 'function', group: '功能方向', name: '幫助入睡' });
  assert.deepEqual(plain(api.summaryLines()), [
    '- PE塑膠瓶｜瓶身 第 3 款（圖：' + ORIGIN + '/u/11.png）',
    '- 多元劑型｜機能餅乾',
    '- 功能方向｜幫助入睡'
  ]);
});

test('picks map only onto product types the form offers', () => {
  const api = load(memoryStorage());
  const options = [...html.matchAll(/<select\b[^>]*id="contact-type"[^>]*>([\s\S]*?)<\/select>/g)][0][1];
  const offered = new Set([...options.matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g)].map(m => m[1] ?? m[2]));
  const cases = [['動物膠囊', '尺寸 0 號 第 1 款', '膠囊'], ['錠劑', '圓型 8mm', '錠劑'], ['粉末鋁袋', '第 2 款', '粉包／顆粒'],
    ['果凍條鋁袋', '第 1 款', '果凍'], ['飲品玻璃瓶', '第 1 款', '飲品'], ['PE塑膠瓶', '瓶身 第 1 款', '']];
  for (const [group, name, type] of cases) {
    assert.equal(api.typeFor({ group, name }), type);
    if (type) assert.ok(offered.has(type), type + ' must be an option in the form');
  }
});

/* premium-contact.js with a fake form, as in test-enquiry.js. */
function contactPayload(inquiryApi, typed) {
  const fields = {};
  for (const id of ['name', 'company', 'phone', 'email', 'launch', 'quantity', 'channel', 'message', 'stage', 'function', 'type']) fields['#contact-' + id] = { value: '' };
  for (const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    fields['#' + m[1]].options = Array.from(m[2].matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g), o => ({ value: o[1] ?? o[2] }));
  }
  fields['#contact-message'].name = html.match(/<textarea[^>]*name="([^"]+)"/)[1];
  fields['#contact-message'].value = typed;
  const events = {};
  const form = { querySelector: s => (s === '[data-form-interest]' ? { hidden: true } : fields[s]), addEventListener: (n, h) => { events[n] = h; } };
  vm.runInNewContext(contactSource, {
    URLSearchParams,
    document: { querySelector: s => (s === '[data-premium-contact-form]' ? form : { textContent: '' }) },
    window: { location: { search: '' }, BKEInquiry: inquiryApi, setTimeout: () => assert.fail('no timers') }
  });
  const formData = new Map([[fields['#contact-message'].name, typed]]);
  events.formdata({ formData });
  return { sent: formData.get(fields['#contact-message'].name), shown: fields['#contact-message'].value };
}

test('the list travels with the enquiry, after the visitor\'s own words', () => {
  const api = load(memoryStorage());
  api.add({ id: 's', kind: 'style', group: '錠劑', name: '圓型 8mm', img: ORIGIN + '/u/8.png' });
  const { sent, shown } = contactPayload(api, '想做一款錠劑');
  assert.equal(sent, '想做一款錠劑\n\n詢價清單：\n- 錠劑｜圓型 8mm（圖：' + ORIGIN + '/u/8.png）');
  assert.equal(shown, '想做一款錠劑', 'the textarea the visitor sees is untouched');
});

test('an empty list adds nothing to the enquiry', () => {
  const { sent } = contactPayload(load(memoryStorage()), '只有初步想法');
  assert.equal(sent, '只有初步想法');
});
