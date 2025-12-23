const config = window.__POKEDEX_CONFIG__ || {};
const moduleVersion = config.assetVersion ? `?v=${config.assetVersion}` : '';

const listEl = document.getElementById('list');
const detailPanelEl = document.getElementById('detail');
const detailContentEl = document.getElementById('detail-content') || detailPanelEl;
const pagePrevEl = document.getElementById('page-prev');
const pageNextEl = document.getElementById('page-next');
const pageInfoEl = document.getElementById('page-info');
const pageProgressEl = document.getElementById('page-progress');
const overlayEl = document.getElementById('overlay');
const menuButtonEl = document.getElementById('menu-button');
const menuOverlayLeftEl = document.getElementById('menu-overlay-left');
const menuOverlayRightEl = document.getElementById('menu-overlay-right');
const menuReloadEl = document.getElementById('menu-reload');
const ledEls = Array.from(document.querySelectorAll('header .light'));
const contentEl = document.querySelector('.content');
const coverLeftEl = document.getElementById('screen-cover-left');
const coverRightEl = document.getElementById('screen-cover-right');

const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
const hideOverlay = () => {
  detailPanelEl?.classList.remove('active');
  overlayEl?.classList.remove('active');
};

async function boot() {
  const [{ createDexOS }, { createPokedexApp }] = await Promise.all([
    import(`./dexOS/dexOS.js${moduleVersion}`),
    import(`./apps/pokedexApp/pokedexApp.js${moduleVersion}`),
  ]);
  const host = createDexOS({
    menuButtonEl,
    menuOverlayLeftEl,
    menuOverlayRightEl,
    menuItems: {
      reload: menuReloadEl,
    },
    ledEls,
    contentEl,
    coverLeftEl,
    coverRightEl,
    config,
  });
  const ctx = {
    config,
    moduleVersion,
    elements: {
      listEl,
      detailPanelEl,
      detailContentEl,
      pagePrevEl,
      pageNextEl,
      pageInfoEl,
      pageProgressEl,
      overlayEl,
    },
    isMobile,
    hideOverlay,
    host,
  };

  host.registerApp('pokedex', createPokedexApp);
  host.setDefaultApp?.('pokedex', ctx);
  try {
    if (typeof host.boot === 'function') {
      await host.boot({ cacheBust: config.assetVersion || Date.now().toString(), source: 'init' });
    } else {
      await host.startIntro?.({ reveal: false });
      await host.loadPokemon({ cacheBust: config.assetVersion || Date.now().toString(), source: 'init' });
      await host.startDefault?.();
      host.finishIntro?.();
    }
  } catch (err) {
    window.location.reload();
    return;
  }
}

boot();
