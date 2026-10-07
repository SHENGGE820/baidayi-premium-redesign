/* Inquiry list: collect catalogue styles, dosage forms, packaging and
 * functional directions while browsing, then send them with the enquiry.
 *
 * The site is static — no server, no accounts — so the list lives in the
 * visitor's own browser (localStorage) and reaches the client only as part of
 * a submitted enquiry: premium-contact.js appends summaryLines() to the
 * message it already sends to the Google Form. It survives closing the tab,
 * but not a change of device or browser.
 *
 * Most catalogue styles carry no caption; their codes and specs are printed
 * inside the image. So a style is named by its page, group and position
 * ("動物膠囊・尺寸 0 號 第 3 款") and the summary carries the image URL, which
 * shows the client exactly which one was picked.
 *
 * Everything that reaches the DOM goes through textContent or a URL check;
 * stored entries are re-validated on every read, since localStorage is
 * writable by anyone at the keyboard.
 */
(function () {
  'use strict';

  var KEY = 'bke-inquiry-v1';
  var MAX_ITEMS = 60;
  var KINDS = { style: 1, format: 1, 'function': 1 };

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function text(value, max) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }

  /* Only same-origin http(s) URLs are kept, so a tampered entry cannot turn
     into a javascript: link or pull an image from somewhere else. */
  function sameOrigin(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin) return '';
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return parsed.href;
    } catch (e) { return ''; }
  }

  function clean(item) {
    if (!item || typeof item !== 'object') return null;
    var id = text(item.id, 300);
    var kind = Object.prototype.hasOwnProperty.call(KINDS, item.kind) ? item.kind : '';
    var name = text(item.name, 80);
    if (!id || !kind || !name) return null;
    return {
      id: id,
      kind: kind,
      group: text(item.group, 40),
      name: name,
      img: sameOrigin(item.img),
      page: sameOrigin(item.page)
    };
  }

  function list() {
    var store = storage();
    if (!store) return [];
    try {
      var raw = JSON.parse(store.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      var seen = {};
      return raw.map(clean).filter(function (item) {
        if (!item || seen[item.id]) return false;
        seen[item.id] = true;
        return true;
      }).slice(0, MAX_ITEMS);
    } catch (e) { return []; }
  }

  function write(items) {
    var store = storage();
    if (!store) return false;
    try { store.setItem(KEY, JSON.stringify(items)); return true; } catch (e) { return false; }
  }

  var listeners = [];
  function changed(detail) { listeners.forEach(function (fn) { fn(list(), detail); }); }

  function has(id) { return list().some(function (item) { return item.id === id; }); }

  function add(item) {
    var entry = clean(item);
    if (!entry) return { ok: false, reason: 'invalid' };
    var items = list();
    if (items.some(function (x) { return x.id === entry.id; })) return { ok: true, items: items };
    if (items.length >= MAX_ITEMS) return { ok: false, reason: 'full' };
    items.push(entry);
    if (!write(items)) return { ok: false, reason: 'storage' };
    changed({ type: 'add', item: entry });
    return { ok: true, items: items };
  }

  function remove(id) {
    var items = list();
    var gone = items.filter(function (x) { return x.id === id; })[0];
    items = items.filter(function (x) { return x.id !== id; });
    write(items);
    changed({ type: 'remove', item: gone });
    return items;
  }

  function clear() { write([]); changed({ type: 'clear' }); }

  var KIND_LABEL = { style: '樣式', format: '劑型／包材', 'function': '功能方向' };

  /* One line per item, for the enquiry the client receives. */
  function summaryLines(items) {
    return (items || list()).map(function (item) {
      var label = item.kind === 'function' ? '功能方向' : (item.group || KIND_LABEL[item.kind]);
      var line = '- ' + label + '｜' + item.name;
      if (item.kind === 'style' && item.img) line += '（圖：' + item.img + '）';
      return line;
    });
  }

  /* The form's own select options, so a pick can prefill them. */
  function typeFor(item) {
    var s = (item.group || '') + ' ' + item.name;
    if (/膠囊/.test(s)) return '膠囊';
    if (/錠/.test(s)) return '錠劑';
    if (/粉|隨身袋|顆粒/.test(s)) return '粉包／顆粒';
    if (/果凍/.test(s)) return '果凍';
    if (/飲品|口栓|異型袋|玻璃瓶/.test(s)) return '飲品';
    return '';
  }

  var api = {
    list: list, has: has, add: add, remove: remove, clear: clear,
    summaryLines: summaryLines, typeFor: typeFor,
    onChange: function (fn) { listeners.push(fn); }
  };
  window.BKEInquiry = api;

  if (typeof document === 'undefined' || !document.body) return;

  /* ======================================================================
     Page layer
     ====================================================================== */
  var body = document.body;
  var root = body.dataset.root || './';
  var contactUrl = root + 'contact/index.html';
  var isContact = body.classList.contains('contact-page');
  var toggles = [];

  function el(tag, cls, content) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  }

  var live = el('div', 'inquiry-live');
  live.setAttribute('aria-live', 'polite');
  body.appendChild(live);
  function announce(message) { live.textContent = ''; setTimeout(function () { live.textContent = message; }, 30); }

  function paintToggle(t) {
    var on = has(t.item.id);
    t.button.setAttribute('aria-pressed', on ? 'true' : 'false');
    t.button.textContent = on ? '✓ 已加入詢價' : '＋ 加入詢價';
    t.button.setAttribute('aria-label', (on ? '從詢價清單移除：' : '加入詢價清單：') + (t.item.group ? t.item.group + ' ' : '') + t.item.name);
    if (t.card) t.card.classList.toggle('is-inquiry-selected', on);
  }

  function makeToggle(item, card, extraClass) {
    var button = el('button', 'inquiry-toggle' + (extraClass ? ' ' + extraClass : ''));
    button.type = 'button';
    var t = { item: item, button: button, card: card };
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (has(item.id)) {
        remove(item.id);
        announce('已移除：' + item.name + '。清單共 ' + list().length + ' 項。');
      } else {
        var result = add(item);
        if (result.ok) {
          announce('已加入：' + item.name + '。清單共 ' + result.items.length + ' 項。');
          if (window.BKETracking && (item.kind === 'style' || item.kind === 'format')) {
            window.BKETracking.record('select_packaging_spec', { item_kind: item.kind, inquiry_count: result.items.length });
          }
        }
        else if (result.reason === 'full') announce('清單最多 ' + MAX_ITEMS + ' 項，請先移除一些再加入。');
        else announce('這個瀏覽器無法儲存清單，請直接在需求說明中寫下想詢問的項目。');
      }
    });
    toggles.push(t);
    paintToggle(t);
    return button;
  }

  var pageUrl = window.location.href.split('#')[0].split('?')[0];
  var pageTitle = text((document.querySelector('main h1') || {}).textContent, 40);

  // 1. Catalogue styles on the dosage-form and packaging pages.
  document.querySelectorAll('figure.spec-item').forEach(function (figure) {
    var group = figure.closest('.spec-group');
    var head = group && group.querySelector('.spec-group-head h2');
    var siblings = group ? Array.prototype.slice.call(group.querySelectorAll('figure.spec-item')) : [figure];
    var caption = figure.querySelector('figcaption');
    var img = figure.querySelector('img');
    var groupLabel = text(head && head.textContent, 30);
    var name = text(caption && caption.textContent, 60) ||
      ((groupLabel ? groupLabel + ' ' : '') + '第 ' + (siblings.indexOf(figure) + 1) + ' 款');
    var item = {
      id: 'style:' + pageUrl + '#' + (img ? img.getAttribute('src') : name),
      kind: 'style', group: pageTitle, name: name,
      img: img ? img.src : '', page: pageUrl
    };
    figure.appendChild(makeToggle(item, figure, 'inquiry-toggle-block'));
  });

  // 2. Dosage-form and packaging cards. The whole card is a link, and a
  //    button cannot sit inside one, so the card gets a wrapper to hold it.
  document.querySelectorAll('.catalogue-grid:not(.catalogue-grid-ingredient) > a.catalogue-card').forEach(function (card) {
    var title = text((card.querySelector('h3') || {}).textContent, 40);
    if (!title) return;
    var section = card.closest('section');
    var sectionTitle = text(section && (section.querySelector('h2') || {}).textContent, 30);
    var img = card.querySelector('img');
    var host = el('div', 'inquiry-host');
    card.parentNode.insertBefore(host, card);
    host.appendChild(card);
    host.appendChild(makeToggle({
      id: 'format:' + title, kind: 'format',
      group: sectionTitle === '可製作的劑型' ? '多元劑型' : sectionTitle,
      name: title, img: img ? img.src : '', page: card.href
    }, card, 'inquiry-toggle-overlay'));
  });

  // 3. Functional directions: the overview cards, and each direction's page.
  document.querySelectorAll('article.service-overview-card[id]').forEach(function (card) {
    if (!/\/功能配方\/|%E5%8A%9F%E8%83%BD%E9%85%8D%E6%96%B9/.test(window.location.pathname)) return;
    var name = text((card.querySelector('h3') || {}).textContent, 30);
    if (!name) return;
    var fnImg = card.querySelector('.function-card-media');
    card.appendChild(makeToggle({ id: 'function:' + card.id, kind: 'function', group: '功能方向', name: name, img: fnImg ? fnImg.src : '', page: pageUrl + '#' + card.id }, card, 'inquiry-toggle-inline'));
  });
  var fnMatch = decodeURIComponent(window.location.pathname).match(/\/功能配方\/([a-z0-9-]+)\/?(?:index\.html)?$/);
  var heroCopy = document.querySelector('.inner-hero-card .inner-hero-copy');
  if (fnMatch && heroCopy && pageTitle) {
    var heroImg = document.querySelector('.inner-hero-card-media img');
    heroCopy.appendChild(makeToggle({ id: 'function:' + fnMatch[1], kind: 'function', group: '功能方向', name: pageTitle, img: heroImg ? heroImg.src : '', page: pageUrl }, null, 'inquiry-toggle-hero'));
  }

  // A one-line hint above the first thing that can be picked on a page.
  var firstPickable = document.querySelector('.spec-group, .catalogue-grid:not(.catalogue-grid-ingredient), .service-overview');
  if (toggles.length && firstPickable && !isContact && !document.querySelector('.hero')) {
    var onFunctions = firstPickable.classList.contains('service-overview');
    var hint = el('p', 'inquiry-hint', onFunctions
      ? '看到想開發的方向，按「＋ 加入詢價」收進清單，最後一起送出。'
      : '看到想詢問的款式，按「＋ 加入詢價」收進清單，最後一起送出。');
    firstPickable.parentNode.insertBefore(hint, firstPickable);
  }

  /* ---------------- tray + drawer ---------------- */
  var tray = el('button', 'floating-consult inquiry-tray');
  tray.type = 'button';
  tray.setAttribute('aria-haspopup', 'dialog');
  var trayLabel = el('span', 'inquiry-tray-label');
  trayLabel.appendChild(document.createTextNode('詢價'));
  trayLabel.appendChild(document.createElement('br'));
  trayLabel.appendChild(document.createTextNode('清單'));
  var trayCount = el('span', 'inquiry-tray-count');
  tray.appendChild(trayLabel);
  tray.appendChild(trayCount);
  body.appendChild(tray);

  var drawer = el('div', 'inquiry-drawer');
  drawer.hidden = true;
  var backdrop = el('div', 'inquiry-backdrop');
  var panel = el('div', 'inquiry-panel-drawer');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'inquiry-drawer-title');
  var head = el('div', 'inquiry-drawer-head');
  var headText = el('div');
  headText.appendChild(el('p', 'eyebrow eyebrow-dark', 'INQUIRY LIST'));
  var h2 = el('h2', '', '詢價清單');
  h2.id = 'inquiry-drawer-title';
  headText.appendChild(h2);
  var close = el('button', 'inquiry-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '關閉詢價清單');
  head.appendChild(headText);
  head.appendChild(close);
  var drawerList = el('ul', 'inquiry-list');
  var foot = el('div', 'inquiry-drawer-foot');
  var clearBtn = el('button', 'inquiry-clear', '清空清單');
  clearBtn.type = 'button';
  var go = el('a', 'button button-dark inquiry-go');
  go.href = contactUrl;
  go.appendChild(document.createTextNode('帶著清單去諮詢 '));
  var arrow = el('span', '', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  go.appendChild(arrow);
  foot.appendChild(clearBtn);
  foot.appendChild(go);
  panel.appendChild(head);
  panel.appendChild(drawerList);
  panel.appendChild(foot);
  drawer.appendChild(backdrop);
  drawer.appendChild(panel);
  if (!isContact) body.appendChild(drawer);

  function renderList(target, items, emptyText) {
    target.textContent = '';
    if (!items.length) { target.appendChild(el('li', 'inquiry-empty', emptyText)); return; }
    items.forEach(function (item) {
      var li = el('li', 'inquiry-row');
      if (item.img) {
        var thumb = el('img', 'inquiry-thumb');
        thumb.src = item.img;
        thumb.alt = '';
        thumb.loading = 'lazy';
        li.appendChild(thumb);
      } else {
        li.appendChild(el('span', 'inquiry-thumb inquiry-thumb-empty'));
      }
      var words = el('div', 'inquiry-row-text');
      words.appendChild(el('small', '', item.kind === 'function' ? '功能方向' : (item.group || KIND_LABEL[item.kind])));
      if (item.page) {
        var link = el('a', '', item.name);
        link.href = item.page;
        words.appendChild(link);
      } else {
        words.appendChild(el('strong', '', item.name));
      }
      li.appendChild(words);
      var rm = el('button', 'inquiry-remove', '移除');
      rm.type = 'button';
      rm.setAttribute('aria-label', '移除：' + item.name);
      rm.addEventListener('click', function () {
        remove(item.id);
        announce('已移除：' + item.name + '。清單共 ' + list().length + ' 項。');
      });
      li.appendChild(rm);
      target.appendChild(li);
    });
  }

  var lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    renderList(drawerList, list(), '清單是空的。');
    drawer.hidden = false;
    document.documentElement.classList.add('inquiry-open');
    close.focus();
  }
  function closeDrawer() {
    drawer.hidden = true;
    document.documentElement.classList.remove('inquiry-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  /* On the contact page the list is already beside the form, so the tray
     takes the visitor to it instead of opening a second copy. */
  tray.addEventListener('click', function () {
    if (inline) {
      inline.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      inlineTitle.focus({ preventScroll: true });
    } else openDrawer();
  });
  close.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !drawer.hidden) closeDrawer();
    // keep Tab inside the open dialog
    if (event.key === 'Tab' && !drawer.hidden) {
      var focusable = panel.querySelectorAll('button, a[href]');
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  clearBtn.addEventListener('click', function () {
    clear();
    announce('已清空詢價清單。');
  });

  /* ---------------- contact page: the list beside the form ---------------- */
  var form = document.querySelector('[data-premium-contact-form]');
  var inline = null, inlineList = null, inlineCount = null, inlineNote = null, inlineTitle = null;
  if (isContact && form) {
    inline = el('section', 'inquiry-inline');
    inline.setAttribute('aria-labelledby', 'inquiry-inline-title');
    var ih = el('div', 'inquiry-inline-head');
    var ititle = el('h3', '', '你的詢價清單');
    ititle.id = 'inquiry-inline-title';
    ititle.tabIndex = -1;
    inlineTitle = ititle;
    inlineCount = el('span', 'inquiry-inline-count');
    ih.appendChild(ititle);
    ih.appendChild(inlineCount);
    var iclear = el('button', 'inquiry-clear', '清空清單');
    iclear.type = 'button';
    iclear.addEventListener('click', function () { clear(); announce('已清空詢價清單。'); });
    ih.appendChild(iclear);
    inlineNote = el('p', 'inquiry-inline-note', '這些項目會附在需求說明後面，隨表單一起送出。');
    inlineList = el('ul', 'inquiry-list');
    inline.appendChild(ih);
    inline.appendChild(inlineNote);
    inline.appendChild(inlineList);
    /* Inside the form, spanning its two-column grid. Placed before the form it
       became a third item in the page's two-column layout and pushed the form
       under the sticky contact details, where the two overlapped on scroll. */
    form.insertBefore(inline, form.firstChild);

    /* Prefill the two selects from the list, but never over a choice already
       made — by the visitor, or by a ?format= / ?function= link. */
    var items = list();
    var typeSelect = form.querySelector('#contact-type');
    var fnSelect = form.querySelector('#contact-function');
    function setIfEmpty(select, value) {
      if (!select || select.value || !value) return;
      if (Array.prototype.some.call(select.options, function (o) { return o.value === value; })) select.value = value;
    }
    for (var i = 0; i < items.length && typeSelect && !typeSelect.value; i++) setIfEmpty(typeSelect, typeFor(items[i]));
    for (var j = 0; j < items.length && fnSelect && !fnSelect.value; j++) if (items[j].kind === 'function') setIfEmpty(fnSelect, items[j].name);

    form.addEventListener('submit', function () {
      if (list().length) inlineNote.textContent = '清單已附在這次送出的內容裡。確認 Google 表單顯示送出成功後，可以按「清空清單」。';
    });
  }

  function refresh(items) {
    var n = items.length;
    body.classList.toggle('has-inquiry', n > 0);
    trayCount.textContent = String(n);
    tray.setAttribute('aria-label', '開啟詢價清單，共 ' + n + ' 項');
    toggles.forEach(paintToggle);
    if (!drawer.hidden) renderList(drawerList, items, '清單是空的。');
    if (inline) {
      inline.hidden = n === 0;
      inlineCount.textContent = n + ' 項';
      renderList(inlineList, items, '');
    }
  }
  api.onChange(function (items, detail) {
    refresh(items);
    if (detail && detail.type === 'add') {
      tray.classList.remove('is-bumped');
      void tray.offsetWidth;
      tray.classList.add('is-bumped');
    }
  });
  // Another tab changed the list.
  window.addEventListener('storage', function (event) { if (event.key === KEY) refresh(list()); });
  refresh(list());
})();
