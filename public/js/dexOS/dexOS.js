export function createDexOS({
  menuButtonEl,
  menuOverlayLeftEl,
  menuOverlayRightEl,
  menuItems = {},
  config = {},
  dataUrl = 'data/pokemon.json',
}) {
  const apps = new Map();
  let currentApp = null;
  const menuListeners = new Map();
  let reloadListener = null;
  const state = {
    pokemon: [],
    typeInfo: config.typeInfo || {},
  };

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

  menuButtonEl?.addEventListener('click', toggleMenu);
  menuOverlayLeftEl?.addEventListener('click', onOverlayClick);
  menuOverlayRightEl?.addEventListener('click', onOverlayClick);

  const dispatchDataUpdated = (payload) => {
    window.dispatchEvent(new CustomEvent('dexos:data:updated', { detail: payload }));
  };

  const loadPokemon = async ({ cacheBust, source = 'load', keepPage = false } = {}) => {
    const version = cacheBust ?? config.assetVersion ?? Date.now().toString();
    const res = await fetch(`${dataUrl}?v=${version}`);
    if (!res.ok) throw new Error('Failed to load data');
    state.pokemon = await res.json();
    dispatchDataUpdated({ pokemon: state.pokemon, source, keepPage });
    return state.pokemon;
  };

  const getPokemon = () => state.pokemon;
  const getTypeInfo = () => state.typeInfo;
  const getMoveInfo = () => null;

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
      loadPokemon({ cacheBust: Date.now().toString(), source: 'reload', keepPage: true }).catch(() => {
        window.location.reload();
      });
    };
    menuItems.reload.addEventListener('click', reloadListener);
  }

  const registerApp = (id, factory) => {
    apps.set(id, factory);
  };

  const switchTo = async (id, ctx) => {
    if (currentApp?.destroy) currentApp.destroy();
    const factory = apps.get(id);
    if (!factory) throw new Error(`Unknown app: ${id}`);
    currentApp = await factory(ctx);
  };

  const start = (id, ctx) => switchTo(id, ctx);

  const destroy = () => {
    if (currentApp?.destroy) currentApp.destroy();
    menuButtonEl?.removeEventListener('click', toggleMenu);
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
    registerMenu,
    hideMenu,
    showMenu,
    clearMenu,
    loadPokemon,
    getPokemon,
    getTypeInfo,
    getMoveInfo,
    destroy,
  };
}
