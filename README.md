# GRIDLOCK — Halo Column Control

A Chrome (MV3) extension that **locks Halo PSA service desk column widths to exact pixels** — per list or globally. It beats the react-table v6 auto-width bug where columns refuse to hold a narrow width (`flex-grow` + `flex-shrink:0` forces them to balloon to fill the table).

It works by injecting a stylesheet that overrides react-table's inline `flex`/`width` on the columns you choose. Widths reapply on sort, refresh, column reorder, and SPA navigation.

## Why CSS injection (not the Halo API)

This is a client-side rendering bug. The Halo API only sets the list's logical column config; it doesn't change how the front-end paints widths at runtime. Overriding the rendered CSS is the only thing that fixes it.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.
4. Pin **Gridlock** to the toolbar.

> After any reload/update of the extension, also refresh open Halo tabs — content scripts only inject on a fresh page load.

## Use

1. Open a Halo service desk list (URL contains `viewid=...&selid=...`).
2. Click the Gridlock icon — it lists the columns detected for that list.
3. Enter a px width for any column to pin it. Blank or `0` = Halo default.
4. **Save & Lock** — applies immediately and persists.
5. **Global toggle:** flip *Apply to all lists* to edit widths that apply to every list. Per-list widths override global for that list.
6. **Unpin all** clears the current scope (the list, or global).

## Scope model

- **Per-list** widths are keyed on `viewid:selid` (a single Halo list). This is the default, so lists are independent.
- **Global** widths live under one shared key and apply to every list, matched by column name.
- **Effective width** = global, with per-list pins layered on top.

## Files

- `manifest.json` — MV3 manifest, host-scoped to `https://*.halopsa.com/*`.
- `content.js` — detects the list (`viewid:selid`), reads column labels, injects/maintains the override stylesheet, answers popup queries.
- `popup.html` / `popup.js` — branded per-list/global width editor; saves to `chrome.storage.local` (key `haloColWidths`).
- `icons/` — extension icon set (16/32/48/128).

## How it targets columns

Columns are matched by their **header label** (e.g. `User`, `AI Generated Summary`), resolved to a `:nth-child` position at apply time, so reordering columns in Halo follows the label. Injected rule per pinned column:

```css
.ReactTable .rt-th:nth-child(N),
.ReactTable .rt-td:nth-child(N){
  flex:0 0 <W>px !important; width:<W>px !important;
  max-width:<W>px !important; min-width:<W>px !important;
}
```

## Notes / limits

- Scope is `*.halopsa.com` (Halo Cloud). For on-prem, add the domain to `host_permissions` and the content-script `matches` in `manifest.json`.
- Matching is by visible header text; two identically-labelled columns in one list would collide.
- This is a workaround. If Halo fixes the min-width calc upstream, uninstall it. Worth reporting to Halo support in parallel.
- Rename: change `name` in `manifest.json` if "Gridlock" isn't your style.
