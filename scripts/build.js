#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

function parseScalar(value) {
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!Number.isNaN(Number(value)) && value.trim() !== '') {
    return Number(value);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseYAML(text) {
  const lines = text.split(/\r?\n/);
  const stack = [{ indent: -1, value: null, ref: null, key: null }];

  const splitOnce = (str, sep) => {
    const idx = str.indexOf(sep);
    if (idx === -1) return [str];
    return [str.slice(0, idx), str.slice(idx + sep.length)];
  };

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const indent = rawLine.match(/^ */)[0].length;
    const content = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];

    if (content.startsWith('- ')) {
      const valueStr = content.slice(2);

      if (!Array.isArray(parent.value)) {
        if (parent.ref && parent.key !== null && Object.keys(parent.value || {}).length === 0) {
          parent.ref[parent.key] = [];
          parent.value = parent.ref[parent.key];
        } else if (parent.value == null) {
          parent.value = [];
          if (parent.ref && parent.key !== null) {
            parent.ref[parent.key] = parent.value;
          }
        } else if (!Array.isArray(parent.value)) {
          parent.value = parent.value || [];
        }
      }

      if (valueStr === '') {
        const obj = {};
        parent.value.push(obj);
        stack.push({ indent, value: obj, ref: parent.value, key: parent.value.length - 1 });
      } else if (valueStr.includes(':')) {
        const [key, rest] = splitOnce(valueStr, ':');
        const obj = {};
        obj[key.trim()] = parseScalar(rest.trim());
        parent.value.push(obj);
        stack.push({ indent, value: obj, ref: parent.value, key: parent.value.length - 1 });
      } else {
        parent.value.push(parseScalar(valueStr));
      }
    } else {
      const [keyRaw, restRaw] = splitOnce(content, ':');
      const key = keyRaw.trim();
      const rest = restRaw === undefined ? '' : restRaw.trim();

      if (rest === '') {
        if (parent.value == null) parent.value = {};
        if (parent.ref && parent.key !== null && parent.value !== parent.ref[parent.key]) {
          parent.ref[parent.key] = parent.value;
        }
        parent.value[key] = {};
        stack.push({ indent, value: parent.value[key], ref: parent.value, key });
      } else {
        if (parent.value == null) parent.value = {};
        parent.value[key] = parseScalar(rest);
      }
    }
  }

  return stack[0].value;
}

function loadYAMLFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parseYAML(text);
}

function loadTypes() {
  const file = path.join(DATA_DIR, 'types.yml');
  return loadYAMLFile(file) || [];
}

function loadMoves() {
  const file = path.join(DATA_DIR, 'moves.yml');
  if (!fs.existsSync(file)) return [];
  return loadYAMLFile(file) || [];
}

function loadPokemon() {
  const dir = path.join(DATA_DIR, 'pokemon');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml'));
  const entries = files.map((file) => {
    const data = loadYAMLFile(path.join(dir, file));
    return data;
  });
  return entries.sort((a, b) => (a.id || 0) - (b.id || 0));
}

function padPokemonList(list) {
  if (!list.length) return [];
  const maxId = Math.max(...list.map((p) => p.id || 0));
  const map = new Map(list.map((p) => [p.id, p]));
  const padded = [];
  for (let i = 1; i <= maxId; i += 1) {
    if (map.has(i)) {
      padded.push(map.get(i));
    } else {
      padded.push({ id: i, placeholder: true });
    }
  }
  return padded;
}

function toDexNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return null;
}

function resolveEvolutionEntry(entry, nameById) {
  if (entry == null) return null;
  let target = entry;
  let condition = null;
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    if ('target' in entry) target = entry.target;
    condition = entry.condition || null;
  }
  const targetId = toDexNumber(target);
  const targetInfo = targetId && nameById.has(targetId) ? nameById.get(targetId) : null;
  const targetName = targetInfo ? targetInfo.name : '???';
  const resolved = { target_id: targetId, target_name: targetName };
  if (targetInfo?.slug) resolved.target_slug = targetInfo.slug;
  if (condition) resolved.condition = condition;
  return resolved;
}

