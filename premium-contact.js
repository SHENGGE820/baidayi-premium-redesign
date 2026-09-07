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
  // Only recognised catalogue choices may become part of an enquiry.
  var formatMap = {
    biscuit: ['機能餅乾', '其他／需要建議'],
    shaker: ['搖搖隨身袋', '粉包／顆粒'],
    candy: ['糖果劑型', '其他／需要建議'],
    capsule: ['動／植物膠囊', '膠囊'],
    tablet: ['錠狀顆粒', '錠劑'],
    powder: ['粉末食品', '粉包／顆粒'],
    meal: ['營養代餐', '其他／需要建議'],
    'jelly-tea': ['果凍／茶包', '其他／需要建議'],
    box: ['包裝外盒', '其他／需要建議']
  };
  var formatKey = params.get('format');
  var selectedFormat = Object.prototype.hasOwnProperty.call(formatMap, formatKey) ? formatMap[formatKey] : null;

  function setSelectValue(select, value) {
    if (!select || !value) return;
    var match = Array.from(select.options).some(function (option) { return option.value === value; });
    if (match) select.value = value;
  }

  setSelectValue(form.querySelector('#contact-stage'), stageMap[params.get('stage')] || params.get('stage'));
  setSelectValue(form.querySelector('#contact-function'), params.get('function'));
  if (selectedFormat) {
    setSelectValue(form.querySelector('#contact-type'), selectedFormat[1]);
    var interest = form.querySelector('[data-form-interest]');
    if (interest) {
      interest.hidden = false;
      interest.textContent = '你正在詢問：' + selectedFormat[0] + '。此方向會隨表單送出；若想調整，請在需求說明中告訴我們。';
    }
  }

  // Enrich the submitted payload without changing the customer's textarea.
  // Repeated submissions therefore cannot duplicate these planning details.
  form.addEventListener('formdata', function (event) {
    var company = form.querySelector('#contact-company');
    var launch = form.querySelector('#contact-launch');
    var quantity = form.querySelector('#contact-quantity');
    var channel = form.querySelector('#contact-channel');
    var message = form.querySelector('#contact-message');
    var details = [];
    if (selectedFormat) details.push('瀏覽的劑型／包材：' + selectedFormat[0]);
    if (company && company.value.trim()) details.push('公司／品牌名稱：' + company.value.trim());
    if (launch && launch.value.trim()) details.push('預計上市時間：' + launch.value.trim());
    if (quantity && quantity.value.trim()) details.push('預計首批數量：' + quantity.value.trim());
    if (channel && channel.value.trim()) details.push('主要銷售通路：' + channel.value.trim());

    if (message && details.length) {
      event.formData.set(message.name, [message.value.trim(), details.join('\n')].filter(Boolean).join('\n\n'));
    }
  });

  form.addEventListener('submit', function () {
    // A cross-origin page owns delivery confirmation; a timer cannot verify it.
    status.textContent = '已嘗試開啟 Google 表單確認頁，請以新分頁顯示的結果為準。若未開啟或顯示錯誤，請重新送出，或來電 02-8521-9269。';
  });
})();
