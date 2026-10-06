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

  let rememberedCategory = catalogue.find(entry => entry.category.open) || null;
  let selected = null;
  let mountedPanel = null;
  let searching = false;
  let resizeFrame = 0;

  const placePanel = () => {
    if (!selected || selected.category.hidden) return;
    const visible = catalogue.filter(entry => !entry.category.hidden);
    const index = visible.indexOf(selected);
    if (index < 0) return;
    const columns = Math.max(1, Number.parseInt(getComputedStyle(grid).getPropertyValue('--ingredient-columns'), 10) || 4);
    const lastInRow = Math.min(visible.length - 1, Math.floor(index / columns) * columns + columns - 1);
    const anchor = visible[lastInRow].category;
    const panel = selected.panel;
    if (panel.parentNode !== grid || anchor.nextSibling !== panel) {
      const focused = panel.contains(document.activeElement) ? document.activeElement : null;
      grid.insertBefore(panel, anchor.nextSibling);
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }
    panel.hidden = false;
    const gridRect = grid.getBoundingClientRect();
    const cardRect = selected.category.getBoundingClientRect();
    const pointerLeft = cardRect.left - gridRect.left + cardRect.width / 2;
    panel.style.setProperty('--ingredient-pointer-left', `${pointerLeft}px`);
  };

  const select = entry => {
    if (entry && entry.category.hidden) entry = null;
    if (mountedPanel && mountedPanel !== entry?.panel) {
      mountedPanel.hidden = true;
      storage.append(mountedPanel);
      mountedPanel = null;
    }
    selected = entry;
    // Close siblings before opening the selected card, including browsers
    // that do not yet support the native exclusive details name attribute.
    catalogue.forEach(item => {
      if (item !== selected) item.category.open = false;
      item.summary.setAttribute('aria-expanded', String(item === selected));
    });
    if (selected) {
      selected.category.open = true;
      mountedPanel = selected.panel;
      placePanel();
    }
  };

  const revealPanel = () => {
    if (!selected) return;
    const panelRect = selected.panel.getBoundingClientRect();
    if (panelRect.top <= window.innerHeight - 180) return;
    const cardHeight = selected.category.getBoundingClientRect().height;
    const headerHeight = document.querySelector('[data-site-header]')?.getBoundingClientRect().height || 76;
    const targetTop = Math.max(headerHeight + 40, Math.min(window.innerHeight - 160, Math.max(headerHeight + cardHeight + 40, window.innerHeight * .45)));
    window.scrollBy({
      top: panelRect.top - targetTop,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  };

  catalogue.forEach(entry => {
    const { category, summary, panel } = entry;
    if (!panel.id) panel.id = `materials-${category.id.replace(/^category-/, '')}`;
    summary.setAttribute('aria-controls', panel.id);
    summary.setAttribute('aria-expanded', 'false');
    panel.style.gridColumn = '1 / -1';
    panel.hidden = true;
    storage.append(panel);
    summary.addEventListener('click', event => {
      // Native summary keyboard activation dispatches a click as well.
      // Control the open state directly so asynchronous toggle events cannot
      // remount a panel from a previous selection or search.
      event.preventDefault();
      const next = selected === entry ? null : entry;
      if (!searching) rememberedCategory = next;
      select(next);
      if (next) revealPanel();
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

  const filter = () => {
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
    select(searching ? firstVisible : rememberedCategory);
  };

  tools.hidden = false;
  input.addEventListener('input', filter);
  reset.addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
  window.addEventListener('resize', () => {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      placePanel();
    });
  });
  filter();
})();
