'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateKnowledge, renderKnowledge } = require('./build-support-knowledge');
const root = path.resolve(__dirname, '..');
const valid = () => JSON.parse(fs.readFileSync(path.join(root, 'content/support-faq.json'), 'utf8'));

test('FAQ source renders the same knowledge object without executing text', () => {
  const data = valid();
  data.faqs[0].answer = '</script><script>window.injected=true</script>\u2028';
  validateKnowledge(data);
  const source = renderKnowledge(data);
  assert.ok(!source.includes('</script>'));
  const window = {};
  vm.runInNewContext(source, { window });
  assert.deepEqual(JSON.parse(JSON.stringify(window.BKE_SUPPORT_KNOWLEDGE)), data);
  assert.equal(window.injected, undefined);
});

test('FAQ schema rejects duplicate IDs and invalid required text', () => {
  const duplicate = valid(); duplicate.faqs[1].id = duplicate.faqs[0].id;
  assert.throws(() => validateKnowledge(duplicate), /unique/);
  const invalid = valid(); invalid.faqs[0].aliases = [''];
  assert.throws(() => validateKnowledge(invalid), /nonempty/);
});

test('FAQ links reject traversal, unknown hosts, scripts and missing files', () => {
  for (const href of ['../package.json', '%2e%2e/package.json', '/contact/index.html', 'contact\\index.html', 'javascript:alert(1)', 'https://unapproved.example/', 'missing/index.html']) {
    const data = valid(); data.faqs[0].links[0].href = href;
    assert.throws(() => validateKnowledge(data), undefined, href);
  }
  assert.equal(validateKnowledge(valid()).faqs.length, valid().faqs.length);
});
