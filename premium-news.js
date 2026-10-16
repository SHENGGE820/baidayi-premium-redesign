(function () {
  'use strict';
  var outline = document.querySelector('.article-outline details');
  if (outline && window.matchMedia('(max-width: 1000px)').matches) outline.open = false;
  var buttons = Array.from(document.querySelectorAll('[data-news-filter]'));
  var cards = Array.from(document.querySelectorAll('[data-news-category]'));
  var results = document.querySelector('[data-news-results]');
  function updateCards(value) {
    var visible = [];
    cards.forEach(function (card) {
      card.hidden = value !== 'all' && card.dataset.newsCategory !== value;
      card.classList.remove('article-card-featured');
      if (!card.hidden) visible.push(card);
    });
    if (visible[0]) visible[0].classList.add('article-card-featured');
    if (results) results.textContent = (value === 'all' ? '全部文章' : value) + ' · ' + visible.length + ' 篇';
  }
  if (cards.length) updateCards('all');

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.dataset.newsFilter;
      buttons.forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      updateCards(value);
    });
  });
})();
