(function () {
  'use strict';
  var script = document.currentScript;
  var root = script ? new URL('.', script.src) : new URL('./', location.href);
  function href(path) { return new URL(path, root).href; }

  var fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap';
  document.head.appendChild(fonts);
  var css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = href('premium-legacy.css');
  document.head.appendChild(css);

  document.body.classList.add('premium-legacy');
  var wrap = document.getElementById('wrap_all') || document.body;
  var oldHeader = document.getElementById('header');
  var mount = document.createElement('div');
  mount.innerHTML = '<header class="legacy-premium-header"><div class="legacy-premium-header-inner">' +
    '<a class="legacy-premium-brand" href="' + href('index.html') + '" aria-label="百達醫 BKE 首頁"><img src="' + href('wp-content/uploads/2025/09/BKE-logo-new.png') + '" width="320" height="99" alt="BKE 百達醫"></a>' +
    '<button class="legacy-premium-toggle" type="button" aria-label="開啟選單" aria-expanded="false" aria-controls="legacy-premium-nav"><i></i><i></i></button>' +
    '<nav class="legacy-premium-nav" id="legacy-premium-nav" aria-label="主要選單">' +
      '<a href="' + href('認識百達醫/關於百達醫/index.html') + '">品牌實力</a><a href="' + href('研發科技/index.html') + '">研發與品質</a><a href="' + href('全面性服務/一站式服務/index.html') + '">解決方案</a><a href="' + href('最新消息/index.html') + '">洞察觀點</a><a href="' + href('contact/index.html') + '">聯絡我們</a>' +
    '</nav><a class="legacy-premium-cta" href="' + href('contact/index.html') + '"><span>啟動專案</span><span aria-hidden="true">↗</span></a>' +
  '</div></header>';
  var premiumHeader = mount.firstElementChild;
  if (oldHeader) oldHeader.before(premiumHeader); else wrap.prepend(premiumHeader);

  var footer = document.createElement('footer');
  footer.className = 'legacy-premium-footer';
  footer.innerHTML = '<div class="legacy-premium-footer-main"><div class="legacy-premium-footer-brand"><img src="' + href('wp-content/uploads/2025/09/BKE-logo-new.png') + '" width="320" height="99" alt="BKE 百達醫"><p>以研發、製造與市場洞察，協助品牌打造值得長期經營的保健產品。</p></div><div class="legacy-premium-footer-nav"><div><strong>關於百達醫</strong><a href="' + href('認識百達醫/關於百達醫/index.html') + '">品牌介紹</a><a href="' + href('認識百達醫/綠色永續/index.html') + '">綠色永續</a></div><div><strong>研發製造</strong><a href="' + href('研發科技/index.html') + '">研發科技</a><a href="' + href('全面性服務/一站式服務/index.html') + '">一站式服務</a></div><div><strong>聯絡</strong><a href="tel:+886285219269">+886 2 8521 9269</a><a href="' + href('contact/index.html') + '">專案諮詢</a></div></div></div><div class="legacy-premium-footer-bottom"><span>© 2026 BAIDAYI ENTERPRISE CO., LTD.</span><span>新北市新莊區新北大道四段 187 號 15 樓</span></div>';
  wrap.appendChild(footer);
  var consult = document.createElement('a');
  consult.className = 'legacy-floating-consult'; consult.href = href('contact/index.html'); consult.innerHTML = '專案<br>諮詢'; consult.setAttribute('aria-label','開啟專案諮詢');
  document.body.appendChild(consult);

  var toggle = premiumHeader.querySelector('.legacy-premium-toggle');
  var nav = premiumHeader.querySelector('.legacy-premium-nav');
  function close() { toggle.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); document.body.style.overflow=''; }
  toggle.addEventListener('click', function () { var open=toggle.getAttribute('aria-expanded')==='true'; toggle.setAttribute('aria-expanded',String(!open)); nav.classList.toggle('is-open',!open); document.body.style.overflow=open?'':'hidden'; });
  nav.querySelectorAll('a').forEach(function (link) { link.addEventListener('click',close); });
  document.addEventListener('keydown',function (event) { if(event.key==='Escape') close(); });
})();
