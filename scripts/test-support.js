'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'premium-support.js'), 'utf8');
const knowledgeSource = fs.readFileSync(path.join(root, 'premium-support-knowledge.js'), 'utf8');
function load() {
  const window = {};
  vm.runInNewContext(knowledgeSource, { window });
  vm.runInNewContext(source, { window, URL });
  return { api: window.BKESupport, knowledge: window.BKE_SUPPORT_KNOWLEDGE };
}
test('customer wording finds MOQ, lead time and special packaging answers', () => {
  const { api } = load();
  for (const question of ['最低起訂量', 'MOQ多少', '交期多久', '彩盒可以燙金嗎', '線上詢價有送成功嗎']) {
    assert.ok(api.match(question).length, question);
  }
  assert.equal(api.match('請問今天火星天氣如何').length, 0);
});
test('inquiry draft keeps customer facts and leaves unspecified fields unconfirmed', () => {
  const { api } = load();
  const raw = '想做膠囊，首批3000瓶，每瓶60顆，需要彩盒與燙金。';
  const result = api.organize(raw);
  assert.ok(result.text.includes('劑型：膠囊'));
  assert.ok(result.text.includes('3000瓶'));
  assert.ok(result.text.includes('60顆'));
  assert.ok(result.text.includes('彩盒、燙金'));
  assert.ok(result.text.includes('成分／含量：待確認'));
  assert.ok(result.text.includes(raw));
  assert.equal(result.hasQuantity, true);
  assert.equal(api.organize('我只有初步想法').hasQuantity, false);
});
test('formula amounts are not turned into quantities or a quoted price', () => {
  const { api } = load();
  const result = api.organize('維生素C 500mg，想做粉包');
  assert.ok(result.text.includes('數量／單位：待確認'));
  assert.ok(result.text.includes('維生素C 500mg'));
  assert.ok(result.text.includes('正式報價'));
  assert.ok(!result.text.includes('NT$'));
});
test('knowledge has unique IDs and links to actual local destinations', () => {
  const { knowledge } = load();
  const ids = new Set();
  assert.ok(knowledge.faqs.length >= 12);
  for (const faq of knowledge.faqs) {
    assert.ok(faq.id && !ids.has(faq.id)); ids.add(faq.id);
    assert.ok(faq.question && faq.answer && Array.isArray(faq.aliases));
    for (const link of faq.links || []) {
      if (/^https?:|^tel:/.test(link.href)) continue;
      const file = path.resolve(root, link.href.replace(/^\//, '').split(/[?#]/)[0]);
      assert.ok(fs.existsSync(file), `${faq.id}: ${link.href}`);
    }
  }
});

test('assistant handoff consumes fresh drafts once and never overwrites existing customer text', () => {
  const contact = fs.readFileSync(path.join(root, 'premium-contact.js'), 'utf8');
  function prefill(draft, existing) {
    const message = { value: existing || '' };
    const store = new Map([['bke-support-draft-v1', JSON.stringify(draft)]]);
    const form = { querySelector: selector => selector === '#contact-message' ? message : null, addEventListener() {} };
    vm.runInNewContext(contact, {
      URLSearchParams, Date,
      document: { querySelector: selector => selector === '[data-premium-contact-form]' ? form : { textContent: '' } },
      window: { location: { search: '?source=support' }, sessionStorage: { getItem: key => store.get(key), removeItem: key => store.delete(key) } }
    });
    assert.equal(store.size, 0);
    return message.value;
  }
  const fresh = { version: 1, text: '膠囊首批3000瓶，待確認配方', createdAt: Date.now() };
  assert.equal(prefill(fresh), fresh.text);
  assert.equal(prefill(fresh, '客戶先前已寫好的需求'), '客戶先前已寫好的需求');
  assert.equal(prefill({ ...fresh, createdAt: Date.now() - 31 * 60 * 1000 }), '');
  assert.equal(prefill({ ...fresh, text: { html: '<script>' } }), '');
});
