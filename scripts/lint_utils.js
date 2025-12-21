const fs = require('fs');
const path = require('path');

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

function listYamlFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => path.join(dir, f));
}

module.exports = {
  loadYAMLFile,
  listYamlFiles,
};
