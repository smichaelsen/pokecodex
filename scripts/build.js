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
    descriptions: {},
    types: {},
    moves: {},
  };

  const chimeDir = path.join(PUBLIC_DIR, 'audio', 'chimes');
  const nameDir = path.join(PUBLIC_DIR, 'audio', 'de', 'pokemon');
  const descDir = path.join(PUBLIC_DIR, 'audio', 'de', 'descriptions');
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

  if (fs.existsSync(descDir)) {
    fs.readdirSync(descDir)
      .filter((file) => file.endsWith('.mp3'))
      .forEach((file) => {
        const id = file.replace(/\.mp3$/, '');
        const stat = fs.statSync(path.join(descDir, file));
        versions.descriptions[id] = Math.floor(stat.mtimeMs);
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

function buildTypeCss(types) {
  return (types || [])
    .filter((t) => t && t.slug && t.color)
    .map((t) => `.type-${t.slug.replace(/\\s+/g, '-').toLowerCase()} { background: ${t.color}; color: #111; }`)
    .join('\\n');
}

function loadHtmlTemplate() {
  const templatePath = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Missing HTML template at public/index.html');
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function renderHtmlTemplate(template, clientConfig, assetVersion) {
  const configJson = JSON.stringify(clientConfig);
  return template
    .replace(/__ASSET_VERSION__/g, assetVersion)
    .replace(/__POKEDEX_CONFIG_JSON__/g, configJson);
}

function buildHtml(template, pokemon, types, moves, assetVersion, audioVersions) {
  const typeInfo = {};
  types.forEach((t) => {
    if (!t || !t.slug) return;
    const label = t.name?.de || t.name || t.slug;
    typeInfo[t.slug] = { name: label, color: t.color || '#ccc' };
  });

  const clientConfig = {
    typeInfo,
    typeNames: types.map((t) => t?.slug).filter(Boolean),
    moveSlugs: moves.map((m) => m?.slug).filter(Boolean),
    audioVersions,
    assetVersion,
  };

  return renderHtmlTemplate(template, clientConfig, assetVersion);
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
  const htmlTemplate = loadHtmlTemplate();

  ensureDir(OUT_DIR);
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    const target = path.join(OUT_DIR, entry.name);
    fs.rmSync(target, { recursive: true, force: true });
  }
  ensureDir(path.join(OUT_DIR, 'data'));

  writeJSON(path.join(OUT_DIR, 'data', 'types.json'), types);
  writeJSON(path.join(OUT_DIR, 'data', 'pokemon.json'), resolvedPokemon);
  copyPublic();
  const typeCss = buildTypeCss(types);
  if (typeCss) {
    ensureDir(path.join(OUT_DIR, 'css'));
    fs.writeFileSync(path.join(OUT_DIR, 'css', 'types.css'), typeCss + '\n', 'utf8');
  }

  const html = buildHtml(htmlTemplate, resolvedPokemon, types, moves, assetVersion, audioVersions);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
  console.log('Build complete. Open dist/index.html');
}

build();
