(() => {
  "use strict";

  const DRAFT_PREFIX = "bke.adminNext.draft.v1:";
  const SECTION_ORDER = ["news", "pages", "catalogue", "media", "company"];
  const MAX_VISIBLE_ROWS = 250;

  const sections = {
    news: {
      title: "最新消息",
      singular: "消息",
      eyebrow: "網站內容",
      description: "管理官網的市場趨勢、配方知識與企業動態。",
      createLabel: "新增消息",
      headers: ["標題", "分類", "發布日期", "顯示位置", ""],
      filterLabel: "全部分類",
      canCreate: true
    },
    pages: {
      title: "網站頁面",
      singular: "頁面",
      eyebrow: "網站結構",
      description: "以前台區塊為單位編輯首頁、關於百達醫、服務與研發頁面。",
      createLabel: "新增頁面",
      headers: ["頁面", "內容區塊", "來源檔案", "欄位數", ""],
      filterLabel: "全部頁面",
      canCreate: true
    },
    catalogue: {
      title: "劑型與包材",
      singular: "劑型頁",
      eyebrow: "產品目錄",
      description: "管理劑型介紹、樣式分組、圖片與諮詢入口。",
      createLabel: "新增劑型或包材",
      headers: ["名稱", "樣式分組", "英文名稱", "樣式數", ""],
      filterLabel: "全部類型",
      canCreate: true
    },
    media: {
      title: "媒體庫",
      singular: "媒體",
      eyebrow: "圖片與影片",
      description: "查看網站已使用的圖片、影片以及它們的引用位置。",
      createLabel: "上傳（尚未連接）",
      headers: ["檔案", "類型", "被引用", "路徑", ""],
      filterLabel: "全部檔案類型",
      canCreate: false,
      disabledCreate: true
    },
    company: {
      title: "公司資訊",
      singular: "公司資訊",
      eyebrow: "全站共用資料",
      description: "統一管理電話、地址、頁尾簡介與其他對外聯絡資訊。",
      createLabel: "",
      headers: ["資訊組", "電話", "地址", "來源", ""],
      filterLabel: "全部資訊",
      canCreate: false,
      hideCreate: true
    }
  };

  const state = {
    section: "news",
    data: null,
    rawPayload: null,
    currentItem: null,
    sourceItem: null,
    currentId: null,
    currentIsNew: false,
    dirty: false,
    loading: false,
    loadController: null,
    loadSequence: 0,
    filter: "",
    query: "",
    previewFrame: null,
    lastFocusedRow: null
  };

  const dom = {
    body: document.body,
    sidebar: document.querySelector("#sidebar"),
    sidebarScrim: document.querySelector("#sidebar-scrim"),
    sidebarOpen: document.querySelector("#sidebar-open"),
    sidebarClose: document.querySelector("#sidebar-close"),
    navItems: [...document.querySelectorAll(".nav-item[data-section]")],
    navCounts: [...document.querySelectorAll("[data-count]")],
    listView: document.querySelector("#list-view"),
    editorView: document.querySelector("#editor-view"),
    pageEyebrow: document.querySelector("#page-eyebrow"),
    pageTitle: document.querySelector("#page-title"),
    pageDescription: document.querySelector("#page-description"),
    createButton: document.querySelector("#create-button"),
    sourceState: document.querySelector("#source-state"),
    generatedAt: document.querySelector("#generated-at"),
    searchInput: document.querySelector("#search-input"),
    filterSelect: document.querySelector("#filter-select"),
    reloadButton: document.querySelector("#reload-button"),
    retryButton: document.querySelector("#retry-button"),
    contentList: document.querySelector("#content-list"),
    listHeader: document.querySelector("#list-header"),
    listBody: document.querySelector("#list-body"),
    loadError: document.querySelector("#load-error"),
    loadErrorMessage: document.querySelector("#load-error-message"),
    resultSummary: document.querySelector("#result-summary"),
    backButton: document.querySelector("#back-button"),
    backLabel: document.querySelector("#back-label"),
    editorEyebrow: document.querySelector("#editor-eyebrow"),
    editorTitle: document.querySelector("#editor-title"),
    editorPath: document.querySelector("#editor-path"),
    saveState: document.querySelector("#save-state"),
    saveDraftButton: document.querySelector("#save-draft-button"),
    editorForm: document.querySelector("#editor-form"),
    draftBanner: document.querySelector("#draft-banner"),
    draftTime: document.querySelector("#draft-time"),
    discardDraftButton: document.querySelector("#discard-draft-button"),
    previewStage: document.querySelector("#preview-stage"),
    preview: document.querySelector("#content-preview"),
    previewSizeButtons: [...document.querySelectorAll("[data-preview-size]")],
    toast: document.querySelector("#toast")
  };

  let fieldCounter = 0;
  let toastTimer = null;

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function valueOr(object, paths, fallback = "") {
    for (const path of paths) {
      const value = getAtPath(object, Array.isArray(path) ? path : [path]);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
  }

  function getAtPath(object, path) {
    return path.reduce((current, key) => current == null ? undefined : current[key], object);
  }

  function setAtPath(object, path, value) {
    let current = object;
    path.forEach((key, index) => {
      if (index === path.length - 1) {
        current[key] = value;
        return;
      }
      if (current[key] == null || typeof current[key] !== "object") {
        current[key] = typeof path[index + 1] === "number" ? [] : {};
      }
      current = current[key];
    });
  }

  function itemId(section, item, index = 0) {
    if (!item) return `${section}-${index}`;
    return String(item.id || item.slug || item.path || item.source || `${section}-${index}`);
  }

  function normalisePayload(payload) {
    if (!isObject(payload)) {
      throw new Error("data.json 的最上層必須是物件。");
    }

    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const catalogue = Array.isArray(payload.catalogue) ? payload.catalogue : [];
    const media = Array.isArray(payload.media) ? payload.media : [];
    const settings = isObject(payload.settings) ? payload.settings : {};

    const data = {
      news: articles.map((item, index) => ({ id: item.id || item.slug || `article-${index + 1}`, ...item })),
      pages: pages.map((item, index) => ({ id: item.id || `page-${index + 1}`, source: item.source || "", data: isObject(item.data) ? item.data : {} })),
      catalogue: catalogue.map((item, index) => ({ id: item.id || item.slug || `catalogue-${index + 1}`, ...item })),
      media: media.map((item, index) => ({ id: item.path || `media-${index + 1}`, ...item })),
      company: [{ id: "company-settings", source: "content/settings.md", ...settings }]
    };

    for (const section of SECTION_ORDER) {
      mergeSavedNewDrafts(section, data[section]);
    }

    return data;
  }

  function mergeSavedNewDrafts(section, items) {
    for (const draft of listDrafts(section)) {
      if (!draft.isNew || !draft.item) continue;
      const id = itemId(section, draft.item);
      if (!items.some((item, index) => itemId(section, item, index) === id)) {
        items.unshift(clone(draft.item));
      }
    }
  }

  async function loadData() {
    const sequence = ++state.loadSequence;
    if (state.loadController) state.loadController.abort();
    const controller = new AbortController();
    state.loadController = controller;
    state.loading = true;

    setSourceState("loading", "正在讀取 data.json…");
    dom.reloadButton.disabled = true;
    dom.loadError.hidden = true;
    if (!state.data) showSkeleton();

    try {
      const response = await fetch("./data.json", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const payload = await response.json();
      if (sequence !== state.loadSequence) return;

      state.rawPayload = payload;
      state.data = normalisePayload(payload);
      state.loading = false;
      dom.contentList.hidden = false;
      dom.contentList.setAttribute("aria-busy", "false");
      dom.reloadButton.disabled = false;
      updateNavCounts();
      renderSection();

      const total = SECTION_ORDER.reduce((sum, key) => sum + state.data[key].length, 0);
      setSourceState("ready", `已讀取 data.json · ${total} 筆內容`);
      dom.generatedAt.textContent = payload.generatedAt
        ? `資料產生時間：${formatDateTime(payload.generatedAt)}`
        : "data.json 未提供產生時間";
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (sequence !== state.loadSequence) return;
      state.loading = false;
      dom.reloadButton.disabled = false;
      setSourceState("error", "data.json 讀取失敗");
      dom.loadError.hidden = false;
      dom.loadErrorMessage.textContent = state.data
        ? `重新讀取失敗，已保留畫面上原有資料。${error.message || ""}`
        : `請確認 admin-next/data.json 已建立，並透過網頁伺服器開啟此頁。${error.message ? `（${error.message}）` : ""}`;
      if (!state.data) {
        dom.contentList.hidden = true;
        dom.resultSummary.textContent = "";
      }
    }
  }

  function showSkeleton() {
    dom.contentList.hidden = false;
    dom.contentList.setAttribute("aria-busy", "true");
    dom.listHeader.replaceChildren();
    dom.listBody.innerHTML = [1, 2, 3].map(() => "<div class=\"skeleton-row\"><span></span><span></span><span></span></div>").join("");
  }

  function setSourceState(kind, message) {
    dom.sourceState.replaceChildren();
    const dot = document.createElement("span");
    dot.className = `source-dot${kind === "loading" ? " is-loading" : kind === "error" ? " is-error" : ""}`;
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = message;
    dom.sourceState.append(dot, text);
  }

  function updateNavCounts() {
    for (const node of dom.navCounts) {
      const key = node.dataset.count;
      node.textContent = state.data && state.data[key] ? String(state.data[key].length) : "—";
    }
  }

  function renderSection() {
    const config = sections[state.section];
    dom.pageEyebrow.textContent = config.eyebrow;
    dom.pageTitle.textContent = config.title;
    dom.pageDescription.textContent = config.description;
    dom.searchInput.placeholder = `搜尋${config.singular}標題、分類或路徑…`;

    dom.createButton.hidden = Boolean(config.hideCreate);
    dom.createButton.disabled = Boolean(config.disabledCreate);
    dom.createButton.classList.toggle("button-disabled", Boolean(config.disabledCreate));
    dom.createButton.classList.toggle("button-primary", !config.disabledCreate);
    dom.createButton.querySelector("span").textContent = config.createLabel;
    dom.createButton.title = config.disabledCreate ? "媒體上傳尚未連接檔案儲存與發布服務" : "";

    for (const navItem of dom.navItems) {
      const active = navItem.dataset.section === state.section;
      navItem.classList.toggle("is-active", active);
      if (active) navItem.setAttribute("aria-current", "page");
      else navItem.removeAttribute("aria-current");
    }

    renderHeaders(config.headers);
    populateFilters();
    renderList();
  }

  function renderHeaders(headers) {
    dom.listHeader.replaceChildren();
    for (const header of headers) {
      const span = document.createElement("span");
      span.textContent = header;
      dom.listHeader.append(span);
    }
  }

  function populateFilters() {
    const config = sections[state.section];
    const options = new Set();
    const items = state.data ? state.data[state.section] : [];
    for (const item of items) {
      const value = getFilterValue(state.section, item);
      if (value) options.add(String(value));
    }

    dom.filterSelect.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = config.filterLabel;
    dom.filterSelect.append(all);
    [...options].sort((a, b) => a.localeCompare(b, "zh-Hant")).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      dom.filterSelect.append(option);
    });
    dom.filterSelect.value = state.filter;
    dom.filterSelect.hidden = options.size === 0;
  }

  function getFilterValue(section, item) {
    if (section === "news") return item.category || "";
    if (section === "media") return mediaTypeLabel(item.type || fileExtension(item.path));
    if (section === "pages") return "主要頁面";
    if (section === "catalogue") return Array.isArray(item.groups) && item.groups.length ? "有樣式分組" : "尚無分組";
    return "";
  }

  function renderList() {
    if (!state.data) return;
    const allItems = state.data[state.section] || [];
    const query = state.query.trim().toLocaleLowerCase("zh-Hant");
    const matches = allItems.filter((item) => {
      if (state.filter && getFilterValue(state.section, item) !== state.filter) return false;
      if (!query) return true;
      return searchableText(state.section, item).toLocaleLowerCase("zh-Hant").includes(query);
    });

    dom.listBody.replaceChildren();
    if (matches.length === 0) {
      dom.listBody.append(createEmptyState(allItems.length === 0));
    } else {
      const fragment = document.createDocumentFragment();
      matches.slice(0, MAX_VISIBLE_ROWS).forEach((item, index) => fragment.append(createListRow(item, index)));
      dom.listBody.append(fragment);
    }

    const shown = Math.min(matches.length, MAX_VISIBLE_ROWS);
    dom.resultSummary.textContent = matches.length > MAX_VISIBLE_ROWS
      ? `符合 ${matches.length} 筆，為了維持速度先顯示前 ${shown} 筆。請使用搜尋縮小範圍。`
      : `顯示 ${shown} 筆，共 ${allItems.length} 筆。`;
  }

  function createEmptyState(sectionEmpty) {
    const wrapper = document.createElement("div");
    wrapper.className = "empty-state";
    wrapper.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16v13H4zM8 10h8M8 14h5"/></svg>`;
    const strong = document.createElement("strong");
    strong.textContent = sectionEmpty ? "data.json 裡還沒有這類內容" : "找不到符合條件的內容";
    const p = document.createElement("p");
    p.textContent = sectionEmpty
      ? "資料檔開始提供這個分類後，清單會自動顯示在這裡。"
      : "請調整搜尋字詞或分類篩選。";
    wrapper.append(strong, p);
    return wrapper;
  }

  function createListRow(item, index) {
    const id = itemId(state.section, item, index);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "list-row";
    row.dataset.itemId = id;
    row.setAttribute("aria-label", `編輯${sections[state.section].singular}：${displayTitle(state.section, item)}`);

    const values = rowValues(state.section, item);
    const titleCell = document.createElement("span");
    titleCell.className = "row-title";
    const titleLine = document.createElement("span");
    titleLine.className = "row-title-line";
    const title = document.createElement("strong");
    title.textContent = values.title;
    titleLine.append(title);
    if (readDraft(state.section, id)) {
      const mark = document.createElement("span");
      mark.className = "draft-mark";
      mark.textContent = "本機草稿";
      titleLine.append(mark);
    }
    const subtitle = document.createElement("small");
    subtitle.textContent = values.subtitle;
    titleCell.append(titleLine, subtitle);
    row.append(titleCell);

    values.cells.forEach((cell, cellIndex) => {
      const span = document.createElement("span");
      span.className = `row-cell${cell.muted ? " is-muted" : ""}`;
      span.dataset.mobileLabel = `${sections[state.section].headers[cellIndex + 1]}：`;
      span.textContent = cell.value;
      if (cell.small) {
        const small = document.createElement("small");
        small.textContent = cell.small;
        span.append(small);
      }
      row.append(span);
    });

    const arrow = document.createElement("span");
    arrow.className = "row-arrow";
    arrow.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>`;
    row.append(arrow);
    row.addEventListener("click", () => {
      state.lastFocusedRow = row;
      openEditor(item, false);
    });
    return row;
  }

  function rowValues(section, item) {
    if (section === "news") {
      return {
        title: item.title || "未命名消息",
        subtitle: item.summary || item.slug || "尚無摘要",
        cells: [
          { value: item.category || "未分類" },
          { value: item.date ? formatDate(item.date) : "未設定" },
          { value: item.home ? "首頁精選" : "一般文章", muted: !item.home }
        ]
      };
    }
    if (section === "pages") {
      const blocks = isObject(item.data) ? Object.keys(item.data) : [];
      return {
        title: displayTitle(section, item),
        subtitle: pageDescription(item) || item.id,
        cells: [
          { value: `${blocks.length} 個區塊` },
          { value: item.source || "本機新頁面", muted: !item.source },
          { value: `${countPrimitiveFields(item.data)} 個欄位` }
        ]
      };
    }
    if (section === "catalogue") {
      const groups = Array.isArray(item.groups) ? item.groups : [];
      return {
        title: item.title || "未命名劑型",
        subtitle: item.lead || item.slug || "尚無介紹",
        cells: [
          { value: `${groups.length} 個分組` },
          { value: item.titleEn || item.title_en || "尚未設定", muted: !(item.titleEn || item.title_en) },
          { value: `${groups.reduce((sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0), 0)} 個樣式` }
        ]
      };
    }
    if (section === "media") {
      const references = Array.isArray(item.referencedBy) ? item.referencedBy : [];
      return {
        title: fileName(item.path) || "未命名檔案",
        subtitle: item.path || "尚無路徑",
        cells: [
          { value: mediaTypeLabel(item.type || fileExtension(item.path)) },
          { value: references.length ? `${references.length} 個位置` : "未被引用", muted: references.length === 0 },
          { value: item.path || "—", muted: true }
        ]
      };
    }
    return {
      title: "公司基本資訊",
      subtitle: item["頁尾簡介"] || item.footerDescription || "全站共用的聯絡與頁尾資料",
      cells: [
        { value: item["電話"] || item.phone || "尚未設定" },
        { value: item["地址"] || item.address || "尚未設定" },
        { value: item.source || "content/settings.md", muted: true }
      ]
    };
  }

  function searchableText(section, item) {
    if (section === "news") return [item.title, item.category, item.summary, item.slug, item.source].join(" ");
    if (section === "pages") return [item.id, item.source, displayTitle(section, item), pageDescription(item), ...Object.keys(item.data || {})].join(" ");
    if (section === "catalogue") return [item.title, item.titleEn, item.title_en, item.lead, item.slug, item.source].join(" ");
    if (section === "media") return [item.path, item.type, ...(item.referencedBy || [])].join(" ");
    return Object.values(item).filter((value) => typeof value !== "object").join(" ");
  }

  function displayTitle(section, item) {
    if (!item) return "未命名內容";
    if (section === "pages") {
      return valueOr(item, [
        ["data", "主視覺", "標題"],
        ["data", "搜尋與分享", "網頁標題"],
        ["data", "title"],
        ["data", "hero", "title"],
        ["id"]
      ], "未命名頁面").toString().replace(/\s+/g, " ").trim();
    }
    if (section === "media") return fileName(item.path) || "未命名檔案";
    if (section === "company") return "公司基本資訊";
    return item.title || item.name || item.id || "未命名內容";
  }

  function pageDescription(item) {
    return valueOr(item, [
      ["data", "主視覺", "說明"],
      ["data", "搜尋與分享", "搜尋說明"],
      ["data", "description"],
      ["data", "hero", "text"]
    ], "");
  }

  function countPrimitiveFields(value) {
    if (value == null) return 0;
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + countPrimitiveFields(item), 0);
    if (isObject(value)) return Object.values(value).reduce((sum, item) => sum + countPrimitiveFields(item), 0);
    return 1;
  }

  function createNewItem() {
    const id = `local-${Date.now()}`;
    let item;
    if (state.section === "news") {
      item = {
        id,
        slug: id,
        source: "本機草稿（尚未建立檔案）",
        title: "",
        date: new Date().toISOString().slice(0, 16),
        category: "市場趨勢",
        summary: "",
        cover: "",
        coverAlt: "",
        hero: "",
        videoLandscape: "",
        videoPortrait: "",
        videoEmbed: "",
        home: false,
        body: "",
        bodyHtml: ""
      };
    } else if (state.section === "pages") {
      item = {
        id,
        source: "本機草稿（尚未建立檔案）",
        data: {
          "搜尋與分享": { "網頁標題": "", "搜尋說明": "" },
          "主視覺": { "英文小標": "", "標題": "", "說明": "", "背景圖": "" },
          "頁尾諮詢": { "標題": "", "說明": "", "連結文字": "代工諮詢" }
        }
      };
    } else if (state.section === "catalogue") {
      item = {
        id,
        slug: id,
        source: "本機草稿（尚未建立檔案）",
        title: "",
        titleEn: "",
        lead: "",
        hero: "",
        groups: [],
        cta: { title: "", text: "", button: "諮詢開發", link: "contact:" }
      };
    } else {
      return;
    }
    state.data[state.section].unshift(item);
    updateNavCounts();
    openEditor(item, true);
  }

  function openEditor(item, isNew) {
    const id = itemId(state.section, item);
    const draft = readDraft(state.section, id);
    state.currentId = id;
    state.sourceItem = clone(item);
    state.currentItem = draft && draft.item ? clone(draft.item) : clone(item);
    state.currentIsNew = draft ? Boolean(draft.isNew) : Boolean(isNew);
    state.dirty = Boolean(isNew && !draft);

    const config = sections[state.section];
    dom.listView.hidden = true;
    dom.editorView.hidden = false;
    dom.backLabel.textContent = `回到${config.title}`;
    dom.editorEyebrow.textContent = state.currentIsNew ? `新增${config.singular}` : `編輯${config.singular}`;
    dom.editorTitle.textContent = displayTitle(state.section, state.currentItem);
    dom.editorPath.textContent = state.currentItem.source || state.currentItem.path || state.currentItem.slug || "本機草稿，尚未建立正式檔案";
    updateDraftBanner(draft);
    renderForm();
    updateSaveState();
    schedulePreview();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      const first = dom.editorForm.querySelector("input:not([readonly]), textarea:not([readonly]), select:not([disabled])");
      if (first) first.focus({ preventScroll: true });
    });
  }

  function closeEditor() {
    if (state.dirty && !window.confirm("這些修改還沒儲存到本機草稿。要離開編輯畫面嗎？")) return;

    if (state.currentIsNew && !readDraft(state.section, state.currentId)) {
      state.data[state.section] = state.data[state.section].filter((item) => itemId(state.section, item) !== state.currentId);
      updateNavCounts();
    }
    state.currentItem = null;
    state.sourceItem = null;
    state.currentId = null;
    state.currentIsNew = false;
    state.dirty = false;
    dom.editorView.hidden = true;
    dom.listView.hidden = false;
    renderSection();
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      if (state.lastFocusedRow && document.contains(state.lastFocusedRow)) state.lastFocusedRow.focus();
      else dom.pageTitle.focus?.();
    });
  }

  function updateDraftBanner(draft) {
    dom.draftBanner.hidden = !draft;
    if (draft) dom.draftTime.textContent = `最後儲存：${formatDateTime(draft.savedAt)}`;
  }

  function updateSaveState(savedAt = null) {
    dom.saveDraftButton.disabled = !state.dirty;
    dom.saveState.className = "save-state";
    if (state.dirty) {
      dom.saveState.textContent = "有尚未儲存的修改";
      dom.saveState.classList.add("is-dirty");
      return;
    }
    const draft = savedAt ? { savedAt } : readDraft(state.section, state.currentId);
    if (draft) {
      dom.saveState.textContent = `本機草稿已儲存 · ${formatTime(draft.savedAt)}`;
      dom.saveState.classList.add("is-saved");
    } else {
      dom.saveState.textContent = "尚未修改";
    }
  }

  function markDirty() {
    state.dirty = true;
    updateSaveState();
  }

  function saveDraft() {
    if (!state.currentItem || !validateForm()) return;
    const savedAt = new Date().toISOString();
    const record = {
      version: 1,
      savedAt,
      section: state.section,
      isNew: state.currentIsNew,
      item: clone(state.currentItem)
    };
    try {
      localStorage.setItem(draftKey(state.section, state.currentId), JSON.stringify(record));
    } catch (error) {
      showToast(`無法儲存本機草稿：${error.message || "瀏覽器已拒絕儲存"}`, true);
      return;
    }

    const index = state.data[state.section].findIndex((item) => itemId(state.section, item) === state.currentId);
    if (index >= 0) state.data[state.section][index] = clone(state.currentItem);
    else state.data[state.section].unshift(clone(state.currentItem));
    state.dirty = false;
    updateSaveState(savedAt);
    updateDraftBanner(record);
    updateNavCounts();
    showToast("草稿已儲存在這台瀏覽器。沒有傳送到 GitHub 或正式網站。");
  }

  function discardDraft() {
    const draft = readDraft(state.section, state.currentId);
    if (!draft) return;
    if (!window.confirm("要刪除這台瀏覽器裡的草稿嗎？這不會影響 data.json 或正式網站。")) return;

    removeDraft(state.section, state.currentId);
    if (draft.isNew) {
      state.data[state.section] = state.data[state.section].filter((item) => itemId(state.section, item) !== state.currentId);
      state.dirty = false;
      state.currentIsNew = true;
      showToast("本機新增草稿已刪除。");
      closeEditor();
      return;
    }

    state.currentItem = clone(state.sourceItem);
    state.dirty = false;
    updateDraftBanner(null);
    renderForm();
    updateSaveState();
    schedulePreview();
    showToast("本機草稿已刪除，已恢復 data.json 中的內容。");
  }

  function draftKey(section, id) {
    return `${DRAFT_PREFIX}${section}:${encodeURIComponent(id)}`;
  }

  function readDraft(section, id) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(draftKey(section, id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function listDrafts(section) {
    const drafts = [];
    try {
      const prefix = `${DRAFT_PREFIX}${section}:`;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(prefix)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key));
          if (value) drafts.push(value);
        } catch {
          // Ignore a single damaged record; the rest remain available.
        }
      }
    } catch {
      return [];
    }
    return drafts;
  }

  function removeDraft(section, id) {
    try { localStorage.removeItem(draftKey(section, id)); } catch { /* no-op */ }
  }

  function validateForm() {
    let valid = true;
    dom.editorForm.querySelectorAll(".form-error").forEach((node) => node.remove());
    dom.editorForm.querySelectorAll(".field.has-error").forEach((node) => node.classList.remove("has-error"));
    for (const input of dom.editorForm.querySelectorAll("[data-required='true']")) {
      if (String(input.value || "").trim()) continue;
      valid = false;
      const field = input.closest(".field");
      field?.classList.add("has-error");
      const error = document.createElement("p");
      error.className = "form-error";
      error.textContent = "這個欄位不能空白。";
      field?.append(error);
    }
    if (!valid) {
      const first = dom.editorForm.querySelector(".field.has-error input, .field.has-error textarea, .field.has-error select");
      first?.focus();
      showToast("請先完成必填欄位，草稿內容仍保留在畫面上。", true);
    }
    return valid;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.toggle("is-error", isError);
    dom.toast.hidden = false;
    toastTimer = window.setTimeout(() => { dom.toast.hidden = true; }, isError ? 6500 : 5000);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function fileName(path) {
    return String(path || "").split("/").filter(Boolean).pop() || "";
  }

  function fileExtension(path) {
    const match = String(path || "").match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return match ? match[1].toLowerCase() : "";
  }

  function mediaTypeLabel(type) {
    const value = String(type || "").toLowerCase();
    if (value.includes("image") || /^(jpe?g|png|webp|gif|svg|avif)$/.test(value)) return "圖片";
    if (value.includes("video") || /^(mp4|webm|mov)$/.test(value)) return "影片";
    if (value.includes("audio") || /^(mp3|wav|m4a)$/.test(value)) return "音訊";
    if (value.includes("font") || /^(woff2?|ttf|otf)$/.test(value)) return "字型";
    return value ? value.toUpperCase() : "其他";
  }

  function openSidebar() {
    dom.sidebar.classList.add("is-open");
    dom.sidebarScrim.hidden = false;
    dom.sidebarOpen.setAttribute("aria-expanded", "true");
    dom.body.classList.add("is-nav-open");
    requestAnimationFrame(() => dom.sidebarClose.focus());
  }

  function closeSidebar() {
    dom.sidebar.classList.remove("is-open");
    dom.sidebarScrim.hidden = true;
    dom.sidebarOpen.setAttribute("aria-expanded", "false");
    dom.body.classList.remove("is-nav-open");
  }

  function switchSection(nextSection) {
    if (!sections[nextSection] || nextSection === state.section) {
      closeSidebar();
      return;
    }
    if (!dom.editorView.hidden && state.dirty && !window.confirm("目前有尚未儲存的修改。要改到其他內容分類嗎？")) return;

    if (!dom.editorView.hidden) {
      state.currentItem = null;
      state.dirty = false;
      dom.editorView.hidden = true;
      dom.listView.hidden = false;
    }
    state.section = nextSection;
    state.query = "";
    state.filter = "";
    dom.searchInput.value = "";
    renderSection();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function schedulePreview() {
    if (state.previewFrame) cancelAnimationFrame(state.previewFrame);
    state.previewFrame = requestAnimationFrame(() => {
      state.previewFrame = null;
      dom.preview.srcdoc = buildPreviewDocument();
    });
  }

  // Form and preview renderers are defined below to keep data handling separate from UI wiring.

  function bindEvents() {
    dom.sidebarOpen.addEventListener("click", openSidebar);
    dom.sidebarClose.addEventListener("click", closeSidebar);
    dom.sidebarScrim.addEventListener("click", closeSidebar);
    dom.navItems.forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.section)));
    dom.createButton.addEventListener("click", createNewItem);
    dom.reloadButton.addEventListener("click", loadData);
    dom.retryButton.addEventListener("click", loadData);
    dom.backButton.addEventListener("click", closeEditor);
    dom.saveDraftButton.addEventListener("click", saveDraft);
    dom.discardDraftButton.addEventListener("click", discardDraft);

    dom.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderList();
    });
    dom.filterSelect.addEventListener("change", (event) => {
      state.filter = event.target.value;
      renderList();
    });

    dom.editorForm.addEventListener("input", handleFormInput);
    dom.editorForm.addEventListener("change", handleFormInput);
    dom.editorForm.addEventListener("click", handleFormClick);

    dom.previewSizeButtons.forEach((button) => button.addEventListener("click", () => {
      const mobile = button.dataset.previewSize === "mobile";
      dom.previewStage.classList.toggle("is-mobile", mobile);
      dom.previewSizeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
    }));

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dom.sidebar.classList.contains("is-open")) {
        closeSidebar();
        dom.sidebarOpen.focus();
      } else if (!dom.editorView.hidden) {
        closeEditor();
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  bindEvents();
  loadData();

  function renderForm() {
    fieldCounter = 0;
    dom.editorForm.replaceChildren();
    if (!state.currentItem) return;
    if (state.section === "news") renderNewsForm();
    else if (state.section === "pages") renderPageForm();
    else if (state.section === "catalogue") renderCatalogueForm();
    else if (state.section === "media") renderMediaForm();
    else renderCompanyForm();
  }

  function renderNewsForm() {
    const item = state.currentItem;
    appendSection("文章資訊", "這些內容會出現在消息清單與文章頁首。", [
      field("標題", ["title"], item.title, { full: true, required: true }),
      field("發布日期", ["date"], item.date, { type: "datetime-local" }),
      field("分類", ["category"], item.category, { options: newsCategories(item.category) }),
      field("網址代號", ["slug"], item.slug, { help: "正式連線後將用來建立文章網址。" }),
      field("首頁精選", ["home"], Boolean(item.home), { type: "checkbox", help: "開啟後才會出現在首頁最新消息。" })
    ]);
    appendSection("清單摘要與圖片", "簡短、可掃描的說明會讓讀者更快理解文章主題。", [
      field("摘要", ["summary"], item.summary, { type: "textarea", full: true }),
      field("清單封面", ["cover"], item.cover, { help: "輸入網站內的圖片路徑。" }),
      field("封面替代文字", ["coverAlt"], item.coverAlt || item.cover_alt, { path: item.coverAlt !== undefined ? ["coverAlt"] : ["cover_alt"] }),
      field("文章主視覺", ["hero"], item.hero),
      field("主視覺替代文字", ["heroAlt"], item.heroAlt || item.hero_alt, { path: item.heroAlt !== undefined ? ["heroAlt"] : ["hero_alt"] })
    ]);
    const bodyPath = item.body !== undefined ? ["body"] : ["bodyHtml"];
    appendSection("文章內容", "預覽只會顯示純文字摘要，不會在後台執行內容中的 HTML。", [
      field(item.body !== undefined ? "Markdown 內文" : "HTML 內文", bodyPath, getAtPath(item, bodyPath), { type: "textarea", code: item.body === undefined, full: true })
    ]);
    appendSection("影音與檔案來源", "影音路徑是選填，來源檔案在開發預覽中只讀。", [
      field("橫式影片", ["videoLandscape"], item.videoLandscape),
      field("直式影片", ["videoPortrait"], item.videoPortrait),
      field("嵌入影片", ["videoEmbed"], item.videoEmbed, { full: true }),
      field("來源檔案", ["source"], item.source, { readonly: true, full: true })
    ]);
  }

  function renderPageForm() {
    const item = state.currentItem;
    appendSection("頁面識別", "頁面代號與來源檔案在開發預覽中不會被改寫。", [
      field("頁面代號", ["id"], item.id, { readonly: !state.currentIsNew, required: true }),
      field("來源檔案", ["source"], item.source, { readonly: true })
    ]);
    const data = isObject(item.data) ? item.data : {};
    Object.entries(data).forEach(([name, value]) => {
      const section = makeSection(name, sectionHint(name));
      if (isObject(value)) appendObjectEditor(section.body, value, ["data", name]);
      else if (Array.isArray(value)) section.body.append(arrayEditor(value, ["data", name], name));
      else section.body.append(field(name, ["data", name], value, { full: true }));
      dom.editorForm.append(section.fieldset);
    });
    if (Object.keys(data).length === 0) appendSection("頁面內容", "data.json 中尚無可編輯的頁面區塊。", []);
  }

  function renderCatalogueForm() {
    const item = state.currentItem;
    appendSection("頁首內容", "介紹這個劑型或包材的主要特色。", [
      field("中文名稱", ["title"], item.title, { required: true }),
      field("英文名稱", item.titleEn !== undefined ? ["titleEn"] : ["title_en"], item.titleEn || item.title_en),
      field("介紹", ["lead"], item.lead, { type: "textarea", full: true }),
      field("主視覺圖片", ["hero"], item.hero, { full: true }),
      field("網址代號", ["slug"], item.slug, { readonly: !state.currentIsNew }),
      field("來源檔案", ["source"], item.source, { readonly: true })
    ]);
    const groupSection = makeSection("樣式分組", "依外型或包材種類分組，可在各組內管理圖片與圖說。");
    groupSection.body.append(arrayEditor(Array.isArray(item.groups) ? item.groups : [], ["groups"], "分組"));
    dom.editorForm.append(groupSection.fieldset);
    const ctaSection = makeSection("頁尾諮詢", "說明看完樣式後的下一步。");
    appendObjectEditor(ctaSection.body, isObject(item.cta) ? item.cta : {}, ["cta"]);
    dom.editorForm.append(ctaSection.fieldset);
  }

  function renderMediaForm() {
    const item = state.currentItem;
    appendSection("檔案資訊", "這個原型只讀取現有媒體。檔案上傳、替換與刪除尚未連接儲存服務。", [
      field("檔案路徑", ["path"], item.path, { readonly: true, full: true }),
      field("檔案類型", ["type"], item.type || mediaTypeLabel(fileExtension(item.path)), { readonly: true }),
      field("替代文字（本機草稿）", ["alt"], item.alt || "", { help: "正式資料模型尚未提供 alt 欄位；目前只會存在這台瀏覽器。" }),
      field("被引用的頁面", ["referencedBy"], Array.isArray(item.referencedBy) ? item.referencedBy : [], { type: "string-array", readonly: true, full: true })
    ]);
  }

  function renderCompanyForm() {
    const item = state.currentItem;
    const entries = Object.entries(item).filter(([key]) => !["id", "source"].includes(key));
    appendSection("對外聯絡資訊", "這些資料會在多個網站頁面共用，儲存前請確認內容一致。",
      entries.map(([key, value]) => field(key, [key], value, { type: String(value || "").length > 70 ? "textarea" : undefined, full: key.includes("簡介") || key.includes("地址") }))
    );
    appendSection("資料來源", "正式連接後才會根據權限寫回原始檔案。", [
      field("來源檔案", ["source"], item.source, { readonly: true, full: true })
    ]);
  }

  function makeSection(title, description) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "form-section";
    const legend = document.createElement("legend");
    const heading = document.createElement("span");
    heading.className = "form-section-title";
    heading.textContent = title;
    const detail = document.createElement("span");
    detail.className = "form-section-description";
    detail.textContent = description || "";
    legend.append(heading, detail);
    const body = document.createElement("div");
    fieldset.append(legend, body);
    return { fieldset, body };
  }

  function appendSection(title, description, fields) {
    const section = makeSection(title, description);
    const grid = document.createElement("div");
    grid.className = "form-grid";
    fields.forEach((node) => grid.append(node));
    section.body.append(grid);
    dom.editorForm.append(section.fieldset);
  }

  function appendObjectEditor(container, object, basePath) {
    const primitive = [];
    const structured = [];
    Object.entries(object).forEach(([key, value]) => {
      if (Array.isArray(value) || isObject(value)) structured.push([key, value]);
      else primitive.push([key, value]);
    });
    if (primitive.length) {
      const grid = document.createElement("div");
      grid.className = "form-grid";
      primitive.forEach(([key, value]) => grid.append(field(key, [...basePath, key], value, {
        type: inferFieldType(key, value),
        full: shouldBeFull(key, value)
      })));
      container.append(grid);
    }
    structured.forEach(([key, value]) => {
      if (Array.isArray(value)) container.append(arrayEditor(value, [...basePath, key], key));
      else {
        const nested = document.createElement("div");
        nested.className = "nested-group";
        const title = document.createElement("h3");
        title.textContent = key;
        nested.append(title);
        appendObjectEditor(nested, value, [...basePath, key]);
        container.append(nested);
      }
    });
  }

  function field(labelText, defaultPath, rawValue, options = {}) {
    const path = options.path || defaultPath;
    const type = options.type || inferFieldType(labelText, rawValue);
    const wrapper = document.createElement("div");
    wrapper.className = `field${options.full || type === "textarea" || type === "string-array" ? " is-full" : ""}`;
    const id = `field-${++fieldCounter}`;

    if (type === "checkbox") {
      const label = document.createElement("label");
      label.className = "checkbox-field";
      label.htmlFor = id;
      const input = document.createElement("input");
      input.id = id;
      input.type = "checkbox";
      input.checked = Boolean(rawValue);
      configureInput(input, path, "boolean", options);
      const copy = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = labelText;
      const help = document.createElement("span");
      help.textContent = options.help || "";
      copy.append(strong, help);
      label.append(input, copy);
      wrapper.append(label);
      return wrapper;
    }

    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = id;
    const name = document.createElement("span");
    name.textContent = labelText;
    label.append(name);
    if (options.required) {
      const required = document.createElement("small");
      required.textContent = "必填";
      label.append(required);
    }
    wrapper.append(label);

    let control;
    if (Array.isArray(options.options)) {
      control = document.createElement("select");
      options.options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        control.append(option);
      });
      control.value = rawValue == null ? "" : String(rawValue);
    } else if (type === "textarea" || type === "string-array") {
      control = document.createElement("textarea");
      control.value = type === "string-array" && Array.isArray(rawValue) ? rawValue.join("\n") : (rawValue == null ? "" : String(rawValue));
      if (options.code) control.classList.add("is-code");
    } else {
      control = document.createElement("input");
      control.type = type === "datetime-local" ? "datetime-local" : type === "number" ? "number" : "text";
      control.value = normaliseInputValue(rawValue, control.type);
      if (/(圖片|路徑|網址|video|image|link|hero|cover)/i.test(labelText)) control.spellcheck = false;
    }
    control.id = id;
    configureInput(control, path, type === "number" ? "number" : type === "string-array" ? "string-array" : "string", options);
    wrapper.append(control);
    if (options.help) {
      const help = document.createElement("p");
      help.className = "field-help";
      help.textContent = options.help;
      wrapper.append(help);
    }
    return wrapper;
  }

  function configureInput(input, path, kind, options) {
    input.dataset.fieldPath = JSON.stringify(path);
    input.dataset.valueKind = kind;
    if (options.readonly) {
      if (input.tagName === "SELECT" || input.type === "checkbox") input.disabled = true;
      else input.readOnly = true;
    }
    if (options.required) {
      input.required = true;
      input.dataset.required = "true";
    }
  }

  function inferFieldType(label, value) {
    if (typeof value === "boolean") return "checkbox";
    if (typeof value === "number") return "number";
    const text = String(value == null ? "" : value);
    if (/date|日期/i.test(label) && /^\d{4}-\d{2}-\d{2}T/.test(text)) return "datetime-local";
    if (text.length > 90 || /(說明|摘要|內文|簡介|標題)$/.test(label) && text.includes("\n")) return "textarea";
    return "text";
  }

  function shouldBeFull(label, value) {
    return /(說明|摘要|簡介|地址|背景圖|圖片)/.test(label) || String(value || "").length > 70;
  }

  function normaliseInputValue(value, type) {
    if (value == null) return "";
    const text = String(value);
    if (type === "datetime-local") return text.slice(0, 16);
    return text;
  }

  function newsCategories(current) {
    const values = new Set(["市場趨勢", "配方研發", "企業動態"]);
    (state.data?.news || []).forEach((item) => item.category && values.add(item.category));
    if (current) values.add(current);
    return [...values];
  }

  function sectionHint(name) {
    if (name === "搜尋與分享") return "搜尋引擎與社群分享時顯示的文字。";
    if (name === "主視覺") return "瀏覽者進入這個頁面後第一個看到的內容。";
    if (name.includes("頁尾") || name.includes("諮詢")) return "完成閱讀後引導瀏覽者前往的下一步。";
    return "依前台區塊順序編輯，預覽會即時反映主要文字。";
  }

  function arrayEditor(array, path, label) {
    const wrapper = document.createElement("div");
    wrapper.className = "repeater";
    if (array.length === 0) {
      const empty = document.createElement("p");
      empty.className = "structure-note";
      empty.textContent = `目前沒有${label}。`;
      wrapper.append(empty);
    }
    if (array.every((item) => !isObject(item) && !Array.isArray(item))) {
      wrapper.append(field(label, path, array, { type: "string-array", full: true }));
      return wrapper;
    }
    array.forEach((item, index) => {
      const details = document.createElement("details");
      details.className = "repeater-item";
      if (index === 0 && array.length <= 4) details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `${index + 1}. ${arrayItemName(item, label)}`;
      details.append(summary);
      const actions = document.createElement("div");
      actions.className = "repeater-actions";
      actions.append(
        repeaterButton("上移", "up", path, index, index === 0),
        repeaterButton("下移", "down", path, index, index === array.length - 1),
        repeaterButton("移除", "remove", path, index, false, true)
      );
      details.append(actions);
      if (isObject(item)) appendObjectEditor(details, item, [...path, index]);
      else if (Array.isArray(item)) details.append(arrayEditor(item, [...path, index], label));
      wrapper.append(details);
    });
    const add = repeaterButton(`新增${label}`, "add", path, -1);
    add.classList.add("repeater-add");
    wrapper.append(add);
    return wrapper;
  }

  function repeaterButton(text, action, path, index, disabled = false, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mini-button${danger ? " is-danger" : ""}`;
    button.textContent = text;
    button.dataset.repeaterAction = action;
    button.dataset.repeaterPath = JSON.stringify(path);
    button.dataset.repeaterIndex = String(index);
    button.disabled = disabled;
    return button;
  }

  function arrayItemName(item, fallback) {
    if (!isObject(item)) return String(item || fallback);
    return item.title || item.name || item.caption || item["標題"] || item["名稱"] || fallback;
  }

  function blankShape(value, path) {
    const key = String(path[path.length - 1] || "");
    if (key === "groups") return { name: "新分組", en: "", items: [] };
    if (key === "items") return { image: "", caption: "" };
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([itemKey, itemValue]) => [itemKey, blankShape(itemValue, [...path, itemKey])]));
    }
    if (Array.isArray(value)) return [];
    if (typeof value === "boolean") return false;
    if (typeof value === "number") return 0;
    return "";
  }

  function handleFormInput(event) {
    const input = event.target.closest("[data-field-path]");
    if (!input || !state.currentItem || input.disabled || input.readOnly) return;
    let path;
    try { path = JSON.parse(input.dataset.fieldPath); } catch { return; }
    let value;
    if (input.dataset.valueKind === "boolean") value = input.checked;
    else if (input.dataset.valueKind === "number") value = input.value === "" ? "" : Number(input.value);
    else if (input.dataset.valueKind === "string-array") value = input.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    else value = input.value;
    setAtPath(state.currentItem, path, value);
    input.closest(".field")?.classList.remove("has-error");
    input.closest(".field")?.querySelector(".form-error")?.remove();
    dom.editorTitle.textContent = displayTitle(state.section, state.currentItem);
    markDirty();
    schedulePreview();
  }

  function handleFormClick(event) {
    const button = event.target.closest("[data-repeater-action]");
    if (!button || !state.currentItem) return;
    let path;
    try { path = JSON.parse(button.dataset.repeaterPath); } catch { return; }
    const array = getAtPath(state.currentItem, path);
    if (!Array.isArray(array)) return;
    const index = Number(button.dataset.repeaterIndex);
    const action = button.dataset.repeaterAction;
    if (action === "add") array.push(blankShape(array[0] || {}, path));
    if (action === "remove" && index >= 0) array.splice(index, 1);
    if (action === "up" && index > 0) [array[index - 1], array[index]] = [array[index], array[index - 1]];
    if (action === "down" && index >= 0 && index < array.length - 1) [array[index + 1], array[index]] = [array[index], array[index + 1]];
    markDirty();
    renderForm();
    schedulePreview();
    showToast("項目已在畫面上更新，尚未儲存到本機草稿。");
  }

  function buildPreviewDocument() {
    const item = state.currentItem || {};
    let content = "";
    if (state.section === "news") content = previewNews(item);
    else if (state.section === "pages") content = previewPage(item);
    else if (state.section === "catalogue") content = previewCatalogue(item);
    else if (state.section === "media") content = previewMedia(item);
    else content = previewCompany(item);
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCss()}</style></head><body><header><b>BKE</b><span>百達醫企業</span><i>內容預覽</i></header>${content}<footer>BKE 百達醫企業 · OEM / ODM 一站式服務</footer></body></html>`;
  }

  function previewNews(item) {
    const body = stripHtml(item.body || item.bodyHtml || "");
    return `<main><section class="hero article"><em>${escapeHtml(item.category || "最新消息")}</em><h1>${escapeHtml(item.title || "未命名文章")}</h1><p>${escapeHtml(item.summary || "請在左側填寫文章摘要。")}</p><small>${escapeHtml(item.date ? formatDate(item.date) : "尚未設定發布日期")}</small></section>${previewImage(item.hero || item.cover, item.heroAlt || item.coverAlt || item.title)}<article><p>${escapeHtml(body.slice(0, 900) || "文章內容會在這裡顯示。")}</p></article></main>`;
  }

  function previewPage(item) {
    const data = isObject(item.data) ? item.data : {};
    const hero = isObject(data["主視覺"]) ? data["主視覺"] : (isObject(data.hero) ? data.hero : {});
    const title = hero["標題"] || hero.title || displayTitle("pages", item);
    const eyebrow = hero["英文小標"] || hero.eyebrow || "BKE BAIDAYI";
    const text = hero["說明"] || hero.text || pageDescription(item);
    const image = hero["背景圖"] || hero.image || "";
    const blocks = Object.entries(data).filter(([name]) => !["搜尋與分享", "主視覺"].includes(name)).slice(0, 4);
    return `<main><section class="hero"><em>${escapeHtml(eyebrow)}</em><h1>${escapeHtml(title || "未命名頁面")}</h1><p>${escapeHtml(text || "請在左側填寫主視覺說明。")}</p></section>${previewImage(image, title)}<div class="sections">${blocks.map(([name, value]) => `<section><em>${escapeHtml(name)}</em><h2>${escapeHtml(firstText(value, "標題") || name)}</h2><p>${escapeHtml(firstText(value, "說明") || firstPrimitive(value) || "此區塊內容已建立。")}</p></section>`).join("")}</div></main>`;
  }

  function previewCatalogue(item) {
    const groups = Array.isArray(item.groups) ? item.groups : [];
    const samples = groups.flatMap((group) => (group.items || []).map((sample) => ({ ...sample, group: group.name }))).slice(0, 8);
    return `<main><section class="hero"><em>${escapeHtml(item.titleEn || item.title_en || "DOSAGE & PACKAGING")}</em><h1>${escapeHtml(item.title || "未命名劑型")}</h1><p>${escapeHtml(item.lead || "請在左側填寫劑型介紹。")}</p></section>${previewImage(item.hero, item.title)}<section class="catalogue"><h2>可製作的樣式</h2><div class="sample-grid">${samples.length ? samples.map((sample) => `<figure>${previewImage(sample.image, sample.caption, true)}<figcaption>${escapeHtml(sample.caption || sample.group || "未命名樣式")}</figcaption></figure>`).join("") : "<p>尚未建立樣式分組。</p>"}</div></section></main>`;
  }

  function previewMedia(item) {
    const image = mediaTypeLabel(item.type || fileExtension(item.path)) === "圖片";
    return `<main><section class="hero"><em>媒體庫</em><h1>${escapeHtml(fileName(item.path) || "未命名檔案")}</h1><p>${escapeHtml(item.alt || item.path || "尚無檔案路徑")}</p></section>${image ? previewImage(item.path, item.alt || fileName(item.path)) : `<section class="file-preview"><b>${escapeHtml(mediaTypeLabel(item.type))}</b><p>這個檔案類型無法在內容摘要中直接預覽。</p></section>`}</main>`;
  }

  function previewCompany(item) {
    const phone = item["電話"] || item.phone || "尚未設定";
    const address = item["地址"] || item.address || "尚未設定";
    const description = item["頁尾簡介"] || item.footerDescription || "尚未設定頁尾簡介";
    return `<main><section class="hero"><em>CONTACT BKE</em><h1>與百達醫開始一個新產品計畫</h1><p>${escapeHtml(description)}</p></section><section class="contact"><div><small>電話</small><b>${escapeHtml(phone)}</b></div><div><small>地址</small><b>${escapeHtml(address)}</b></div></section></main>`;
  }

  function previewImage(src, alt, compact = false) {
    if (!src) return compact ? "<div class=\"image-placeholder\">尚無圖片</div>" : "";
    return `<div class="preview-image${compact ? " compact" : ""}"><img src="${escapeHtml(assetUrl(src))}" alt="${escapeHtml(alt || "")}"></div>`;
  }

  function assetUrl(src) {
    const value = String(src || "").trim();
    if (!value || /^(javascript|vbscript):/i.test(value)) return "";
    if (/^(https?:|data:image\/)/i.test(value)) return value;
    try { return new URL(value.replace(/^\//, ""), new URL("../", window.location.href)).href; }
    catch { return ""; }
  }

  function stripHtml(value) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(String(value || ""), "text/html");
    return (documentNode.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(value, desiredKey) {
    if (!isObject(value)) return "";
    for (const [key, item] of Object.entries(value)) {
      if ((key === desiredKey || key.endsWith(`｜${desiredKey}`)) && typeof item === "string") return item;
    }
    return "";
  }

  function firstPrimitive(value) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.length ? firstPrimitive(value[0]) : "";
    if (isObject(value)) {
      for (const item of Object.values(value)) {
        const found = firstPrimitive(item);
        if (found) return found;
      }
    }
    return "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character]));
  }

  function previewCss() {
    return `*{box-sizing:border-box}html{background:#fff}body{margin:0;color:#183028;font-family:"Noto Sans TC","PingFang TC",sans-serif;line-height:1.7}header{height:58px;display:flex;align-items:center;gap:10px;padding:0 5vw;border-bottom:1px solid #dfe5e0;font-size:12px;letter-spacing:.08em}header b{font:700 15px Georgia;color:#235b4b}header i{margin-left:auto;color:#728079;font-style:normal}main{min-height:520px}.hero{padding:clamp(48px,10vw,100px) 8vw 44px;background:#f1f5f1}.hero.article{background:#f7f6f1}.hero em,.sections em{color:#2b6d59;font-size:10px;font-style:normal;font-weight:700;letter-spacing:.16em}.hero h1{max-width:760px;margin:12px 0 16px;font-family:"Noto Serif TC",serif;font-size:clamp(30px,6vw,62px);font-weight:600;letter-spacing:-.04em;line-height:1.22;white-space:pre-line}.hero p{max-width:720px;margin:0;color:#53645c;font-size:clamp(13px,2vw,17px)}.hero small{display:block;margin-top:24px;color:#78847e}.preview-image{width:84%;max-width:900px;margin:42px auto}.preview-image img{display:block;width:100%;max-height:480px;object-fit:cover}.preview-image.compact{width:100%;margin:0}.preview-image.compact img{height:120px;object-fit:contain;background:#f3f5f2}.sections{padding:20px 8vw 60px}.sections section{padding:34px 0;border-bottom:1px solid #dfe4df}.sections h2,.catalogue h2{margin:6px 0 8px;font:600 clamp(22px,3vw,34px) "Noto Serif TC",serif}.sections p,article p{max-width:720px;margin:0;color:#5d6b64}article{padding:45px 8vw 80px}article p{font-size:15px;line-height:2}.catalogue{padding:48px 8vw 80px}.sample-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:24px}.sample-grid figure{margin:0;border-bottom:1px solid #dbe1dc}.sample-grid figcaption{padding:9px 0 14px;font-size:12px}.image-placeholder{display:grid;height:120px;place-items:center;background:#eef1ee;color:#849089;font-size:11px}.file-preview,.contact{margin:44px 8vw;padding:30px;border:1px solid #dce2dd}.file-preview b{font-size:24px}.contact{display:grid;grid-template-columns:1fr 1.6fr;gap:24px}.contact small,.contact b{display:block}.contact small{color:#718078;font-size:10px;letter-spacing:.12em}.contact b{margin-top:5px;font-size:15px}footer{padding:30px 8vw;color:#dce9e4;background:#173a31;font-size:10px;letter-spacing:.08em}@media(max-width:520px){.hero{padding-inline:7vw}.sample-grid,.contact{grid-template-columns:1fr}.preview-image{width:86%;margin-block:28px}.sections,.catalogue,article{padding-inline:7vw}}`;
  }
})();
