#!/usr/bin/env node
const path = require('path');
const { loadYAMLFile } = require('./lint_utils');

const ROOT = path.join(__dirname, '..');
const MOVES_FILE = path.join(ROOT, 'data', 'moves.yml');
const TYPES_FILE = path.join(ROOT, 'data', 'types.yml');

const errors = [];

function err(msg) {
  errors.push(msg);
}

const moves = loadYAMLFile(MOVES_FILE);
const types = loadYAMLFile(TYPES_FILE) || [];
const typeSlugs = new Set(types.map((t) => t && t.slug).filter(Boolean));

if (!Array.isArray(moves)) {
  err('moves.yml must be a list');
} else {
  const seen = new Set();
  moves.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      err(`moves.yml entry ${idx + 1} must be an object`);
      return;
    }
    const slug = entry.slug;
    const nameDe = entry.name && entry.name.de;
    const nameEn = entry.name && entry.name.en;
    const type = entry.type;
    const power = entry.power;
    const descDe = entry.description && entry.description.de;
    const tts = entry.tts;

    if (!slug || typeof slug !== 'string') err(`moves.yml entry ${idx + 1} missing slug`);
    if (slug && !/^[a-z0-9-]+$/.test(slug)) err(`moves.yml entry ${idx + 1} invalid slug: ${slug}`);
    if (!nameDe || typeof nameDe !== 'string') err(`moves.yml entry ${idx + 1} missing name.de`);
    if (!nameEn || typeof nameEn !== 'string') err(`moves.yml entry ${idx + 1} missing name.en`);
    if (!type || typeof type !== 'string') err(`moves.yml entry ${idx + 1} missing type`);
    if (type && !typeSlugs.has(type)) err(`moves.yml entry ${idx + 1} unknown type: ${type}`);
    if (typeof power !== 'number' || Number.isNaN(power) || power < 0) err(`moves.yml entry ${idx + 1} invalid power`);
    if (!descDe || typeof descDe !== 'string') err(`moves.yml entry ${idx + 1} missing description.de`);
    if (tts != null) {
      if (typeof tts !== 'object' || Array.isArray(tts)) err(`moves.yml entry ${idx + 1} tts must be an object`);
      if (!tts?.de || typeof tts.de !== 'string') err(`moves.yml entry ${idx + 1} missing tts.de`);
    }

    if (slug) {
      if (seen.has(slug)) err(`moves.yml duplicate slug: ${slug}`);
      seen.add(slug);
    }
  });
}

if (errors.length) {
  console.error('Move lint failed:');
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}

console.log('Move lint OK.');
