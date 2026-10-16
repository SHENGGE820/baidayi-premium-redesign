'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {models} = require('../content/packaging-models.json');
const render = require('./lib/packaging-models');
test('all 47 original packaging sheets retain independent verified text and safe photo bounds',()=>{
  assert.equal(Object.keys(models).length,47);
  for(let n=1;n<=47;n++){
    const image=`/wp-content/uploads/2026/04/${n}.png`;
    const model=models[image]; assert.ok(model);
    assert.ok(fs.existsSync(path.join(__dirname,'..',image)));
    assert.ok(model.name&&model.specs['編號']);
    assert.ok(Object.values(model.specs).every(value=>value&&typeof value==='string'));
    assert.equal(model.photo.top+model.photo.height,515,'the baked text starts below the photo viewport');
    assert.equal(model.photo.fullHeight,797);
  }
  assert.equal(models['/wp-content/uploads/2026/04/14.png'].specs['規格'],'BOK-305-B-W2');
  assert.equal(models['/wp-content/uploads/2026/04/42.png'].specs['編號'],'31129458 - 8.6mm 小口');
  assert.equal(models['/wp-content/uploads/2026/04/47.png'].specs['成型尺寸'],'98×58.6MM');
  assert.equal(models['/wp-content/uploads/2026/04/39.png'].photo.top,15,'the tall bag must remain complete');
});
test('packaging text is escaped, specification sheets remain accessible, and no JS hides source records',()=>{
  const html=render({item:{title:'<script>bad()</script>',text:'<b>source</b>'},groups:[{name:'款式',items:[{image:'/wp-content/uploads/2026/04/16.png'}]}],image:src=>`<img src="${src}" alt="">`,destination:()=>'/contact/',id:'test'});
  assert.doesNotMatch(html,/<script>|<b>source<\/b>/);
  assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html,/href="\.\.\/wp-content\/uploads\/2026\/04\/16\.png"/);
  assert.match(html,/<dt>編號<\/dt><dd>3104000400742<\/dd>/);
  assert.match(html,/data-packaging-full[^>]*aria-haspopup="dialog"[^>]*hidden>查看款式/);
  assert.match(html,/<strong>1<\/strong> 款可選/);
  assert.doesNotMatch(html,/data-packaging-choice/);
  assert.doesNotMatch(html,/<figure[^>]*\bhidden/);
});
