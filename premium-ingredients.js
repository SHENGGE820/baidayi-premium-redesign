(() => {
  const grid = document.querySelector('.ingredient-accordion');
  const input = document.getElementById('ingredient-search');
  const tools = document.querySelector('.ingredient-tools');
  const count = document.getElementById('ingredient-count');
  const empty = document.querySelector('.ingredient-empty');
  const reset = document.getElementById('ingredient-reset');
  if (!grid || !input || !tools || !count || !empty || !reset) return;

  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  const catalogue = Array.from(grid.querySelectorAll('details.ingredient-category')).map(category => ({
    category,
    summary: category.querySelector('summary'),
    panel: category.querySelector('.ingredient-category-panel'),
    text: normalize(category.dataset.categorySearch || category.dataset.search || ''),
    materials: Array.from(category.querySelectorAll('.ingredient-material')).map(material => ({
      material,
      text: normalize(material.dataset.search || material.textContent)
    }))
  }));
  if (!catalogue.length || catalogue.some(entry => !entry.summary || !entry.panel)) return;
  // Keep inactive regions in a hidden container so aria-controls always
  // references a real element, without exposing their links to keyboard focus.
  const storage = document.createElement('div');
  storage.className = 'ingredient-panel-storage';
  storage.hidden = true;
  grid.after(storage);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionEase = 'cubic-bezier(.25,.1,.25,1)';
  let rememberedCategory = catalogue.find(entry => entry.category.open) || null;
  let selected = null;
  let searching = false;
  let resizeFrame = 0;

  const isVisible = () => grid.getClientRects().length > 0 && grid.getBoundingClientRect().width > 0;
  const rowGap = () => Number.parseFloat(getComputedStyle(grid).getPropertyValue('--ingredient-row-gap')) || 24;
  const placePanel = entry => {
    if (!entry || entry.category.hidden) return;
    const visible = catalogue.filter(entry => !entry.category.hidden);
    const index = visible.indexOf(entry);
    if (index < 0) return;
    const columns = Math.max(1, Number.parseInt(getComputedStyle(grid).getPropertyValue('--ingredient-columns'), 10) || 4);
    const lastInRow = Math.min(visible.length - 1, Math.floor(index / columns) * columns + columns - 1);
    const anchor = visible[lastInRow].category;
    const { panel, shell } = entry;
    if (shell.parentNode !== grid || anchor.nextSibling !== shell) {
      const focused = panel.contains(document.activeElement) ? document.activeElement : null;
      grid.insertBefore(shell, anchor.nextSibling);
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }
    if (!isVisible()) return;
    const gridRect = grid.getBoundingClientRect();
    const cardRect = entry.category.getBoundingClientRect();
    const pointerLeft = cardRect.left - gridRect.left + cardRect.width / 2;
    panel.style.setProperty('--ingredient-pointer-left', `${pointerLeft}px`);
  };

  const cancelMotion = entry => {
    if (!entry.motion) return;
    entry.motion.shell.cancel();
    entry.motion.content.cancel();
    entry.motion = null;
  };

  const finishPanel = (entry, open) => {
    cancelMotion(entry);
    entry.phase = open ? 'open' : 'closed';
    entry.shell.style.removeProperty('height');
    entry.shell.style.removeProperty('margin-bottom');
    entry.shell.style.removeProperty('overflow');
    entry.panel.style.removeProperty('opacity');
    entry.panel.style.removeProperty('transform');
    entry.shell.classList.remove('is-moving');
    entry.panel.inert = !open;
    entry.panel.setAttribute('aria-hidden', String(!open));
    entry.panel.hidden = !open;
    entry.shell.hidden = !open;
    if (!open) storage.append(entry.shell);
  };

  const animatePanel = (entry, open, animate = true) => {
    const { shell, panel } = entry;
    // Capture the actual rendered frame before cancelling. A reversed or
    // interrupted transition continues from here instead of jumping to an end.
    const fromHeight = shell.hidden ? 0 : shell.getBoundingClientRect().height;
    const fromGap = shell.hidden ? 0 : Number.parseFloat(getComputedStyle(shell).marginBottom) || 0;
    const contentStyle = getComputedStyle(panel);
    const fromOpacity = shell.hidden ? 0 : Number.parseFloat(contentStyle.opacity);
    const fromTransform = shell.hidden ? 'translateY(10px)' : contentStyle.transform;
    cancelMotion(entry);
    if (open) {
      shell.hidden = false;
      panel.hidden = false;
      panel.inert = false;
      panel.setAttribute('aria-hidden', 'false');
      placePanel(entry);
    } else {
      // Do not leave focus in an outgoing region, including keyboard-driven
      // hash changes. The content can remain visible while no longer tabbable.
      if (panel.contains(document.activeElement)) {
        (selected?.summary || entry.summary).focus({ preventScroll: true });
      }
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
    }
    const toHeight = open ? panel.getBoundingClientRect().height : 0;
    if (!animate || reducedMotion.matches || !isVisible() || typeof shell.animate !== 'function' ||
        (Math.abs(fromHeight - toHeight) < 1 && Math.abs(fromGap - (open ? rowGap() : 0)) < 1)) {
      finishPanel(entry, open);
      return;
    }
    entry.phase = open ? 'opening' : 'closing';
    shell.classList.add('is-moving');
    shell.style.height = `${fromHeight}px`;
    shell.style.marginBottom = `${fromGap}px`;
    shell.style.overflow = 'hidden';
    const options = { duration: open ? 580 : 520, easing: motionEase, fill: 'both' };
    const motion = {
      shell: shell.animate([
        { height: `${fromHeight}px`, marginBottom: `${fromGap}px` },
        { height: `${toHeight}px`, marginBottom: `${open ? rowGap() : 0}px` }
      ], options),
      content: panel.animate([
        { opacity: fromOpacity, transform: fromTransform },
        { opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(8px)' }
      ], options),
      targetHeight: toHeight,
      targetGap: open ? rowGap() : 0
    };
    entry.motion = motion;
    motion.shell.finished.then(() => {
      if (entry.motion === motion) finishPanel(entry, open);
    }).catch(() => { /* Replaced by a newer selection or a reduced-motion change. */ });
  };

  const select = (entry, { animate = true } = {}) => {
    if (entry && entry.category.hidden) entry = null;
    selected = entry;
    // Close siblings before opening the selected card, including browsers
    // that do not yet support the native exclusive details name attribute.
    catalogue.forEach(item => {
      if (item !== selected) item.category.open = false;
      item.summary.setAttribute('aria-expanded', String(item === selected));
      if (item !== selected && item.phase !== 'closed') animatePanel(item, false, animate);
    });
    if (selected) {
      selected.category.open = true;
      animatePanel(selected, true, animate);
    }
  };

  const revealPanel = entry => {
    if (!entry || selected !== entry || !isVisible() || entry.shell.hidden) return;
    const panelRect = entry.shell.getBoundingClientRect();
    if (panelRect.top <= window.innerHeight - 180) return;
    const cardHeight = entry.category.getBoundingClientRect().height;
    const headerHeight = document.querySelector('[data-site-header]')?.getBoundingClientRect().height || 76;
    const targetTop = Math.max(headerHeight + 40, Math.min(window.innerHeight - 160, Math.max(headerHeight + cardHeight + 40, window.innerHeight * .45)));
    window.scrollBy({
      top: panelRect.top - targetTop,
      behavior: reducedMotion.matches ? 'auto' : 'smooth'
    });
  };

  catalogue.forEach(entry => {
    const { category, summary, panel } = entry;
    if (!panel.id) panel.id = `materials-${category.id.replace(/^category-/, '')}`;
    summary.setAttribute('aria-controls', panel.id);
    summary.setAttribute('aria-expanded', 'false');
    const shell = document.createElement('div');
    shell.className = 'ingredient-panel-slot';
    shell.hidden = true;
    shell.append(panel);
    entry.shell = shell;
    entry.phase = 'closed';
    entry.motion = null;
    panel.hidden = true;
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
    storage.append(shell);
    summary.addEventListener('click', event => {
      // Native summary keyboard activation dispatches a click as well.
      // Control the open state directly so asynchronous toggle events cannot
      // remount a panel from a previous selection or search.
      event.preventDefault();
      const next = selected === entry ? null : entry;
      if (!searching) rememberedCategory = next;
      select(next);
      if (next) window.requestAnimationFrame(() => revealPanel(next));
    });
    const close = panel.querySelector('[data-close-ingredients]');
    if (close) close.addEventListener('click', event => {
      event.preventDefault();
      if (selected !== entry) return;
      if (!searching) rememberedCategory = null;
      select(null);
      summary.focus({ preventScroll: true });
    });
  });
  grid.classList.add('ingredient-grid-ready');

  const filter = ({ animate = true } = {}) => {
    const query = normalize(input.value.trim());
    searching = Boolean(query);
    let visible = 0;
    let firstVisible = null;
    catalogue.forEach(entry => {
      const categoryMatches = !query || entry.text.includes(query);
      let matchingMaterials = 0;
      entry.materials.forEach(({ material, text }) => {
        const matches = categoryMatches || text.includes(query);
        material.hidden = !matches;
        if (matches) matchingMaterials += 1;
      });
      const matches = categoryMatches || matchingMaterials > 0;
      entry.category.hidden = !matches;
      if (matches) {
        visible += 1;
        if (!firstVisible) firstVisible = entry;
      }
    });
    count.textContent = String(visible);
    empty.hidden = visible > 0;
    select(searching ? firstVisible : rememberedCategory, { animate });
  };

  tools.hidden = false;
  input.addEventListener('input', () => filter());
  reset.addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
  const scheduleLayout = () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!isVisible()) {
        // A parent tab may disappear mid-expansion. Retain its logical choice,
        // but stop off-screen motion and restore natural dimensions for return.
        catalogue.forEach(entry => {
          if (entry.motion) finishPanel(entry, entry === selected);
        });
        return;
      }
      if (!selected) return;
      placePanel(selected);
      if (selected.motion && selected.phase === 'opening' && isVisible()) {
        const height = selected.panel.getBoundingClientRect().height;
        if (Math.abs(height - selected.motion.targetHeight) > 1 || Math.abs(rowGap() - selected.motion.targetGap) > .5) animatePanel(selected, true);
      }
    });
  };
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('bke:cap-panel-visible', scheduleLayout);
  if (typeof ResizeObserver !== 'undefined') {
    let lastWidth = -1;
    const gridObserver = new ResizeObserver(() => {
      const width = grid.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) > .5) {
        lastWidth = width;
        scheduleLayout();
      }
    });
    gridObserver.observe(grid);
    const contentObserver = new ResizeObserver(scheduleLayout);
    catalogue.forEach(entry => {
      // Observe natural content, not the animated shell's height, avoiding a
      // feedback loop while still adapting to images, fonts and search results.
      Array.from(entry.panel.children).forEach(child => contentObserver.observe(child));
    });
  }
  const settleReducedMotion = () => {
    if (!reducedMotion.matches) return;
    catalogue.forEach(entry => {
      if (entry.motion) finishPanel(entry, entry === selected);
    });
    scheduleLayout();
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', settleReducedMotion);
  else reducedMotion.addListener(settleReducedMotion);

  const hashCategory = () => {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch { return null; }
    return catalogue.find(entry => entry.category.id === id || entry.panel.id === id) || null;
  };
  const revealHashCategory = () => {
    const entry = hashCategory();
    if (!entry) return;
    input.value = '';
    rememberedCategory = entry;
    filter();
    window.requestAnimationFrame(() => revealPanel(entry));
  };
  window.addEventListener('hashchange', revealHashCategory);
  rememberedCategory = hashCategory() || rememberedCategory;
  filter({ animate: false });
  if (hashCategory()) window.requestAnimationFrame(() => revealPanel(selected));
})();
