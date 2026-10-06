/* Shared switcher on the live homepage and each homepage proposal. */
(function () {
  'use strict';
  var VERSIONS = [
    { file: 'index.html', key: '目前', label: '目前首頁' },
    { file: 'home-v1.html', key: '1', label: '三格圖塊版' },
    { file: 'home-v2.html', key: '2', label: '大器沉穩版' },
    { file: 'home-v3.html', key: '3', label: '今天之前的原版' },
    { file: 'home-v4.html', key: '4', label: '雜誌編輯風' },
    { file: 'home-v5.html', key: '5', label: '全深色質感風' }
  ];
  var here = location.pathname.split('/').pop();
  var bar = document.createElement('nav');
  bar.className = 'home-versions';
  bar.setAttribute('aria-label', '首頁提案切換');
  var html = '<span>首頁提案</span>';
  VERSIONS.forEach(function (v) {
    var current = v.file === here || (v.file === 'index.html' && !here);
    html += '<a href="./' + v.file + '"' + (current ? ' aria-current="page"' : '') + ' aria-label="' + v.label + '" title="' + v.label + '">' + v.key + (v.file === 'index.html' ? '' : '<em>' + v.label + '</em>') + '</a>';
  });
  bar.innerHTML = html;
  var css = document.createElement('style');
  css.textContent =
    '.home-versions{position:fixed;left:16px;bottom:16px;z-index:200;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 32px);box-sizing:border-box;overflow-x:auto;padding:8px 10px;background:rgba(23,23,19,.92);color:#fff;font:500 13px "Noto Sans TC",sans-serif;border:1px solid rgba(255,255,255,.2)}' +
    '.home-versions span{flex-shrink:0;margin-right:6px;color:#d9b875;letter-spacing:.06em}' +
    '.home-versions a{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 10px;color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.25)}' +
    '.home-versions a:focus-visible{outline:2px solid #d9b875;outline-offset:2px}' +
    '.home-versions a em{font-style:normal;font-size:12px;opacity:.7}' +
    '.home-versions a[aria-current]{background:#b98a3d;border-color:#b98a3d}' +
    '.home-versions a[aria-current] em{opacity:1}' +
    '@media (max-width:720px){.home-versions a em{display:none}}';
  document.head.appendChild(css);
  document.body.appendChild(bar);
})();
