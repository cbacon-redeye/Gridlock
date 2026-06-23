/* Halo Column Adjuster - content script
 * Pins service desk table column widths by injecting a stylesheet that overrides
 * react-table v6's inline flex/width styles.
 *
 * Scope model:
 *   - Per-list widths are keyed on "viewid:selid" (a single Halo list).
 *   - Global widths live under GLOBAL_KEY and apply to every list.
 *   - Effective = global, then per-list overrides on top.
 */
(() => {
  "use strict";

  const TABLE_SELECTOR = ".ReactTable.main-table, .ReactTable";
  const STYLE_ID = "halo-col-adjuster-style";
  const STORAGE_KEY = "haloColWidths";
  const GLOBAL_KEY = "__global__";

  // In-memory cache: { [listKey | "__global__"]: { columnName: widthPx } }
  let config = {};

  /* --- list identity ------------------------------------------------------ */
  // A Halo list is identified by viewid (the view) + selid (the selected list).
  // viewid alone is shared across lists in the same view, so both are needed.
  function getListKey() {
    const p = new URLSearchParams(location.search);
    const viewid = p.get("viewid");
    const selid = p.get("selid");
    if (selid) return (viewid || "v") + ":" + selid;
    return viewid || null;
  }

  /* --- column detection --------------------------------------------------- */
  function getTable() {
    return document.querySelector(TABLE_SELECTOR);
  }

  function getColumnNames(table) {
    table = table || getTable();
    if (!table) return [];
    return [...table.querySelectorAll(".rt-thead .rt-tr .rt-th")].map((th) =>
      (th.innerText || "").replace(/\s+/g, " ").trim()
    );
  }

  // non-empty header label -> 1-based child index
  function nameToNthChild(table) {
    const map = {};
    getColumnNames(table).forEach((name, i) => {
      if (name) map[name] = i + 1;
    });
    return map;
  }

  /* --- effective config --------------------------------------------------- */
  function effectiveWidths() {
    const key = getListKey();
    const globalCfg = config[GLOBAL_KEY] || {};
    const listCfg = (key && config[key]) || {};
    return Object.assign({}, globalCfg, listCfg); // per-list overrides global
  }

  /* --- CSS injection ------------------------------------------------------ */
  function buildCss(table) {
    const eff = effectiveWidths();
    if (!Object.keys(eff).length) return "";
    const idx = nameToNthChild(table);
    let css = "";
    for (const [name, w] of Object.entries(eff)) {
      const width = parseInt(w, 10);
      if (!idx[name] || !Number.isFinite(width) || width <= 0) continue;
      const n = idx[name];
      css +=
        `.ReactTable .rt-th:nth-child(${n}),` +
        `.ReactTable .rt-td:nth-child(${n}){` +
        `flex:0 0 ${width}px !important;width:${width}px !important;` +
        `max-width:${width}px !important;min-width:${width}px !important;}\n`;
    }
    return css;
  }

  function ensureStyleNode() {
    let st = document.getElementById(STYLE_ID);
    if (!st) {
      st = document.createElement("style");
      st.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(st);
    }
    return st;
  }

  function apply() {
    const table = getTable();
    const css = table ? buildCss(table) : "";
    const st = ensureStyleNode();
    if (st.textContent !== css) st.textContent = css; // idempotent: avoids loops
  }

  /* --- config loading ----------------------------------------------------- */
  function loadConfig(cb) {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      config = (res && res[STORAGE_KEY]) || {};
      if (cb) cb();
    });
  }

  /* --- reactivity --------------------------------------------------------- */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      config = changes[STORAGE_KEY].newValue || {};
      apply();
    }
  });

  (function patchHistory() {
    const fire = () => window.dispatchEvent(new Event("halo-locationchange"));
    for (const m of ["pushState", "replaceState"]) {
      const orig = history[m];
      history[m] = function () {
        const r = orig.apply(this, arguments);
        fire();
        return r;
      };
    }
    window.addEventListener("popstate", fire);
    window.addEventListener("hashchange", fire);
  })();
  window.addEventListener("halo-locationchange", () => {
    apply();
    setTimeout(apply, 300);
  });

  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      apply();
    }, 200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  /* --- popup messaging ---------------------------------------------------- */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === "getListInfo") {
      const key = getListKey();
      const table = getTable();
      sendResponse({
        key,
        title: document.title || "",
        columns: getColumnNames(table).filter(Boolean),
        listWidths: (key && config[key]) || {},
        globalWidths: config[GLOBAL_KEY] || {},
      });
      return true;
    }
    if (msg.type === "apply") {
      apply();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  /* --- boot --------------------------------------------------------------- */
  // v1.1: per-list keying (viewid:selid) + global scope
  loadConfig(apply);
})();
