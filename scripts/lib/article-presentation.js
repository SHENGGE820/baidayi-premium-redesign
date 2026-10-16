/* Presentation only: preserve editorial text/media order and legacy content.
   Runs AFTER the article renderer's safety checks, never as a sanitizer. */
function presentArticle(html, { sizeFor = () => null } = {}) {
  const headings = [];
  let sequence = 0;
  const includeSubheadings = (html.match(/<h2\b/gi) || []).length < 3;
  html = html.replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (whole, level, attrs, text) => {
    sequence++;
    const id = attrs.match(/\bid="([a-zA-Z][\w:.-]*)"/);
    const target = id ? id[1] : `article-section-${sequence}`;
    if (level === '2' || includeSubheadings) headings.push({ id: target, text: text.replace(/<[^>]+>/g, '').trim() });
    return `<h${level}${id ? attrs : attrs.replace(/\s+id="[^"]*"/g, '') + ` id="${target}"`}>${text}</h${level}>`;
  });
  html = html.replace(/<img\b([^>]*?)\s*\/?>/gi, (whole, attrs) => {
    const src = attrs.match(/\bsrc="([^"]+)"/);
    const size = src && sizeFor(src[1]);
    let extra = ' decoding="async"';
    attrs = attrs.replace(/\s+decoding="[^"]*"/gi, '');
    if (!/\bloading=/.test(attrs)) extra += ' loading="lazy"';
    if (size && size[0] > 0 && size[1] > 0) {
      attrs = attrs.replace(/\s+(?:width|height)="[^"]*"/gi, '');
      extra += ` width="${size[0]}" height="${size[1]}"`;
      extra += ` data-media-shape="${size[0] / size[1] < .85 ? 'portrait' : size[0] / size[1] < 1.2 ? 'square' : 'wide'}"`;
      const ratio = size[0] / size[1];
      const displayWidth = Math.floor(Math.min(size[0], ratio < .85 ? 520 * ratio : ratio < 1.2 ? 560 : 580 * ratio));
      // A definite CSS width reserves height even before lazy images decode;
      // auto/auto would otherwise jump when the natural size becomes known.
      extra += ` style="--article-image-width:${displayWidth}px"`;
    }
    return `<img${attrs}${extra}>`;
  });
  // Only a pure image group qualifies; do not rearrange images across prose.
  html = html.replace(/<div>\s*((?:<img\b[^>]*>\s*(?:<br\s*\/?>(?:\s*))?){2,})<\/div>/gi,
    (_, images) => `<div class="article-gallery">${images.replace(/<br\s*\/?>/gi, '')}</div>`);
  html = html.replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '');
  return { html, headings };
}

module.exports = { presentArticle };
