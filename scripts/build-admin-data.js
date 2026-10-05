#!/usr/bin/env node

/*
 * Builds the read-only content index used by the custom admin interface.
 *
 *   node scripts/build-admin-data.js
 *
 * The generated JSON deliberately keeps the original front matter for pages
 * while giving articles and catalogue entries a small, predictable shape.
 * Media references are collected from both structured fields and article
 * bodies so the media library can show assets used by legacy HTML too.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const OUTPUT_FILE = path.join(ROOT, 'admin-next', 'data.json');

const MEDIA_TYPES = new Map([
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif'],
  ['ico', 'image/x-icon'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['webp', 'image/webp'],
  ['m4v', 'video/x-m4v'],
  ['mov', 'video/quicktime'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm']
]);

const MEDIA_EXTENSION_PATTERN = [...MEDIA_TYPES.keys()].join('|');
const ATTRIBUTE_MEDIA_RE = /(?:src|poster|href|data-src|data-poster)\s*=\s*(["'])(.*?)\1/giu;
const MARKDOWN_MEDIA_RE = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/giu;
const CSS_MEDIA_RE = /url\(\s*(["']?)(.*?)\1\s*\)/giu;
const BARE_MEDIA_RE = new RegExp(
  `(?:https?:\\/\\/|\\/\\/|\\/|\\.\\.?\\/)[^\\s"'<>()[\\]]+?\\.(?:${MEDIA_EXTENSION_PATTERN})(?:[?#][^\\s"'<>]*)?`,
  'giu'
);

function compareText(a, b) {
  const left = String(a == null ? '' : a).normalize('NFC');
  const right = String(b == null ? '' : b).normalize('NFC');
  return left < right ? -1 : left > right ? 1 : 0;
}

function asString(value) {
  return value == null ? '' : String(value).trim();
}

function asDateString(value) {
  if (value instanceof Date) return value.toISOString();
  return asString(value);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function sourcePath(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function markdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name)
    .sort(compareText);
}

function readMatter(filePath) {
  return matter(fs.readFileSync(filePath, 'utf8'));
}

function loadArticles() {
  const directory = path.join(CONTENT_DIR, 'articles');
  return markdownFiles(directory).map(fileName => {
    const filePath = path.join(directory, fileName);
    const parsed = readMatter(filePath);
    const data = parsed.data || {};
    const slug = fileName.replace(/\.md$/i, '');

    return {
      id: slug,
      slug,
      source: sourcePath(filePath),
      title: asString(data.title),
      date: asDateString(data.date),
      category: asString(data.category),
      summary: asString(data.summary),
      cover: asString(data.cover),
      coverAlt: asString(data.cover_alt || data.title),
      hero: asString(data.hero),
      videoLandscape: asString(data.video_landscape),
      videoPortrait: asString(data.video_portrait),
      videoEmbed: asString(data.video_embed),
      home: data.home === true,
      body: parsed.content.trim(),
      bodyHtml: asString(data.body_html)
    };
  }).sort((a, b) => compareText(b.date, a.date) || compareText(a.slug, b.slug));
}

function loadCatalogue() {
  const directory = path.join(CONTENT_DIR, 'catalogue');
  return markdownFiles(directory).map(fileName => {
    const filePath = path.join(directory, fileName);
    const data = readMatter(filePath).data || {};
    const slug = fileName.replace(/\.md$/i, '');

    return {
      id: slug,
      slug,
      source: sourcePath(filePath),
      title: asString(data.title),
      titleEn: asString(data.title_en),
      lead: asString(data.lead),
      hero: asString(data.hero),
      groups: Array.isArray(data.groups) ? data.groups : [],
      cta: data.cta == null ? null : data.cta
    };
  }).sort((a, b) => compareText(a.slug, b.slug));
}

function loadPages() {
  const directory = path.join(CONTENT_DIR, 'pages');
  return markdownFiles(directory).map(fileName => {
    const filePath = path.join(directory, fileName);
    const id = fileName.replace(/\.md$/i, '');
    return {
      id,
      source: sourcePath(filePath),
      data: readMatter(filePath).data || {}
    };
  }).sort((a, b) => compareText(a.id, b.id));
}

function loadSettings() {
  const filePath = path.join(CONTENT_DIR, 'settings.md');
  return readMatter(filePath).data || {};
}

function normaliseMediaPath(value) {
  let mediaPath = asString(value).replace(/&amp;/giu, '&');
  if (!mediaPath || mediaPath.startsWith('data:')) return null;

  if ((mediaPath.startsWith('"') && mediaPath.endsWith('"')) ||
      (mediaPath.startsWith("'") && mediaPath.endsWith("'"))) {
    mediaPath = mediaPath.slice(1, -1).trim();
  }

  // A cache-busting query is not part of an asset's identity in the library.
  mediaPath = mediaPath.split('#', 1)[0].split('?', 1)[0].trim();
  const extension = mediaPath.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
  const type = extension && MEDIA_TYPES.get(extension);
  return type ? { path: mediaPath, type } : null;
}

function candidatesFromString(value) {
  const trimmed = value.trim();
  // Treat a scalar as a path only when it is not a larger HTML/text body.
  const candidates = /[\r\n<>]/u.test(trimmed) ? [] : [trimmed];
  let match;

  ATTRIBUTE_MEDIA_RE.lastIndex = 0;
  while ((match = ATTRIBUTE_MEDIA_RE.exec(value))) candidates.push(match[2]);

  MARKDOWN_MEDIA_RE.lastIndex = 0;
  while ((match = MARKDOWN_MEDIA_RE.exec(value))) candidates.push(match[1] || match[2]);

  CSS_MEDIA_RE.lastIndex = 0;
  while ((match = CSS_MEDIA_RE.exec(value))) candidates.push(match[2]);

  BARE_MEDIA_RE.lastIndex = 0;
  while ((match = BARE_MEDIA_RE.exec(value))) candidates.push(match[0]);

  return candidates;
}

function fieldReference(source, field) {
  return field ? `${source}#${field}` : source;
}

function appendField(base, key, isArray) {
  if (isArray) return `${base}[${key}]`;
  return base ? `${base}.${key}` : String(key);
}

function collectMedia(articles, catalogue, pages, settings) {
  const assets = new Map();

  function add(value, reference) {
    for (const candidate of candidatesFromString(value)) {
      const media = normaliseMediaPath(candidate);
      if (!media) continue;
      let entry = assets.get(media.path);
      if (!entry) {
        entry = { path: media.path, type: media.type, referencedBy: new Set() };
        assets.set(media.path, entry);
      }
      entry.referencedBy.add(reference);
    }
  }

  function walk(value, source, field = '') {
    if (typeof value === 'string') {
      add(value, fieldReference(source, field));
      return;
    }
    if (value == null || value instanceof Date || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, source, appendField(field, index, true)));
      return;
    }

    Object.keys(value).sort(compareText).forEach(key => {
      walk(value[key], source, appendField(field, key, false));
    });
  }

  articles.forEach(article => walk(article, article.source));
  catalogue.forEach(entry => walk(entry, entry.source));
  pages.forEach(page => walk(page.data, page.source, 'data'));
  walk(settings, 'content/settings.md');

  return [...assets.values()]
    .map(entry => ({
      path: entry.path,
      type: entry.type,
      referencedBy: [...entry.referencedBy].sort(compareText)
    }))
    .sort((a, b) => compareText(a.path, b.path));
}

function safeJson(value) {
  // Escaping HTML-significant characters also keeps this safe if it is ever
  // embedded in a script tag instead of fetched as a standalone JSON file.
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sourceCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

function buildAdminData() {
  const articles = loadArticles();
  const catalogue = loadCatalogue();
  const pages = loadPages();
  const settings = loadSettings();
  const media = collectMedia(articles, catalogue, pages, settings);

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCommit: sourceCommit(),
    stats: {
      articles: articles.length,
      catalogue: catalogue.length,
      pages: pages.length,
      media: media.length,
      mediaImages: media.filter(item => item.type.startsWith('image/')).length,
      mediaVideos: media.filter(item => item.type.startsWith('video/')).length
    },
    articles,
    catalogue,
    pages,
    settings,
    media
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${safeJson(payload)}\n`, 'utf8');
  return payload;
}

const payload = buildAdminData();
console.log(
  `admin data: ${payload.stats.articles} articles, ` +
  `${payload.stats.catalogue} catalogue entries, ${payload.stats.pages} pages, ` +
  `${payload.stats.media} media files -> ${sourcePath(OUTPUT_FILE)}`
);