function resolvePokemonRelations(list, nameById) {
  return list.map((p) => {
    if (!p || p.placeholder) return p;
    const evolvesFromId = toDexNumber(p.evolves_from);
    const evolvesFromInfo = evolvesFromId && nameById.has(evolvesFromId) ? nameById.get(evolvesFromId) : null;
    const evolvesFromName = evolvesFromInfo ? evolvesFromInfo.name : '???';
    const evolutions = (p.evolutions || [])
      .map((e) => resolveEvolutionEntry(e, nameById))
      .filter(Boolean);
    return {
      ...p,
      evolves_from_name: evolvesFromId ? evolvesFromName : undefined,
      evolves_from_slug: evolvesFromInfo?.slug,
      evolutions,
    };
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJSON(outPath, data) {
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
}

function runFetchScripts() {
  const scriptsDir = path.join(ROOT, 'scripts');
  const scripts = ['fetch_sprites.sh', 'fetch_chimes.sh'];
  scripts.forEach((script) => {
    const scriptPath = path.join(scriptsDir, script);
    if (!fs.existsSync(scriptPath)) {
      console.warn(`[build] Skip ${script} (missing)`);
      return;
    }
    execSync(`bash ${scriptPath}`, { stdio: 'inherit' });
  });
}

function copyPublic() {
  if (!fs.existsSync(PUBLIC_DIR)) return;
  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(PUBLIC_DIR, entry.name);
    const dest = path.join(OUT_DIR, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

function buildAudioVersions() {
  const versions = {
    chimes: {},
    names: {},
    types: {},
    moves: {},
  };

  const chimeDir = path.join(PUBLIC_DIR, 'audio', 'chimes');
  const nameDir = path.join(PUBLIC_DIR, 'audio', 'de', 'pokemon');
  const typeDir = path.join(PUBLIC_DIR, 'audio', 'de', 'types');
  const moveDir = path.join(PUBLIC_DIR, 'audio', 'de', 'moves');

  if (fs.existsSync(chimeDir)) {
    fs.readdirSync(chimeDir)
      .filter((file) => file.endsWith('.ogg'))
      .forEach((file) => {
        const id = file.replace(/\.ogg$/, '');
        const stat = fs.statSync(path.join(chimeDir, file));
        versions.chimes[id] = Math.floor(stat.mtimeMs);
      });
  }

  if (fs.existsSync(nameDir)) {
    fs.readdirSync(nameDir)
      .filter((file) => file.endsWith('.mp3'))
      .forEach((file) => {
        const id = file.replace(/\.mp3$/, '');
        const stat = fs.statSync(path.join(nameDir, file));
        versions.names[id] = Math.floor(stat.mtimeMs);
      });
  }

  if (fs.existsSync(typeDir)) {
    fs.readdirSync(typeDir)
      .filter((file) => file.endsWith('.mp3'))
      .forEach((file) => {
        const key = file.replace(/\.mp3$/, '');
        const stat = fs.statSync(path.join(typeDir, file));
        versions.types[key] = Math.floor(stat.mtimeMs);
      });
  }

  if (fs.existsSync(moveDir)) {
    fs.readdirSync(moveDir)
      .filter((file) => file.endsWith('.mp3'))
      .forEach((file) => {
        const key = file.replace(/\.mp3$/, '');
        const stat = fs.statSync(path.join(moveDir, file));
        versions.moves[key] = Math.floor(stat.mtimeMs);
      });
  }

  return versions;
}

function buildHtml(pokemon, types, moves, assetVersion, audioVersions) {
  const typeInfo = {};
  types.forEach((t) => {
    if (!t || !t.slug) return;
    const label = t.name?.de || t.name || t.slug;
    typeInfo[t.slug] = { name: label, color: t.color || '#ccc' };
  });

  const badgeCss = Object.entries(typeInfo)
    .map(([slug, info]) => `.type-${slug.replace(/\\s+/g, '-').toLowerCase()} { background: ${info.color}; color: #111; }`)
    .join('\\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Pokedex MVP</title>
  <style>
    :root {
      --bg: linear-gradient(135deg, #e53935 0%, #b71c1c 70%);
      --panel: #f7f7f7;
      --panel-dark: #ececec;
      --accent: #ffca28;
      --text: #1b1b1b;
      --muted: #6b6b6b;
      --border: #c62828;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      touch-action: manipulation;
    }
    .shell {
      width: min(1200px, 100%);
      background: linear-gradient(180deg, #ff5252 0%, #d32f2f 50%, #c62828 100%);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.25);
      border: 4px solid #7f0000;
      overflow: hidden;
      max-height: calc(100vh - 32px);
      touch-action: manipulation;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: rgba(0,0,0,0.08);
      color: #fff;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    header .lights {
      display: flex;
      gap: 10px;
    }
    .light {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #42a5f5;
      border: 2px solid #1565c0;
      box-shadow: 0 0 12px rgba(66,165,245,0.7);
    }
    .content {
      display: grid;
      grid-template-columns: 360px 1fr;
      min-height: 600px;
      background: #d50000;
      padding: 12px;
      gap: 12px;
      height: calc(100vh - 140px);
    }
    .panel {
      background: var(--panel);
      border-radius: 14px;
      border: 2px solid var(--border);
      box-shadow: inset 0 4px 0 rgba(255,255,255,0.7), inset 0 -4px 0 rgba(0,0,0,0.06);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .list-panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .controls {
      padding: 12px;
      background: var(--panel-dark);
      border-bottom: 2px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .controls input {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #c5c5c5;
      font-size: 14px;
      outline: none;
    }
    .list {
      overflow: auto;
      padding: 10px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
      flex: 1;
      min-height: 0;
    }
    .pager {
      padding: 12px;
      background: var(--panel-dark);
      border-top: 2px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pager button {
      font: inherit;
      font-weight: 700;
      border-radius: 12px;
      border: 2px solid var(--border);
      background: #fff;
      padding: 8px 10px;
      min-height: 48px;
      min-width: 48px;
      cursor: pointer;
    }
    .pager button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .pager .page-info {
      flex: 1;
      display: flex;
      align-items: center;
    }
    .pager .progress {
      position: relative;
      width: 100%;
      height: 14px;
      border-radius: 999px;
      background: linear-gradient(180deg, #1b1b1b, #2e2e2e);
      border: 2px solid #0f0f0f;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,0.06);
      overflow: hidden;
    }
    .pager .progress::before,
    .pager .progress::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff5252;
      box-shadow: 0 0 8px rgba(255,82,82,0.6);
      transform: translateY(-50%);
    }
    .pager .progress::before {
      left: 6px;
    }
    .pager .progress::after {
      right: 6px;
    }
    .pager .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6ff3ff, #42a5f5 40%, #ffee58 70%, #ff7043);
      box-shadow: 0 0 10px rgba(102,187,106,0.5);
      transition: width 0.25s ease;
    }
    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 10px;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 8px;
      align-items: center;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.08);
    }
    .card.placeholder {
      cursor: default;
      opacity: 0.6;
    }
    .card.placeholder:hover {
      transform: none;
      box-shadow: none;
    }
    .card .id {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.5px;
    }
    .card .name {
      font-weight: 700;
      margin: 4px 0 6px;
    }
    .badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .thumb {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid #ececec;
    }
    .thumb img {
      width: 90%;
      height: 90%;
      object-fit: contain;
    }
    .thumb.missing::after {
      content: '–';
      color: var(--muted);
      font-weight: 700;
    }
    .name.muted {
      color: var(--muted);
    }
    .badge {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      color: #111;
      background: #eee;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .detail {
      padding: 16px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7), transparent 35%), var(--panel);
      overflow: auto;
      position: relative;
    }
    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .detail .close {
      display: none;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--muted);
    }
    .detail-title {
      font-size: 24px;
      margin: 0;
    }
    .detail-title.clickable {
      cursor: pointer;
    }
    .detail-body {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .section {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      padding: 12px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.05);
    }
    .section h4 {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .art {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      padding: 12px;
      min-height: 260px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.05);
    }
    .art.clickable {
      cursor: pointer;
    }
    .art img {
      width: 100%;
      max-width: 320px;
      object-fit: contain;
    }
    .art.missing {
      color: var(--muted);
      font-style: italic;
    }
    .moves {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .move {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .move .meta {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .evo-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .evo-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .evo-link {
      font: inherit;
      text-align: left;
      cursor: pointer;
      width: 100%;
    }
    .evo-link:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }
    .evo-thumb {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid #ececec;
      flex: 0 0 auto;
    }
    .evo-thumb img {
      width: 90%;
      height: 90%;
      object-fit: contain;
    }
    .evo-thumb.missing::after {
      content: '–';
      color: var(--muted);
      font-weight: 700;
    }
    .evo-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .evo-meta .name {
      font-weight: 700;
    }
    .evo-meta .cond {
      color: var(--muted);
      font-size: 12px;
    }
    .empty {
      color: var(--muted);
      text-align: center;
      padding: 40px 16px;
    }
    .overlay {
      display: none;
    }
    @media (max-width: 960px) {
      .content { grid-template-columns: 1fr; height: calc(100vh - 140px); }
      .detail-body { grid-template-columns: 1fr; }
      .detail {
        position: fixed;
        inset: 12px;
        z-index: 20;
        display: none;
        max-height: calc(100vh - 24px);
      }
      .detail.active {
        display: grid;
      }
      .detail .close {
        display: inline-block;
      }
      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        backdrop-filter: blur(1px);
        z-index: 15;
      }
      .overlay.active { display: block; }
      .pager button {
        min-width: 56px;
        font-size: 20px;
      }
    }
    ${badgeCss}
  </style>
</head>
<body>
  <div class=\"shell\">
    <header>
      <div class=\"lights\"><div class=\"light\"></div><div class=\"light\" style=\"background:#66bb6a;border-color:#2e7d32;box-shadow:0 0 12px rgba(102,187,106,0.7)\"></div><div class=\"light\" style=\"background:#ffee58;border-color:#fbc02d;box-shadow:0 0 12px rgba(255,238,88,0.7)\"></div></div>
      <div>Pokédex – Kanto</div>
    </header>
    <div class=\"content\">
      <div class=\"panel list-panel\">
        <div class=\"list\" id=\"list\"></div>
        <div class=\"pager\">
          <button type=\"button\" id=\"page-prev\" aria-label=\"Vorherige Seite\">◀</button>
          <div class=\"page-info\" id=\"page-info\">
            <div class=\"progress\" role=\"progressbar\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"0\">
              <div class=\"progress-fill\" id=\"page-progress\"></div>
            </div>
          </div>
          <button type=\"button\" id=\"page-next\" aria-label=\"Nächste Seite\">▶</button>
        </div>
      </div>
      <div class=\"panel detail\" id=\"detail\">
        <div class=\"empty\">Wähle ein Pokémon aus der Liste aus.</div>
      </div>
    </div>
    <div class=\"overlay\" id=\"overlay\"></div>
  </div>
  <script>
    const state = { pokemon: [], types: ${JSON.stringify(typeInfo)} };
    const typeNames = ${JSON.stringify(types.map((t) => t?.slug).filter(Boolean))};
    const moveSlugs = ${JSON.stringify(moves.map((m) => m?.slug).filter(Boolean))};
    const audioVersions = ${JSON.stringify(audioVersions)};
    const assetVersion = '${assetVersion}';
    const listEl = document.getElementById('list');
    const detailEl = document.getElementById('detail');
  const pagePrevEl = document.getElementById('page-prev');
  const pageNextEl = document.getElementById('page-next');
  const pageInfoEl = document.getElementById('page-info');
  const pageProgressEl = document.getElementById('page-progress');

  const padId = (id) => id.toString().padStart(3, '0');
  const typeClass = (t) => 'type-' + (t || '').toLowerCase().replace(/\\s+/g, '-');
  const spritePath = (id) => 'assets/sprites/' + padId(id) + '.png?v=' + assetVersion;
  const chimePath = (id) => {
    const version = audioVersions?.chimes?.[id] || assetVersion;
    return 'audio/chimes/' + id + '.ogg?v=' + version;
  };
  const nameAudioPath = (id) => {
    const version = audioVersions?.names?.[id] || assetVersion;
    return 'audio/de/pokemon/' + id + '.mp3?v=' + version;
  };
  const typeAudioPath = (typeName) => {
    const version = audioVersions?.types?.[typeName] || assetVersion;
    return 'audio/de/types/' + typeName + '.mp3?v=' + version;
  };
  const moveAudioPath = (slug) => {
    const version = audioVersions?.moves?.[slug] || assetVersion;
    return 'audio/de/moves/' + slug + '.mp3?v=' + version;
  };
    const overlayEl = document.getElementById('overlay');
    const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
    const hideOverlay = () => {
      detailEl.classList.remove('active');
      overlayEl?.classList.remove('active');
    };
    const badgeHtml = (t) => {
      const info = state.types?.[t];
      const label = info?.name || t || 'Typ';
      const style = info?.color ? ' style=\"background:'+info.color+';color:#111;\"' : '';
      return '<span class=\"badge '+typeClass(t)+'\" data-type=\"'+t+'\"'+style+'>'+label+'</span>';
    };

  const pageSize = 12;

  const resetListScroll = () => {
    listEl.scrollTop = 0;
    if (listEl.parentElement) {
      listEl.parentElement.scrollTop = 0;
    }
  };

  function renderList(items) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    if (!items.length) {
      listEl.innerHTML = '<div class=\"empty\" style=\"grid-column:1/-1\">Keine Ergebnisse</div>';
    } else {
      listEl.innerHTML = paged.map((p) => {
        if (p.placeholder) {
          return '<div class=\"card placeholder\" data-placeholder=\"1\">' +
            '<div class=\"thumb missing\"></div>' +
            '<div>' +
              '<div class=\"id\">Nr. '+padId(p.id)+'</div>' +
              '<div class=\"name muted\">—</div>' +
              '<div class=\"badges\"></div>' +
            '</div>' +
          '</div>';
        }
        const img = spritePath(p.id);
        return '<div class=\"card\" data-slug=\"'+p.slug+'\">' +
          '<div class=\"thumb\"><img src=\"'+img+'\" alt=\"'+(p.name?.de || 'Sprite')+'\" loading=\"lazy\" onerror=\"this.parentElement.classList.add(\\'missing\\'); this.remove();\"></div>' +
          '<div>' +
            '<div class=\"id\">Nr. '+padId(p.id)+'</div>' +
            '<div class=\"name\">'+(p.name?.de || p.name || 'Unbekannt')+'</div>' +
          '</div>' +
        '</div>';
      }).join('');
      listEl.querySelectorAll('.card').forEach((el) => {
        if (el.dataset.placeholder) return;
        el.addEventListener('click', () => {
          const slug = el.getAttribute('data-slug');
          const found = state.pokemon.find((p) => p.slug === slug);
          if (found) showDetail(found);
        });
      });
    }

    if (pageInfoEl && pageProgressEl) {
      const progress = totalPages <= 1 ? 100 : Math.round(((state.page - 1) / (totalPages - 1)) * 100);
      pageProgressEl.style.width = progress + '%';
      pageInfoEl.querySelector('.progress')?.setAttribute('aria-valuenow', String(progress));
    }
    if (pagePrevEl) pagePrevEl.disabled = state.page <= 1;
    if (pageNextEl) pageNextEl.disabled = state.page >= totalPages;
  }

    function showDetail(p, opts = {}) {
      if (p.placeholder) {
        detailEl.innerHTML = '<div class=\"detail-header\"><h2 class=\"detail-title\">Nr. '+padId(p.id)+'</h2><div class=\"id\">Leer</div></div><div class=\"empty\">Keine Daten für diesen Eintrag.</div>';
        hideOverlay();
        return;
      }
      if (!opts.skipListSync) {
        const index = state.pokemon.findIndex((entry) => entry && entry.slug === p.slug);
        if (index >= 0) {
          const nextPage = Math.floor(index / pageSize) + 1;
          if (state.page !== nextPage) {
            state.page = nextPage;
            renderList(state.pokemon);
          }
          const card = listEl.querySelector('.card[data-slug=\"' + p.slug + '\"]');
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
      const img = spritePath(p.id);
      const typeBadges = (p.types || []).map((t) => badgeHtml(t)).join('');
      const chimeAudio = new Audio(chimePath(p.id));
      chimeAudio.preload = 'auto';
      chimeAudio.load();
      const nameAudio = new Audio(nameAudioPath(p.id));
      nameAudio.preload = 'auto';
      nameAudio.load();
      const evolvesFrom = p.evolves_from
        ? (() => {
            const fromName = p.evolves_from_name || '???';
            const hasFrom = fromName !== '???';
            const fromId = p.evolves_from;
            const thumb = hasFrom
              ? '<div class=\"evo-thumb\"><img src=\"'+spritePath(fromId)+'\" alt=\"'+fromName+'\" onerror=\"this.parentElement.classList.add(\\'missing\\'); this.remove();\"></div>'
              : '<div class=\"evo-thumb missing\"></div>';
            const meta = '<div class=\"evo-meta\"><div class=\"name\">'+fromName+' (#'+padId(fromId)+')</div></div>';
            if (hasFrom && p.evolves_from_slug) {
              return '<button class=\"evo-row evo-link\" data-slug=\"'+p.evolves_from_slug+'\">'+thumb+meta+'</button>';
            }
            return '<div class=\"evo-row\">'+thumb+meta+'</div>';
          })()
        : '';
      const evolutions = (p.evolutions || []).map((e) => {
        const targetName = e?.target_name || e?.target || e || '???';
        const targetId = e?.target_id ? e.target_id : null;
        const hasTarget = targetName !== '???' && targetId;
        const cond = hasTarget && e && e.condition ? e.condition : '';
        const thumb = hasTarget
          ? '<div class=\"evo-thumb\"><img src=\"'+spritePath(targetId)+'\" alt=\"'+targetName+'\" onerror=\"this.parentElement.classList.add(\\'missing\\'); this.remove();\"></div>'
          : '<div class=\"evo-thumb missing\"></div>';
        const meta = '<div class=\"evo-meta\"><div class=\"name\">'+targetName+(targetId ? ' (#'+padId(targetId)+')' : '')+'</div>'+
          (cond ? '<div class=\"cond\">'+cond+'</div>' : '')+'</div>';
        if (hasTarget && e?.target_slug) {
          return '<button class=\"evo-row evo-link\" data-slug=\"'+e.target_slug+'\">'+thumb+meta+'</button>';
        }
        return '<div class=\"evo-row\">'+thumb+meta+'</div>';
      }).join('');
      const evolutionHtml = (evolvesFrom || evolutions)
        ? '<div class=\"evo-list\">' +
            (evolvesFrom ? '<div class=\"evo-block\"><div class=\"meta\">Vorentwicklung</div>'+evolvesFrom+'</div>' : '') +
            (evolutions ? '<div class=\"evo-block\"><div class=\"meta\">Entwicklungen</div>'+evolutions+'</div>' : '') +
          '</div>'
        : '<div class=\"evo-list\"></div>';
      const move = p.signature_move_data;
      const moveBadge = move?.type ? badgeHtml(move.type) : '<span class=\"badge\">Typ</span>';
      const moveHtml = move
        ? '<div class=\"move\"><div><strong class=\"move-name\" data-move=\"'+(move.slug || '')+'\">'+(move.name?.de || 'Unbekannt')+'</strong><div class=\"meta\">'+(move.description?.de || '')+'</div></div><div class=\"meta\">'+moveBadge+'</div></div>'
        : '<div class=\"empty\">Keine Signaturattacke hinterlegt.</div>';
      const closeBtn = isMobile() ? '<button class=\"close\" aria-label=\"Schließen\">✕</button>' : '';
      detailEl.innerHTML = '<div class=\"detail-header\">'+closeBtn+'<h2 class=\"detail-title clickable\">'+(p.name?.de || 'Unbekannt')+'</h2><div class=\"id\">Nr. '+padId(p.id)+'</div></div>' +
        '<div class=\"detail-body\">' +
          '<div class=\"art clickable\"><img src=\"'+img+'\" alt=\"'+(p.name?.de || 'Illustration')+'\" onerror=\"this.parentElement.classList.add(\\'missing\\'); this.parentElement.textContent=\\'Kein Bild verfügbar\\';\"></div>' +
          '<div class=\"section\"><h4>Beschreibung</h4><p>'+(p.entry?.de || 'Keine Beschreibung')+'</p><div class=\"badges pokemon-types\" style=\"margin-top:8px\">'+typeBadges+'</div></div>' +
          '<div class=\"section\"><h4>Entwicklung</h4>'+evolutionHtml+'</div>' +
          '<div class=\"section\"><h4>Signaturattacke</h4><div class=\"moves\">'+moveHtml+'</div></div>' +
        '</div>';
      const btn = detailEl.querySelector('.close');
      if (btn) btn.addEventListener('click', hideOverlay);
      const titleEl = detailEl.querySelector('.detail-title');
      if (titleEl) {
        titleEl.addEventListener('click', () => {
          nameAudio.currentTime = 0;
          nameAudio.play().catch(() => {});
        });
      }
      const artEl = detailEl.querySelector('.art');
      if (artEl) {
        artEl.addEventListener('click', () => {
          chimeAudio.currentTime = 0;
          chimeAudio.play().catch(() => {});
        });
      }
      detailEl.querySelectorAll('.pokemon-types .badge[data-type]').forEach((el) => {
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          const typeName = el.getAttribute('data-type');
          if (!typeName) return;
          const audio = new Audio(typeAudioPath(typeName));
          audio.currentTime = 0;
          audio.play().catch(() => {});
        });
      });
      detailEl.querySelectorAll('.moves .badge[data-type]').forEach((el) => {
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          const typeName = el.getAttribute('data-type');
          if (!typeName) return;
          const audio = new Audio(typeAudioPath(typeName));
          audio.currentTime = 0;
          audio.play().catch(() => {});
        });
      });
      detailEl.querySelectorAll('.move-name[data-move]').forEach((el) => {
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          const slug = el.getAttribute('data-move');
          if (!slug) return;
          const audio = new Audio(moveAudioPath(slug));
          audio.currentTime = 0;
          audio.play().catch(() => {});
        });
      });
      detailEl.querySelectorAll('.evo-link').forEach((el) => {
        el.addEventListener('click', () => {
          const slug = el.getAttribute('data-slug');
          const found = state.pokemon.find((entry) => entry.slug === slug);
        if (found) showDetail(found);
      });
      });
      if (isMobile()) {
        detailEl.classList.add('active');
        overlayEl?.classList.add('active');
      } else {
        hideOverlay();
      }
    }

    async function boot() {
      const res = await fetch('data/pokemon.json?v=' + assetVersion);
      state.pokemon = await res.json();
      state.page = 1;
      renderList(state.pokemon);
      typeNames.forEach((typeName) => {
        const audio = new Audio(typeAudioPath(typeName));
        audio.preload = 'auto';
        audio.load();
      });
      moveSlugs.forEach((slug) => {
        const audio = new Audio(moveAudioPath(slug));
        audio.preload = 'auto';
        audio.load();
      });
      pagePrevEl?.addEventListener('click', () => {
        if (state.page > 1) {
          state.page -= 1;
          renderList(state.pokemon);
          resetListScroll();
        }
      });
      pageNextEl?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(state.pokemon.length / pageSize));
        if (state.page < totalPages) {
          state.page += 1;
          renderList(state.pokemon);
          resetListScroll();
        }
      });
      if (state.pokemon.length) {
        const firstReal = state.pokemon.find((p) => !p.placeholder);
        showDetail(firstReal || state.pokemon[0]);
      }
      overlayEl?.addEventListener('click', hideOverlay);
    }
    boot();
  </script>
