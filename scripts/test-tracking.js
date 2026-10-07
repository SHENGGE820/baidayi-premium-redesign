// No browser automation or network request. Proves the evidence definitions,
// privacy boundary and per-page loader paths before the local UI walkthrough.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'premium-tracking.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function load(initial, blocked = false) {
  const saved = new Map(initial ? [['bke-event-log-v1', initial]] : []);
  const handlers = {};
  const document = {
    body: { dataset: {}, classList: { contains: name => name === 'contact-page' } },
    querySelector: () => null,
    addEventListener: (name, fn, capture) => { handlers[name] = fn; handlers[name + 'Capture'] = capture; },
    dispatchEvent: () => {}
  };
  const window = {
    location: { origin: 'https://example.test', href: 'https://example.test/contact/?email=private@example.com' },
    get localStorage() {
      if (blocked) throw new Error('storage blocked');
      return { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
    }
  };
  vm.runInNewContext(source, { window, document, URL, Date });
  return { api: window.BKETracking, window, handlers, saved };
}

test('submission attempts cannot produce a delivered or successful event', () => {
  const { api, window } = load();
  const entry = api.record('quote_submit_attempt', { delivery_status: 'delivered', inquiry_count: 3 });
  assert.equal(entry.delivery_status, 'unverified');
  assert.equal(entry.action, 'submission_attempt');
  assert.equal(entry.submission_target, 'google_form');
  assert.equal(entry.inquiry_count, 3);
  assert.equal(api.record('submit_quote_inquiry', { delivery_status: 'success' }), null);
  assert.equal(api.record('quote_inquiry_delivered'), null);
  assert.equal(window.dataLayer.length, 1);
});

test('only enumerated evidence fields survive input or tampered storage', () => {
  const { api, window } = load(JSON.stringify([
    { event: 'quote_start', email: 'private@example.com', page_type: 'contact', recorded_at: '2026-10-07T01:02:03.000Z' },
    { event: 'select_packaging_spec', item_kind: 'bogus' },
    { event: 'unknown', note: 'secret' }
  ]));
  api.record('select_packaging_spec', { item_kind: 'style', inquiry_count: 90, email: 'private@example.com', name: '客戶姓名', page_type: 'unsafe', page_url: 'https://example.test/?tel=1234', note: 'secret' });
  const entries = plain(api.read());
  assert.equal(entries.length, 2);
  assert.equal(entries[1].inquiry_count, 60);
  assert.equal(entries[1].page_type, 'contact');
  const allEvidence = JSON.stringify([entries, window.dataLayer]);
  for (const privateText of ['private@example.com', '客戶姓名', 'page_url', 'secret', 'tel=1234']) assert.ok(!allEvidence.includes(privateText));
});

test('blocked storage preserves current-session evidence and caps history', () => {
  const { api } = load(null, true);
  for (let i = 0; i < 210; i++) api.record('quote_start');
  assert.equal(api.read().length, 200);
  api.clear();
  assert.deepEqual(plain(api.read()), []);
});

test('contact and marked support links record a single quote start', () => {
  const { api, handlers } = load();
  assert.equal(handlers.clickCapture, true, 'measure before the existing animation handler intercepts navigation');
  const marked = { href: 'https://example.test/contact/' };
  handlers.click({ target: { closest: selector => selector.startsWith('[data-') ? marked : marked }, defaultPrevented: false });
  assert.equal(api.read().length, 1);
  const contact = { href: 'https://example.test/contact/?function=beauty' };
  handlers.click({ target: { closest: selector => selector.startsWith('[data-') ? null : contact }, defaultPrevented: false });
  assert.equal(api.read().length, 2);
  handlers.click({ target: { closest: () => contact }, defaultPrevented: true });
  assert.equal(api.read().length, 2);
});

test('support events retain only states and boolean draft flags', () => {
  const { api } = load();
  for (const event of ['support_open', 'support_faq_answer', 'support_handoff']) {
    api.record(event, { query: 'private customer question', faq_id: 'private@example.com', note: 'secret' });
  }
  api.record('support_unanswered', { category: 'private customer question' });
  api.record('support_draft_created', { has_format: true, has_quantity: 'private@example.com', has_packaging: false, draft: 'private customer question' });
  const entries = plain(api.read());
  assert.equal(entries.length, 5);
  assert.equal(entries[3].category, 'unknown');
  assert.equal(entries[4].has_format, true);
  assert.equal(entries[4].has_quantity, false);
  assert.equal(entries[4].has_packaging, false);
  assert.ok(entries.every(entry => entry.delivery_status === 'not_applicable'));
  for (const privateText of ['private', 'secret', 'faq_id', 'draft:']) assert.ok(!JSON.stringify(entries).includes(privateText));
});

test('shared loader resolves inquiry and support assets at nested page depths', () => {
  const shell = fs.readFileSync(path.join(root, 'premium-shell.js'), 'utf8');
  const added = [];
  const create = () => ({ setAttribute: () => {} });
  const document = {
    body: { dataset: { root: '../../../' }, classList: { contains: () => true }, appendChild: node => added.push(node) },
    head: { appendChild: node => added.push(node) },
    querySelector: () => null,
    currentScript: { src: 'https://example.test/premium-shell.js?v=20261007' },
    createElement: create
  };
  vm.runInNewContext(shell, { document });
  assert.ok(added.some(node => node.href === '../../../premium-support.css?v=20261007'));
  const tracking = added.find(node => node.src === '../../../premium-tracking.js?v=20261007');
  const knowledge = added.find(node => node.src === '../../../premium-support-knowledge.js?v=20261007');
  assert.ok(tracking && knowledge);
  tracking.onerror();
  knowledge.onerror();
  assert.ok(added.some(node => node.src === '../../../premium-inquiry.js?v=20261007'));
  assert.ok(added.some(node => node.src === '../../../premium-support.js?v=20261007'));
});
