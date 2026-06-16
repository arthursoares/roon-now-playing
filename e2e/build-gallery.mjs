#!/usr/bin/env node
/*
 * Build an interactive review gallery from the approval-matrix screenshots.
 *
 * Scans e2e/screenshots/matrix/<resolution>/<layout>__<background>.png and writes
 * a self-contained e2e/screenshots/matrix/gallery.html. Open it in a browser to
 * browse every frame, click the ones that need review to flag them, and copy the
 * exported list (layout / background @ resolution [+ note]) to hand back for fixes.
 *
 * Selections persist in localStorage. No dependencies — run AFTER the matrix:
 *   pnpm test:e2e:matrix && pnpm run review:gallery
 */
import { readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATRIX_DIR = join(__dirname, 'screenshots', 'matrix');

if (!existsSync(MATRIX_DIR)) {
  console.error(`error: no matrix screenshots at ${MATRIX_DIR} — run 'pnpm test:e2e:matrix' first.`);
  process.exit(1);
}

// { [resolution]: { [layout]: [{ bg, file }] } }
const data = {};
for (const res of readdirSync(MATRIX_DIR)) {
  const resDir = join(MATRIX_DIR, res);
  if (res === '_review' || !statSync(resDir).isDirectory()) continue;
  for (const f of readdirSync(resDir)) {
    const m = f.match(/^(.+?)__(.+)\.png$/);
    if (!m) continue;
    const [, layout, bg] = m;
    (data[res] ??= {});
    (data[res][layout] ??= []).push({ bg, file: `${res}/${f}` });
  }
}

const count = Object.values(data).reduce(
  (n, layouts) => n + Object.values(layouts).reduce((m, tiles) => m + tiles.length, 0),
  0,
);
if (count === 0) {
  console.error('error: no matrix frames found.');
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roon — Visual Review Gallery</title>
<style>
  :root {
    --bg-base:#0a0a0b; --bg-elevated:#111113; --bg-surface:#18181b;
    --border:#27272a; --text:#fafafa; --muted:#a1a1aa; --accent:#f59e0b; --flag:#ef4444;
    --font:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg-base); color:var(--text); font-family:var(--font); }
  header { position:sticky; top:0; z-index:10; background:var(--bg-elevated);
    border-bottom:1px solid var(--border); padding:14px 20px; display:flex;
    align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; font-weight:600; }
  header h1 span { color:var(--accent); }
  .tabs { display:flex; gap:6px; }
  .tab { background:var(--bg-surface); color:var(--muted); border:1px solid var(--border);
    border-radius:6px; padding:6px 12px; cursor:pointer; font:inherit; font-size:13px; }
  .tab.active { color:var(--text); border-color:var(--accent); }
  .spacer { flex:1; }
  .count { font-size:13px; color:var(--muted); }
  .count b { color:var(--flag); }
  button.action { background:var(--bg-surface); color:var(--text); border:1px solid var(--border);
    border-radius:6px; padding:6px 12px; cursor:pointer; font:inherit; font-size:13px; }
  button.action:hover { border-color:var(--accent); }
  main { padding:20px; }
  .layout-group { margin-bottom:28px; }
  .layout-group h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em;
    color:var(--muted); margin:0 0 12px; border-bottom:1px solid var(--border); padding-bottom:6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
  .tile { background:var(--bg-surface); border:2px solid var(--border); border-radius:10px;
    overflow:hidden; cursor:pointer; transition:border-color .12s, transform .12s; }
  .tile:hover { transform:translateY(-2px); }
  .tile img { width:100%; display:block; aspect-ratio:16/9; object-fit:cover; background:#000; }
  .tile .cap { padding:8px 10px; font-size:12px; color:var(--muted); display:flex;
    justify-content:space-between; align-items:center; gap:8px; }
  .tile .cap .bg { color:var(--text); }
  .tile.flagged { border-color:var(--flag); }
  .tile.flagged .cap { background:rgba(239,68,68,.12); }
  .tile.flagged .cap::after { content:'● needs review'; color:var(--flag); font-size:11px; white-space:nowrap; }
  .tile .note { display:none; width:100%; border:0; border-top:1px solid var(--border);
    background:var(--bg-elevated); color:var(--text); font:inherit; font-size:12px; padding:8px 10px; }
  .tile.flagged .note { display:block; }
  /* export drawer */
  #drawer { position:fixed; right:0; bottom:0; top:0; width:380px; max-width:90vw;
    background:var(--bg-elevated); border-left:1px solid var(--border); transform:translateX(100%);
    transition:transform .2s; display:flex; flex-direction:column; z-index:20; }
  #drawer.open { transform:translateX(0); }
  #drawer h3 { margin:0; padding:16px 18px; border-bottom:1px solid var(--border); font-size:14px; }
  #drawer textarea { flex:1; margin:14px 18px; background:var(--bg-base); color:var(--text);
    border:1px solid var(--border); border-radius:8px; padding:12px; font-family:ui-monospace,monospace;
    font-size:12px; resize:none; }
  #drawer .row { display:flex; gap:8px; padding:0 18px 18px; }
  #drawer .row button { flex:1; }
  .hint { color:var(--muted); font-size:12px; padding:0 18px 12px; }
  img.lightbox-active { position:fixed; inset:4vh 4vw; width:92vw; height:92vh; object-fit:contain;
    z-index:50; background:#000; cursor:zoom-out; aspect-ratio:auto; }
  #backdrop { display:none; position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:40; }
  #backdrop.show { display:block; }
</style>
</head>
<body>
<header>
  <h1>Roon · <span>Visual Review</span></h1>
  <div class="tabs" id="tabs"></div>
  <span class="spacer"></span>
  <span class="count"><b id="flagCount">0</b> flagged</span>
  <button class="action" id="openDrawer">Export ▸</button>
</header>
<main id="main"></main>

<div id="backdrop"></div>
<aside id="drawer">
  <h3>Flagged for review</h3>
  <p class="hint">Click a tile to flag it. Add an optional note. Copy this list back for fixes.</p>
  <textarea id="export" readonly></textarea>
  <div class="row">
    <button class="action" id="copyBtn">Copy</button>
    <button class="action" id="clearBtn">Clear all</button>
    <button class="action" id="closeDrawer">Close</button>
  </div>
</aside>

<script>
const DATA = ${JSON.stringify(data)};
const KEY = 'roon-matrix-flags-v1';
let flags = {}; // id -> note
try { flags = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) {}
const resolutions = Object.keys(DATA);
let active = resolutions[0];

const save = () => localStorage.setItem(KEY, JSON.stringify(flags));
const id = (res, layout, bg) => res + ' | ' + layout + ' | ' + bg;

function render() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  resolutions.forEach(res => {
    const b = document.createElement('button');
    b.className = 'tab' + (res === active ? ' active' : '');
    b.textContent = res;
    b.onclick = () => { active = res; render(); };
    tabs.appendChild(b);
  });

  const main = document.getElementById('main');
  main.innerHTML = '';
  const layouts = DATA[active];
  Object.keys(layouts).sort().forEach(layout => {
    const group = document.createElement('div');
    group.className = 'layout-group';
    const h = document.createElement('h2');
    h.textContent = layout;
    group.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'grid';
    layouts[layout].forEach(({ bg, file }) => {
      const theId = id(active, layout, bg);
      const flagged = theId in flags;
      const tile = document.createElement('div');
      tile.className = 'tile' + (flagged ? ' flagged' : '');
      tile.innerHTML =
        '<img src="' + file + '" loading="lazy" alt="' + layout + ' / ' + bg + '">' +
        '<div class="cap"><span class="bg">' + bg + '</span></div>' +
        '<input class="note" placeholder="note (optional)…" value="' +
          (flags[theId] || '').replace(/"/g, '&quot;') + '">';
      const img = tile.querySelector('img');
      img.onclick = (e) => { e.stopPropagation(); lightbox(file); };
      tile.querySelector('.cap').onclick = () => toggle(theId, tile);
      const note = tile.querySelector('.note');
      note.onclick = (e) => e.stopPropagation();
      note.oninput = () => { if (theId in flags) { flags[theId] = note.value; save(); updateExport(); } };
      grid.appendChild(tile);
    });
    group.appendChild(grid);
    main.appendChild(group);
  });
  updateExport();
}

function toggle(theId, tile) {
  if (theId in flags) { delete flags[theId]; tile.classList.remove('flagged'); }
  else { flags[theId] = tile.querySelector('.note').value || ''; tile.classList.add('flagged'); }
  save(); updateExport();
}

function updateExport() {
  document.getElementById('flagCount').textContent = Object.keys(flags).length;
  const lines = Object.keys(flags).sort().map(k => {
    const [res, layout, bg] = k.split(' | ');
    const note = flags[k] ? '  — ' + flags[k] : '';
    return layout + ' / ' + bg + ' @ ' + res + note;
  });
  document.getElementById('export').value = lines.join('\\n');
}

function lightbox(file) {
  const bd = document.getElementById('backdrop');
  const img = document.createElement('img');
  img.src = file; img.className = 'lightbox-active';
  img.onclick = () => { img.remove(); bd.classList.remove('show'); };
  bd.classList.add('show');
  bd.onclick = () => { img.remove(); bd.classList.remove('show'); };
  document.body.appendChild(img);
}

document.getElementById('openDrawer').onclick = () => document.getElementById('drawer').classList.add('open');
document.getElementById('closeDrawer').onclick = () => document.getElementById('drawer').classList.remove('open');
document.getElementById('copyBtn').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('export').value);
  const b = document.getElementById('copyBtn'); b.textContent = 'Copied ✓';
  setTimeout(() => b.textContent = 'Copy', 1200);
};
document.getElementById('clearBtn').onclick = () => {
  if (confirm('Clear all flags?')) { flags = {}; save(); render(); }
};
render();
</script>
</body>
</html>
`;

const out = join(MATRIX_DIR, 'gallery.html');
writeFileSync(out, html);
console.log(`Gallery: ${out} (${count} frames across ${Object.keys(data).length} resolutions)`);
console.log(`Open it in a browser:  open "${out}"`);
