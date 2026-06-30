const payload = window.XHS_NOTES_DATA || { meta: {}, notes: [] };
const notes = Array.isArray(payload.notes) ? payload.notes : [];
const hiddenStorageKey = "xhsnotes-backup-hidden-notes";
const authStorageKey = "xhsnotes-backup-authenticated";
const passwordHash = "dbe617185d5397ec10cd34402daa1811075db3e8185ce938035b992492fd05d6";

const elements = {
  authGate: document.querySelector("#authGate"),
  authForm: document.querySelector("#authForm"),
  passwordInput: document.querySelector("#passwordInput"),
  authError: document.querySelector("#authError"),
  summaryText: document.querySelector("#summaryText"),
  totalCount: document.querySelector("#totalCount"),
  shownCount: document.querySelector("#shownCount"),
  searchInput: document.querySelector("#searchInput"),
  industrySelect: document.querySelector("#industrySelect"),
  subcategorySelect: document.querySelector("#subcategorySelect"),
  materialSelect: document.querySelector("#materialSelect"),
  minLikesInput: document.querySelector("#minLikesInput"),
  minCollectsInput: document.querySelector("#minCollectsInput"),
  validOnlyInput: document.querySelector("#validOnlyInput"),
  resetButton: document.querySelector("#resetButton"),
  cardsGrid: document.querySelector("#cardsGrid"),
  emptyState: document.querySelector("#emptyState"),
};

const state = {
  search: "",
  industry: "全部",
  subcategory: "全部",
  material: "全部",
  minLikes: 0,
  minCollects: 0,
  validOnly: true,
};

let currentList = [];
let hiddenNoteKeys = loadHiddenNoteKeys();

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unlock() {
  document.body.classList.remove("auth-locked");
  elements.authGate.hidden = true;
  window.sessionStorage.setItem(authStorageKey, "1");
}

function bindAuth() {
  if (window.sessionStorage.getItem(authStorageKey) === "1") {
    unlock();
    return;
  }

  elements.passwordInput.focus();
  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.authError.hidden = true;
    const hash = await sha256(elements.passwordInput.value);
    if (hash === passwordHash) {
      unlock();
      return;
    }
    elements.passwordInput.value = "";
    elements.authError.hidden = false;
    elements.passwordInput.focus();
  });
}

