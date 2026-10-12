/* 能做什麼: light up the stage in the sticky bar that is currently on screen. */
(function () {
  'use strict';
  var links = document.querySelectorAll('.cap-steps a');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      var current = byId[entry.target.id];
      if (!current) return;
      current.setAttribute('aria-current', 'step');
      // on phones the bar scrolls sideways; keep the lit stage in view
      var bar = current.closest('ol');
      var li = current.parentNode;
      if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: li.offsetLeft - (bar.clientWidth - li.offsetWidth) / 2, behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(byId).forEach(function (id) {
    var section = document.getElementById(id);
    if (section) observer.observe(section);
  });
})();
