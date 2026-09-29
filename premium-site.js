(function () {
  'use strict';

  var header = document.querySelector('[data-site-header]');
  var menuButton = document.querySelector('[data-menu-toggle]');
  var navigation = document.querySelector('[data-primary-nav]');

  function syncHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  }

  if (menuButton && navigation) {
    menuButton.addEventListener('click', function () {
      var open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      navigation.classList.toggle('is-open', !open);
      document.body.classList.toggle('menu-open', !open);
    });

    navigation.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) closeMenu();
    }, { passive: true });
  }

  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  if (document.body.classList.contains('function-page')) {
    var siteRoot = document.body.dataset.root || './';
    document.querySelectorAll('.service-overview-card').forEach(function (card) {
      var title = card.querySelector('h3');
      if (!title || card.querySelector('.function-card-cta')) return;
      var link = document.createElement('a');
      link.className = 'function-card-cta';
      link.href = siteRoot + 'contact/index.html?function=' + encodeURIComponent(title.textContent.trim());
      link.innerHTML = '以此方向諮詢 <span aria-hidden="true">↗</span>';
      card.appendChild(link);
    });
  }

  var revealItems = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.forEach(function (item) { observer.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }

  // Native fragment navigation preserves focus, URL history and modified clicks.
  // CSS supplies smooth scrolling, reduced-motion support and header clearance.

  /* Homepage factory loop. The markup ships with preload="none" and the
     source held in data-src, so nothing downloads until this decides to play
     it. Visitors who asked for reduced motion, or for reduced data, keep the
     poster — a still from the same shoot — and never fetch the 2MB file. If
     this script never runs, the poster is what everyone sees, which is a
     complete hero on its own. */
  var heroVideo = document.querySelector('[data-hero-video]');
  if (heroVideo) {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!reduceMotion && !saveData) {
      var source = heroVideo.querySelector('source[data-src]');
      source.src = source.getAttribute('data-src');
      heroVideo.load();
      var start = function () {
        var playing = heroVideo.play();
        // Autoplay can still be refused (battery saver, some in-app browsers);
        // the poster stays up, which is fine.
        if (playing && playing.catch) playing.catch(function () {});
      };
      start();
      /* A page opened in a background tab has its autoplay deferred or
         refused, and some browsers pause video-only media while hidden. Try
         again whenever the page comes back into view. */
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && heroVideo.paused) start();
      });
    }
  }
})();
