/* 能做什麼: the 產品開發 tabs (layout A) and the switcher between the three
   layout proposals. */
(function () {
  'use strict';

  // ---- layout A: tabs. Panels all show until this runs.
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.cap-tabs [role="tab"]'));
  var activeTab = null;
  var list = tabs.length ? tabs[0].parentNode : null;
  var panelsWrap = list ? list.parentNode.querySelector('.cap-tabs-panels') : null;
  var indicator = null;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var switchToken = 0;
  var panelOf = function (t) { return document.getElementById(t.getAttribute('aria-controls')); };

  // gold bar that slides to the chosen title (down the side, or under it on phones)
  function moveIndicator() {
    if (!indicator || !activeTab) return;
    var across = getComputedStyle(list).flexDirection === 'row';
    indicator.classList.toggle('is-across', across);
    indicator.style.transform = across ? 'translateX(' + activeTab.offsetLeft + 'px)' : 'translateY(' + activeTab.offsetTop + 'px)';
    indicator.style[across ? 'width' : 'height'] = (across ? activeTab.offsetWidth : activeTab.offsetHeight) + 'px';
    indicator.style[across ? 'height' : 'width'] = '';
  }

  function show(tab) {
    tabs.forEach(function (t) { panelOf(t).hidden = t !== tab; });
    window.dispatchEvent(new CustomEvent('bke:cap-panel-visible', { detail: { id: tab.getAttribute('aria-controls') } }));
  }

  function select(tab, focus, animate) {
    // A rapid second choice must use the panel actually on screen, not the
    // selected tab whose delayed transition has not displayed its panel yet.
    var previous = tabs.find(function (t) { return !panelOf(t).hidden; });
    var currentHeight = panelsWrap.offsetHeight;
    var token = ++switchToken;
    tabs.forEach(function (t) { panelOf(t).classList.remove('is-entering', 'is-leaving'); });
    panelsWrap.style.height = '';
    panelsWrap.classList.remove('is-switching');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    activeTab = tab;
    moveIndicator();
    if (focus) tab.focus();
    if (!animate || calm || !previous || previous === tab) { show(tab); return; }

    // the old panel fades up and out, the box eases to the new height,
    // then the new panel's heading and items rise in one after another
    var oldPanel = panelOf(previous);
    var newPanel = panelOf(tab);
    panelsWrap.style.height = currentHeight + 'px';
    panelsWrap.classList.add('is-switching');
    oldPanel.classList.add('is-leaving');
    setTimeout(function () {
      if (token !== switchToken) return;
      oldPanel.classList.remove('is-leaving');
      show(tab);
      newPanel.classList.add('is-entering');
      panelsWrap.style.height = newPanel.offsetHeight + 'px';
      setTimeout(function () {
        if (token !== switchToken) return;
        panelsWrap.style.height = '';
        panelsWrap.classList.remove('is-switching');
      }, 520);
      setTimeout(function () { if (token === switchToken) newPanel.classList.remove('is-entering'); }, 1400);
    }, 190);
  }
  function tabFor(id) {
    if (/^formula-/.test(id)) id = 'formula';
    if (/^format-/.test(id)) id = 'formats';
    if (/^packaging-/.test(id)) id = 'packaging';
    if (/^(?:category-|materials-)/.test(id) || id === 'ingredient-library') id = 'ingredients';
    for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('aria-controls') === id) return tabs[i];
    return null;
  }
  if (tabs.length) {
    document.getElementById('develop').classList.add('is-ready');
    indicator = document.createElement('span');
    indicator.className = 'cap-tabs-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    list.appendChild(indicator);
    // stagger order for the items in each panel
    tabs.forEach(function (t) {
      panelOf(t).querySelectorAll('.cap-group-label, li, details.ingredient-category').forEach(function (el, n) { el.style.setProperty('--i', Math.min(n, 14)); });
    });
    var fromHash = tabFor(location.hash.slice(1));
    select(fromHash || tabs[0]);
    if (fromHash) document.getElementById('develop').scrollIntoView();
    window.addEventListener('resize', moveIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false, true); });
      tab.addEventListener('keydown', function (e) {
        var next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        var t = tabs[(next + tabs.length) % tabs.length];
        select(t, true, true);
      });
    });
    window.addEventListener('hashchange', function () {
      var target = tabFor(location.hash.slice(1));
      if (target) select(target, false, false);
    });
    function releasePanelHeight() {
      panelsWrap.style.height = '';
      panelsWrap.classList.remove('is-switching');
    }
    // Let the ingredient accordion own its height while it is expanding.
    // Two nested height transitions would make the outer box lag and clip it.
    ['click', 'input'].forEach(function (event) {
      panelsWrap.addEventListener(event, function (e) {
        if (e.target.closest('.cap-ingredient-library')) releasePanelHeight();
      }, true);
    });
    // Searching or opening ingredients can change the entering panel's
    // height while the tab transition is still running; do not clip it.
    if ('ResizeObserver' in window) {
      var panelObserver = new ResizeObserver(function () {
        if (panelsWrap.classList.contains('is-switching') && activeTab && !panelOf(activeTab).hidden) {
          if (panelOf(activeTab).querySelector('.ingredient-panel-slot.is-moving')) releasePanelHeight();
          else panelsWrap.style.height = panelOf(activeTab).offsetHeight + 'px';
        }
      });
      tabs.forEach(function (tab) { panelObserver.observe(panelOf(tab)); });
    }
  }

  // ---- layout C: strips. The native scrollbar is hidden; arrows, edge
  // fades and mouse dragging take its place.
  document.querySelectorAll('.cap-strip-track').forEach(function (track) {
    var group = track.parentNode;
    var bar = document.createElement('div');
    bar.className = 'cap-strip-bar';
    var label = group.querySelector('.cap-group-label');
    if (label) bar.appendChild(label);
    var nav = document.createElement('div');
    nav.className = 'cap-strip-nav';
    nav.innerHTML = '<button type="button" data-dir="-1" aria-label="上一組"><span aria-hidden="true">←</span></button><button type="button" data-dir="1" aria-label="下一組"><span aria-hidden="true">→</span></button>';
    bar.appendChild(nav);
    group.insertBefore(bar, track);
    var frame = document.createElement('div');
    frame.className = 'cap-strip-frame';
    group.insertBefore(frame, track);
    frame.appendChild(track);
    var prev = nav.firstChild, next = nav.lastChild;

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      var overflow = max > 2;
      group.classList.toggle('has-overflow', overflow);
      frame.classList.toggle('can-left', overflow && track.scrollLeft > 2);
      frame.classList.toggle('can-right', overflow && track.scrollLeft < max - 2);
      prev.setAttribute('aria-disabled', !(track.scrollLeft > 2));
      next.setAttribute('aria-disabled', !(track.scrollLeft < max - 2));
    }
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      track.scrollBy({ left: Number(b.dataset.dir) * track.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    // drag with a mouse; a drag that moved is not a click on the item
    var startX = 0, startLeft = 0, dragging = false, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
  });

  // ---- proposal switcher (A is the live page)
  var VERSIONS = [['index.html', 'A'], ['capability-c.html', 'C']];
  var here = decodeURIComponent(location.pathname.split('/').pop()) || 'index.html';
  var nav = document.createElement('nav');
  nav.className = 'cap-versions';
  nav.setAttribute('aria-label', '能做什麼排版提案切換');
  nav.innerHTML = VERSIONS.map(function (v) {
    return '<a href="./' + v[0] + '"' + (v[0] === here ? ' aria-current="page"' : '') + ' aria-label="排版提案 ' + v[1] + '">' + v[1] + '</a>';
  }).join('');
  document.body.appendChild(nav);
})();
