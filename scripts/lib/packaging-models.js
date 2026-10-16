'use strict';
const records = require('../../content/packaging-models.json').models;
const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const definitionList = (fields, cls) => '<dl class="'+cls+'">'+fields.filter(([,value])=>value).map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';

module.exports = function packagingModels({item, groups, image, destination, id}) {
  const models = groups.flatMap(group => group.items.map((model, index) => {
    const record = records[model.image];
    return {image:model.image, group:group.name, record, name:record?.name || model.name || group.name+' '+String(index+1).padStart(2,'0')};
  }));
  const search = [item.title,item.text,...models.flatMap(m => [m.name,m.group,...Object.values(m.record?.specs || {})])].join(' ');
  const photos = models.map((model, index) => {
    const record = model.record;
    const source = '../'+model.image.replace(/^\//,'');
    // A display viewport over the untouched bitmap; meet scaling keeps tall
    // products complete inside a consistent photo stage.
    const visual = record ? '<svg class="packaging-product-image" viewBox="0 '+record.photo.top+' '+record.photo.width+' '+record.photo.height+'" role="img" aria-label="'+esc(item.title+' '+model.name)+'"><image href="'+esc(source)+'" width="451" height="797"/></svg>' : image(model.image,item.title+' '+model.name);
    const values=record?.specs || {};
    const summary = record ? definitionList([
      ['容量／適用',values['容量'] || values['適用劑型'] || '依瓶器規格確認'],
      ['材質',values['材質']],['尺寸',values['成型尺寸'] || values['尺寸']],['顏色',values['顏色']]
    ],'packaging-summary') : '<p class="packaging-summary-empty">款式、尺寸及印刷方式可依品牌需求討論。</p>';
    const full=record ? definitionList(Object.entries(values),'packaging-specs') : '<p>實際款式與製作條件請洽詢確認。</p>';
    return '<figure class="packaging-model" data-packaging-slide id="'+id+'-model-'+index+'"><a class="packaging-product" href="'+esc(source)+'" target="_blank" rel="noopener" aria-label="放大'+esc(item.title+' '+model.name)+'原始圖片'+(record?'與規格':'')+'">'+visual+'</a><figcaption class="packaging-model-copy"><p class="ingredient-material-en">'+esc(item.en || 'PACKAGING')+'</p><h3>'+esc(item.title)+'</h3><p class="ingredient-material-description">'+esc(item.text || '依品牌需求規劃款式與規格。')+'</p><h4>'+esc(model.name)+'</h4>'+summary+'<div class="packaging-full-record">'+full+'<p class="packaging-source-note">'+(record?'依原站型號圖整理；實際規格與供應條件請洽詢確認。':'實際款式與製作條件請洽詢確認。')+'</p></div></figcaption></figure>';
  }).join('');
  const overview = '<div class="packaging-card-overview" hidden><p class="ingredient-material-en">'+esc(item.en || 'PACKAGING')+'</p><h3>'+esc(item.title)+'</h3><p>'+esc(item.text || '依品牌需求規劃款式與規格。')+'</p><span class="packaging-style-count"><strong>'+models.length+'</strong> 款可選</span></div>';
  return '<section class="ingredient-material is-source-card development-group" data-packaging-gallery data-packaging-title="'+esc(item.title)+'" data-search="'+esc(search)+'"><div class="development-models">'+photos+'</div>'+overview+'<div class="packaging-card-actions"><button type="button" class="text-link packaging-full-button" data-packaging-full aria-haspopup="dialog" hidden>查看款式 <span aria-hidden="true">↗</span></button><a class="text-link packaging-details-link" href="'+destination(item)+'">'+(item.link?'包材介紹':'討論包裝需求')+' <span aria-hidden="true">→</span></a></div></section>';
};
