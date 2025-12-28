export function createStorage() {
  const memory = new Map();
  const hasLocalStorage = (() => {
    try {
      const testKey = '__dexos_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  })();
  const backend = hasLocalStorage ? window.localStorage : null;

  const getRaw = (key) => {
    if (backend) return backend.getItem(key);
    return memory.has(key) ? memory.get(key) : null;
  };
  const setRaw = (key, value) => {
    if (backend) {
      backend.setItem(key, value);
    } else {
      memory.set(key, value);
    }
  };
  const removeRaw = (key) => {
    if (backend) {
      backend.removeItem(key);
    } else {
      memory.delete(key);
    }
  };
  const clearRaw = () => {
    if (backend) {
      backend.clear();
    } else {
      memory.clear();
    }
  };

  const get = (key, fallback = null) => {
    const raw = getRaw(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  const set = (key, value) => {
    let raw = value;
    if (typeof value !== 'string') {
      try {
        raw = JSON.stringify(value);
      } catch {
        raw = String(value);
      }
    }
    setRaw(key, raw);
  };

  return {
    get,
    set,
    remove: removeRaw,
    clear: clearRaw,
  };
}
