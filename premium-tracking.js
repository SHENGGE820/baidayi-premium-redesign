/* First-party interaction evidence only. No analytics account, network request,
 * contact field, item caption, URL query or referrer is recorded here.
 * quote_submit_attempt means a browser-validated submission ATTEMPT; delivery
 * belongs to the external Google Form and remains unverified on this page. */
(function () {
  'use strict';
  var KEY = 'bke-event-log-v1';
  var MAX = 200;
  var EVENTS = { quote_start: 1, select_packaging_spec: 1, quote_submit_attempt: 1,
    support_open: 1, support_faq_answer: 1, support_unanswered: 1, support_draft_created: 1, support_handoff: 1 };
  var PAGES = { home: 1, catalogue: 1, specification: 1, function: 1, contact: 1, content: 1, qa: 1 };
  var memory = [];

  function pageType() {
    var body = document.body;
    if (!body) return 'content';
    if (body.dataset.measurementQa) return 'qa';
    if (body.classList.contains('contact-page')) return 'contact';
    if (document.querySelector('figure.spec-item')) return 'specification';
    if (document.querySelector('.catalogue-grid:not(.catalogue-grid-ingredient)')) return 'catalogue';
    if (body.classList.contains('function-page')) return 'function';
    if (document.querySelector('[data-hero-video]')) return 'home';
    return 'content';
  }

  // Whitelist every property, including when reading tampered browser storage.
  function clean(raw) {
    if (!raw || !Object.prototype.hasOwnProperty.call(EVENTS, raw.event)) return null;
    var entry = {
      event: raw.event,
      recorded_at: typeof raw.recorded_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.recorded_at) ? raw.recorded_at : new Date().toISOString(),
      page_type: Object.prototype.hasOwnProperty.call(PAGES, raw.page_type) ? raw.page_type : 'content',
      measurement_scope: 'local_event_evidence',
      delivery_status: raw.event === 'quote_submit_attempt' ? 'unverified' : 'not_applicable'
    };
    if (raw.event === 'quote_start') entry.action = 'open_contact';
    if (raw.event === 'select_packaging_spec') {
      if (raw.item_kind !== 'style' && raw.item_kind !== 'format') return null;
      entry.action = 'add_to_inquiry';
      entry.item_kind = raw.item_kind;
    }
    if (raw.event === 'quote_submit_attempt') {
      entry.action = 'submission_attempt';
      entry.submission_target = 'google_form';
    }
    if (raw.event === 'select_packaging_spec' || raw.event === 'quote_submit_attempt') {
      entry.inquiry_count = Math.min(60, Math.max(0, Math.floor(Number(raw.inquiry_count) || 0)));
    }
    if (raw.event.indexOf('support_') === 0) entry.action = raw.event.slice(8);
    if (raw.event === 'support_unanswered') entry.category = raw.category === 'requires_review' ? 'requires_review' : 'unknown';
    if (raw.event === 'support_draft_created') {
      ['has_format', 'has_quantity', 'has_packaging'].forEach(function (key) { entry[key] = raw[key] === true; });
    }
    return entry;
  }

  function read() {
    var raw;
    try {
      raw = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) raw = [];
    } catch (e) { raw = memory; }
    return raw.map(clean).filter(Boolean).slice(-MAX);
  }
  function save(entries) {
    memory = entries;
    try { window.localStorage.setItem(KEY, JSON.stringify(entries)); } catch (e) {}
  }
  function changed() {
    if (typeof window.CustomEvent === 'function') document.dispatchEvent(new window.CustomEvent('bke:tracking'));
  }
  function record(event, details) {
    var entry = clean(Object.assign({}, details, { event: event, recorded_at: new Date().toISOString(), page_type: pageType() }));
    if (!entry) return null;
    var entries = read();
    entries.push(entry);
    save(entries.slice(-MAX));
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push(Object.assign({}, entry));
    changed();
    return entry;
  }
  window.BKETracking = {
    record: record,
    read: read,
    clear: function () { save([]); changed(); }
  };

  // Observe before the shared motion handler prevents native navigation to
  // run its transition. That still represents a real contact-link click.
  document.addEventListener('click', function (event) {
    if (!event.target.closest || event.defaultPrevented) return;
    var marked = event.target.closest('[data-bke-event="quote_start"]');
    if (marked) { record('quote_start'); return; }
    var link = event.target.closest('a[href]');
    if (!link) return;
    try {
      var destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && /\/contact\/(?:index\.html)?$/.test(destination.pathname)) {
        record('quote_start');
      }
    } catch (e) {}
  }, true);
})();
