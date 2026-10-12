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
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    activeTab = tab;
    if (focus) tab.focus();
  }
  function tabFor(id) {
    for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('aria-controls') === id) return tabs[i];
    return null;
  }
  if (tabs.length) {
    document.getElementById('develop').classList.add('is-ready');
    var fromHash = tabFor(location.hash.slice(1));
    select(fromHash || tabs[0]);
    if (fromHash) document.getElementById('develop').scrollIntoView();
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); lightUp(tab.getAttribute('aria-controls')); });
      tab.addEventListener('keydown', function (e) {
        var next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        var t = tabs[(next + tabs.length) % tabs.length];
        select(t, true);
        lightUp(t.getAttribute('aria-controls'));
      });
    });
    // stage-bar links to a panel open that tab and scroll to the block
    barLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var tab = tabFor(a.getAttribute('href').slice(1));
        if (!tab) return;
        e.preventDefault();
        select(tab);
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
