/* Halo Column Adjuster (Gridlock) - popup */
(() => {
  "use strict";
  const STORAGE_KEY = "haloColWidths";
  const GLOBAL_KEY = "__global__";

  const metaEl = document.getElementById("meta");
  const emptyEl = document.getElementById("empty");
  const colsEl = document.getElementById("cols");
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");
  const clearBtn = document.getElementById("clear");
  const globalToggle = document.getElementById("globalToggle");

  let listKey = null;
  let columns = [];
  let listWidths = {};
  let globalWidths = {};
  let activeTabId = null;

  function scopeIsGlobal() { return globalToggle.checked; }
  function currentScopeKey() { return scopeIsGlobal() ? GLOBAL_KEY : listKey; }
  function currentScopeWidths() { return scopeIsGlobal() ? globalWidths : listWidths; }

  function setStatus(msg, ok) {
    statusEl.style.color = ok === false ? "#ff5a50" : "#36d399";
    statusEl.textContent = msg || "";
  }

  function showEmpty(text) {
    if (text) emptyEl.textContent = text;
    emptyEl.style.display = "block";
    saveBtn.disabled = clearBtn.disabled = true;
  }

  function fillInputs() {
    const w = currentScopeWidths();
    colsEl.querySelectorAll("input").forEach((inp) => {
      inp.value = w[inp.dataset.col] || "";
    });
  }

  function renderColumns() {
    colsEl.innerHTML = "";
    columns.forEach((name) => {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.textContent = name;
      label.title = name;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "20";
      input.placeholder = "auto";
      input.dataset.col = name;
      row.appendChild(label);
      row.appendChild(input);
      colsEl.appendChild(row);
    });
    fillInputs();
  }

  function render(info) {
    if (!info || (!info.key && !(info.columns && info.columns.length))) {
      metaEl.textContent = info && info.title ? info.title : "Not a Halo list page.";
      showEmpty();
      return;
    }
    listKey = info.key;
    columns = info.columns || [];
    listWidths = info.listWidths || {};
    globalWidths = info.globalWidths || {};

    const niceTitle = (info.title || "").replace(/^Tickets\s*>\s*/i, "");
    metaEl.innerHTML =
      "List: <b>" + escapeHtml(niceTitle || "(untitled)") + "</b><br>" +
      escapeHtml(listKey ? "key " + listKey : "no list id");

    if (!columns.length) {
      showEmpty("No columns detected. Make sure the table is visible, then reopen.");
      return;
    }
    renderColumns();
  }

  function gatherWidths() {
    const cfg = {};
    colsEl.querySelectorAll("input").forEach((inp) => {
      const w = parseInt(inp.value, 10);
      if (Number.isFinite(w) && w > 0) cfg[inp.dataset.col] = w;
    });
    return cfg;
  }

  function save(cfgForScope) {
    const key = currentScopeKey();
    if (!key) { setStatus("No list id to save under.", false); return; }
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const all = (res && res[STORAGE_KEY]) || {};
      if (cfgForScope && Object.keys(cfgForScope).length) all[key] = cfgForScope;
      else delete all[key];
      chrome.storage.local.set({ [STORAGE_KEY]: all }, () => {
        if (scopeIsGlobal()) globalWidths = cfgForScope || {};
        else listWidths = cfgForScope || {};
        setStatus(scopeIsGlobal() ? "Saved globally (all lists)." : "Saved for this list.", true);
        if (activeTabId != null) {
          chrome.tabs.sendMessage(activeTabId, { type: "apply" }, () => void chrome.runtime.lastError);
        }
      });
    });
  }

  saveBtn.addEventListener("click", () => save(gatherWidths()));
  clearBtn.addEventListener("click", () => {
    colsEl.querySelectorAll("input").forEach((i) => (i.value = ""));
    save({});
  });
  globalToggle.addEventListener("change", () => { fillInputs(); setStatus(""); });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Ask the content script in the active tab for the current list's columns.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) { render(null); return; }
    activeTabId = tab.id;
    chrome.tabs.sendMessage(tab.id, { type: "getListInfo" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        metaEl.textContent = "Open a Halo (*.halopsa.com) list tab and refresh it, then reopen this popup.";
        showEmpty();
        return;
      }
      render(resp);
    });
  });
})();
