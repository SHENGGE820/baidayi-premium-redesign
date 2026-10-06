/* Enhance real certificate-image links with an accessible in-page viewer.
 * With JavaScript disabled or native dialog unavailable, the original links work.
 */
(function () {
  'use strict';

  if (typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function' ||
      document.querySelector('dialog.certificate-viewer')) return;

  var dialog = document.createElement('dialog');
  dialog.className = 'certificate-viewer';
  dialog.setAttribute('aria-labelledby', 'certificate-viewer-title');

  var header = document.createElement('div');
  header.className = 'certificate-viewer-header';

  var title = document.createElement('h2');
  title.id = 'certificate-viewer-title';
  title.className = 'certificate-viewer-title';

  var closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'certificate-viewer-close';
  closeButton.setAttribute('aria-label', '關閉證書檢視');
  closeButton.setAttribute('autofocus', '');
  closeButton.textContent = '關閉 ×';

  var stage = document.createElement('div');
  stage.className = 'certificate-viewer-stage';
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', '證書原圖，可上下捲動查看');

  var image = document.createElement('img');
  image.className = 'certificate-viewer-image';
  image.setAttribute('decoding', 'async');

  var imageStatus = document.createElement('p');
  imageStatus.className = 'certificate-viewer-status';
  imageStatus.setAttribute('role', 'status');

  var footer = document.createElement('div');
  footer.className = 'certificate-viewer-footer';

  var note = document.createElement('p');
  note.className = 'certificate-viewer-note';
  note.textContent = '認證範圍、廠區與有效期間以證書所載內容為準。';

  var original = document.createElement('a');
  original.className = 'certificate-viewer-original';
  original.target = '_blank';
  original.rel = 'noopener';
  original.textContent = '原圖另開 ↗';

  header.appendChild(title);
  header.appendChild(closeButton);
  stage.appendChild(imageStatus);
  stage.appendChild(image);
  footer.appendChild(note);
  footer.appendChild(original);
  dialog.appendChild(header);
  dialog.appendChild(stage);
  dialog.appendChild(footer);
  document.body.appendChild(dialog);

  var opener = null;
  var previousOverflow = '';

  image.addEventListener('load', function () {
    imageStatus.hidden = true;
  });

  image.addEventListener('error', function () {
    imageStatus.hidden = false;
    imageStatus.textContent = '無法載入證書圖片，請使用「原圖另開」查看。';
  });

  closeButton.addEventListener('click', function () {
    dialog.close();
  });

  // The native dialog handles Escape and focus trapping.
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    var bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });

  dialog.addEventListener('close', function () {
    document.body.style.overflow = previousOverflow;
    if (opener && opener.isConnected) {
      try { opener.focus({ preventScroll: true }); } catch (error) { opener.focus(); }
    }
    opener = null;
  });

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        !(event.target instanceof Element)) return;
    var link = event.target.closest('a[data-certificate-view]');
    if (!link || link.hasAttribute('download')) return;

    var label = link.getAttribute('data-certificate-title') || '認證證書';
    title.textContent = label;
    image.alt = label + '證書原圖';
    imageStatus.hidden = false;
    imageStatus.textContent = '正在載入證書…';
    image.src = link.href;
    original.href = link.href;
    original.setAttribute('aria-label', '另開新分頁查看' + label + '證書原圖');
    if (image.complete && image.naturalWidth > 0) imageStatus.hidden = true;

    // Prevent navigation only once the enhanced viewer has opened successfully.
    try {
      dialog.showModal();
    } catch (error) {
      return;
    }
    event.preventDefault();
    opener = link;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stage.scrollTop = 0;
  });
})();
