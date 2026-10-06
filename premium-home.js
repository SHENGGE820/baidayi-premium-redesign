/* Homepage: hide the floating consult button while the hero, which carries
   its own consult button, is on screen. Without JavaScript or
   IntersectionObserver the button simply stays visible. */
(function () {
  'use strict';
  var hero = document.querySelector('.corporate-home .hero');
  if (!hero || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    document.body.classList.toggle('hero-in-view', entries[0].isIntersecting);
  }, { rootMargin: '0px 0px -40% 0px' }).observe(hero);
})();
