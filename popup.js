/* Halo Column Adjuster (Gridlock) - popup */
(() => {
  "use strict";
  const STORAGE_KEY = "haloColWidths";
  const GLOBAL_KEY = "__global__";

  const metaEl = document.getElementById("meta");
  const emptyEl = document.getElementById("empty");
  const legendEl = document.getElementById("legend");
  const colsEl = document.getElementById("cols");
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");
  const clearBtn = document.getElementById("clear");

  let listKey = null;
  let columns = [];
  let listWidths = {};   // per-list overrides for this list
  let globalWidths = {}; // shared across all lists
  let activeTabId = null;

  function setStatus(msg, ok) {
    statusEl.style.color = ok === false ? "#ff5a50" : "#36d399";
    statusEl.textContent = msg || "";
  }

  function showEmpty(text) {
    if (text) emptyEl.textContent = text;
    emptyEl.style.display = "block";
    legendEl.style.display = "none";
    saveBtn.disabled = clearBtn.disabled = true;
  }

  // Per column: per-list value wins for display; otherwise show the global value
  // with the Global box checked.
  function renderColumns() {
    legendEl.style.display = "flex";
    colsEl.innerHTML = "";
    columns.forEach((name) => {
      let value = "";
      let global = false;
      if (Object.prototype.hasOwnProperty.call(listWidths, name)) {
        value = listWidths[name];
      } else if (Object.prototype.hasOwnProperty.call(globalWidths, name)) {
        value = globalWidths[name];
        global = true;
      }

      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("label");
      label.className = "cname";
      label.textContent = name;
      label.title = name;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "20";
      input.placeholder = "auto";
      input.dataset.col = name;
      if (value) input.value = value;

      const gwrap = document.createElement("span");
      gwrap.className = "gwrap";
      const gbox = document.createElement("input");
      gbox.type = "checkbox";
      gbox.dataset.col = name;
      gbox.className = "gbox";
      gbox.checked = global;
      gbox.title = "Apply this column's width to all lists";
      gwrap.appendChild(gbox);

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(gwrap);
      colsEl.appendChild(row);
    });
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
      "List: <b>" + escapeHtml(niceTitle || "(untitled)") + "</b>";

    if (!columns.length) {
      showEmpty("No columns detected. Make sure the table is visible, then reopen.");
      return;
    }
    renderColumns();
  }

  // Build the next global + per-list config from the current inputs.
  function gather() {
    const nextGlobal = Object.assign({}, globalWidths);
    const nextList = Object.assign({}, listWidths);
    colsEl.querySelectorAll(".row").forEach((row) => {
      const input = row.querySelector('input[type=number]');
      const gbox = row.querySelector('.gbox');
      const col = input.dataset.col;
      const w = parseInt(input.value, 10);
      const isGlobal = gbox.checked;
      if (Number.isFinite(w) && w > 0) {
        if (isGlobal) { nextGlobal[col] = w; delete nextList[col]; }
        else { nextList[col] = w; }            // leave any global entry intact
      } else {
        if (isGlobal) { delete nextGlobal[col]; delete nextList[col]; }
        else { delete nextList[col]; }          // clearing a per-list override
      }
    });
    return { nextGlobal, nextList };
  }

  function persist(nextGlobal, nextList, okMsg) {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const all = (res && res[STORAGE_KEY]) || {};
      if (Object.keys(nextGlobal).length) all[GLOBAL_KEY] = nextGlobal;
      else delete all[GLOBAL_KEY];
      if (listKey) {
        if (Object.keys(nextList).length) all[listKey] = nextList;
        else delete all[listKey];
      }
      chrome.storage.local.set({ [STORAGE_KEY]: all }, () => {
        globalWidths = nextGlobal;
        listWidths = nextList;
        setStatus(okMsg || "Saved.", true);
        if (activeTabId != null) {
          chrome.tabs.sendMessage(activeTabId, { type: "apply" }, () => void chrome.runtime.lastError);
        }
        renderColumns();
      });
    });
  }

  saveBtn.addEventListener("click", () => {
    const { nextGlobal, nextList } = gather();
    persist(nextGlobal, nextList, "Saved & locked.");
  });

  // Reset this list = drop this list's per-list overrides; leave global widths.
  clearBtn.addEventListener("click", () => {
    persist(Object.assign({}, globalWidths), {}, "Per-list widths cleared for this list.");
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

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
