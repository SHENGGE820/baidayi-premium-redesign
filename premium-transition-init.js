(function () {
  'use strict';

  var key = 'bke-page-transition';
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sessionStorage.removeItem(key);
      return;
    }
    if (sessionStorage.getItem(key) !== '1') return;
    sessionStorage.removeItem(key);
    document.documentElement.classList.add('motion-arriving');

    // If the main motion file cannot load, never leave the new page covered.
    window.setTimeout(function () {
      document.documentElement.classList.remove('motion-arriving', 'motion-arrival-release');
    }, 1800);
  } catch (error) {
    // Storage can be unavailable in strict privacy modes; navigation still works.
  }
})();
