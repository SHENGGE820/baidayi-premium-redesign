const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const matter=require('gray-matter');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('news filters expose the real editorial categories, not a misleading combined trend bucket',()=>{
  const listing=read('最新消息/index.html');
  const filters=[...listing.matchAll(/data-news-filter="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(filters,['all','市場趨勢','配方研發','製造觀點','供應觀察','品牌動態']);
  const categories=[...listing.matchAll(/data-news-category="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(categories.length,fs.readdirSync(path.join(root,'content/articles')).filter(f=>f.endsWith('.md')).length);
  for(const category of categories)assert.ok(filters.includes(category));
  assert.equal((listing.match(/article-card-featured/g)||[]).length,1);
  assert.match(listing,/data-news-results role="status" aria-live="polite"/);
});

test('all generated news pages share the editorial shell and have working paragraph navigation',()=>{
  for(const file of fs.readdirSync(path.join(root,'content/articles')).filter(f=>f.endsWith('.md'))){
    const source=matter(read('content/articles/'+file)).data;
    const html=read(file.replace(/\.md$/,'')+'/index.html');
    assert.match(html,/premium-news.css\?v=20261016-01/);
    assert.match(html,/premium-news.js\?v=20261016-01/);
    assert.match(html,/class="article-breadcrumb"/);
    assert.match(html,/class="article-content-section"/);
    assert.match(html,/id="related-title">延伸閱讀/);
    assert.ok(html.includes(source.title));
    const outline=(html.match(/<aside class="article-outline">([\s\S]*?)<\/aside>/)||[])[1]||'';
    for(const match of outline.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${match[1]}"`),file+' '+match[1]);
    const hero=(html.match(/class="article-hero[^>]*>([\s\S]*?)<\/div>/)||[])[1];
    if(hero)assert.match(hero,/<img[^>]+width="\d+" height="\d+"/);
  }
});

test('article media CSS contains small and portrait images rather than stretching them',()=>{
  const css=read('premium-news.css');
  assert.match(css,/\.article-page \.article-body img \{[^}]*width: min\(100%,var\(--article-image-width,100%\)\);[^}]*max-width: 100%;[^}]*height: auto;/);
  assert.match(css,/\.article-page \.article-body img\[data-media-shape="portrait"\] \{ max-height: 520px;/);
  assert.match(css,/\.news-page \.article-card-image-artwork img \{ object-fit: contain;/);
});
