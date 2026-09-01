(function () {
  'use strict';
  var form = document.querySelector('[data-premium-contact-form]');
  var status = document.querySelector('[data-form-status]');
  if (!form || !status) return;

  form.addEventListener('submit', function () {
    var company = form.querySelector('#contact-company');
    var launch = form.querySelector('#contact-launch');
    var message = form.querySelector('#contact-message');
    var composedMessage = form.querySelector('[data-composed-message]');
    var details = [];
    if (company && company.value.trim()) details.push('公司／品牌名稱：' + company.value.trim());
    if (launch && launch.value.trim()) details.push('預計上市時間：' + launch.value.trim());
    if (message && composedMessage) {
      composedMessage.value = [message.value.trim(), details.join('\n')].filter(Boolean).join('\n\n');
    }
    status.textContent = '正在送出資料，完成後將開啟確認頁面。';
    window.setTimeout(function () {
      status.textContent = '謝謝你的詢問。百達醫專案顧問將依資料與你聯繫。';
    }, 900);
  });
})();
