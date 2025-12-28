import { createPaths } from '../paths.js';
import { createAudioController } from './audio.js';
import { createAppRegistry } from './apps.js';
import { createDataController } from './data.js';
import { createLeds } from './leds.js';
import { createMenuController } from './menu.js';
import { createStorage } from './storage.js';

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
} = {}) {
  const RELOAD_MENU_POKEDEX = 137;
  const AUTO_REFRESH_INTERVAL_MS = Number.isFinite(config.autoRefreshIntervalMs)
    ? config.autoRefreshIntervalMs
    : 120000;
  const AUDIO_LOAD_TIMEOUT = 8000;

  let autoRefreshTimer = null;
  let autoRefreshInFlight = false;
  let isPoweredOn = true;
  let powerTimer = null;
  let suppressClick = false;
  let ignoreNextClickAfterPowerOff = false;
  let introActive = false;

  const paths = createPaths(config);
  const leds = createLeds(ledEls);
  const storage = createStorage();

  const dispatchDataUpdated = (payload) => {
    window.dispatchEvent(new CustomEvent('dexos:data:updated', { detail: payload }));
  };

  const data = createDataController({ config, dataUrl, dispatchDataUpdated });
  const apps = createAppRegistry();
  const audio = createAudioController({
    setLed: leds.set,
    flashLedTimes: leds.flashTimes,
    loadTimeout: AUDIO_LOAD_TIMEOUT,
  });

  const setCoverState = (active) => {
    coverLeftEl?.classList.toggle('active', !!active);
    coverRightEl?.classList.toggle('active', !!active);
    coverLeftEl?.setAttribute('aria-hidden', active ? 'false' : 'true');
    coverRightEl?.setAttribute('aria-hidden', active ? 'false' : 'true');
  };

  const menu = createMenuController({
    menuOverlayLeftEl,
    menuOverlayRightEl,
    menuButtonEl,
    menuItems,
    paths,
    canToggle: () => isPoweredOn && !introActive,
  });

  const clearAutoRefresh = () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  };

  const runAutoRefresh = () => {
    if (!isPoweredOn || autoRefreshInFlight) return;
    autoRefreshInFlight = true;
    data
      .loadPokemon({ cacheBust: Date.now().toString(), source: 'auto' })
      .catch(() => {})
      .finally(() => {
        autoRefreshInFlight = false;
      });
  };

  const startAutoRefresh = () => {
    clearAutoRefresh();
    if (!AUTO_REFRESH_INTERVAL_MS || AUTO_REFRESH_INTERVAL_MS <= 0) return;
    autoRefreshTimer = setInterval(runAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
  };

  menu.wireReload(() => {
    data.loadPokemon({ cacheBust: Date.now().toString(), source: 'reload' }).catch(() => {
      window.location.reload();
    });
  }, RELOAD_MENU_POKEDEX);

  const runIntro = async ({ reveal = true } = {}) => {
    if (!isPoweredOn) return;
    introActive = true;
    setCoverState(true);
    leds.set(0, false);
    leds.set(1, false);
    leds.set(2, false);

    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!isPoweredOn) return;
    leds.set(0, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    leds.set(0, false);
    leds.set(1, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    leds.set(1, false);
    leds.set(2, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    leds.set(2, false);

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

  const setPowerState = async (nextState) => {
    if (isPoweredOn === nextState) return;
    isPoweredOn = nextState;
    if (!isPoweredOn) {
      introActive = false;
      menu.hideMenu();
      contentEl?.classList.add('screen-off');
      audio.destroy();
      leds.clearAll();
      apps.destroy();
      return;
    }

    contentEl?.classList.remove('screen-off');
    await runIntro({ reveal: false });
    await apps.startDefault();
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

  const onMenuButtonClick = (event) => {
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
    menu.toggleMenu();
  };

  menuButtonEl?.addEventListener('click', onMenuButtonClick);
  menuButtonEl?.addEventListener('mousedown', onPowerPress);
  menuButtonEl?.addEventListener('touchstart', onPowerPress);
  menuButtonEl?.addEventListener('mouseup', onPowerRelease);
  menuButtonEl?.addEventListener('mouseleave', onPowerRelease);
  menuButtonEl?.addEventListener('touchend', onPowerRelease);
  menuButtonEl?.addEventListener('touchcancel', onPowerRelease);

  const boot = async ({ cacheBust, source = 'init' } = {}) => {
    await runIntro({ reveal: false });
    await data.loadPokemon({ cacheBust, source });
    await apps.startDefault();
    finishIntro();
    startAutoRefresh();
  };

  const destroy = () => {
    apps.destroy();
    menuButtonEl?.removeEventListener('click', onMenuButtonClick);
    menuButtonEl?.removeEventListener('mousedown', onPowerPress);
    menuButtonEl?.removeEventListener('touchstart', onPowerPress);
    menuButtonEl?.removeEventListener('mouseup', onPowerRelease);
    menuButtonEl?.removeEventListener('mouseleave', onPowerRelease);
    menuButtonEl?.removeEventListener('touchend', onPowerRelease);
    menuButtonEl?.removeEventListener('touchcancel', onPowerRelease);
    menu.destroy();
    clearAutoRefresh();
  };

  return {
    registerApp: apps.registerApp,
    start: apps.start,
    switchTo: apps.switchTo,
    setDefaultApp: apps.setDefaultApp,
    startDefault: apps.startDefault,
    boot,
    registerMenu: menu.registerMenu,
    hideMenu: menu.hideMenu,
    showMenu: menu.showMenu,
    clearMenu: menu.clearMenu,
    loadPokemon: data.loadPokemon,
    getPokemon: data.getPokemon,
    getTypeInfo: data.getTypeInfo,
    getMoveInfo: data.getMoveInfo,
    audio: {
      get: audio.get,
      preload: audio.preload,
      play: audio.play,
    },
    leds: {
      set: leds.set,
      pulse: leds.pulse,
    },
    storage,
    power: {
      on: () => setPowerState(true),
      off: () => setPowerState(false),
      isOn: () => isPoweredOn,
    },
    startAutoRefresh,
    stopAutoRefresh: clearAutoRefresh,
    destroy,
  };
}
