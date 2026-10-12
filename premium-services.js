/* 能做什麼: the 產品開發 tabs (layout A), the sticky stage bar, and the
   switcher between the three layout proposals. */
(function () {
  'use strict';

  var bar = document.querySelector('.cap-steps ol');
  var barLinks = bar ? bar.querySelectorAll('a') : [];
  function lightUp(id) {
    var current = null;
    barLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      if (on) { a.setAttribute('aria-current', 'step'); current = a; } else a.removeAttribute('aria-current');
    });
    // on phones the bar scrolls sideways; keep the lit stage in view
    if (current && bar.scrollWidth > bar.clientWidth) {
      var li = current.parentNode;
      bar.scrollTo({ left: li.offsetLeft - (bar.clientWidth - li.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

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
  }

  function select(tab, focus, animate) {
    var previous = activeTab;
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
    var token = ++switchToken;
    var oldPanel = panelOf(previous);
    var newPanel = panelOf(tab);
    tabs.forEach(function (t) { panelOf(t).classList.remove('is-entering', 'is-leaving'); });
    panelsWrap.style.height = panelsWrap.offsetHeight + 'px';
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
      panelOf(t).querySelectorAll('.cap-group-label, li').forEach(function (el, n) { el.style.setProperty('--i', Math.min(n, 14)); });
    });
    var fromHash = tabFor(location.hash.slice(1));
    select(fromHash || tabs[0]);
    if (fromHash) document.getElementById('develop').scrollIntoView();
    window.addEventListener('resize', moveIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false, true); lightUp(tab.getAttribute('aria-controls')); });
      tab.addEventListener('keydown', function (e) {
        var next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        var t = tabs[(next + tabs.length) % tabs.length];
        select(t, true, true);
        lightUp(t.getAttribute('aria-controls'));
      });
    });
    // stage-bar links to a panel open that tab and scroll to the block
    barLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var tab = tabFor(a.getAttribute('href').slice(1));
        if (!tab) return;
        e.preventDefault();
        select(tab, false, true);
        lightUp(tab.getAttribute('aria-controls'));
        document.getElementById('develop').scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', a.getAttribute('href'));
      });
    });
  }

  // ---- stage bar: light the stage on screen
  if (barLinks.length && 'IntersectionObserver' in window) {
    var watched = [];
    barLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var el = tabFor(id) ? document.getElementById('develop') : document.getElementById(id);
      if (el && watched.indexOf(el) < 0) watched.push(el);
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        lightUp(id === 'develop' && activeTab ? activeTab.getAttribute('aria-controls') : id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    watched.forEach(function (el) { observer.observe(el); });
  }

  // ---- proposal switcher (A is the live page)
  var VERSIONS = [['index.html', 'A'], ['capability-b.html', 'B'], ['capability-c.html', 'C']];
  var here = decodeURIComponent(location.pathname.split('/').pop()) || 'index.html';
  var nav = document.createElement('nav');
  nav.className = 'cap-versions';
  nav.setAttribute('aria-label', '能做什麼排版提案切換');
  nav.innerHTML = VERSIONS.map(function (v) {
    return '<a href="./' + v[0] + '"' + (v[0] === here ? ' aria-current="page"' : '') + ' aria-label="排版提案 ' + v[1] + '">' + v[1] + '</a>';
  }).join('');
  document.body.appendChild(nav);
})();
