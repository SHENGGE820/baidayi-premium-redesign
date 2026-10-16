'use strict';
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const demo = require('../catalogue-preview-data.json');
const root = path.resolve(__dirname, '../..');
const esc = value => String(value || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

module.exports = function developmentCards({ directions, ingredientCategory, responsiveImg }) {
  const data = matter(fs.readFileSync(path.join(root, 'content/pages/catalogue.md'), 'utf8')).data;
  const formulaSlugs = ['slender','meal','body-care','elderly','women','men','digestive','skin-care','child'];
  const image = (src, alt = '', cls = '') => {
    const im = responsiveImg(src, '../');
    return `<img${cls ? ` class="${cls}"` : ''} src="${im.src}"${im.srcset}${im.srcset ? ' sizes="(max-width:620px) 90vw, (max-width:1100px) 40vw, 320px"' : ''} alt="${esc(alt)}"${im.dims} loading="lazy">`;
  };
  const destination = item => item.link && item.link.startsWith('page:') ? `./一站式服務/${item.link.slice(5)}/index.html` : '../contact/index.html';
  function library(id, cards, label, note) {
    return `<div class="cap-ingredient-library development-library" data-ingredient-library data-library-kind="${id}">
      <p class="ingredient-preview-note">${note}</p>
      <div class="ingredient-tools" hidden><div class="ingredient-search"><label for="${id}-search">搜尋${label}</label><input id="${id}-search" data-library-search type="search" autocomplete="off" placeholder="輸入名稱或款式關鍵字"></div><p class="ingredient-count" role="status" aria-live="polite"><span data-library-count>${cards.length}</span> 個分類</p></div>
      <div class="ingredient-accordion">${cards.join('\n')}</div>
      <div class="ingredient-empty" hidden><p>沒有找到相符項目。</p><button type="button" data-library-reset>清除搜尋，查看全部 <span aria-hidden="true">→</span></button></div>
    </div>`;
  }
  function category({id, group, title, en, cover, preview, entries, unit = '款式', index, note, link}) {
    return `<details class="ingredient-category" data-blended-category name="${group}-category" id="${id}" data-category-search="${esc(title + ' ' + en)}"><summary aria-controls="${id}-items"><span class="ingredient-category-visual">${image(cover, '', 'ingredient-category-image')}<span class="ingredient-category-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="ingredient-category-selected" aria-hidden="true">已展開</span></span><span class="ingredient-category-copy"><span class="ingredient-category-title"><span>${esc(en)}</span><strong id="${id}-title">${esc(title)}</strong></span><span class="ingredient-category-preview">${esc(preview)}</span><span class="ingredient-category-action"><span>${entries.length} 項${unit}</span><span class="ingredient-category-action-label"><span class="ingredient-card-open-label">查看${unit}</span><span class="ingredient-card-close-label">收合${unit}</span><i aria-hidden="true"></i></span></span></span></summary>
      <div class="ingredient-category-panel" id="${id}-items" role="region" aria-labelledby="${id}-title"><div class="ingredient-panel-heading"><div><p>${esc(en)}</p><h3>${esc(title)}<span>${esc(unit)}清單</span></h3></div><button type="button" class="ingredient-panel-close" data-close-ingredients aria-label="收合${esc(title)}">收合 <span aria-hidden="true">×</span></button></div>${note ? `<p class="ingredient-source-note">${esc(note)}</p>` : ''}<div class="ingredient-material-grid has-source-records">${entries.join('\n')}</div><div class="ingredient-category-next"><p>進一步了解這個方向的款式與合作方式。</p><a class="text-link" href="${link}">查看詳細介紹 <span aria-hidden="true">↗</span></a></div></div></details>`;
  }
  const formulas = formulaSlugs.map((slug, i) => {
    const c = directions.find(c => c.slug === slug);
    if (!c) throw new Error('Missing formula direction: ' + slug);
    return ingredientCategory(c, i, '../', c.image)
      .replaceAll('name="ingredient-category"', 'name="formula-category"')
      .replaceAll('id="category-', 'id="formula-').replaceAll('aria-labelledby="category-', 'aria-labelledby="formula-')
      .replaceAll('id="materials-', 'id="formula-materials-').replaceAll('aria-controls="materials-', 'aria-controls="formula-materials-');
  });
  const formatSlugs = ['tablet','powder','capsule','shaker','jelly-tea','candy','biscuit','meal'];
  const formats = formatSlugs.map((slug, i) => {
    const samples = demo.formats.find(c => c.slug === slug);
    const source = data.dosage.find(c => c.title === samples.title);
    if (!source) throw new Error('Missing dosage source: ' + slug);
    const entries = samples.examples.map(sample => `<article class="ingredient-material is-source-card" data-search="${esc(sample.name + ' ' + sample.fields.map(f=>f.value).join(' '))}"><header class="ingredient-material-header"><div class="ingredient-material-identity"><p class="ingredient-material-en">版面示意</p><h3>${esc(sample.name)}</h3></div></header><div class="ingredient-material-copy"><dl class="ingredient-material-specs">${sample.fields.map(f => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl><p class="ingredient-material-description">${esc(sample.description)}</p></div><p class="ingredient-material-image-note">款式、尺寸與容量為示意資料。</p></article>`);
    return category({id:'format-'+slug, group:'formats', title:source.title, en:'DOSAGE FORM', cover:source.image, preview:source.text, entries, index:i, note:'以下款式與規格為版面示意，供選型與互動預覽；實際製作條件請洽詢確認。',link:destination(source)});
  });
  const packaging = [
    {id:'semi-finished',title:'半成品包材',en:'PRIMARY PACKAGING',items:data.package},
    {id:'finished',title:'成品包材',en:'FINISHED PACKAGING',items:data.finished}
  ].map((group, i) => {
    const entries = group.items.map(item => {
      const slug = item.link?.startsWith('page:') ? item.link.slice(5) : null;
      const file = slug ? path.join(root,'content/catalogue',slug+'.md') : null;
      const source = file && fs.existsSync(file) ? matter(fs.readFileSync(file,'utf8')).data : null;
      const groups = source?.groups?.length ? source.groups : [{name:'包裝方向',items:[{image:item.image,name:item.title}]}];
      const models = groups.map(modelGroup => `<div class="development-model-group"><h4>${esc(modelGroup.name)} <span>${modelGroup.items.length} 款</span></h4><div class="development-models">${modelGroup.items.map((model,i) => `<figure><a href="${esc('../'+model.image.replace(/^\//,''))}" target="_blank" rel="noopener" aria-label="放大${esc(item.title+' '+(model.name||modelGroup.name+' '+(i+1)))}原圖">${image(model.image, model.name || item.title+' '+modelGroup.name+' '+(i+1))}</a><figcaption>${esc(model.name || modelGroup.name+' '+String(i+1).padStart(2,'0'))}</figcaption></figure>`).join('')}</div></div>`).join('');
      return `<section class="ingredient-material development-group" data-search="${esc(item.title+' '+(item.text||'')+' '+groups.map(g=>g.name).join(' '))}"><div class="development-group-heading"><div><p class="ingredient-material-en">${esc(item.en || 'PACKAGING')}</p><h3>${esc(item.title)}</h3><p class="ingredient-material-description">${esc(item.text || '依品牌需求規劃款式與規格。')}</p></div><a class="text-link" href="${destination(item)}">${item.link?'完整規格介紹':'討論包裝需求'} <span aria-hidden="true">↗</span></a></div>${models}</section>`;
    });
    return category({id:'packaging-'+group.id,group:'packaging',title:group.title,en:group.en,cover:'/assets/brand/pack-category-'+group.id+'-v1.jpg',preview:group.items.slice(0,3).map(c=>c.title).join('・'),entries,index:i,unit:'包材',note:'點選圖片可放大查看；尺寸與製作條件請洽詢確認。',link:'./劑型與包材/index.html#'+(i?'finished':'package')});
  });
  return {
    formula:library('formula', formulas, '方向或原料', '選擇配方方向，在同一頁展開原料與介紹。'),
    formats:library('formats', formats, '劑型或示意款式', '選擇劑型，展開查看示意款式與尺寸。實際規格請洽詢確認。'),
    packaging:library('packaging',packaging,'包材分類或品項','依包裝階段選擇分類，展開查看各類款式。分類封面為 AI 情境示意，實際款式以下方內容為準。')
  };
};
