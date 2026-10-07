(function () {
  'use strict';
  var text = document.getElementById('demo-request');
  var button = document.getElementById('copy-sample');
  var status = document.getElementById('copy-status');
  function selectText() {
    text.focus(); text.select();
    status.textContent = '已選取文字，請按 Ctrl+C 或使用複製功能。';
  }
  button.addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.writeText) { selectText(); return; }
    navigator.clipboard.writeText(text.value).then(function () {
      status.textContent = '已複製示範需求。';
    }, selectText);
  });
})();
