// Local regression checks only: never sends an enquiry to the live form.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
  const form = {
    querySelector: selector => selector === '[data-form-interest]' ? interest : fields[selector],
    addEventListener: (name, handler) => { events[name] = handler; }
  };
  vm.runInNewContext(source, {
    URLSearchParams,
    document: { querySelector: selector => selector === '[data-premium-contact-form]' ? form : status },
    window: { location: { search }, setTimeout: () => assert.fail('No timer may claim remote success') }
  });
  function payload() {
    const message = fields['#contact-message'];
    const formData = new Map([[message.name, message.value]]);
    events.formdata({ formData });
    return formData.get(message.name);
  }
  return { fields, interest, status, events, payload };
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

test('all eight dosage cards have a next step and reading anchors resolve', () => {
  const catalogue = fs.readFileSync(path.join(root, '全面性服務/劑型與包材/index.html'), 'utf8');
  const dosage = catalogue.split('id="dosage"')[1].split('</section>')[0];
  assert.equal((dosage.match(/<a class="catalogue-card reveal"/g) || []).length, 8);
  for (const match of catalogue.matchAll(/href="#([^"]+)"/g)) assert.ok(catalogue.includes('id="' + match[1] + '"'));
});
