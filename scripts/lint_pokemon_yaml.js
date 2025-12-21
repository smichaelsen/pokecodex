#!/usr/bin/env node
const path = require('path');
const { loadYAMLFile, listYamlFiles } = require('./lint_utils');

const ROOT = path.join(__dirname, '..');
const POKEMON_DIR = path.join(ROOT, 'data', 'pokemon');
const MOVES_FILE = path.join(ROOT, 'data', 'moves.yml');
const TYPES_FILE = path.join(ROOT, 'data', 'types.yml');

const errors = [];

function err(msg) {
  errors.push(msg);
}

const moves = loadYAMLFile(MOVES_FILE) || [];
const moveSlugs = new Set(moves.map((m) => m && m.slug).filter(Boolean));
const types = loadYAMLFile(TYPES_FILE) || [];
const typeSlugs = new Set(types.map((t) => t && t.slug).filter(Boolean));

const files = listYamlFiles(POKEMON_DIR);
const byId = new Map();
const bySlug = new Set();

files.forEach((file) => {
  const data = loadYAMLFile(file);
  if (!data || typeof data !== 'object') {
    err(`${path.basename(file)} is not a valid object`);
    return;
  }
  const id = data.id;
  const slug = data.slug;
  const nameDe = data.name && data.name.de;
  const entryDe = data.entry && data.entry.de;
  const typesArr = data.types;
  const height = data.height_m;
  const weight = data.weight_kg;
  const signature = data.signature_move;
  const evolvesFrom = data.evolves_from;
  const evolutions = data.evolutions;

  const base = path.basename(file);
  if (typeof id !== 'number' || Number.isNaN(id)) err(`${base} invalid id`);
  if (!slug || typeof slug !== 'string') err(`${base} missing slug`);
  if (!nameDe || typeof nameDe !== 'string') err(`${base} missing name.de`);
  if (!entryDe || typeof entryDe !== 'string') err(`${base} missing entry.de`);
  if (!Array.isArray(typesArr) || typesArr.length === 0) err(`${base} missing types`);
  if (typeof height !== 'number' || Number.isNaN(height)) err(`${base} invalid height_m`);
  if (typeof weight !== 'number' || Number.isNaN(weight)) err(`${base} invalid weight_kg`);
  if (!signature || typeof signature !== 'string') err(`${base} missing signature_move`);
  if (signature && !moveSlugs.has(signature)) err(`${base} unknown signature_move: ${signature}`);

  if (Array.isArray(typesArr)) {
    typesArr.forEach((t) => {
      if (!typeSlugs.has(t)) err(`${base} unknown type slug: ${t}`);
    });
  }

  if (evolvesFrom != null && (typeof evolvesFrom !== 'number' || Number.isNaN(evolvesFrom))) {
    err(`${base} invalid evolves_from`);
  }

  if (!Array.isArray(evolutions)) {
    err(`${base} evolutions must be an array`);
  } else {
    evolutions.forEach((e, idx) => {
      if (!e || typeof e !== 'object') {
        err(`${base} evolutions[${idx}] must be object`);
        return;
      }
      const target = e.target;
      const condition = e.condition;
      if (typeof target !== 'number' || Number.isNaN(target)) {
        err(`${base} evolutions[${idx}] invalid target`);
      }
      if (!condition || typeof condition !== 'string') {
        err(`${base} evolutions[${idx}] missing condition`);
      }
    });
  }

  if (id && slug) {
    const expected = `${String(id).padStart(3, '0')}_${slug}.yml`;
    if (base !== expected) err(`${base} filename mismatch (expected ${expected})`);
    if (byId.has(id)) err(`${base} duplicate id ${id}`);
    byId.set(id, base);
    if (bySlug.has(slug)) err(`${base} duplicate slug ${slug}`);
    bySlug.add(slug);
  }
});

// evolves_from may be unresolved; no lint error on missing target

if (errors.length) {
  console.error('Pokemon lint failed:');
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}

console.log('Pokemon lint OK.');
