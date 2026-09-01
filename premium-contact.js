(function () {
  'use strict';
  var form = document.querySelector('[data-premium-contact-form]');
  var status = document.querySelector('[data-form-status]');
  if (!form || !status) return;

  var params = new URLSearchParams(window.location.search);
  var stageMap = {
    idea: '只有初步想法',
    formula: '已有配方方向',
    brand: '已有品牌與包裝規劃',
    supplier: '尋找新供應商',
    upgrade: '既有產品改版'
  };

  function setSelectValue(select, value) {
    if (!select || !value) return;
    var match = Array.from(select.options).some(function (option) { return option.value === value; });
    if (match) select.value = value;
  }

  setSelectValue(form.querySelector('#contact-stage'), stageMap[params.get('stage')] || params.get('stage'));
  setSelectValue(form.querySelector('#contact-function'), params.get('function'));

  form.addEventListener('submit', function () {
    var company = form.querySelector('#contact-company');
    var launch = form.querySelector('#contact-launch');
    var quantity = form.querySelector('#contact-quantity');
    var channel = form.querySelector('#contact-channel');
    var message = form.querySelector('#contact-message');
    var details = [];
    if (company && company.value.trim()) details.push('公司／品牌名稱：' + company.value.trim());
    if (launch && launch.value.trim()) details.push('預計上市時間：' + launch.value.trim());
    if (quantity && quantity.value.trim()) details.push('預計首批數量：' + quantity.value.trim());
    if (channel && channel.value.trim()) details.push('主要銷售通路：' + channel.value.trim());

    // The textarea now carries the Google Form entry id itself, so the text the
    // customer wrote reaches the form even if this script never loads. It used
    // to have no name at all and was copied into a hidden proxy here, which
    // meant a single script error silently sent an enquiry with no enquiry in
    // it. These optional planning fields have no entry id of their own, so they are
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
