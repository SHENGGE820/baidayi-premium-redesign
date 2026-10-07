/* Local knowledge-base assistant. No API key, remote model, or chat upload.
 * Answers come from the checked FAQ; unconfirmed terms go to the sales team.
 * The user explicitly carries a draft to the existing contact form. */
(function () {
  'use strict';
  var knowledge = window.BKE_SUPPORT_KNOWLEDGE || { faqs: [] };
  var faqs = Array.isArray(knowledge.faqs) ? knowledge.faqs : [];
  var DRAFT_KEY = 'bke-support-draft-v1';
  var MAX_INPUT = 800;
  var MAX_TURNS = 20;
  var turns = 0;
  var draft = '';

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[？?！!，,。．、：:；;「」『』()（）]/g, '')
      .replace(/胶/g, '膠').replace(/剂/g, '劑').replace(/询/g, '詢').replace(/价/g, '價').replace(/包装/g, '包裝');
  }

  function matchQuestions(value) {
    var query = normalize(value);
    if (!query) return [];
    return faqs.map(function (faq) {
      var score = 0;
      [faq.question].concat(faq.aliases || []).forEach(function (term) {
        var needle = normalize(term);
        if (!needle || needle.length < 2) return;
        if (query === needle) score = Math.max(score, 100 + needle.length);
        else if (query.indexOf(needle) !== -1) score = Math.max(score, 10 + needle.length);
      });
      return { faq: faq, score: score };
    }).filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3).map(function (item) { return item.faq; });
  }

  function organize(value) {
    var input = String(value || '').slice(0, MAX_INPUT);
    var formats = input.match(/膠囊|胶囊|錠劑|片劑|粉包|粉末|顆粒|果凍|飲品|飲料|茶包|餅乾|糖果/g) || [];
    var quantity = input.match(/(?:\d[\d,]*(?:\.\d+)?\s*(?:萬|千)?\s*(?:盒|瓶|包|袋|條|顆|粒|錠|公斤|kg))/gi) || [];
    var packaging = input.match(/彩盒|外盒|瓶裝|瓶標|標籤|鋁袋|夾鏈袋|玻璃瓶|塑膠瓶|燙金|燙銀|局部光|局部上光|霧膜|亮膜/g) || [];
    var formula = input.match(/(?:[\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9-]{0,18})\s*\d+(?:\.\d+)?\s*(?:mg|毫克|公克|g)(?![A-Za-z])/gi) || [];
    var unique = function (items) { return items.filter(function (item, index) { return items.indexOf(item) === index; }); };
    var lines = ['代工需求草稿（依提供文字整理，請再核對）',
      '劑型：' + (unique(formats).join('、') || '待確認'),
      '數量／單位：' + (unique(quantity).join('、') || '待確認'),
      '包材／工藝：' + (unique(packaging).join('、') || '待確認'),
      '成分／含量：' + (unique(formula).join('、') || '待確認'),
      '待業務確認：每份規格、完整配方、首批數量、包裝尺寸、檢驗需求、目標上市日與正式報價',
      '', '原始需求：', input];
    return { text: lines.join('\n'), hasFormat: formats.length > 0, hasQuantity: quantity.length > 0, hasPackaging: packaging.length > 0 };
  }

  window.BKESupport = { match: matchQuestions, organize: organize };
  if (typeof document === 'undefined' || !document.body || document.getElementById('bke-support-panel')) return;
  var root = document.body.dataset.root || './';
  var contact = root + 'contact/index.html';

  function track(name, detail) {
    if (window.BKETracking && typeof window.BKETracking.record === 'function') window.BKETracking.record(name, detail || {});
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function button(text, cls, handler) {
    var node = el('button', cls, text); node.type = 'button';
    if (handler) node.addEventListener('click', handler);
    return node;
  }

  var launcher = button('智慧客服', 'bke-support-launcher', open);
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'bke-support-panel');
  launcher.setAttribute('aria-haspopup', 'dialog');
  var panel = el('section', 'bke-support-panel');
  panel.id = 'bke-support-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'bke-support-title');
  var head = el('div', 'bke-support-head');
  var titleGroup = el('div');
  var title = el('h2', '', '百達醫智慧客服'); title.id = 'bke-support-title';
  titleGroup.appendChild(title); titleGroup.appendChild(el('p', '', '詢價 FAQ 與需求整理'));
  head.appendChild(titleGroup);
  var closeButton = button('×', 'bke-support-close', close);
  closeButton.setAttribute('aria-label', '關閉智慧客服'); head.appendChild(closeButton);
  panel.appendChild(head);
  var log = el('div', 'bke-support-log'); log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-relevant', 'additions');
  log.setAttribute('aria-label', '客服對話'); log.tabIndex = 0; panel.appendChild(log);
  var quick = el('div', 'bke-support-quick');
  ['最低起訂量', '交期多久', '包裝特殊工藝', '整理詢價需求'].forEach(function (question) {
    quick.appendChild(button(question, '', function () { send(question); }));
  });
  panel.appendChild(quick);
  var form = el('form', 'bke-support-form');
  var inputLabel = el('label', 'bke-support-sr', '你的問題或代工需求'); inputLabel.htmlFor = 'bke-support-input';
  var input = el('textarea'); input.id = 'bke-support-input'; input.rows = 2; input.maxLength = MAX_INPUT;
  input.placeholder = '詢問起訂量、交期，或貼上代工需求';
  var sendButton = el('button', '', '送出'); sendButton.type = 'submit';
  form.appendChild(inputLabel); form.appendChild(input); form.appendChild(sendButton); panel.appendChild(form);
  var foot = el('div', 'bke-support-foot');
  foot.appendChild(el('small', '', '對話留在此頁，轉交時才帶入諮詢表單。'));
  foot.appendChild(button('清除對話', '', function () {
    log.replaceChildren(); turns = 0; draft = ''; input.disabled = false; sendButton.disabled = false;
    input.value = ''; delete input.dataset.organize;
    try { window.sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
    welcome(); input.focus();
  })); panel.appendChild(foot);
  document.body.appendChild(launcher); document.body.appendChild(panel);

  function addMessage(text, user) {
    var article = el('div', 'bke-support-message' + (user ? ' is-user' : ''));
    article.appendChild(el('small', 'bke-support-role', user ? '你' : '百達醫客服'));
    article.appendChild(el('p', '', text)); log.appendChild(article);
    log.scrollTop = log.scrollHeight; return article;
  }
  function safeHref(href) {
    if (typeof href !== 'string') return '';
    if (/^tel:\+?[\d -]+$/.test(href)) return href;
    try {
      var resolved = new URL(href.charAt(0) === '/' ? href.slice(1) : href, new URL(root, window.location.href));
      if (!/^https?:$/.test(resolved.protocol)) return '';
      if (resolved.origin !== window.location.origin && resolved.hostname !== 'shengge820.github.io') return '';
      return resolved.href;
    } catch (e) { return ''; }
  }
  function links(host, items) {
    var group = el('div', 'bke-support-links');
    (items || []).forEach(function (item) {
      var href = safeHref(item.href); if (!href) return;
      var link = el('a', '', item.label); link.href = href;
      if (/^https?:/.test(href) && new URL(href).origin !== window.location.origin) {
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
      group.appendChild(link);
    });
    if (group.childNodes.length) host.appendChild(group);
  }
  function handoff(host, summary) {
    host.appendChild(button('帶入代工諮詢表單', 'bke-support-handoff', function () {
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, text: summary.slice(0, 2400), createdAt: Date.now() }));
        track('support_handoff', { source: 'support' });
        window.location.assign(contact + '?source=support');
      } catch (e) {
        addMessage('瀏覽器無法帶入草稿，請複製需求後開啟代工諮詢表單。');
      }
    }));
    var copy = button('複製需求', 'bke-support-copy', function () {
      if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
        window.navigator.clipboard.writeText(summary).then(function () { copy.textContent = '已複製'; }, function () {
          addMessage('無法使用剪貼簿，請選取上方需求草稿並複製。');
        });
      } else addMessage('請選取上方需求草稿並複製。');
    }); host.appendChild(copy);
    links(host, [{ label: '直接開啟諮詢表單', href: 'contact/index.html' }]);
  }
  function welcome() {
    addMessage('你好！我可以查詢百達醫的代工 FAQ，也能把零散需求整理成詢價草稿。起訂量、交期和正式價格由業務依專案確認。');
  }
  function open() {
    panel.hidden = false; launcher.setAttribute('aria-expanded', 'true'); input.focus();
    track('support_open', {});
  }
  function close() { panel.hidden = true; launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
  panel.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', function (event) { event.preventDefault(); var value = input.value; input.value = ''; send(value); });
  function send(value) {
    var text = String(value || '').trim().slice(0, MAX_INPUT); if (!text) return;
    if (turns >= MAX_TURNS) { addMessage('請先清除對話再繼續，或直接聯繫業務。'); return; }
    turns++; addMessage(text, true);
    if (/^(整理詢價需求|整理需求|需求整理)$/.test(text)) {
      draft = ''; addMessage('請貼上你的代工需求。例如：想做膠囊，首批 3000 瓶，每瓶 60 顆，需要彩盒和燙金。我會保留原文並列出待確認項目。');
      input.dataset.organize = 'true'; input.focus(); return;
    }
    if (input.dataset.organize === 'true' || /整理.*(?:詢價|需求)|(?:想做|要做|開發).*(?:膠囊|粉包|錠劑|果凍|飲品)|\d[\d,]*\s*(?:盒|瓶).*(?:膠囊|彩盒|燙金)/.test(text)) {
      delete input.dataset.organize;
      var result = organize(text); draft = result.text;
      var summary = addMessage(result.text); handoff(summary, draft);
      track('support_draft_created', { has_format: result.hasFormat, has_quantity: result.hasQuantity, has_packaging: result.hasPackaging });
    } else if (/真人|人工|業務|聯絡|電話/.test(text) && !matchQuestions(text).length) {
      var human = addMessage('可以聯絡百達醫業務，電話 02-8521-9269。也可以帶入這次問題，由業務依專案回覆。');
      handoff(human, '客服待確認問題：\n' + text);
    } else if (/治療|疾病|糖尿病|藥物|服藥|孕婦|孕期|合法|法規|合規|療效/.test(text)) {
      var qualified = addMessage('這類問題需要依完整配方、使用情境與適用規範確認。客服知識庫無法判定療效、用藥或法規符合性，請交由業務與適當專業人員審核。');
      handoff(qualified, '需專業確認的問題：\n' + text);
      track('support_unanswered', { category: 'requires_review' });
    } else {
      var matches = matchQuestions(text);
      if (matches.length) {
        matches.forEach(function (faq) {
          var response = addMessage(faq.answer); links(response, faq.links);
          track('support_faq_answer', { faq_id: faq.id });
        });
      } else {
        var unknown = addMessage('目前知識庫沒有可確認的答案。你可以問起訂量、交期、劑型、包材或詢價流程，也可以把這個問題交給業務。');
        handoff(unknown, '客服待確認問題：\n' + text);
        track('support_unanswered', { category: 'unknown' });
      }
    }
    if (turns >= MAX_TURNS) { input.disabled = true; sendButton.disabled = true; addMessage('本次對話已達上限。可以轉交業務，或清除對話後繼續。'); }
    log.scrollTop = log.scrollHeight;
  }
  welcome();
  // A deliberate shortcut from the presentation entry opens the same widget.
  try {
    if (new URLSearchParams(window.location.search).get('support') === 'open') open();
  } catch (e) {}
})();
