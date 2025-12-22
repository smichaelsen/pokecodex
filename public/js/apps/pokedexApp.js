const preloadAudio = (url) => {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.load();
};

export async function createPokedexApp(ctx) {
  const {
    config,
    moduleVersion,
    elements,
    host,
    isMobile,
    hideOverlay,
  } = ctx;

  const {
    listEl,
    detailPanelEl,
    detailContentEl,
    pagePrevEl,
    pageNextEl,
    pageInfoEl,
    pageProgressEl,
    overlayEl,
    menuReloadEl,
  } = elements;

  const state = { pokemon: [], types: config.typeInfo || {}, page: 1, selectedSlug: null };

  const [, { createPaths }, renderModule] = await Promise.all([
    import(`../components/pokedex-card.js${moduleVersion}`),
    import(`../paths.js${moduleVersion}`),
    import(`../render.js${moduleVersion}`),
  ]);
  const { PAGE_SIZE, renderList, showDetail } = renderModule;

  const pokedexCtx = {
    state,
    listEl,
    detailPanelEl,
    detailContentEl,
    overlayEl,
    pagePrevEl,
    pageNextEl,
    pageInfoEl,
    pageProgressEl,
    typeInfo: state.types,
    paths: createPaths(config),
    isMobile,
    hideOverlay,
    showDetail: null,
    detailAudio: null,
  };

  pokedexCtx.showDetail = (p, opts) => {
    if (p && !p.placeholder) state.selectedSlug = p.slug || null;
    showDetail(p, pokedexCtx, opts);
  };

  const loadPokemon = async (cacheBust = '', opts = {}) => {
    const res = await fetch(`data/pokemon.json?v=${cacheBust}`);
    if (!res.ok) throw new Error('Failed to load data');
    state.pokemon = await res.json();
    if (!opts.keepPage) state.page = 1;
    renderList(state.pokemon, pokedexCtx);
    const hasList = state.pokemon.length > 0;
    if (!hasList) return;
    const fallback = state.pokemon.find((p) => !p.placeholder) || state.pokemon[0];
    const selected = state.selectedSlug
      ? state.pokemon.find((p) => p.slug === state.selectedSlug)
      : null;
    const target = selected || fallback;
    if (target) {
      pokedexCtx.showDetail(target, {
        skipListSync: true,
        openMobileOverlay: opts.openMobileOverlay,
      });
    }
  };

  const initialVersion = config.assetVersion || Date.now().toString();
  await loadPokemon(initialVersion, { openMobileOverlay: true });

  (config.typeNames || []).forEach((typeName) => {
    preloadAudio(pokedexCtx.paths.typeAudioPath(typeName));
  });
  (config.moveSlugs || []).forEach((slug) => {
    preloadAudio(pokedexCtx.paths.moveAudioPath(slug));
  });

  const onPrev = () => {
    if (state.page > 1) {
      state.page -= 1;
      renderList(state.pokemon, pokedexCtx);
    }
  };

  const onNext = () => {
    const totalPages = Math.max(1, Math.ceil(state.pokemon.length / PAGE_SIZE));
    if (state.page < totalPages) {
      state.page += 1;
      renderList(state.pokemon, pokedexCtx);
    }
  };

  const onListClick = (event) => {
    const card = event.target.closest('.card');
    if (!card || card.dataset.placeholder) return;
    const slug = card.getAttribute('data-slug');
    if (!slug) return;
    const found = state.pokemon.find((p) => p.slug === slug);
    if (found) {
      state.selectedSlug = slug;
      pokedexCtx.showDetail(found);
    }
  };

  const onDetailClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('.close')) {
      hideOverlay();
      return;
    }

    if (target.closest('.detail-title')) {
      const audio = pokedexCtx.detailAudio?.nameAudio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    if (target.closest('.art')) {
      const audio = pokedexCtx.detailAudio?.chimeAudio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    if (target.closest('.entry')) {
      const audio = pokedexCtx.detailAudio?.descAudio;
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
      const audio = new Audio(pokedexCtx.paths.typeAudioPath(typeName));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const moveName = target.closest('.move-name[data-move]');
    if (moveName) {
      event.stopPropagation();
      const slug = moveName.getAttribute('data-move');
      if (!slug) return;
      const audio = new Audio(pokedexCtx.paths.moveAudioPath(slug));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const evoLink = target.closest('.evo-link');
    if (evoLink) {
      const slug = evoLink.getAttribute('data-slug');
      if (!slug) return;
      const found = state.pokemon.find((entry) => entry.slug === slug);
      if (found) {
        state.selectedSlug = slug;
        pokedexCtx.showDetail(found);
      }
    }
  };

  const onOverlayClick = () => hideOverlay();

  const onReload = async () => {
    host.hideMenu();
    try {
      const openMobileOverlay = !!detailPanelEl?.classList.contains('active');
      await loadPokemon(Date.now().toString(), {
        keepPage: true,
        openMobileOverlay,
      });
    } catch (err) {
      window.location.reload();
    }
  };

  pagePrevEl?.addEventListener('click', onPrev);
  pageNextEl?.addEventListener('click', onNext);
  listEl?.addEventListener('click', onListClick);
  detailContentEl?.addEventListener('click', onDetailClick);
  overlayEl?.addEventListener('click', onOverlayClick);
  menuReloadEl?.addEventListener('click', onReload);

  if (state.pokemon.length) {
    const firstReal = state.pokemon.find((p) => !p.placeholder);
    pokedexCtx.showDetail(firstReal || state.pokemon[0], { openMobileOverlay: true });
  }

  return {
    destroy() {
      pagePrevEl?.removeEventListener('click', onPrev);
      pageNextEl?.removeEventListener('click', onNext);
      listEl?.removeEventListener('click', onListClick);
      detailContentEl?.removeEventListener('click', onDetailClick);
      overlayEl?.removeEventListener('click', onOverlayClick);
      menuReloadEl?.removeEventListener('click', onReload);
    },
  };
}
