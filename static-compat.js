(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  ready(function () {
    var compatScript = document.querySelector('script[src*="static-compat.js"]');
    var staticRoot = compatScript ? new URL('.', compatScript.src) : new URL('./', window.location.href);
    var placeholderImage = new URL('static-placeholder.svg', staticRoot).href;

    // Rewrite root-absolute links against staticRoot rather than the domain
    // root. This is a no-op when the site is served from a domain root, but
    // is required whenever it's hosted under a subpath (GitHub Pages project
    // sites, a subfolder deploy, etc.) as well as when opened via file://.
    document.querySelectorAll('a[href^="/"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && !href.startsWith('//')) link.href = new URL(href.replace(/^\/+/, ''), staticRoot).href;
    });
    document.querySelectorAll('[data-link-column-url^="/"]').forEach(function (column) {
      var href = column.getAttribute('data-link-column-url');
      column.setAttribute('data-link-column-url', new URL(href.replace(/^\/+/, ''), staticRoot).href);
    });

    // The theme ships a transparent fixed header whose own JS swaps it to a
    // solid one once you scroll off the hero. That JS doesn't run here, so
    // the white nav text was left sitting on whatever happened to be behind
    // it — which past the hero is white, and on the product sub-pages is
    // white from the very top. Measured contrast was 1.00: the navigation
    // was completely invisible. Re-implement the swap.
    (function stickyHeaderContrast() {
      var header = document.getElementById('header');
      var main = document.getElementById('main');
      if (!header || !main) return;

      // Only a tall, image-backed opening section can carry white nav text.
      // Pages without one (the product sub-pages) go solid immediately.
      var first = main.querySelector(':scope > .avia-section, :scope > .container_wrap');
      var hero = null;
      if (first) {
        var background = window.getComputedStyle(first).backgroundImage;
        if (background && background !== 'none' && first.offsetHeight >= 320) hero = first;
      }

      var threshold = 0;
      function measure() {
        threshold = hero ? Math.max(0, hero.offsetHeight - header.offsetHeight - 40) : 0;
      }

      // The backdrop is a dedicated element of our own rather than a style on
      // #header or .header_bg. Both of those are pinned by the theme's
      // minified CSS — .header_bg carries two competing
      // `background-color: ... !important` declarations, and on #header even
      // an inline `!important` was observed losing. A fresh node nothing else
      // targets sidesteps the cascade entirely.
      var backdrop = document.createElement('div');
      backdrop.className = 'bke-header-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      header.insertBefore(backdrop, header.firstChild);

      var solidNow = null;
      function sync() {
        var solid = !hero || window.pageYOffset > threshold;
        if (solid === solidNow) return;
        solidNow = solid;
        document.documentElement.classList.toggle('bke-header-solid', solid);
        backdrop.style.opacity = solid ? '1' : '0';
      }

      measure();
      sync();
      window.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', function () { measure(); sync(); }, { passive: true });
    })();

    function hashTarget(hash) {
      if (!hash || hash === '#' || hash === '#next' || hash === '#prev') return null;
      var id;
      try { id = decodeURIComponent(hash.slice(1)); }
      catch (_) { id = hash.slice(1); }
      return document.getElementById(id) || document.querySelector('[name="' + CSS.escape(id) + '"]');
    }

    var smoothScrollFrame = 0;

    function animateDocumentScroll(target) {
      if (smoothScrollFrame) cancelAnimationFrame(smoothScrollFrame);
      var startY = window.scrollY;
      var targetOffset = target.classList && target.classList.contains('av-horizontal-gallery') ? 245 : 96;
      var targetY = Math.max(0, startY + target.getBoundingClientRect().top - targetOffset);
      var distance = targetY - startY;
      if (Math.abs(distance) < 2) return;
      var duration = Math.min(1100, Math.max(620, Math.abs(distance) * .38));
      var startedAt = performance.now();

      function scrollFrame(now) {
        var progress = Math.min(1, (now - startedAt) / duration);
        var eased = progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, startY + distance * eased);
        if (progress < 1) smoothScrollFrame = requestAnimationFrame(scrollFrame);
        else smoothScrollFrame = 0;
      }

      smoothScrollFrame = requestAnimationFrame(scrollFrame);
    }

    function smoothToHash(hash, updateAddress) {
      var target = hashTarget(hash);
      if (!target) return false;
      animateDocumentScroll(target);
      if (updateAddress && window.history && history.pushState) history.pushState(null, '', hash);
      return true;
    }

    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href*="#"]');
      if (!link || link.classList.contains('prev-slide') || link.classList.contains('next-slide')) return;
      var url;
      try { url = new URL(link.href, window.location.href); }
      catch (_) { return; }
      if (!url.hash || url.hash === '#') return;
      if (url.href.split('#')[0] !== window.location.href.split('#')[0]) return;
      if (!smoothToHash(url.hash, true)) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    if (window.location.hash && hashTarget(window.location.hash)) {
      window.addEventListener('load', function () {
        window.scrollTo(0, 0);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { smoothToHash(window.location.hash, false); });
        });
        setTimeout(function () { smoothToHash(window.location.hash, false); }, 320);
      }, { once: true });
    }

    var googleFormAction = 'https://docs.google.com/forms/d/e/1FAIpQLSeP3KrUZ5PTpkwhoCBBhWK5_aV_5MjT70JdYOkaRzDd1gvvPw/formResponse';
    var googleFieldMap = {
      'your-name': 'entry.130244551',
      'phone': 'entry.1017656485',
      'email': 'entry.1981457941',
      'select-732': 'entry.38656607',
      'select-733': 'entry.1257808609',
      'select-734': 'entry.270739519',
      'message': 'entry.1788068493'
    };

    document.querySelectorAll('form.wpcf7-form').forEach(function (form) {
      form.action = googleFormAction;
      form.method = 'post';
      form.target = '_blank';
      Object.keys(googleFieldMap).forEach(function (originalName) {
        var field = form.querySelector('[name="' + originalName + '"]');
        if (!field) return;
        field.name = googleFieldMap[originalName];
        field.required = true;
      });
      form.addEventListener('submit', function (event) {
        event.stopImmediatePropagation();
      }, true);
    });

    document.querySelectorAll('form').forEach(function (form) {
      if (form.classList.contains('wpcf7-form')) return;
      var searchInput = form.querySelector('input[name="s"], input[type="search"]');
      if (!searchInput) return;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.href = new URL('search.html?q=' + encodeURIComponent(searchInput.value.trim()), staticRoot).href;
      }, true);
    });

    document.querySelectorAll('.cart_dropdown, .widget_shopping_cart, .woocommerce-mini-cart').forEach(function (cart) {
      cart.remove();
    });

    document.body.classList.add('bke-motion-ready');

    var revealSelector = [
      '#main > .avia-section > .container',
      '#main .av-layout-grid-container > .flex_cell',
      '#main .av-masonry-entry .av-inner-masonry',
      '#main .bke-news-card',
      '#main .product-development .flex_column',
      '#main .avia-icon-list > li',
      '#main .avia-content-slider .slide-entry',
      '#main .av-horizontal-gallery',
      '#main .bke-service-jump-card',
      '#main .bke-pie-stage',
      '#main .avia-animated-number'
    ].join(',');

    var revealItems = Array.from(document.querySelectorAll(revealSelector)).filter(function (item) {
      return !item.closest('#footer, #socket, #pum-4684') && !item.closest('.pie-main, .pie-icon, .pie-text');
    });

    revealItems.forEach(function (item) {
      item.classList.add('bke-reveal');
      if (item.matches('.av-horizontal-gallery, .bke-pie-stage')) item.classList.add('bke-reveal-fade');
      var siblings = item.parentElement ? Array.from(item.parentElement.children).filter(function (sibling) {
        return sibling.matches && sibling.matches(revealSelector);
      }) : [];
      item.style.setProperty('--bke-reveal-order', String(Math.min(Math.max(0, siblings.indexOf(item)), 5)));
    });

    function showReveal(item) {
      item.classList.add('bke-reveal-visible');
    }

    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealObserver.unobserve(entry.target);
          showReveal(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
      revealItems.forEach(function (item) { revealObserver.observe(item); });
    } else {
      revealItems.forEach(showReveal);
    }

    document.querySelectorAll('#main .avia-image-container img, #main img[loading="lazy"]').forEach(function (image) {
      image.classList.add('bke-image-fade');
      function showImage() { requestAnimationFrame(function () { image.classList.add('bke-image-visible'); }); }
      if (image.complete) showImage();
      else {
        image.addEventListener('load', showImage, { once: true });
        image.addEventListener('error', showImage, { once: true });
      }
    });

    document.addEventListener('click', function (event) {
      var control = event.target.closest('.av-tab-section-tab-title-container a, .tab_titles .tab, .toggler');
      if (!control) return;
      setTimeout(function () {
        var scope = control.closest('.av-tab-section-container, .tabcontainer, .togglecontainer') || control.parentElement;
        var content = control.classList.contains('toggler') ? control.nextElementSibling : scope && scope.querySelector('.av-active-tab-content, .active_tab_content, .toggle_wrap');
        if (!content) return;
        content.classList.remove('bke-swap-in');
        void content.offsetWidth;
        content.classList.add('bke-swap-in');
      }, 0);
    });

    var cooperationPopup = document.getElementById('pum-4684');
    if (cooperationPopup) {
      var popupContainer = cooperationPopup.querySelector('.pum-container');

      // Turn it into a draggable floating window: a small handle bar at the
      // top of the panel, positioned top-left on every open, that the user
      // can grab to move the whole window anywhere on screen.
      var dragHandle = null;
      if (popupContainer) {
        dragHandle = document.createElement('div');
        dragHandle.className = 'bke-modal-draghandle';
        dragHandle.textContent = '合作洽談';
        popupContainer.insertBefore(dragHandle, popupContainer.firstChild);

        var dragState = null;
        function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

        function dragStart(event) {
          if (event.button !== undefined && event.button !== 0) return;
          var rect = popupContainer.getBoundingClientRect();
          dragState = {
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top
          };
          cooperationPopup.classList.add('bke-modal-dragging');
          dragHandle.setPointerCapture && event.pointerId != null && dragHandle.setPointerCapture(event.pointerId);
          event.preventDefault();
        }

        function dragMove(event) {
          if (!dragState) return;
          var rect = popupContainer.getBoundingClientRect();
          var maxLeft = Math.max(0, window.innerWidth - rect.width);
          var maxTop = Math.max(0, window.innerHeight - rect.height);
          var nextLeft = clamp(dragState.startLeft + (event.clientX - dragState.startX), 0, maxLeft);
          var nextTop = clamp(dragState.startTop + (event.clientY - dragState.startY), 0, maxTop);
          // The stylesheet pins left/top with !important (to defeat the popup
          // plugin's own right/bottom positioning), so this has to win the
          // same way — a plain inline style loses to an !important rule.
          popupContainer.style.setProperty('left', nextLeft + 'px', 'important');
          popupContainer.style.setProperty('top', nextTop + 'px', 'important');
        }

        function dragEnd() {
          dragState = null;
          cooperationPopup.classList.remove('bke-modal-dragging');
        }

        dragHandle.addEventListener('pointerdown', dragStart, { passive: false });
        document.addEventListener('pointermove', dragMove, { passive: false });
        document.addEventListener('pointerup', dragEnd);
        document.addEventListener('pointercancel', dragEnd);
      }

      function openCooperation(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        cooperationPopup.classList.add('pum-active', 'bke-static-modal-open');
        cooperationPopup.style.display = 'block';
        cooperationPopup.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('bke-modal-lock');
        if (popupContainer) {
          // Drop any position left over from a previous drag so the
          // stylesheet's default top-right corner placement applies again.
          popupContainer.style.removeProperty('left');
          popupContainer.style.removeProperty('top');
          popupContainer.style.removeProperty('right');
        }
        var firstField = cooperationPopup.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstField) setTimeout(function () { firstField.focus({ preventScroll: true }); }, 80);
      }

      function closeCooperation(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        cooperationPopup.classList.remove('pum-active', 'bke-static-modal-open');
        cooperationPopup.style.display = 'none';
        cooperationPopup.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('bke-modal-lock');
      }

      document.querySelectorAll('#menu-item-3386 > a, a[href="#"]').forEach(function (link) {
        if (link.textContent.trim().indexOf('合作洽談') !== -1 || link.closest('#menu-item-3386')) {
          link.addEventListener('click', openCooperation, true);
        }
      });
      cooperationPopup.querySelectorAll('.pum-close, .popmake-close').forEach(function (button) {
        button.addEventListener('click', closeCooperation, true);
      });
      cooperationPopup.addEventListener('click', function (event) {
        if (popupContainer && !popupContainer.contains(event.target)) closeCooperation(event);
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && cooperationPopup.classList.contains('bke-static-modal-open')) closeCooperation(event);
      });
    }

    document.querySelectorAll('.avia-single-number[data-number]').forEach(function (number) {
      if (number.dataset.staticCounterReady === '1') return;
      number.dataset.staticCounterReady = '1';
      var target = Number(number.getAttribute('data-number'));
      var start = Number(number.getAttribute('data-start_from') || 0);
      var timer = Number(number.closest('.avia-animated-number') && number.closest('.avia-animated-number').getAttribute('data-timer')) || 1600;
      if (!Number.isFinite(target)) return;

      var decimals = String(number.getAttribute('data-number') || '').split('.')[1];
      var precision = decimals ? decimals.length : 0;
      var started = false;
      var currentText = start.toFixed(precision);
      var counterBox = number.closest('.avia-animated-number');
      if (counterBox) {
        counterBox.classList.remove('avia_animate_when_visible');
        counterBox.classList.add('static-counter-managed');
        counterBox.style.opacity = '1';
      }

      function writeNumber(text) {
        currentText = text;
        if (number.textContent !== text) number.textContent = text;
      }

      writeNumber(currentText);
      var numberGuard = new MutationObserver(function () {
        if (number.textContent !== currentText) number.textContent = currentText;
      });
      numberGuard.observe(number, { childList: true, characterData: true, subtree: true });

      function animateCounter() {
        if (started) return;
        started = true;
        window.removeEventListener('scroll', checkCounter);
        window.removeEventListener('resize', checkCounter);
        if (counterBox) counterBox.classList.add('is-counting');
        var begun = performance.now();
        function frame(now) {
          var progress = Math.min(1, (now - begun) / Math.max(500, timer));
          var eased = 1 - Math.pow(1 - progress, 2);
          var value = start + (target - start) * eased;
          writeNumber(value.toFixed(precision));
          if (progress < 1) requestAnimationFrame(frame);
          else {
            writeNumber(target.toFixed(precision));
            if (counterBox) {
              counterBox.classList.remove('is-counting');
              counterBox.classList.add('is-counted');
            }
          }
        }
        requestAnimationFrame(frame);
      }

      function checkCounter() {
        if (started) return;
        var box = (counterBox || number).getBoundingClientRect();
        if (box.top <= window.innerHeight * .88 && box.bottom >= window.innerHeight * .08) animateCounter();
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
          observer.disconnect();
          animateCounter();
        }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
        observer.observe(number.closest('.avia-animated-number') || number);
      }
      window.addEventListener('scroll', checkCounter, { passive: true });
      window.addEventListener('resize', checkCounter, { passive: true });
      setTimeout(checkCounter, 80);
      setTimeout(checkCounter, 500);
    });

    var serviceGalleries = Array.from(document.querySelectorAll('.av-horizontal-gallery'));
    var serviceTargets = ['ingredients', 'function', 'dosage', 'package', 'materials', 'health-food'];

    if (serviceGalleries.length >= serviceTargets.length) {
      serviceTargets.forEach(function (targetId) {
        document.querySelectorAll('[id="' + targetId + '"]').forEach(function (element) {
          element.removeAttribute('id');
        });
      });
      serviceGalleries.slice(0, serviceTargets.length).forEach(function (gallery, index) {
        gallery.id = serviceTargets[index];
      });
    }

    var serviceJumpCards = Array.from(document.querySelectorAll('.imgcircle')).filter(function (card) {
      return /INGREDIENTS|BY FUNCTION|DOSAGE FORM|PACKAGE DESIGN|HEALTH FOOD/i.test(card.textContent);
    });
    if (serviceJumpCards.length >= 5) {
      var navParent = serviceJumpCards[0].parentElement;
      serviceJumpCards = serviceJumpCards.filter(function (card) { return card.parentElement === navParent; }).slice(0, 5);
      if (serviceJumpCards.length === 5) {
        var finishedCard = serviceJumpCards[3].cloneNode(true);
        finishedCard.className = finishedCard.className.replace(/\bfirst\b|\bav_one_fifth\b/g, ' ');
        var finishedEnglish = finishedCard.querySelector('.av-subheading p');
        var finishedChinese = finishedCard.querySelector('.av-special-heading-tag');
        if (finishedEnglish) finishedEnglish.textContent = 'FINISHED PACKAGING';
        if (finishedChinese) finishedChinese.textContent = '成品包材';
        finishedCard.querySelectorAll('img').forEach(function (image) { image.alt = '成品包材'; });
        navParent.insertBefore(finishedCard, serviceJumpCards[4]);
        serviceJumpCards.splice(4, 0, finishedCard);
        finishedCard.classList.add('bke-reveal-visible');
      }
      navParent.classList.add('bke-service-jump-nav');
      serviceJumpCards.forEach(function (card, index) {
        var targetId = serviceTargets[index];
        card.classList.add('bke-service-jump-card');
        card.setAttribute('role', 'link');
        card.tabIndex = 0;
        card.setAttribute('aria-label', '前往' + (card.querySelector('.av-special-heading-tag')?.textContent || targetId));

        function followTarget(event) {
          if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (serviceGalleries.length >= serviceTargets.length && document.getElementById(targetId)) smoothToHash('#' + targetId, true);
          else window.location.href = new URL('全面性服務/一站式服務/index.html#' + targetId, staticRoot).href;
        }

        card.addEventListener('click', followTarget, true);
        card.addEventListener('keydown', followTarget, true);
      });
    }

    serviceGalleries.forEach(function (gallery) {
      if (gallery.dataset.staticSliderReady === '1') return;
      var slider = gallery.querySelector('.av-horizontal-gallery-slider');
      var items = Array.from(gallery.querySelectorAll('.av-horizontal-gallery-wrap'));
      var previous = gallery.querySelector('a.prev-slide');
      var next = gallery.querySelector('a.next-slide');
      if (!slider || !items.length || !previous || !next) return;

      var index = 0;
      var resizeTimer;

      var section = gallery.closest('.avia-section');
      if (section && section.textContent.indexOf('成品包材') !== -1) {
        section.classList.add('bke-finished-packaging-shell');
        gallery.classList.add('bke-finished-packaging');
      }

      items.forEach(function (item) {
        var image = item.querySelector('img');
        if (!image) return;
        function usePlaceholder() {
          if (image.dataset.staticPlaceholder === '1') return;
          image.dataset.staticPlaceholder = '1';
          image.classList.add('bke-placeholder-image');
          image.removeAttribute('srcset');
          image.src = placeholderImage;
        }
        image.addEventListener('error', usePlaceholder, { once: true });
        if (image.complete && image.naturalWidth === 0) usePlaceholder();
      });

      function measurements() {
        var first = items[0].getBoundingClientRect();
        var second = items[1] && items[1].getBoundingClientRect();
        var computedGap = parseFloat(window.getComputedStyle(slider).columnGap || window.getComputedStyle(slider).gap) || 15;
        var firstWidth = first.width || parseFloat(window.getComputedStyle(items[0]).width) || Math.min(300, gallery.clientWidth * .76) || 260;
        var step = second && Math.abs(second.left - first.left) > 1 ? Math.abs(second.left - first.left) : firstWidth + computedGap;
        var visible = Math.max(1, Math.floor((gallery.clientWidth + computedGap) / Math.max(step, 1)));
        return { step: step, max: Math.max(0, items.length - visible) };
      }

      function render(animate) {
        var size = measurements();
        index = Math.max(0, Math.min(index, size.max));
        slider.style.setProperty('transition', animate ? 'transform .78s cubic-bezier(.22,.72,.24,1)' : 'none', 'important');
        slider.style.left = '0px';
        slider.style.transform = 'translate3d(' + (-index * size.step) + 'px,0,0)';
        previous.setAttribute('aria-disabled', index === 0 ? 'true' : 'false');
        next.setAttribute('aria-disabled', index === size.max ? 'true' : 'false');
        previous.tabIndex = 0;
        next.tabIndex = 0;
        gallery.dataset.staticSliderReady = '1';
      }

      function move(direction, event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        var size = measurements();
        index = Math.max(0, Math.min(index + direction, size.max));
        render(true);
      }

      previous.addEventListener('click', function (event) { move(-1, event); }, true);
      next.addEventListener('click', function (event) { move(1, event); }, true);
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { render(false); }, 120);
      });
      items.forEach(function (item) {
        var image = item.querySelector('img');
        if (image && !image.complete) image.addEventListener('load', function () { render(false); }, { once: true });
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { render(false); });
      });
      window.addEventListener('load', function () { render(false); }, { once: true });
      setTimeout(function () { render(false); }, 350);
      setTimeout(function () { render(false); }, 1000);
    });

    function buildVerticalNews() {
      var pathname;
      try { pathname = decodeURIComponent(window.location.pathname).replace(/\/+$/, ''); }
      catch (_) { pathname = window.location.pathname.replace(/\/+$/, ''); }
      pathname = pathname.replace(/\/index\.html$/i, '');
      if (!pathname.endsWith('/最新消息')) return;

      var masonry = document.querySelector('.av-masonry-container');
      if (!masonry || document.querySelector('.bke-news-page')) return;
      document.body.classList.add('bke-news-document');
      var entries = Array.from(masonry.querySelectorAll('a.av-masonry-entry[href]'));
      if (!entries.length) return;

      var market = entries.filter(function (entry) { return entry.classList.contains('e5b882e5a0b4e8b6a8e58ba2_sort'); });
      var events = entries.filter(function (entry) { return entry.classList.contains('e6b4bbe58b95e8a88ae681af_sort'); });
      var page = document.createElement('div');
      page.className = 'bke-news-page';

      var hero = document.createElement('header');
      hero.className = 'bke-news-hero';
      hero.innerHTML = '<p class="bke-news-eyebrow">News &amp; Insights</p><h1 class="bke-news-title">最新消息</h1><p class="bke-news-intro">掌握保健市場趨勢、產品開發觀點與百達醫最新活動動態。</p>';
      page.appendChild(hero);

      function makeCard(entry, category) {
        var card = document.createElement('a');
        card.className = 'bke-news-card';
        card.href = entry.getAttribute('href');

        var image = document.createElement('div');
        image.className = 'bke-news-card-image';
        var originalImage = entry.querySelector('.av-masonry-image-container');
        image.style.backgroundImage = originalImage && originalImage.style.backgroundImage ? originalImage.style.backgroundImage : 'url("' + placeholderImage + '")';

        var copy = document.createElement('div');
        copy.className = 'bke-news-card-copy';
        var title = document.createElement('h3');
        var originalTitle = entry.querySelector('.av-masonry-entry-title');
        title.innerHTML = originalTitle ? originalTitle.innerHTML : (entry.getAttribute('title') || '查看消息');
        var summary = document.createElement('p');
        summary.className = 'bke-news-card-summary';
        var originalSummary = entry.querySelector('.av-masonry-entry-content');
        summary.textContent = originalSummary ? originalSummary.textContent.trim() : '';
        var date = document.createElement('time');
        date.className = 'bke-news-card-date';
        var originalDate = entry.querySelector('.av-masonry-date');
        date.textContent = originalDate ? originalDate.textContent.trim() : '';

        copy.appendChild(title);
        if (summary.textContent) copy.appendChild(summary);
        if (date.textContent) copy.appendChild(date);
        card.appendChild(image);
        card.appendChild(copy);
        return card;
      }

      function addSection(title, category, list) {
        if (!list.length) return;
        var section = document.createElement('section');
        section.className = 'bke-news-section';
        var heading = document.createElement('div');
        heading.className = 'bke-news-section-heading';
        var h2 = document.createElement('h2');
        h2.textContent = title;
        var kicker = document.createElement('p');
        kicker.className = 'bke-news-section-kicker';
        kicker.textContent = category;
        var count = document.createElement('span');
        count.className = 'bke-news-count';
        count.textContent = String(list.length).padStart(2, '0');
        heading.appendChild(h2);
        heading.appendChild(kicker);
        heading.appendChild(count);
        var cards = document.createElement('div');
        cards.className = 'bke-news-list';
        list.forEach(function (entry) { cards.appendChild(makeCard(entry, category)); });
        section.appendChild(heading);
        section.appendChild(cards);
        page.appendChild(section);
      }

      addSection('市場趨勢', 'MARKET INSIGHTS', market);
      addSection('活動訊息', 'EVENTS', events);
      var masonryBlock = masonry.closest('.flex_column') || masonry.parentElement;
      masonryBlock.parentElement.insertBefore(page, masonryBlock);
      masonryBlock.classList.add('bke-news-source-hidden');
      var shell = page.closest('.avia-section');
      if (shell) shell.classList.add('bke-news-shell');
    }

    buildVerticalNews();

    document.querySelectorAll('.flex_column.pie').forEach(function (pie) {
      var stage = pie.querySelector(':scope > .bke-pie-stage');
      if (!stage) {
        var layers = Array.from(pie.children).filter(function (child) {
          return child.classList.contains('pie-base') ||
            child.classList.contains('pie-main') ||
            child.classList.contains('pie-icon') ||
            child.classList.contains('pie-text') ||
            child.classList.contains('pie-buttons');
        });
        if (layers.length) {
          stage = document.createElement('div');
          stage.className = 'bke-pie-stage';
          pie.insertBefore(stage, layers[0]);
          layers.forEach(function (layer) { stage.appendChild(layer); });
          pie.classList.add('bke-pie-ready');
        }
      }

      var paths = pie.querySelectorAll('#pie-buttons path[data-item]');
      var mains = pie.querySelectorAll('.pie-main .avia-gallery-thumb > a');
      var icons = pie.querySelectorAll('.pie-icon .avia-gallery-thumb > a');
      var texts = pie.querySelectorAll('.pie-text li');
      if (!paths.length || !mains.length) return;

      function activate(index) {
        [mains, icons, texts].forEach(function (list) {
          list.forEach(function (item, itemIndex) {
            item.classList.toggle('active', itemIndex === index);
          });
        });
        if (stage) {
          stage.classList.remove('bke-wheel-switch');
          void stage.offsetWidth;
          stage.classList.add('bke-wheel-switch');
        }
      }

      paths.forEach(function (path) {
        path.style.cursor = 'pointer';
        path.addEventListener('click', function (event) {
          event.preventDefault();
          var item = Number(path.getAttribute('data-item'));
          if (item >= 1 && item <= mains.length) activate(item - 1);
        }, true);
      });
      if (!Array.from(mains).some(function (item) { return item.classList.contains('active'); })) activate(0);
    });

    Array.from(document.querySelectorAll(revealSelector)).filter(function (item) {
      return !item.classList.contains('bke-reveal') && !item.closest('#footer, #socket, #pum-4684') && !item.closest('.pie-main, .pie-icon, .pie-text');
    }).forEach(function (item) {
      item.classList.add('bke-reveal');
      if (item.matches('.av-horizontal-gallery, .bke-pie-stage')) item.classList.add('bke-reveal-fade');
      var siblings = item.parentElement ? Array.from(item.parentElement.children).filter(function (sibling) {
        return sibling.matches && sibling.matches(revealSelector);
      }) : [];
      item.style.setProperty('--bke-reveal-order', String(Math.min(Math.max(0, siblings.indexOf(item)), 5)));
      if (revealObserver) revealObserver.observe(item);
      else showReveal(item);
    });
  });
})();
