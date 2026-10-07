(function () {
  'use strict';

  var body = document.body;
  var root = body.dataset.root || './';
  var active = body.dataset.active || '';

  /* Company details from content/settings.md (網站設定 in the CMS);
     scripts/build-site.js rewrites the line between the markers, with the
     values already HTML-escaped. */
  // cms:settings
  var SITE = {"phone":"+886 2 8521 9269","tel":"+886285219269","address":"新北市新莊區新北大道四段 187 號 15 樓","tagline":"保健食品 ODM／OEM 代工：配方、劑型、包裝到量產。"};
  // /cms:settings

  function url(path) {
    return root + path;
  }

  function navLink(key, label, path) {
    var current = key === active ? ' class="is-current" aria-current="page"' : '';
    return '<a href="' + url(path) + '"' + current + '>' + label + '</a>';
  }

  var headerMount = document.querySelector('[data-premium-header]');
  if (headerMount) {
    /* Five plain destinations, in the order a brand owner's questions come:
       what can you make, how would we work together, can I trust the
       quality, who are you, what's new. The previous menu hid the first of
       those under "解決方案" behind a three-way choice whose options
       overlapped, and its "start from your stage" links all led to the same
       form. */
    var nav = navLink('capability', '能做什麼', '全面性服務/index.html') +
      navLink('process', '合作流程', '全面性服務/一站式服務/index.html') +
      navLink('quality', '品質與認證', '研發科技/index.html') +
      navLink('about', '關於我們', '認識百達醫/關於百達醫/index.html') +
      navLink('news', '最新消息', '最新消息/index.html') +
      /* On phones the header CTA is hidden, so the menu carries the contact
         action itself; on desktop this link is hidden in favour of the CTA. */
      '<a class="nav-contact" href="' + url('contact/index.html') + '">代工諮詢 <span aria-hidden="true">↗</span></a>';

    /* The homepage header starts transparent over the hero video and gains
       its backdrop on scroll (premium-site.js); inner pages start solid. */
    var headerClass = body.classList.contains('premium-inner') ? 'site-header is-scrolled' : 'site-header';

    headerMount.outerHTML =
      '<header class="' + headerClass + '" data-site-header>' +
        '<div class="header-inner">' +
          '<a class="brand" href="' + url('index.html') + '" aria-label="百達醫 BKE 首頁">' +
            '<img src="' + url('wp-content/uploads/2025/09/BKE-logo-new.png') + '" width="320" height="99" alt="BKE 百達醫">' +
          '</a>' +
          '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-menu-toggle>' +
            '<span class="menu-toggle-label">選單</span><span class="menu-toggle-lines" aria-hidden="true"><i></i><i></i></span>' +
          '</button>' +
          '<nav class="primary-nav" id="primary-nav" aria-label="主要選單" data-primary-nav>' + nav + '</nav>' +
          '<a class="header-cta' + (active === 'contact' ? ' is-current' : '') + '" href="' + url('contact/index.html') + '"><span>代工諮詢</span><span aria-hidden="true">↗</span></a>' +
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
            '<p>' + SITE.tagline + '</p>' +
          '</div>' +
          '<div class="footer-nav">' +
            '<div><strong>能做什麼</strong><a href="' + url('全面性服務/index.html') + '">一站式服務</a><a href="' + url('全面性服務/原料成分/index.html') + '">原料成分</a><a href="' + url('全面性服務/功能配方/index.html') + '">功能配方</a><a href="' + url('全面性服務/劑型與包材/index.html') + '">劑型與包材</a><a href="' + url('全面性服務/機能食品保健/index.html') + '">機能食品保健</a></div>' +
            '<div><strong>關於百達醫</strong><a href="' + url('認識百達醫/關於百達醫/index.html') + '">關於我們</a><a href="' + url('研發科技/index.html') + '">品質與認證</a><a href="' + url('認識百達醫/綠色永續/index.html') + '">綠色永續</a><a href="' + url('最新消息/index.html') + '">最新消息</a></div>' +
            '<div><strong>聯絡</strong><a href="tel:' + SITE.tel + '">' + SITE.phone + '</a><a href="' + url('contact/index.html') + '">代工諮詢</a></div>' +
          '</div>' +
        '</div>' +
        '<div class="container footer-bottom"><span>© 2026 BAIDAYI ENTERPRISE CO., LTD.</span><span>' + SITE.address + '</span></div>' +
      '</footer>' +
      '<a class="floating-consult" href="' + url('contact/index.html') + '" aria-label="代工諮詢"><span>代工<br>諮詢</span><i aria-hidden="true">↗</i></a>';
  }

  /* The inquiry list runs on every page. Loading it from here means none of
     the pages needs its own script tag; it takes this file's cache key. */
  var self = document.currentScript;
  var version = self && self.src.indexOf('?') > -1 ? self.src.slice(self.src.indexOf('?')) : '';
  function loadInquiry() {
    var inquiry = document.createElement('script');
    inquiry.src = url('premium-inquiry.js') + version;
    document.body.appendChild(inquiry);
  }
  // Load the local evidence logger first so the first catalogue pick is kept.
  // Its failure must never prevent customers from using the inquiry list.
  var tracking = document.createElement('script');
  tracking.src = url('premium-tracking.js') + version;
  tracking.onload = tracking.onerror = loadInquiry;
  document.body.appendChild(tracking);

  // The shared shell runs at every page depth. Keep the support assets
  // independent of inquiry/tracking so either feature can fail gracefully.
  if (!document.querySelector('[data-bke-support-assets]')) {
    var supportCss = document.createElement('link');
    supportCss.rel = 'stylesheet';
    supportCss.href = url('premium-support.css') + version;
    supportCss.setAttribute('data-bke-support-assets', 'true');
    document.head.appendChild(supportCss);
    function loadSupport() {
      var support = document.createElement('script');
      support.src = url('premium-support.js') + version;
      document.body.appendChild(support);
    }
    var knowledge = document.createElement('script');
    knowledge.src = url('premium-support-knowledge.js') + version;
    knowledge.onload = knowledge.onerror = loadSupport;
    document.body.appendChild(knowledge);
  }
})();
