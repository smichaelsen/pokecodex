export function createDexOS({
  menuButtonEl,
  menuOverlayLeftEl,
  menuOverlayRightEl,
  menuItems = {},
  ledEls = [],
  contentEl = null,
  coverLeftEl = null,
  coverRightEl = null,
  config = {},
  dataUrl = 'data/pokemon.json',
}) {
  const apps = new Map();
  let currentApp = null;
  let defaultApp = null;
  const menuListeners = new Map();
  let reloadListener = null;
  let isPoweredOn = true;
  let powerTimer = null;
  let suppressClick = false;
  let ignoreNextClickAfterPowerOff = false;
  let introActive = false;
  let audioLedTimer = null;
  const state = {
    pokemon: [],
    typeInfo: config.typeInfo || {},
  };
  const audioCache = new Map();
  const ledTimers = new Map();
  const audioActive = new Set();
  let defaultCtx = null;
  const storage = (() => {
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
  })();

  const hideMenu = () => {
    menuOverlayLeftEl?.classList.remove('active');
    menuOverlayRightEl?.classList.remove('active');
    menuOverlayLeftEl?.setAttribute('aria-hidden', 'true');
    menuOverlayRightEl?.setAttribute('aria-hidden', 'true');
    menuButtonEl?.setAttribute('aria-label', 'Menü öffnen');
  };

  const showMenu = () => {
    menuOverlayLeftEl?.classList.add('active');
    menuOverlayRightEl?.classList.add('active');
    menuOverlayLeftEl?.setAttribute('aria-hidden', 'false');
    menuOverlayRightEl?.setAttribute('aria-hidden', 'false');
    menuButtonEl?.setAttribute('aria-label', 'Menü schließen');
  };

  const toggleMenu = () => {
    if (!isPoweredOn || introActive) return;
    if (menuOverlayRightEl?.classList.contains('active')) {
      hideMenu();
    } else {
      showMenu();
    }
  };

  const onOverlayClick = (event) => {
    if (event.target === menuOverlayLeftEl || event.target === menuOverlayRightEl) {
      hideMenu();
    }
  };

  const setCoverState = (active) => {
    coverLeftEl?.classList.toggle('active', !!active);
    coverRightEl?.classList.toggle('active', !!active);
    coverLeftEl?.setAttribute('aria-hidden', active ? 'false' : 'true');
    coverRightEl?.setAttribute('aria-hidden', active ? 'false' : 'true');
  };

  const setPowerState = async (nextState) => {
    if (isPoweredOn === nextState) return;
    isPoweredOn = nextState;
    if (!isPoweredOn) {
      introActive = false;
      hideMenu();
      menuOverlayLeftEl?.classList.remove('active');
      menuOverlayRightEl?.classList.remove('active');
      menuOverlayLeftEl?.setAttribute('aria-hidden', 'true');
      menuOverlayRightEl?.setAttribute('aria-hidden', 'true');
      setCoverState(false);
      contentEl?.classList.add('screen-off');
      audioCache.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      audioActive.clear();
      updateAudioLed();
      if (audioLedTimer) {
        clearInterval(audioLedTimer);
        audioLedTimer = null;
      }
      ledTimers.forEach((timer) => clearInterval(timer));
      ledTimers.clear();
      ledEls.forEach((_, index) => setLed(index, false));
      if (currentApp?.destroy) currentApp.destroy();
      currentApp = null;
      return;
    }

    contentEl?.classList.remove('screen-off');
    await runIntro({ reveal: false });
    if (defaultApp) {
      await switchTo(defaultApp.id, defaultApp.ctx);
    }
    finishIntro();
  };

  const onPowerPress = () => {
    if (!menuButtonEl) return;
    if (powerTimer) clearTimeout(powerTimer);
    suppressClick = false;
    ignoreNextClickAfterPowerOff = false;
    powerTimer = setTimeout(() => {
      suppressClick = true;
      const nextState = !isPoweredOn;
      if (!nextState) ignoreNextClickAfterPowerOff = true;
      setPowerState(nextState);
    }, 5000);
  };

  const onPowerRelease = () => {
    if (powerTimer) {
      clearTimeout(powerTimer);
      powerTimer = null;
    }
  };

  menuButtonEl?.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      if (ignoreNextClickAfterPowerOff) {
        ignoreNextClickAfterPowerOff = false;
      }
      event.preventDefault();
      return;
    }
    if (ignoreNextClickAfterPowerOff) {
      ignoreNextClickAfterPowerOff = false;
      event.preventDefault();
      return;
    }
    if (introActive) return;
    if (!isPoweredOn) {
      setPowerState(true);
      return;
    }
    toggleMenu();
  });
  menuButtonEl?.addEventListener('mousedown', onPowerPress);
  menuButtonEl?.addEventListener('touchstart', onPowerPress);
  menuButtonEl?.addEventListener('mouseup', onPowerRelease);
  menuButtonEl?.addEventListener('mouseleave', onPowerRelease);
  menuButtonEl?.addEventListener('touchend', onPowerRelease);
  menuButtonEl?.addEventListener('touchcancel', onPowerRelease);
  menuOverlayLeftEl?.addEventListener('click', onOverlayClick);
  menuOverlayRightEl?.addEventListener('click', onOverlayClick);

  const dispatchDataUpdated = (payload) => {
    window.dispatchEvent(new CustomEvent('dexos:data:updated', { detail: payload }));
  };

  const loadPokemon = async ({ cacheBust, source = 'load' } = {}) => {
    const version = cacheBust ?? config.assetVersion ?? Date.now().toString();
    const res = await fetch(`${dataUrl}?v=${version}`);
    if (!res.ok) throw new Error('Failed to load data');
    state.pokemon = await res.json();
    dispatchDataUpdated({ pokemon: state.pokemon, source });
    return state.pokemon;
  };

  const getPokemon = () => state.pokemon;
  const getTypeInfo = () => state.typeInfo;
  const getMoveInfo = () => null;

  const getAudio = (url) => {
    if (!url) return null;
    const existing = audioCache.get(url);
    if (existing) return existing;
    const audio = new Audio(url);
    audio.addEventListener('ended', () => {
      audioActive.delete(url);
      updateAudioLed();
    });
    audio.addEventListener('pause', () => {
      if (audio.currentTime >= audio.duration) return;
      audioActive.delete(url);
      updateAudioLed();
    });
    audio.addEventListener('error', () => {
      audioActive.delete(url);
      updateAudioLed();
    });
    audioCache.set(url, audio);
    return audio;
  };

  const setLed = (index, state) => {
    const el = ledEls?.[index];
    if (!el) return;
    el.classList.toggle('active', !!state);
  };

  const pulseLed = (index, pattern = {}) => {
    const { interval = 400 } = pattern;
    const el = ledEls?.[index];
    if (!el) return () => {};
    const existing = ledTimers.get(index);
    if (existing) clearInterval(existing);
    let on = false;
    const timer = setInterval(() => {
      on = !on;
      setLed(index, on);
    }, interval);
    ledTimers.set(index, timer);
    return () => {
      clearInterval(timer);
      ledTimers.delete(index);
      setLed(index, false);
    };
  };

  const updateAudioLed = () => {
    const hasAudio = audioActive.size > 0;
    setLed(0, hasAudio);
  };

  const preloadAudio = (url) => {
    const audio = getAudio(url);
    if (!audio) return null;
    audio.preload = 'auto';
    audio.load();
    return audio;
  };

  const playAudio = (url) => {
    const audio = getAudio(url);
    if (!audio) return null;
    audioActive.add(url);
    updateAudioLed();
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return audio;
  };

  const clearMenu = () => {
    menuListeners.forEach((listener, id) => {
      menuItems[id]?.removeEventListener('click', listener);
    });
    menuListeners.clear();
  };

  const registerMenu = (handlers = {}) => {
    clearMenu();
    Object.entries(handlers).forEach(([id, handler]) => {
      if (id === 'reload') return;
      const el = menuItems[id];
      if (!el || typeof handler !== 'function') return;
      const listener = () => {
        hideMenu();
        handler();
      };
      menuListeners.set(id, listener);
      el.addEventListener('click', listener);
    });
  };

  if (menuItems.reload) {
    reloadListener = () => {
      hideMenu();
      loadPokemon({ cacheBust: Date.now().toString(), source: 'reload' }).catch(() => {
        window.location.reload();
      });
    };
    menuItems.reload.addEventListener('click', reloadListener);
  }

  const registerApp = (id, factory) => {
    apps.set(id, factory);
  };

  const setDefaultApp = (id, ctx) => {
    defaultApp = { id, ctx };
    defaultCtx = ctx;
  };

  const switchTo = async (id, ctx) => {
    if (currentApp?.destroy) currentApp.destroy();
    const factory = apps.get(id);
    if (!factory) throw new Error(`Unknown app: ${id}`);
    currentApp = await factory(ctx);
  };

  const start = (id, ctx) => switchTo(id, ctx);
  const startDefault = () => {
    if (!defaultApp) return Promise.resolve();
    return switchTo(defaultApp.id, defaultApp.ctx);
  };

  const runIntro = async ({ reveal = true } = {}) => {
    if (!isPoweredOn) return;
    introActive = true;
    setCoverState(true);
    setLed(0, false);
    setLed(1, false);
    setLed(2, false);

    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!isPoweredOn) return;
    setLed(0, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setLed(0, false);
    setLed(1, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setLed(1, false);
    setLed(2, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setLed(2, false);

    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!isPoweredOn) return;
    if (reveal) {
      setCoverState(false);
      introActive = false;
    }
  };

  const finishIntro = () => {
    if (!isPoweredOn) return;
    setCoverState(false);
    introActive = false;
  };

  const destroy = () => {
    if (currentApp?.destroy) currentApp.destroy();
    menuButtonEl?.removeEventListener('click', toggleMenu);
    menuButtonEl?.removeEventListener('mousedown', onPowerPress);
    menuButtonEl?.removeEventListener('touchstart', onPowerPress);
    menuButtonEl?.removeEventListener('mouseup', onPowerRelease);
    menuButtonEl?.removeEventListener('mouseleave', onPowerRelease);
    menuButtonEl?.removeEventListener('touchend', onPowerRelease);
    menuButtonEl?.removeEventListener('touchcancel', onPowerRelease);
    menuOverlayLeftEl?.removeEventListener('click', onOverlayClick);
    menuOverlayRightEl?.removeEventListener('click', onOverlayClick);
    clearMenu();
    if (reloadListener) {
      menuItems.reload?.removeEventListener('click', reloadListener);
      reloadListener = null;
    }
  };

  return {
    registerApp,
    start,
    switchTo,
    setDefaultApp,
    startDefault,
    boot: async ({ cacheBust, source = 'init' } = {}) => {
      await runIntro({ reveal: false });
      await loadPokemon({ cacheBust, source });
      await startDefault();
      finishIntro();
    },
    registerMenu,
    hideMenu,
    showMenu,
    clearMenu,
    loadPokemon,
    getPokemon,
    getTypeInfo,
    getMoveInfo,
    audio: {
      get: getAudio,
      preload: preloadAudio,
      play: playAudio,
    },
    leds: {
      set: setLed,
      pulse: pulseLed,
    },
    storage,
    power: {
      on: () => setPowerState(true),
      off: () => setPowerState(false),
      isOn: () => isPoweredOn,
    },
    destroy,
  };
}
