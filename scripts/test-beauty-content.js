'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'build-site.js'), 'utf8');
const start = source.indexOf("const FN_DIR = '全面性服務/功能配方';");
const end = source.indexOf('/* ------------------------------------------------------------ page text */', start);
assert.ok(start >= 0 && end > start, 'Ingredient builder section is available');
const esc = s => String(s == null ? '' : s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rel = (value, prefix) => typeof value !== 'string' || !value ? '' : value.startsWith('/') && !value.startsWith('//') ? prefix + value.slice(1) : value;
const sandbox = { fs, path, matter, ROOT: root, V: 'test', SITE: 'https://example.test/baidayi/', esc, rel, imageSize: () => [1200, 800], module: { exports: {} } };
// Evaluate only pure loaders/renderers, not the build entry point: these tests
// read source data and return HTML without rewriting any generated page.
vm.runInNewContext(source.slice(start, end) + '\nmodule.exports = { loadFunctions, ingredientCard, ingredientCategory, functionPage, ingredientTitle };', sandbox);
const render = sandbox.module.exports;
const directions = render.loadFunctions();
const beauty = directions.find(c => c.slug === 'beauty');
const raw = matter(fs.readFileSync(path.join(root, 'content/functions/beauty.md'), 'utf8')).data;
const official = require('./ingredient-source-records.json');

const expectedNames = [
  'Hyabest 流行鏈球菌發酵物(含透明質酸鈉)',
  'Hyapol 流行鏈球菌發酵物(含透明質酸鈉)',
  'HAPLEX PLUS 流行鏈球菌發酵物(含透明質酸鈉)',
  'Mobilee 3D 玻尿酸_雞冠抽出物',
  'Miracolla 水解魚膠原蛋白',
  'TRIPEPIII 魚膠原蛋白三胜肽',
  'CollaSel 魚膠原三肽',
  'MOISTIDE 魚鱗膠原三肽',
  '穀胱甘肽',
  'PhytoflORAL 專利冰晶番茄',
  'Pearl Tomato 白番茄萃取物',
  '智利酒果',
  '紅石榴'
];

test('beauty keeps the thirteen valid workbook rows in source order', () => {
  assert.deepEqual(Array.from(beauty.items, it => it.name), expectedNames);
  assert.equal(beauty.placeholder, false);
  assert.equal(beauty.image, '/assets/brand/function-beauty.jpg', 'Category hero is not replaced by the item illustration');
  assert.doesNotMatch(beauty.items.map(it => it.name).join(' '), /維生素 C|神經醯胺|白藜蘆醇/);
  assert.equal(beauty.items.filter(it => it.material === '冰晶番茄').length, 2, 'Internal blank row 59 must not become another generic tomato ingredient');
  assert.equal(beauty.items.every(it => !it.en && !it.form), true, 'Do not invent missing English names or forms');
});

test('beauty source metadata and numbered descriptions are kept verbatim', () => {
  assert.deepEqual(Array.from(beauty.items.slice(0, 8), it => it.origin), ['日本', '中國', '中國', '西班牙', '日本', '越南', '土耳其', '印度']);
  assert.deepEqual(Array.from(beauty.items.slice(0, 8), it => it.patent), ['多項專利', '無專利', '製程專利', '功效專利', '無專利', '無專利', '無專利', '無專利']);
  assert.equal(beauty.items[0].text, '1.多項原廠研究，哈拉問卷\n2.純度 >95%\n3.白色至淡黃色粉末');
  assert.equal(beauty.items[3].text, '1.多項原廠研究、具HALAL\n2.Sodium Hyaluronate ( HA）天然玻尿酸60-75%、Polysaccharides（多醣類）10%、Hydrolized Proteins ( 膠原蛋白 ) 5%\n3.白色的吸濕性粉末');
  assert.equal(beauty.items[4].text, '1.多項原廠研究\n2.分子量<2,500Da\n3.溶水極度澄清(透光率>95%)');
  assert.equal(beauty.items[6].text, '1.多項原廠研究，哈拉、kosher\n2.蛋白質>90%、CTP> 80%，平均分子量500+-200 Da\n3.淡黃色至白色粉末、高水溶');
  for (const it of beauty.items.slice(8)) {
    assert.equal(it.text, '規格資料整理中，請洽詢確認。');
    assert.equal(it.origin, '');
    assert.equal(it.patent, '');
  }
});

test('every ingredient item has a distinct local image, not a renamed family duplicate', () => {
  const pictured = beauty.items.filter(it => it.image);
  assert.equal(pictured.length, 13);
  assert.equal(new Set(pictured.map(it=>it.image)).size,13);
  const hashes=pictured.map(it=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,it.image.slice(1)))).digest('hex'));
  assert.equal(new Set(hashes).size,13,'Different filenames must also contain different images');
  assert.equal(beauty.items.every(it => it.imageNote.startsWith('AI')), true);
  for(const it of pictured){
    assert.match(it.image,/^\/assets\/brand\/ingredient-beauty-[a-z-]+-v4\.jpg$/);
    assert.equal(fs.existsSync(path.join(root,it.image.slice(1))),true);
    assert.doesNotMatch(it.image,/abstract-v1|ingredient-(?:hyaluronate|collagen|pomegranate)-v1/);
  }
  assert.equal(pictured[9].image,'/assets/brand/ingredient-beauty-phytofloral-v4.jpg');
  assert.equal(pictured[10].image,'/assets/brand/ingredient-beauty-pearl-tomato-v4.jpg');
  assert.equal(pictured[9].image===pictured[10].image,false);
});

