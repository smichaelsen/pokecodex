export function createDexOS({
  menuButtonEl,
  menuOverlayLeftEl,
  menuOverlayRightEl,
  menuItems = {},
}) {
  const apps = new Map();
  let currentApp = null;
  const menuListeners = new Map();

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

  const clearMenu = () => {
    menuListeners.forEach((listener, id) => {
      menuItems[id]?.removeEventListener('click', listener);
    });
    menuListeners.clear();
  };

  const registerMenu = (handlers = {}) => {
    clearMenu();
    Object.entries(handlers).forEach(([id, handler]) => {
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
  };

  return {
    registerApp,
    start,
    switchTo,
    registerMenu,
    hideMenu,
    showMenu,
    clearMenu,
    destroy,
  };
}
