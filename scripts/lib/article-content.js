/* Safe rendering for article content.
 *
 * Articles edited in the custom CMS use a deliberately small block schema.
 * Nothing in that schema is trusted as HTML: text is escaped, URLs are
 * allow-listed, and root-relative media paths are rewritten for the depth of
 * the generated article page.
 */
const { Marked, Renderer } = require('marked');

const BLOCK_TYPES = new Set(['heading', 'paragraph', 'image', 'video', 'quote', 'list']);
const LOCAL_MEDIA = /^\/(?:assets|wp-content)\//;
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg']);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const URL_BAD = /[\u0000-\u0020\u007f<>"'`\\]/;

class ArticleContentError extends Error {
  constructor(errors) {
    super(`Invalid article content:\n- ${errors.join('\n- ')}`);
    this.name = 'ArticleContentError';
    this.errors = errors;
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function optionsOf(options) {
  if (typeof options === 'string') return { prefix: options };
  return options && typeof options === 'object' ? options : {};
}

function safePrefix(options) {
  const prefix = String(optionsOf(options).prefix || '');
  if (!/^(?:(?:\.\.?\/))*$/.test(prefix)) throw new Error(`Unsafe article path prefix: ${prefix}`);
  return prefix;
}

function hasAllowedUrlShape(value) {
  return value && !URL_BAD.test(value) && !/^\/\//.test(value);
}

function httpsUrl(value) {
  if (!hasAllowedUrlShape(value) || !/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch (_) {
    return null;
  }
}

function rewriteRootPath(value, prefix) {
  return value.startsWith('/') && !value.startsWith('//') ? prefix + value.slice(1) : value;
}

/* Links may be HTTPS, a same-site path/anchor, an email address, or a phone
   number. Any other explicit scheme (including javascript: and data:) is
   rejected. */
function safeLinkUrl(value, prefix = '') {
  const raw = String(value == null ? '' : value).trim();
  if (!hasAllowedUrlShape(raw)) return null;
  if (/^https:\/\//i.test(raw)) return httpsUrl(raw);
  if (/^mailto:/i.test(raw)) {
    return /^mailto:[^@\s/?#]+@[^@\s/?#]+(?:\?subject=[^\r\n]*)?$/i.test(raw) ? raw : null;
  }
  if (/^tel:/i.test(raw)) return /^tel:\+?[0-9() .-]{6,30}$/i.test(raw) ? raw : null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith('#')) return /^#[A-Za-z0-9_:.%-]+$/.test(raw) ? raw : null;
  return rewriteRootPath(raw, prefix);
}

/* Images can use same-site media or an HTTPS origin. Site media is kept
   root-relative in content and receives the page prefix only at render time. */
function safeImageUrl(value, prefix = '') {
  const raw = String(value == null ? '' : value).trim();
  if (!hasAllowedUrlShape(raw)) return null;
  if (/^https:\/\//i.test(raw)) return httpsUrl(raw);
  if (!LOCAL_MEDIA.test(raw)) return null;
  return rewriteRootPath(raw, prefix);
}

function siteMediaUrl(value, prefix, extensions) {
  const raw = String(value == null ? '' : value).trim();
  if (!hasAllowedUrlShape(raw) || !LOCAL_MEDIA.test(raw) || /[?#]/.test(raw)) return null;
  if (extensions) {
    const match = raw.match(/\.([a-z0-9]+)$/i);
    if (!match || !extensions.has(match[1].toLowerCase())) return null;
  }
  return rewriteRootPath(raw, prefix);
}

function youtubeId(value) {
  const absolute = httpsUrl(value);
  if (!absolute) return null;
  const url = new URL(absolute);
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
  else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else if (/^\/(?:embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
  } else if (host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
    if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

function vimeoId(value) {
  const absolute = httpsUrl(value);
  if (!absolute) return null;
  const url = new URL(absolute);
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    id = parts.length === 1 ? parts[0] : '';
  } else if (host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/video\/(\d+)\/?$/);
    id = match ? match[1] : '';
  }
  return /^\d{5,15}$/.test(id) ? id : null;
}

function normalizedVideoUrl(provider, value) {
  if (provider === 'youtube') {
    const id = youtubeId(value);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (provider === 'vimeo') {
    const id = vimeoId(value);
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

function normalizeText(value, field, errors, { required = false, max = 20000 } = {}) {
  if (value == null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') {
    errors.push(`${field} must be text`);
    return '';
  }
  const text = String(value).replace(/\r\n?/g, '\n').trim();
  if (CONTROL.test(text)) errors.push(`${field} contains control characters`);
  if (required && !text) errors.push(`${field} is required`);
  if (text.length > max) errors.push(`${field} exceeds ${max} characters`);
  return text;
}

function validateArticleBlocks(input) {
  const errors = [];
  const blocks = [];
  if (input == null) input = [];
  if (!Array.isArray(input)) return { valid: false, errors: ['body_blocks must be a list'], blocks: [] };
  if (input.length > 250) errors.push('body_blocks cannot contain more than 250 blocks');

  input.slice(0, 250).forEach((raw, index) => {
    const at = `body_blocks[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${at} must be an object`);
      return;
    }
    const type = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
    if (!BLOCK_TYPES.has(type)) {
      errors.push(`${at}.type is not supported`);
      return;
    }

    if (type === 'heading') {
      const level = Number(raw.level);
      if (level !== 2 && level !== 3) errors.push(`${at}.level must be 2 or 3`);
      const text = normalizeText(raw.text, `${at}.text`, errors, { required: true, max: 300 });
      blocks.push({ type, level, text });
      return;
    }

    if (type === 'paragraph') {
      const text = normalizeText(raw.text, `${at}.text`, errors, { required: true, max: 30000 });
      blocks.push({ type, text });
      return;
    }

    if (type === 'image') {
      const src = normalizeText(raw.src, `${at}.src`, errors, { required: true, max: 2000 });
      const alt = normalizeText(raw.alt, `${at}.alt`, errors, { required: true, max: 500 });
      const caption = normalizeText(raw.caption, `${at}.caption`, errors, { max: 1000 });
      if (src && !safeImageUrl(src)) errors.push(`${at}.src must be /assets, /wp-content, or an HTTPS URL`);
      blocks.push({ type, src, alt, caption });
      return;
    }

    if (type === 'video') {
      let provider = typeof raw.provider === 'string' ? raw.provider.trim().toLowerCase() : '';
      if (provider === 'local') provider = 'file';
      if (!['youtube', 'vimeo', 'file'].includes(provider)) errors.push(`${at}.provider must be youtube, vimeo, or file`);
      const url = normalizeText(raw.url, `${at}.url`, errors, { required: true, max: 2000 });
      const caption = normalizeText(raw.caption, `${at}.caption`, errors, { max: 1000 });
      if (provider === 'file') {
        const portraitUrl = normalizeText(raw.portraitUrl, `${at}.portraitUrl`, errors, { max: 2000 });
        const poster = normalizeText(raw.poster, `${at}.poster`, errors, { max: 2000 });
        const portraitPoster = normalizeText(raw.portraitPoster, `${at}.portraitPoster`, errors, { max: 2000 });
        if (url && !siteMediaUrl(url, '', VIDEO_EXTENSIONS)) errors.push(`${at}.url must be a root-relative MP4, WebM, or Ogg file under /assets or /wp-content`);
        if (portraitUrl && !siteMediaUrl(portraitUrl, '', VIDEO_EXTENSIONS)) errors.push(`${at}.portraitUrl must be a root-relative MP4, WebM, or Ogg file under /assets or /wp-content`);
        if (poster && !siteMediaUrl(poster, '')) errors.push(`${at}.poster must be root-relative under /assets or /wp-content`);
        if (portraitPoster && !siteMediaUrl(portraitPoster, '')) errors.push(`${at}.portraitPoster must be root-relative under /assets or /wp-content`);
        if (portraitPoster && !portraitUrl) errors.push(`${at}.portraitPoster requires portraitUrl`);
        blocks.push({ type, provider, url, portraitUrl, poster, portraitPoster, caption });
      } else {
        if (url && !normalizedVideoUrl(provider, url)) errors.push(`${at}.url is not an allowed ${provider || 'external'} video URL`);
        for (const name of ['portraitUrl', 'poster', 'portraitPoster']) {
          if (raw[name]) errors.push(`${at}.${name} is only available for file videos`);
        }
        blocks.push({ type, provider, url, caption });
      }
      return;
    }

    if (type === 'quote') {
      const text = normalizeText(raw.text, `${at}.text`, errors, { required: true, max: 10000 });
      const attribution = normalizeText(raw.attribution, `${at}.attribution`, errors, { max: 500 });
      blocks.push({ type, text, attribution });
      return;
    }

    if (typeof raw.ordered !== 'boolean') errors.push(`${at}.ordered must be true or false`);
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
      errors.push(`${at}.items must contain at least one item`);
      blocks.push({ type, ordered: raw.ordered === true, items: [] });
      return;
    }
    if (raw.items.length > 100) errors.push(`${at}.items cannot contain more than 100 items`);
    const items = raw.items.slice(0, 100).map((item, itemIndex) =>
      normalizeText(item, `${at}.items[${itemIndex}]`, errors, { required: true, max: 5000 })
    );
    blocks.push({ type, ordered: raw.ordered === true, items });
  });

  return { valid: errors.length === 0, errors, blocks };
}

function normalizeArticleBlocks(input) {
  const result = validateArticleBlocks(input);
  if (!result.valid) throw new ArticleContentError(result.errors);
  return result.blocks;
}

function textWithBreaks(value) {
  return escapeHtml(value).replace(/\n/g, '<br>\n');
}

function videoType(url) {
  const extension = String(url).match(/\.([a-z0-9]+)$/i);
  return extension ? `video/${extension[1].toLowerCase() === 'ogg' ? 'ogg' : extension[1].toLowerCase()}` : '';
}

function renderFileVideo(block, prefix) {
  const renderOne = (url, poster, className) => {
    const src = siteMediaUrl(url, prefix, VIDEO_EXTENSIONS);
    const posterUrl = poster ? siteMediaUrl(poster, prefix) : '';
    const cls = className ? ` ${className}` : '';
    return `<div class="bke-video-wrap${cls}"><video controls preload="none" playsinline${posterUrl ? ` poster="${escapeHtml(posterUrl)}"` : ''}><source src="${escapeHtml(src)}" type="${videoType(url)}"></video></div>`;
  };
  if (block.portraitUrl) {
    return renderOne(block.url, block.poster, 'desktop-video') + '\n' +
      renderOne(block.portraitUrl, block.portraitPoster, 'mobile-video');
  }
  return renderOne(block.url, block.poster, '');
}

function renderArticleBlocks(input, options = {}) {
  const prefix = safePrefix(options);
  const blocks = normalizeArticleBlocks(input);
  return blocks.map(block => {
    if (block.type === 'heading') return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    if (block.type === 'paragraph') return `<p>${textWithBreaks(block.text)}</p>`;
    if (block.type === 'image') {
      const image = `<img src="${escapeHtml(safeImageUrl(block.src, prefix))}" alt="${escapeHtml(block.alt)}" loading="lazy" decoding="async">`;
      return `<figure class="article-content-image">${image}${block.caption ? `<figcaption>${textWithBreaks(block.caption)}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'video') {
      const media = block.provider === 'file'
        ? renderFileVideo(block, prefix)
        : `<div class="article-video-embed"><iframe title="${escapeHtml(block.caption || (block.provider === 'youtube' ? 'YouTube 影片' : 'Vimeo 影片'))}" src="${escapeHtml(normalizedVideoUrl(block.provider, block.url))}" loading="lazy" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
      return `<figure class="article-content-video">${media}${block.caption ? `<figcaption>${textWithBreaks(block.caption)}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'quote') {
      return `<blockquote><p>${textWithBreaks(block.text)}</p>${block.attribution ? `<footer><cite>${escapeHtml(block.attribution)}</cite></footer>` : ''}</blockquote>`;
    }
    const tag = block.ordered ? 'ol' : 'ul';
    return `<${tag}>${block.items.map(item => `<li>${textWithBreaks(item)}</li>`).join('')}</${tag}>`;
  }).join('\n');
}

/* Marked does useful typography for legacy/new Markdown, but its default raw
   HTML and URL handling are deliberately replaced. Raw tags are shown as
   text; unsafe links lose their anchor, and unsafe images are reduced to alt
   text. */
function renderSafeMarkdown(markdown, options = {}) {
  const prefix = safePrefix(options);
  const renderer = new Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = function ({ href, title, tokens }) {
    const body = this.parser.parseInline(tokens);
    const safe = safeLinkUrl(href, prefix);
    if (!safe) return body;
    return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${body}</a>`;
  };
  renderer.image = function ({ href, title, text, tokens }) {
    const alt = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
    const safe = safeImageUrl(href, prefix);
    if (!safe) return escapeHtml(alt || '');
    return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt || '')}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`;
  };
  const parser = new Marked({ async: false, gfm: true, renderer });
  return parser.parse(String(markdown == null ? '' : markdown));
}

module.exports = {
  ArticleContentError,
  escapeHtml,
  normalizeArticleBlocks,
  validateArticleBlocks,
  renderArticleBlocks,
  renderSafeMarkdown,
  safeLinkUrl,
  safeImageUrl
};
