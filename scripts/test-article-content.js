const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ArticleContentError,
  normalizeArticleBlocks,
  validateArticleBlocks,
  renderArticleBlocks,
  renderSafeMarkdown
} = require('./lib/article-content');

test('structured blocks render semantic HTML and rewrite root media paths', () => {
  const html = renderArticleBlocks([
    { type: 'heading', level: 2, text: '配方邏輯' },
    { type: 'paragraph', text: '第一行\n第二行' },
    { type: 'image', src: '/assets/brand/lab.jpg', alt: '實驗室', caption: '研發現場' },
    { type: 'quote', text: '品質不是最後一關', attribution: '品保團隊' },
    { type: 'list', ordered: true, items: ['需求確認', '打樣'] }
  ], { prefix: '../' });

  assert.match(html, /<h2>配方邏輯<\/h2>/);
  assert.match(html, /<p>第一行<br>\n第二行<\/p>/);
  assert.match(html, /src="\.\.\/assets\/brand\/lab\.jpg"/);
  assert.match(html, /<blockquote><p>品質不是最後一關<\/p><footer><cite>品保團隊<\/cite>/);
  assert.match(html, /<ol><li>需求確認<\/li><li>打樣<\/li><\/ol>/);
});

test('all structured text and attributes are escaped', () => {
  const html = renderArticleBlocks([
    { type: 'heading', level: 3, text: '<img src=x onerror=alert(1)>' },
    { type: 'paragraph', text: 'A & B <script>alert(1)</script>' },
    { type: 'image', src: '/assets/a.jpg', alt: '" onerror="alert(1)', caption: '<b>caption</b>' },
    { type: 'quote', text: '<svg onload=alert(1)>', attribution: 'A & B' }
  ]);

  assert.doesNotMatch(html, /<(?:script|svg)\b/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /alt="&quot; onerror=&quot;alert\(1\)"/);
  assert.match(html, /&lt;b&gt;caption&lt;\/b&gt;/);
});

test('external video URLs are allow-listed and normalized', () => {
  const youtube = renderArticleBlocks([
    { type: 'video', provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: '影片' }
  ]);
  const vimeo = renderArticleBlocks([
    { type: 'video', provider: 'vimeo', url: 'https://vimeo.com/123456789' }
  ]);
  assert.match(youtube, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/);
  assert.match(vimeo, /src="https:\/\/player\.vimeo\.com\/video\/123456789"/);
  assert.throws(() => renderArticleBlocks([
    { type: 'video', provider: 'youtube', url: 'https://evil.example/watch?v=dQw4w9WgXcQ' }
  ]), ArticleContentError);
  assert.throws(() => renderArticleBlocks([
    { type: 'video', provider: 'vimeo', url: 'javascript:alert(1)' }
  ]), ArticleContentError);
});

test('local video supports safe landscape and portrait files with posters', () => {
  const html = renderArticleBlocks([{
    type: 'video', provider: 'file',
    url: '/wp-content/uploads/desktop.mp4',
    portraitUrl: '/wp-content/uploads/mobile.webm',
    poster: '/assets/posters/desktop.jpg',
    portraitPoster: '/assets/posters/mobile.jpg',
    caption: '生產現場'
  }], '../../');

  assert.match(html, /bke-video-wrap desktop-video/);
  assert.match(html, /src="\.\.\/\.\.\/wp-content\/uploads\/desktop\.mp4" type="video\/mp4"/);
  assert.match(html, /poster="\.\.\/\.\.\/assets\/posters\/desktop\.jpg"/);
  assert.match(html, /bke-video-wrap mobile-video/);
  assert.match(html, /src="\.\.\/\.\.\/wp-content\/uploads\/mobile\.webm" type="video\/webm"/);
  assert.match(html, /<figcaption>生產現場<\/figcaption>/);
});

test('local videos reject traversal, external hosts, scripts, and unsupported files', () => {
  for (const url of [
    '../assets/video.mp4',
    '/private/video.mp4',
    'https://example.com/video.mp4',
    'javascript:alert(1)',
    '/assets/video.html'
  ]) {
    assert.throws(() => renderArticleBlocks([{ type: 'video', provider: 'file', url }]), ArticleContentError, url);
  }
  assert.throws(() => renderArticleBlocks([{
    type: 'video', provider: 'file', url: '/assets/video.mp4', poster: 'data:image/png;base64,AAAA'
  }]), ArticleContentError);
});

test('validation reports schema errors and normalization rejects them', () => {
  const result = validateArticleBlocks([
    { type: 'heading', level: 1, text: '' },
    { type: 'image', src: 'data:image/svg+xml,<svg/>', alt: '' },
    { type: 'list', ordered: 'yes', items: [] },
    { type: 'html', text: '<script>alert(1)</script>' }
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 7);
  assert.throws(() => normalizeArticleBlocks([{ type: 'paragraph', text: '' }]), ArticleContentError);
});

test('safe Markdown disables raw HTML and unsafe URL schemes', () => {
  const html = renderSafeMarkdown([
    '# 安全測試',
    '<script>alert(1)</script>',
    '[危險](javascript:alert(1))',
    '![攻擊](data:text/html;base64,AAAA)',
    '[安全](https://example.com/path?q=1&x=2)',
    '![圖片](/assets/brand/lab.jpg)'
  ].join('\n\n'), { prefix: '../' });

  assert.doesNotMatch(html, /<script|javascript:|data:text/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, />危險</);
  assert.doesNotMatch(html, /href="[^"]*">危險/);
  assert.match(html, /href="https:\/\/example\.com\/path\?q=1&amp;x=2"/);
  assert.match(html, /src="\.\.\/assets\/brand\/lab\.jpg"/);
});

test('an unsafe render prefix is rejected before producing HTML', () => {
  assert.throws(() => renderArticleBlocks([
    { type: 'paragraph', text: '內文' }
  ], { prefix: '\"><script>alert(1)</script>' }), /Unsafe article path prefix/);
});
