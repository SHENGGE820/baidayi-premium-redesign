(function () {
  'use strict';
  function refresh() {
    var entries = window.BKETracking.read();
    document.getElementById('status').textContent = entries.length ? '目前有 ' + entries.length + ' 筆可查證的本機互動紀錄。' : '尚無紀錄。請從上方入口開啟官網，點擊諮詢連結或把規格加入詢價清單。';
    var rows = document.getElementById('rows');
    rows.textContent = '';
    entries.slice().reverse().forEach(function (entry) {
      var row = document.createElement('tr');
      [new Date(entry.recorded_at).toLocaleTimeString('zh-TW'), entry.event, entry.page_type, entry.delivery_status, entry.inquiry_count == null ? '—' : entry.inquiry_count].forEach(function (value) {
        var cell = document.createElement('td');
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      rows.appendChild(row);
    });
    document.getElementById('json').textContent = JSON.stringify(entries, null, 2);
  }
  document.getElementById('refresh').addEventListener('click', refresh);
  document.getElementById('clear').addEventListener('click', function () { window.BKETracking.clear(); });
  document.addEventListener('bke:tracking', refresh);
  window.addEventListener('storage', refresh);
  window.addEventListener('focus', refresh);
  refresh();
})();
