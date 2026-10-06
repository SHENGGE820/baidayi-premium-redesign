/* Shared switcher on the live homepage and each homepage proposal. */
(function () {
  'use strict';
  var VERSIONS = [
    { file: 'home-v1.html', key: '1' },
    { file: 'home-v2.html', key: '2' },
    { file: 'home-v3.html', key: '3' },
    { file: 'home-v4.html', key: '4' },
    { file: 'home-v5.html', key: '5' }
  ];
  var here = location.pathname.split('/').pop();
  var bar = document.createElement('nav');
  bar.className = 'home-versions';
  bar.setAttribute('aria-label', '首頁提案切換');
  var html = '';
  VERSIONS.forEach(function (v) {
    var current = v.file === here;
    html += '<a href="./' + v.file + '"' + (current ? ' aria-current="page"' : '') + ' aria-label="首頁版本 ' + v.key + '">' + v.key + '</a>';
  });
  bar.innerHTML = html;
  var css = document.createElement('style');
  css.textContent =
    '.home-versions{position:fixed;left:16px;bottom:16px;z-index:200;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 32px);box-sizing:border-box;overflow-x:auto;padding:8px 10px;background:rgba(23,23,19,.92);color:#fff;font:500 13px "Noto Sans TC",sans-serif;border:1px solid rgba(255,255,255,.2)}' +
    '.home-versions a{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;box-sizing:border-box;padding:0 10px;color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.25)}' +
    '.home-versions a:focus-visible{outline:2px solid #d9b875;outline-offset:2px}' +
    '.home-versions a[aria-current]{background:#b98a3d;border-color:#b98a3d}';
  document.head.appendChild(css);
  document.body.appendChild(bar);
})();