test('both ingredient views show metadata, line breaks and a single source caveat', () => {
  const inline = render.ingredientCategory(beauty, 0, '../');
  const legacy = render.functionPage(beauty);
  assert.equal((inline.match(/<article class="ingredient-material/g) || []).length, 13);
  assert.equal((legacy.match(/<article class="catalogue-card/g) || []).length, 13);
  for (const html of [inline, legacy]) {
    assert.equal((html.match(/class="ingredient-source-note"/g) || []).length, 1);
    assert.equal((html.match(/class="ingredient-material-specs"/g) || []).length, 13);
    assert.match(html, /<dt>來源<\/dt><dd>日本<\/dd>/);
    assert.match(html, /<dt>專利紀錄<\/dt><dd>多項專利<\/dd>/);
    assert.match(html, /原料資料紀錄，不代表百達醫公司資格/);
    assert.match(html, /專利有效期限及適用範圍/);
    assert.match(html, /1\.多項原廠研究，哈拉問卷<br>2\.純度 >95%<br>3\.白色至淡黃色粉末/);
    assert.match(html, /分子量&lt;2,500Da/);
  }
  assert.equal((inline.match(/class="ingredient-material-image-note"/g) || []).length, 13);
  assert.equal((legacy.match(/class="ingredient-image-note"/g) || []).length, 13);
  assert.equal((inline.match(/has-concept-image/g)||[]).length,13);
  assert.equal((legacy.match(/has-concept-image/g)||[]).length,13);
  assert.match(inline,/意象，非原料實物照/);
  assert.doesNotMatch(legacy, /name="robots" content="noindex"|class="placeholder-note/);
  assert.match(legacy, /href="\.\.\/\.\.\/\.\.\/premium-ingredients\.css\?v=20261014-02"/);
  assert.match(inline, /data-search="[^"]*玻尿酸\(鈉\) 日本 多項專利/);
  assert.match(inline, /aria-controls="materials-beauty"/);
});

test('inline source cards group the image with the name and keep specs outside the identity row',()=>{
  for(const [slug,expected]of Object.entries(official.categories)){
    const category=directions.find(c=>c.slug===slug),html=render.ingredientCategory(category,0,'../');
    assert.equal((html.match(/class="ingredient-material-header/g)||[]).length,expected.length);
    assert.equal((html.match(/class="ingredient-material-identity"/g)||[]).length,expected.length);
    const headers=[...html.matchAll(/<header class="ingredient-material-header[^>]*>([\s\S]*?)<\/header>/g)].map(x=>x[1]);
    assert.equal(headers.filter(x=>x.includes('<img')).length,expected.filter(x=>x.image).length);
    for(const header of headers){assert.match(header,/<h3>/);assert.doesNotMatch(header,/ingredient-material-specs|ingredient-material-description/);}
    assert.equal((html.match(/aria-describedby="ingredient-note-/g)||[]).length,expected.filter(x=>x.image).length);
  }
});

test('semantic title breaks keep every original character and safely escape all parts',()=>{
  for(const category of directions.filter(c=>c.notice))for(const it of category.items){
    const title=render.ingredientTitle(it.name);
    assert.equal(title.replace(/<[^>]*>/g,''),esc(it.name),it.name);
    if(/^[A-Za-z].*[\u3400-\u9fff]/u.test(it.name))assert.match(title,/ingredient-title-brand[\s\S]*ingredient-title-name/);
  }
  const unsafe=render.ingredientTitle('Brand <img onerror="bad()"> 中文原料(補充)');
  assert.doesNotMatch(unsafe,/<img|onerror="bad/);
  assert.match(unsafe,/&lt;img onerror=&quot;bad\(\)&quot;>/);
  assert.match(render.ingredientTitle('FloraGLO葉黃素'),/FloraGLO<\/span><span class="ingredient-title-name">葉黃素/);
});

test('every named source item uses its own local wide art without changing original CMS images',()=>{
  const art=JSON.parse(fs.readFileSync(path.join(__dirname,'ingredient-card-art.json'),'utf8'));
  const sources=new Set(),paths=new Set(),hashes=new Set();
  for(const category of directions.filter(c=>c.notice))for(const it of category.items.filter(x=>x.image)){
    sources.add(it.image);assert.ok(art[it.image],it.name);
    const chosen=art[it.image].image;assert.match(chosen,/^\/assets\/brand\/ingredient-wide-[a-z0-9-]+-v1\.jpg$/);
    const bytes=fs.readFileSync(path.join(root,chosen.slice(1)));paths.add(chosen);hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
    const gallery=render.ingredientCard(it,'../');assert.ok(gallery.includes('src="'+rel(chosen,'../')+'"'),it.name);
  }
  assert.equal(Object.keys(art).length,63);assert.equal(sources.size,63);assert.equal(paths.size,63);assert.equal(hashes.size,63);
  for(const file of ['全面性服務/index.html','全面性服務/capability-c.html','全面性服務/原料成分/index.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal((html.match(/class="ingredient-material-image" src="[^"]*ingredient-wide-/g)||[]).length,79);
  }
});

test('optional fields do not change the nine unrelated direction pages or legacy item markup', () => {
  const unrelated = directions.filter(c => !Object.hasOwn(official.categories, c.slug));
  assert.equal(unrelated.length, 9);
  for (const category of unrelated) {
    assert.equal(category.notice, '');
    assert.doesNotMatch(render.functionPage(category), /premium-ingredients\.css/);
    const inline = render.ingredientCategory(category, 1);
    assert.doesNotMatch(inline, /ingredient-material-specs|ingredient-source-note|ingredient-material-visual|ingredient-material-image-note/);
    for (const it of category.items) {
      assert.equal(it.material + it.origin + it.patent + it.imageNote, '');
      const expected = `<article class="catalogue-card reveal"><div class="catalogue-media"><img src="${esc(rel(it.image || '/assets/premium/ingredient-placeholder.svg', '../../'))}" alt="${it.image ? esc(it.name + '原料') : ''}" loading="lazy"></div><div class="catalogue-copy">${it.en ? `<span class="catalogue-en">${esc(it.en)}</span>` : ''}<h3>${esc(it.name)}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.form ? `<p class="ingredient-meta"><b>形式</b>　${esc(it.form)}</p>` : ''}</div></article>`;
      assert.equal(render.ingredientCard(it, '../../'), expected, category.slug + '/' + it.name);
    }
  }
  assert.equal(Object.hasOwn(raw, 'notice'), true);
});

test('all eleven raw-material categories retain source order and exact public fields', () => {
  assert.equal(Object.keys(official.categories).length,11);
  let rows=0,pictured=0;const perName=new Map(),perPath=new Map(),hashes=new Map();
  for(const [slug,expected]of Object.entries(official.categories)){
    const category=directions.find(c=>c.slug===slug);assert.equal(category.placeholder,false);assert.ok(category.notice);
    assert.equal(category.items.length,expected.length,slug);rows+=category.items.length;
    for(let i=0;i<expected.length;i++){
      const actual=category.items[i],wanted=expected[i];
      for(const key of ['name','material','origin','patent','text','image'])assert.equal(actual[key],wanted[key]||'',slug+'/'+i+'/'+key);
      assert.equal(actual.imageNote,wanted.image_note||'');assert.equal(actual.en+actual.form,'');
      if(official.pending.includes(actual.name)){assert.equal(actual.image,'');assert.match(actual.text,/僅列此原料類別/);continue;}
      assert.ok(actual.image.startsWith('/assets/brand/ingredient-'));assert.ok(actual.imageNote.startsWith('AI'));pictured++;
      if(perName.has(actual.name))assert.equal(actual.image,perName.get(actual.name),'Same ingredient must keep same image across categories');
      if(perPath.has(actual.image))assert.equal(actual.name,perPath.get(actual.image),'Different ingredients cannot share a family image');
      perName.set(actual.name,actual.image);perPath.set(actual.image,actual.name);
      const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,actual.image.slice(1)))).digest('hex');
      if(hashes.has(sha))assert.equal(hashes.get(sha),actual.name,'Renamed duplicate asset');hashes.set(sha,actual.name);
    }
    const inline=render.ingredientCategory(category,0,'../');
    assert.equal((inline.match(/<article class="ingredient-material/g)||[]).length,expected.length);
    assert.match(inline,/ingredient-source-note/);assert.match(render.functionPage(category),/premium-ingredients\.css/);
  }
  assert.equal(rows,88);assert.equal(pictured,79);assert.equal(perName.size,63);assert.equal(hashes.size,63);
});

test('all three inline views expose all source records, concept labels and only local asset paths',()=>{
  for(const file of ['全面性服務/index.html','全面性服務/capability-c.html','全面性服務/原料成分/index.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal((html.match(/<article class="ingredient-material/g)||[]).length,88,file);
    assert.equal((html.match(/class="ingredient-material-image-note"/g)||[]).length,79,file);
    assert.equal((html.match(/class="ingredient-source-note"/g)||[]).length,11,file);
    assert.doesNotMatch(html,/其他分類仍待逐步核對/);
    assert.doesNotMatch(html,/<img class="ingredient-material-image" src="(?:https?:|\/\/)/);
  }
});

test('empty numbered source placeholders do not masquerade as customer specifications',()=>{
  const it={name:'Sample',text:'1.\n2.蛋白質>85%\n3.\n4.',material:'植物蛋白',origin:'',patent:'',imageNote:'',en:'',form:'',image:''};
  const html=render.ingredientCard(it,'../');assert.match(html,/<p>2\.蛋白質>85%<\/p>/);
  assert.equal(it.text,'1.\n2.蛋白質>85%\n3.\n4.','Original CMS value must stay untouched');
});

test('CMS optional fields can persist ingredient source records and concept notes', () => {
  const config = matter('---\n' + fs.readFileSync(path.join(root, 'admin/config.yml'), 'utf8') + '\n---').data;
  const functions = config.collections.find(c => c.name === 'functions');
  assert.equal(functions.fields.find(f => f.name === 'notice').required, false);
  const fields = functions.fields.find(f => f.name === 'items').fields;
  for (const name of ['material', 'origin', 'patent', 'image_note']) {
    assert.equal(fields.find(f => f.name === name).required, false, name + ' is optional');
  }
});

test('custom-admin loader retains the category notice and the original item fields',()=>{
  const adminSource=fs.readFileSync(path.join(__dirname,'build-admin-data.js'),'utf8');
  const loader=adminSource.slice(adminSource.indexOf('function loadFunctions()'),adminSource.indexOf('function loadCatalogue()'));
  const context={path,CONTENT_DIR:path.join(root,'content'),markdownFiles:()=>['beauty.md'],readMatter:file=>matter(fs.readFileSync(file,'utf8')),sourcePath:file=>file,asString:value=>String(value||''),compareText:(a,b)=>a.localeCompare(b),module:{exports:{}}};
  vm.runInNewContext(loader+'\nmodule.exports=loadFunctions();',context);
  const loaded=context.module.exports[0];
  assert.equal(loaded.notice,beauty.notice);
  assert.equal(loaded.items.length,13);
  assert.equal(loaded.items[0].image_note,raw.items[0].image_note);
  assert.equal(loaded.items[0].origin,'日本');
});

test('official optional fields remain escaped instead of becoming executable HTML', () => {
  const unsafe = { name: '<img onerror="bad()">', en: '', text: '1.<script>bad()</script>\n2.Safe', form: '', image: '/assets/test.jpg', material: '<b>sample</b>', origin: '<svg onload="bad()">', patent: '"test"', imageNote: '<script>bad()</script>' };
  const html = render.ingredientCard(unsafe, '../');
  assert.doesNotMatch(html, /<script>|<svg|<b>sample|<img onerror/);
  assert.match(html, /&lt;script>bad\(\)&lt;\/script><br>2\.Safe/);
  assert.match(html, /&lt;svg onload=&quot;bad\(\)&quot;>/);
});