function loadHiddenNoteKeys() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(hiddenStorageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function saveHiddenNoteKeys() {
  try {
    window.localStorage.setItem(hiddenStorageKey, JSON.stringify([...hiddenNoteKeys]));
  } catch {
    // Deletion still works for the current page even if localStorage is unavailable.
  }
}

function noteKey(note) {
  return String(note["笔记ID"] || note["笔记链接"] || note["封面图"] || note["笔记标题"] || "");
}

function visibleNotes() {
  return notes.filter((note) => !hiddenNoteKeys.has(noteKey(note)));
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
  return String(number);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function optionHtml(values) {
  return ["全部", ...values]
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function includesText(note, keyword) {
  if (!keyword) return true;
  const haystack = [
    note["笔记标题"],
    note["账号名称"],
    note["行业"],
    note["细分行业/筛选条件"],
    note["备注"],
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

function hasValidMetrics(note) {
  return (
    Number(note["连续投放天数"] || 0) > 0 &&
    Number(note["点赞数"] || 0) > 0 &&
    Number(note["收藏数"] || 0) > 0 &&
    Number(note["评论数"] || 0) > 0
  );
}

function filterAndSort() {
  const filtered = visibleNotes()
    .filter((note) => !state.validOnly || hasValidMetrics(note))
    .filter((note) => includesText(note, state.search))
    .filter((note) => state.industry === "全部" || note["行业"] === state.industry)
    .filter((note) => state.subcategory === "全部" || note["细分行业/筛选条件"] === state.subcategory)
    .filter((note) => state.material === "全部" || note["素材类型"] === state.material)
    .filter((note) => Number(note["点赞数"] || 0) >= state.minLikes)
    .filter((note) => Number(note["收藏数"] || 0) >= state.minCollects);

  filtered.sort((a, b) => {
    return Number(b["点赞数"] || 0) - Number(a["点赞数"] || 0);
  });

  return filtered;
}

function renderCard(note) {
  const index = currentList.indexOf(note);
  const title = note["笔记标题"] || "未命名笔记";
  const cover = note["封面图"] || "";
  const href = note["笔记链接"] || "#";
  const material = note["素材类型"] || "笔记";
  const account = note["账号名称"] || "未知账号";
  const fans = note["账号粉丝量级"] || "";
  const image = cover
    ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" data-title="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" />`
    : `<div class="cover-fallback">${escapeHtml(title)}</div>`;

  return `
    <article class="note-card" data-href="${escapeHtml(href)}" tabindex="0">
      <button class="delete-note" type="button" data-index="${index}" title="删除这条笔记">删除</button>
      <div class="cover-wrap">
        ${image}
        <span class="badge">${escapeHtml(material)} · ${formatNumber(note["图片数"])}图</span>
      </div>
      <div class="card-body">
        <h2 class="title">${escapeHtml(title)}</h2>
        <div class="account">
          <span>${escapeHtml(account)}</span>
          <span>${escapeHtml(fans)}</span>
        </div>
        <div class="stats">
          <span class="stat">赞 <strong>${formatNumber(note["点赞数"])}</strong></span>
          <span class="stat collect">藏 <strong>${formatNumber(note["收藏数"])}</strong></span>
          <span class="stat comment">评 <strong>${formatNumber(note["评论数"])}</strong></span>
          <span class="stat days">投 <strong>${formatNumber(note["连续投放天数"])}</strong> 天</span>
        </div>
      </div>
    </article>
  `;
}

function render() {
  currentList = filterAndSort();
  elements.cardsGrid.innerHTML = currentList.map(renderCard).join("");
  elements.totalCount.textContent = String(visibleNotes().length);
  elements.shownCount.textContent = String(currentList.length);
  elements.emptyState.hidden = currentList.length > 0;
}

function createFallback(title) {
  const fallback = document.createElement("div");
  fallback.className = "cover-fallback";
  fallback.textContent = title || "封面加载失败";
  return fallback;
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });
  elements.industrySelect.addEventListener("change", (event) => {
    state.industry = event.target.value;
    render();
  });
  elements.subcategorySelect.addEventListener("change", (event) => {
    state.subcategory = event.target.value;
    render();
  });
  elements.materialSelect.addEventListener("change", (event) => {
    state.material = event.target.value;
    render();
  });
  elements.minLikesInput.addEventListener("input", (event) => {
    state.minLikes = Number(event.target.value || 0);
    render();
  });
  elements.minCollectsInput.addEventListener("input", (event) => {
    state.minCollects = Number(event.target.value || 0);
    render();
  });
  elements.validOnlyInput.addEventListener("change", (event) => {
    state.validOnly = event.target.checked;
    render();
  });
  elements.resetButton.addEventListener("click", () => {
    state.search = "";
    state.industry = "全部";
    state.subcategory = "全部";
    state.material = "全部";
    state.minLikes = 0;
    state.minCollects = 0;
    state.validOnly = true;
    elements.searchInput.value = "";
    elements.industrySelect.value = "全部";
    elements.subcategorySelect.value = "全部";
    elements.materialSelect.value = "全部";
    elements.minLikesInput.value = "";
    elements.minCollectsInput.value = "";
    elements.validOnlyInput.checked = true;
    render();
  });
  elements.cardsGrid.addEventListener(
    "error",
    (event) => {
      if (event.target.tagName !== "IMG") return;
      event.target.replaceWith(createFallback(event.target.dataset.title));
    },
    true,
  );
  elements.cardsGrid.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-note");
    if (deleteButton) {
      event.stopPropagation();
      const note = currentList[Number(deleteButton.dataset.index)];
      if (!note) return;
      const title = note["笔记标题"] || "这条笔记";
      if (!window.confirm(`确定删除「${title}」吗？这条笔记会在当前备份页隐藏。`)) return;
      deleteButton.disabled = true;
      deleteButton.textContent = "删除中";
      hiddenNoteKeys.add(noteKey(note));
      saveHiddenNoteKeys();
      render();
      return;
    }

    const card = event.target.closest(".note-card");
    if (card && card.dataset.href && card.dataset.href !== "#") {
      window.open(card.dataset.href, "_blank", "noopener,noreferrer");
    }
  });
  elements.cardsGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const card = event.target.closest(".note-card");
    if (card && card.dataset.href && card.dataset.href !== "#") {
      window.open(card.dataset.href, "_blank", "noopener,noreferrer");
    }
  });
}

function init() {
  bindAuth();
  const meta = payload.meta || {};
  elements.totalCount.textContent = String(visibleNotes().length);
  const duplicateText = Number(meta.duplicateRemoved || 0) > 0 ? `，已去重 ${meta.duplicateRemoved} 条` : "";
  const deletedText = Number(meta.deletedHidden || 0) > 0 ? `，已隐藏删除 ${meta.deletedHidden} 条` : "";
  elements.summaryText.textContent = `数据更新时间：${meta.exportedAt || "未知"}${duplicateText}${deletedText}，点击卡片打开原笔记链接`;
  elements.industrySelect.innerHTML = optionHtml(meta.industries || []);
  elements.subcategorySelect.innerHTML = optionHtml(meta.subcategories || []);
  elements.materialSelect.innerHTML = optionHtml(meta.materials || []);
  bindEvents();
  render();
}

init();
