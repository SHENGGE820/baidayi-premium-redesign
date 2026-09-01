(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;

  var progress = document.createElement('div');
  progress.className = 'motion-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<i></i>';
  body.appendChild(progress);

  var curtain = document.createElement('div');
  curtain.className = 'motion-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  body.appendChild(curtain);

  function makeVisible(element) {
    element.classList.add('is-visible');
  }

  var motionObserver = reducedMotion || !('IntersectionObserver' in window) ? null : new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      makeVisible(entry.target);
      motionObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });

  function observe(element) {
    if (!element) return;
    if (motionObserver) motionObserver.observe(element);
    else makeVisible(element);
  }

  document.querySelectorAll('.reveal').forEach(function (element) {
    element.classList.add('motion-item');
  });

  if (body.classList.contains('premium-legacy')) {
    document.querySelectorAll('#main .avia-section, #main article, #main .av-masonry-entry, #main .av_textblock_section').forEach(function (element, index) {
      element.classList.add('motion-item');
      element.style.setProperty('--motion-delay', Math.min(index % 3, 2) * 65 + 'ms');
      observe(element);
    });
  }

  var staggerGroups = [
    '.proof-grid', '.capability-grid', '.solution-list', '.process-grid',
    '.certification-grid', '.insight-grid', '.value-grid', '.service-overview',
    '.format-grid', '.research-pillars', '.article-grid', '.contact-detail-list'
  ];
  document.querySelectorAll(staggerGroups.join(',')).forEach(function (group) {
    group.classList.add('motion-sequence');
    Array.prototype.forEach.call(group.children, function (child, index) {
      child.style.setProperty('--motion-index', String(Math.min(index, 7)));
      child.style.setProperty('--motion-delay', Math.min(index, 5) * 65 + 'ms');
    });
    observe(group);
  });

  document.querySelectorAll('.motion-item').forEach(observe);

  var mediaSelectors = [
    '.hero-media', '.inner-hero-media', '.split-feature-media', '.insight-image',
    '.article-card-image', '#main .avia-image-container', '#main .av-masonry-image-container'
  ];
  document.querySelectorAll(mediaSelectors.join(',')).forEach(function (element) {
    element.classList.add('motion-media');
    observe(element);
  });

  document.querySelectorAll('.hero h1, .inner-hero h1, .news-masthead h1, .contact-masthead h1').forEach(function (heading) {
    var lines = heading.innerHTML.split(/<br\s*\/?\s*>/i);
    if (!lines.length) return;
    heading.classList.remove('reveal', 'motion-item', 'is-visible');
    heading.classList.add('motion-headline');
    heading.innerHTML = lines.map(function (line, index) {
      return '<span class="motion-line" style="--motion-line:' + index + '"><span>' + line + '</span></span>';
    }).join('');
    window.setTimeout(function () { heading.classList.add('is-animated'); }, 90);
  });

  function animateNumber(element) {
    if (!element || element.dataset.counted === 'true') return;
    var textNode = Array.prototype.find.call(element.childNodes, function (node) {
      return node.nodeType === 3 && /\d/.test(node.nodeValue);
    });
    if (!textNode) return;
    var match = textNode.nodeValue.match(/\d+/);
    if (!match) return;
    var target = Number(match[0]);
    if (!Number.isFinite(target)) return;
    var original = textNode.nodeValue;
    var startValue = target > 999 ? Math.max(0, target - 18) : 0;
    var duration = target > 999 ? 1050 : 1250;
    var startTime = performance.now();
    element.dataset.counted = 'true';
    element.classList.add('counting');
    function frame(now) {
      var elapsed = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - elapsed, 4);
      var value = Math.round(startValue + (target - startValue) * eased);
      textNode.nodeValue = original.replace(match[0], String(value));
      if (elapsed < 1) requestAnimationFrame(frame);
      else element.classList.remove('counting');
    }
    requestAnimationFrame(frame);
  }

  var counters = document.querySelectorAll('.proof-item strong, .story-aside strong');
  if (counters.length) {
    var counterArea = document.querySelector('.proof-strip, .story-aside');
    if (!reducedMotion && counterArea && 'IntersectionObserver' in window) {
      var counterObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        counters.forEach(animateNumber);
        counterObserver.disconnect();
      }, { threshold: 0.4 });
      counterObserver.observe(counterArea);
    }
  }

  var scrollTicking = false;
  var parallaxImage = document.querySelector('.hero-media img, .inner-hero-media img');
  function updateScrollMotion() {
    var pageHeight = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = pageHeight > 0 ? Math.min(Math.max(window.scrollY / pageHeight, 0), 1) : 0;
    document.documentElement.style.setProperty('--scroll-progress', ratio.toFixed(4));
    if (!reducedMotion && window.innerWidth > 820 && parallaxImage) {
      parallaxImage.style.setProperty('--motion-parallax', Math.min(window.scrollY * .075, 64).toFixed(1) + 'px');
    }
    scrollTicking = false;
  }
  function requestScrollMotion() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScrollMotion);
  }
  updateScrollMotion();
  window.addEventListener('scroll', requestScrollMotion, { passive: true });
  window.addEventListener('resize', requestScrollMotion, { passive: true });

  if (!reducedMotion) {
    document.querySelectorAll('.button, .header-cta, .floating-consult, .legacy-premium-cta, .legacy-floating-consult').forEach(function (element) {
      element.addEventListener('pointermove', function (event) {
        var rect = element.getBoundingClientRect();
        element.style.setProperty('--magnet-x', ((event.clientX - rect.left) / rect.width - .5) * 3.5 + 'px');
        element.style.setProperty('--magnet-y', ((event.clientY - rect.top) / rect.height - .5) * 3.5 + 'px');
      });
      element.addEventListener('pointerleave', function () {
        element.style.setProperty('--magnet-x', '0px');
        element.style.setProperty('--magnet-y', '0px');
      });
    });

    document.querySelectorAll('.capability-card, .certification-card, .value-card, .service-overview-card, .format-card, .research-pillar, .process-step, .insight-card, .article-card, .solution-row').forEach(function (card) {
      card.classList.add('motion-spotlight');
    });

    // The CSS reads --spot-x/--spot-y to decide where each hover wash starts
    // spreading from, but nothing ever set them, so every wash opened from the
    // dead centre. Anchor them where the pointer crossed the edge. Set on
    // enter only: updating them on pointermove re-anchors the circle while the
    // clip-path is still animating and the wash visibly judders.
    function anchorSpot(event) {
      var element = event.currentTarget;
      var rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Pixels, not percentages: these now also drive mask-position, and a
      // percentage position is resolved against (box - mask), which inverts
      // once the mask is larger than the box it sits in.
      element.style.setProperty('--spot-x', (event.clientX - rect.left).toFixed(1) + 'px');
      element.style.setProperty('--spot-y', (event.clientY - rect.top).toFixed(1) + 'px');
    }
    document.querySelectorAll('.motion-spotlight, .button, .header-cta, .floating-consult, .legacy-premium-cta, .legacy-floating-consult, #main .avia-button').forEach(function (element) {
      element.addEventListener('pointerenter', anchorSpot);
    });

    // Card tilt, modelled on simular.co. They use vanilla-tilt at max:3, which
    // is a *total* range, so the card never leans more than 1.5deg either way -
    // the effect is meant to be felt rather than seen. Their reverse:true makes
    // the card lean away from the pointer; flip the two signs below for the
    // more common lean-towards. Reproduced in ~25 lines instead of adding the
    // library, since this is the only thing it would have been used for.
    var TILT_MAX = 1.5;
    var TILT_RETURN = 660;

    function tiltTrack(event) {
      var card = event.currentTarget;
      var rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var px = (event.clientX - rect.left) / rect.width - .5;
      var py = (event.clientY - rect.top) / rect.height - .5;
      // The -4px lift lives here rather than in CSS: an inline transform beats
      // the stylesheet's transform, so the two cannot be split across them.
      card.style.transform =
        'perspective(1000px) rotateX(' + (-py * TILT_MAX * 2).toFixed(2) + 'deg)' +
        ' rotateY(' + (px * TILT_MAX * 2).toFixed(2) + 'deg) translate3d(0,-4px,0)';
    }

    document.querySelectorAll('.insight-card, .article-card').forEach(function (card) {
      var returnTimer;
      card.classList.add('tilt-card');

      card.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        window.clearTimeout(returnTimer);
        card.classList.remove('is-returning');
        card.classList.add('is-tilting');
        // No transition while tracking. A transition here trails the pointer by
        // its own duration, which reads as broken rather than as smooth.
        tiltTrack(event);
      });

      card.addEventListener('pointermove', function (event) {
        if (!card.classList.contains('is-tilting')) return;
        tiltTrack(event);
      });

      card.addEventListener('pointerleave', function () {
        if (!card.classList.contains('is-tilting')) return;
        card.classList.remove('is-tilting');
        card.classList.add('is-returning');
        card.style.transform = '';
        returnTimer = window.setTimeout(function () {
          card.classList.remove('is-returning');
        }, TILT_RETURN);
      });
    });
  }

  document.addEventListener('click', function (event) {
    if (reducedMotion || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(?:mailto:|tel:|javascript:)/i.test(href)) return;
    var destination;
    try { destination = new URL(link.href, location.href); } catch (error) { return; }
    if (destination.origin !== location.origin || destination.href === location.href) return;
    event.preventDefault();
    body.classList.add('motion-leaving');
    window.setTimeout(function () { location.href = destination.href; }, 390);
  });

  window.addEventListener('pageshow', function () { body.classList.remove('motion-leaving'); });
  body.classList.add('motion-ready');
})();
