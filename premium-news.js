(function () {
  'use strict';
  var buttons = Array.from(document.querySelectorAll('[data-news-filter]'));
  var cards = Array.from(document.querySelectorAll('[data-news-category]'));
  if (!buttons.length || !cards.length) return;

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.dataset.newsFilter;
      buttons.forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      cards.forEach(function (card) {
        card.hidden = value !== 'all' && card.dataset.newsCategory !== value;
      });
    });
  });
})();
