(function () {
  'use strict';
  var form = document.querySelector('[data-premium-contact-form]');
  var status = document.querySelector('[data-form-status]');
  if (!form || !status) return;

  form.addEventListener('submit', function () {
    var company = form.querySelector('#contact-company');
    var launch = form.querySelector('#contact-launch');
    var message = form.querySelector('#contact-message');
    var details = [];
    if (company && company.value.trim()) details.push('公司／品牌名稱：' + company.value.trim());
    if (launch && launch.value.trim()) details.push('預計上市時間：' + launch.value.trim());

    // The textarea now carries the Google Form entry id itself, so the text the
    // customer wrote reaches the form even if this script never loads. It used
    // to have no name at all and was copied into a hidden proxy here, which
    // meant a single script error silently sent an enquiry with no enquiry in
    // it. These two optional fields have no entry id of their own, so they are
    // appended to the message instead of posted separately.
    if (message && details.length) {
      var original = message.value;
      message.value = [original.trim(), details.join('\n')].filter(Boolean).join('\n\n');
      // The form serialises synchronously after this handler; restore what the
      // customer sees on the next tick, since target="_blank" leaves them here.
      window.setTimeout(function () { message.value = original; }, 0);
    }

    status.textContent = '正在送出資料，完成後將開啟確認頁面。';
    window.setTimeout(function () {
      status.textContent = '謝謝你的詢問。百達醫專案顧問將依資料與你聯繫。';
    }, 900);
  });
})();
