(function () {
  'use strict';

  var body = document.body;
  var root = body.dataset.root || './';
  var active = body.dataset.active || '';

  function url(path) {
    return root + path;
  }

  var navItems = [
    ['about', '品牌實力', '認識百達醫/關於百達醫/index.html'],
    ['research', '研發與品質', '研發科技/index.html'],
    ['service', '解決方案', '全面性服務/一站式服務/index.html'],
    ['news', '洞察觀點', '最新消息/index.html'],
    ['contact', '聯絡我們', 'contact/index.html']
  ];

  var headerMount = document.querySelector('[data-premium-header]');
  if (headerMount) {
    var nav = navItems.map(function (item) {
      var current = item[0] === active ? ' class="is-current" aria-current="page"' : '';
      return '<a href="' + url(item[2]) + '"' + current + '>' + item[1] + '</a>';
    }).join('');

    headerMount.outerHTML =
      '<header class="site-header is-scrolled" data-site-header>' +
        '<div class="header-inner">' +
          '<a class="brand" href="' + url('index.html') + '" aria-label="百達醫 BKE 首頁">' +
            '<img src="' + url('wp-content/uploads/2025/09/BKE-logo-new.png') + '" width="320" height="99" alt="BKE 百達醫">' +
          '</a>' +
          '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-menu-toggle>' +
            '<span class="menu-toggle-label">選單</span><span class="menu-toggle-lines" aria-hidden="true"><i></i><i></i></span>' +
          '</button>' +
          '<nav class="primary-nav" id="primary-nav" aria-label="主要選單" data-primary-nav>' + nav + '</nav>' +
          '<a class="header-cta" href="' + url('contact/index.html') + '"><span>啟動專案</span><span aria-hidden="true">↗</span></a>' +
        '</div>' +
      '</header>';
  }

  var footerMount = document.querySelector('[data-premium-footer]');
  if (footerMount) {
    footerMount.outerHTML =
      '<footer class="site-footer">' +
        '<div class="container footer-main">' +
          '<div class="footer-brand">' +
            '<img src="' + url('wp-content/uploads/2025/09/BKE-logo-new.png') + '" width="320" height="99" alt="BKE 百達醫">' +
            '<p>以研發、製造與市場洞察，協助品牌打造值得長期經營的保健產品。</p>' +
          '</div>' +
          '<div class="footer-nav">' +
            '<div><strong>關於百達醫</strong><a href="' + url('認識百達醫/關於百達醫/index.html') + '">品牌介紹</a><a href="' + url('認識百達醫/綠色永續/index.html') + '">綠色永續</a></div>' +
            '<div><strong>研發製造</strong><a href="' + url('研發科技/index.html') + '">研發科技</a><a href="' + url('全面性服務/一站式服務/index.html') + '">一站式服務</a></div>' +
            '<div><strong>聯絡</strong><a href="tel:+886285219269">+886 2 8521 9269</a><a href="' + url('contact/index.html') + '">專案諮詢</a></div>' +
          '</div>' +
        '</div>' +
        '<div class="container footer-bottom"><span>© 2026 BAIDAYI ENTERPRISE CO., LTD.</span><span>新北市新莊區新北大道四段 187 號 15 樓</span></div>' +
      '</footer>' +
      '<a class="floating-consult" href="' + url('contact/index.html') + '" aria-label="開啟專案諮詢"><span>專案<br>諮詢</span><i aria-hidden="true">↗</i></a>';
  }
})();
