const config = window.__POKEDEX_CONFIG__ || {};
const state = { pokemon: [], types: config.typeInfo || {}, page: 1 };

const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const pagePrevEl = document.getElementById('page-prev');
const pageNextEl = document.getElementById('page-next');
const pageInfoEl = document.getElementById('page-info');
const pageProgressEl = document.getElementById('page-progress');
const overlayEl = document.getElementById('overlay');
const menuButtonEl = document.getElementById('menu-button');
const menuOverlayEl = document.getElementById('menu-overlay');
const menuReloadEl = document.getElementById('menu-reload');

const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
const hideOverlay = () => {
  detailEl.classList.remove('active');
  overlayEl?.classList.remove('active');
};
const hideMenu = () => {
  menuOverlayEl?.classList.remove('active');
  menuOverlayEl?.setAttribute('aria-hidden', 'true');
  menuButtonEl?.setAttribute('aria-label', 'Menü öffnen');
};
const showMenu = () => {
  menuOverlayEl?.classList.add('active');
  menuOverlayEl?.setAttribute('aria-hidden', 'false');
  menuButtonEl?.setAttribute('aria-label', 'Menü schließen');
};

const ctx = {
  state,
  listEl,
  detailEl,
  overlayEl,
  pagePrevEl,
  pageNextEl,
  pageInfoEl,
  pageProgressEl,
  typeInfo: state.types,
  paths: null,
  isMobile,
  hideOverlay,
  showDetail: null,
  detailAudio: null,
};

const preloadAudio = (url) => {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.load();
};

async function boot() {
  const moduleVersion = config.assetVersion ? `?v=${config.assetVersion}` : '';
  const [{ createPaths }, renderModule] = await Promise.all([
    import(`./paths.js${moduleVersion}`),
    import(`./render.js${moduleVersion}`),
  ]);
  const { PAGE_SIZE, renderList, showDetail } = renderModule;

  ctx.paths = createPaths(config);
  ctx.showDetail = (p, opts) => showDetail(p, ctx, opts);

  const loadPokemon = async (cacheBust = '') => {
    const res = await fetch(`data/pokemon.json?v=${cacheBust}`);
    if (!res.ok) throw new Error('Failed to load data');
    state.pokemon = await res.json();
    state.page = 1;
    renderList(state.pokemon, ctx);
    if (state.pokemon.length) {
      const firstReal = state.pokemon.find((p) => !p.placeholder);
      ctx.showDetail(firstReal || state.pokemon[0], { skipListSync: true });
    }
  };

  const initialVersion = config.assetVersion || Date.now().toString();
  await loadPokemon(initialVersion);

  (config.typeNames || []).forEach((typeName) => {
    preloadAudio(ctx.paths.typeAudioPath(typeName));
  });
  (config.moveSlugs || []).forEach((slug) => {
    preloadAudio(ctx.paths.moveAudioPath(slug));
  });

  pagePrevEl?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderList(state.pokemon, ctx);
    }
  });
  pageNextEl?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.pokemon.length / PAGE_SIZE));
    if (state.page < totalPages) {
      state.page += 1;
      renderList(state.pokemon, ctx);
    }
  });

  listEl?.addEventListener('click', (event) => {
    const card = event.target.closest('.card');
    if (!card || card.dataset.placeholder) return;
    const slug = card.getAttribute('data-slug');
    if (!slug) return;
    const found = state.pokemon.find((p) => p.slug === slug);
    if (found) ctx.showDetail(found);
  });

  detailEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('.close')) {
      ctx.hideOverlay();
      return;
    }

    if (target.closest('.detail-title')) {
      const audio = ctx.detailAudio?.nameAudio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    if (target.closest('.art')) {
      const audio = ctx.detailAudio?.chimeAudio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    if (target.closest('.entry')) {
      const audio = ctx.detailAudio?.descAudio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const typeBadge = target.closest('.badge[data-type]');
    if (typeBadge) {
      event.stopPropagation();
      const typeName = typeBadge.getAttribute('data-type');
      if (!typeName) return;
      const audio = new Audio(ctx.paths.typeAudioPath(typeName));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const moveName = target.closest('.move-name[data-move]');
    if (moveName) {
      event.stopPropagation();
      const slug = moveName.getAttribute('data-move');
      if (!slug) return;
      const audio = new Audio(ctx.paths.moveAudioPath(slug));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const evoLink = target.closest('.evo-link');
    if (evoLink) {
      const slug = evoLink.getAttribute('data-slug');
      if (!slug) return;
      const found = state.pokemon.find((entry) => entry.slug === slug);
      if (found) ctx.showDetail(found);
    }
  });

  if (state.pokemon.length) {
    const firstReal = state.pokemon.find((p) => !p.placeholder);
    ctx.showDetail(firstReal || state.pokemon[0]);
  }
  overlayEl?.addEventListener('click', hideOverlay);

  menuButtonEl?.addEventListener('click', () => {
    if (menuOverlayEl?.classList.contains('active')) {
      hideMenu();
    } else {
      showMenu();
    }
  });

  menuOverlayEl?.addEventListener('click', (event) => {
    if (event.target === menuOverlayEl) hideMenu();
  });

  menuReloadEl?.addEventListener('click', async () => {
    hideMenu();
    try {
      await loadPokemon(Date.now().toString());
    } catch (err) {
      window.location.reload();
    }
  });
}

boot();
