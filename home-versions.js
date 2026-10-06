/* Homepage proposals: a small switcher on each home-vN.html page so the
   versions can be compared side by side. Add a version here and it shows
   up on every proposal page. */
(function () {
  'use strict';
  var VERSIONS = [
    { file: 'home-v1.html', label: '三格圖塊版' },
    { file: 'home-v2.html', label: '大器沉穩版' },
    { file: 'home-v3.html', label: '今天之前的原版' }
  ];
  var here = location.pathname.split('/').pop();
  var bar = document.createElement('nav');
  bar.className = 'home-versions';
  bar.setAttribute('aria-label', '首頁提案切換');
  var html = '<span>首頁提案</span>';
  VERSIONS.forEach(function (v, i) {
    var current = v.file === here;
    html += '<a href="./' + v.file + '"' + (current ? ' aria-current="page"' : '') + ' title="' + v.label + '">' + (i + 1) + '<em>' + v.label + '</em></a>';
  });
  bar.innerHTML = html;
  var css = document.createElement('style');
  css.textContent =
    '.home-versions{position:fixed;left:16px;bottom:16px;z-index:200;display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(23,23,19,.92);color:#fff;font:500 13px "Noto Sans TC",sans-serif;border:1px solid rgba(255,255,255,.2)}' +
    '.home-versions span{margin-right:6px;color:#d9b875;letter-spacing:.06em}' +
    '.home-versions a{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.25)}' +
    '.home-versions a em{font-style:normal;font-size:12px;opacity:.7}' +
    '.home-versions a[aria-current]{background:#b98a3d;border-color:#b98a3d}' +
    '.home-versions a[aria-current] em{opacity:1}' +
    '@media (max-width:720px){.home-versions a em{display:none}}';
  document.head.appendChild(css);
  document.body.appendChild(bar);
})();