</body>
</html>`;
}

function build() {
  runFetchScripts();
  const types = loadTypes();
  const moves = loadMoves();
  const pokemonRaw = loadPokemon();
  const pokemon = padPokemonList(pokemonRaw);
  const nameById = new Map(
    pokemonRaw
      .filter((p) => p && p.id)
      .map((p) => [p.id, { name: (p.name && p.name.de) || p.name || '???', slug: p.slug }])
  );
  const moveBySlug = new Map(moves.filter((m) => m && m.slug).map((m) => [m.slug, m]));
  const resolvedPokemon = resolvePokemonRelations(pokemon, nameById).map((p) => {
    if (!p || p.placeholder) return p;
    const move = p.signature_move ? moveBySlug.get(p.signature_move) : null;
    return {
      ...p,
      signature_move_data: move || null,
    };
  });
  const assetVersion = Date.now().toString();
  const audioVersions = buildAudioVersions();

  ensureDir(OUT_DIR);
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    const target = path.join(OUT_DIR, entry.name);
    fs.rmSync(target, { recursive: true, force: true });
  }
  ensureDir(path.join(OUT_DIR, 'data'));

  writeJSON(path.join(OUT_DIR, 'data', 'types.json'), types);
  writeJSON(path.join(OUT_DIR, 'data', 'pokemon.json'), resolvedPokemon);
  copyPublic();

  const html = buildHtml(resolvedPokemon, types, moves, assetVersion, audioVersions);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
  console.log('Build complete. Open dist/index.html');
}

build();
