(function () {
  'use strict';

  var body = document.body;
  var root = body.dataset.root || './';
  var active = body.dataset.active || '';

  function url(path) {
    return root + path;
  }

  function navLink(key, label, path) {
    var current = key === active ? ' class="is-current" aria-current="page"' : '';
    return '<a href="' + url(path) + '"' + current + '>' + label + '</a>';
  }

  function solutionsNav() {
    var current = active === 'service' ? ' is-current' : '';
    return '<div class="nav-cluster">' +
      '<a class="nav-cluster-trigger' + current + '" href="' + url('全面性服務/一站式服務/index.html') + '">解決方案 <span aria-hidden="true">＋</span></a>' +
      '<div class="nav-panel" aria-label="解決方案選單">' +
        '<p>ONE-STOP ODM / OEM</p>' +
        '<div class="nav-panel-grid">' +
          '<a href="' + url('全面性服務/一站式服務/index.html') + '"><span>01</span><strong>一條龍服務</strong><small>從市場定位、配方研發到量產交付</small></a>' +
          '<a href="' + url('全面性服務/功能配方/index.html') + '"><span>02</span><strong>功能配方</strong><small>依二十個產品方向探索開發可能</small></a>' +
          '<a href="' + url('全面性服務/劑型與包材/index.html') + '"><span>03</span><strong>劑型與包材</strong><small>查看可製作的產品形式與包裝</small></a>' +
        '</div>' +
        '<div class="nav-panel-stages"><span>依目前階段開始</span><a href="' + url('contact/index.html?stage=idea') + '">只有初步想法</a><a href="' + url('contact/index.html?stage=formula') + '">已有配方方向</a><a href="' + url('contact/index.html?stage=upgrade') + '">既有產品改版</a></div>' +
      '</div>' +
    '</div>';
  }

  var headerMount = document.querySelector('[data-premium-header]');
  if (headerMount) {
    var nav = navLink('about', '品牌實力', '認識百達醫/關於百達醫/index.html') +
      navLink('research', '研發與品質', '研發科技/index.html') +
      solutionsNav() +
      navLink('news', '洞察觀點', '最新消息/index.html') +
      navLink('contact', '聯絡我們', 'contact/index.html');

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
            '<div><strong>研發製造</strong><a href="' + url('研發科技/index.html') + '">研發科技</a><a href="' + url('全面性服務/一站式服務/index.html') + '">一站式服務</a><a href="' + url('全面性服務/功能配方/index.html') + '">功能配方</a><a href="' + url('全面性服務/劑型與包材/index.html') + '">劑型與包材</a></div>' +
            '<div><strong>聯絡</strong><a href="tel:+886285219269">+886 2 8521 9269</a><a href="' + url('contact/index.html') + '">專案諮詢</a></div>' +
          '</div>' +
        '</div>' +
        '<div class="container footer-bottom"><span>© 2026 BAIDAYI ENTERPRISE CO., LTD.</span><span>新北市新莊區新北大道四段 187 號 15 樓</span></div>' +
      '</footer>' +
      '<a class="floating-consult" href="' + url('contact/index.html') + '" aria-label="開啟專案諮詢"><span>專案<br>諮詢</span><i aria-hidden="true">↗</i></a>';
  }
})();
