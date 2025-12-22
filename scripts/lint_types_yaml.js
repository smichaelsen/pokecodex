#!/usr/bin/env node
const path = require('path');
const { loadYAMLFile } = require('./lint_utils');

const ROOT = path.join(__dirname, '..');
const TYPES_FILE = path.join(ROOT, 'data', 'types.yml');

const errors = [];

function err(msg) {
  errors.push(msg);
}

const data = loadYAMLFile(TYPES_FILE);
if (!Array.isArray(data)) {
  err('types.yml must be a list');
} else {
  const seen = new Set();
  data.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      err(`types.yml entry ${idx + 1} must be an object`);
      return;
    }
    const slug = entry.slug;
    const name = entry.name && entry.name.de;
    const color = entry.color;
    const tts = entry.tts;
    if (!slug || typeof slug !== 'string') err(`types.yml entry ${idx + 1} missing slug`);
    if (slug && !/^[a-z0-9-]+$/.test(slug)) err(`types.yml entry ${idx + 1} invalid slug: ${slug}`);
    if (!name || typeof name !== 'string') err(`types.yml entry ${idx + 1} missing name.de`);
    if (!color || typeof color !== 'string') err(`types.yml entry ${idx + 1} missing color`);
    if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      err(`types.yml entry ${idx + 1} invalid color: ${color}`);
    }
    if (tts != null) {
      if (typeof tts !== 'object' || Array.isArray(tts)) err(`types.yml entry ${idx + 1} tts must be an object`);
      if (!tts?.de || typeof tts.de !== 'string') err(`types.yml entry ${idx + 1} missing tts.de`);
    }
    if (slug) {
      if (seen.has(slug)) err(`types.yml duplicate slug: ${slug}`);
      seen.add(slug);
    }
  });
}

if (errors.length) {
  console.error('Type lint failed:');
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}

console.log('Type lint OK.');
