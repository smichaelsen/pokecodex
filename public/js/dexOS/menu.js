export function createMenuController({
  menuOverlayLeftEl,
  menuOverlayRightEl,
  menuButtonEl,
  menuItems = {},
  paths,
  canToggle,
} = {}) {
  const menuListeners = new Map();
  let reloadListener = null;

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
    if (typeof canToggle === 'function' && !canToggle()) return;
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

  menuOverlayLeftEl?.addEventListener('click', onOverlayClick);
  menuOverlayRightEl?.addEventListener('click', onOverlayClick);

  const setMenuIllustration = (el, pokedexNumber) => {
    if (!el || !Number.isFinite(pokedexNumber)) return;
    el.classList.add('menu-item--with-illustration');
    let img = el.querySelector('.menu-icon');
    if (!img) {
      img = document.createElement('img');
      img.className = 'menu-icon';
      img.setAttribute('aria-hidden', 'true');
      el.prepend(img);
    }
    img.src = paths.spritePath(pokedexNumber);
    img.alt = `Pokémon #${pokedexNumber}`;
  };

  const normalizeMenuEntry = (entry) => {
    if (typeof entry === 'function') return { handler: entry };
    if (!entry || typeof entry !== 'object') return {};
    const handler = entry.handler || entry.onSelect;
    const pokedexNumber = entry.pokedexNumber ?? entry.pokedexId;
    return { handler, pokedexNumber };
  };

  const requirePokedexNumber = (pokedexNumber, id) => {
    if (!Number.isInteger(pokedexNumber)) {
      throw new Error(`Menu item "${id}" requires a valid pokedexNumber`);
    }
    return pokedexNumber;
  };

  const clearMenu = () => {
    menuListeners.forEach((listener, id) => {
      menuItems[id]?.removeEventListener('click', listener);
    });
    menuListeners.clear();
  };

  const registerMenu = (handlers = {}) => {
    clearMenu();
    Object.entries(handlers).forEach(([id, entry]) => {
      if (id === 'reload') return;
      const el = menuItems[id];
      if (!el) return;
      const { handler, pokedexNumber } = normalizeMenuEntry(entry);
      if (typeof handler !== 'function') return;
      const requiredNumber = requirePokedexNumber(pokedexNumber, id);
      setMenuIllustration(el, requiredNumber);
      const listener = () => {
        hideMenu();
        handler();
      };
      menuListeners.set(id, listener);
      el.addEventListener('click', listener);
    });
  };

  const wireReload = (onReload, pokedexNumber) => {
    if (!menuItems.reload || typeof onReload !== 'function') return;
    setMenuIllustration(menuItems.reload, pokedexNumber);
    reloadListener = () => {
      hideMenu();
      onReload();
    };
    menuItems.reload.addEventListener('click', reloadListener);
  };

  const destroy = () => {
    clearMenu();
    if (reloadListener) {
      menuItems.reload?.removeEventListener('click', reloadListener);
      reloadListener = null;
    }
    menuOverlayLeftEl?.removeEventListener('click', onOverlayClick);
    menuOverlayRightEl?.removeEventListener('click', onOverlayClick);
  };

  return {
    hideMenu,
    showMenu,
    toggleMenu,
    registerMenu,
    clearMenu,
    destroy,
    wireReload,
    setMenuIllustration,
  };
}
