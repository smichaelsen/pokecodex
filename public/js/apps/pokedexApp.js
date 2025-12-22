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
  } = elements;

  const state = {
    pokemon: host.getPokemon ? host.getPokemon() : [],
    types: host.getTypeInfo ? host.getTypeInfo() : (config.typeInfo || {}),
    page: 1,
    selectedSlug: null,
  };
  const SEEN_STORAGE_KEY = 'dexos.pokedex.seen';
  const seenSlugs = (() => {
    const stored = host.storage?.get ? host.storage.get(SEEN_STORAGE_KEY, []) : [];
    return new Set(Array.isArray(stored) ? stored.filter(Boolean) : []);
  })();

  const persistSeen = () => {
    if (host.storage?.set) {
      host.storage.set(SEEN_STORAGE_KEY, Array.from(seenSlugs));
    }
  };

  const markSeen = (pokemon) => {
    if (!pokemon || pokemon.placeholder) return;
    const slug = pokemon.slug;
    if (!slug || seenSlugs.has(slug)) return;
    seenSlugs.add(slug);
    persistSeen();
    const cardEl = listEl?.querySelector('pokedex-card[slug="' + slug + '"]');
    if (cardEl) cardEl.removeAttribute('new');
  };

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
    audio: host.audio || null,
    seenSlugs,
    isMobile,
    hideOverlay,
    showDetail: null,
    detailAudio: null,
  };

  pokedexCtx.showDetail = (p, opts) => {
    if (p && !p.placeholder) {
      state.selectedSlug = p.slug || null;
      markSeen(p);
    }
    showDetail(p, pokedexCtx, opts);
  };

  const applyPokemon = (pokemon, opts = {}) => {
    state.pokemon = pokemon || [];
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

  applyPokemon(state.pokemon, { openMobileOverlay: true });


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
      host.audio?.play?.(audio.src);
      return;
    }

    if (target.closest('.art')) {
      const audio = pokedexCtx.detailAudio?.chimeAudio;
      if (!audio) return;
      host.audio?.play?.(audio.src);
      return;
    }

    if (target.closest('.entry')) {
      const audio = pokedexCtx.detailAudio?.descAudio;
      if (!audio) return;
      host.audio?.play?.(audio.src);
      return;
    }

    const typeBadge = target.closest('.badge[data-type]');
    if (typeBadge) {
      event.stopPropagation();
      const typeName = typeBadge.getAttribute('data-type');
      if (!typeName) return;
      const url = pokedexCtx.paths.typeAudioPath(typeName);
      host.audio?.play?.(url);
      return;
    }

    const moveName = target.closest('.move-name[data-move]');
    if (moveName) {
      event.stopPropagation();
      const slug = moveName.getAttribute('data-move');
      if (!slug) return;
      const url = pokedexCtx.paths.moveAudioPath(slug);
      host.audio?.play?.(url);
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

  const onDataUpdated = (event) => {
    const detail = event?.detail || {};
    const openMobileOverlay = !!detailPanelEl?.classList.contains('active');
    applyPokemon(detail.pokemon || [], {
      keepPage: true,
      openMobileOverlay,
    });
  };

  pagePrevEl?.addEventListener('click', onPrev);
  pageNextEl?.addEventListener('click', onNext);
  listEl?.addEventListener('click', onListClick);
  detailContentEl?.addEventListener('click', onDetailClick);
  overlayEl?.addEventListener('click', onOverlayClick);
  window.addEventListener('dexos:data:updated', onDataUpdated);

  return {
    destroy() {
      pagePrevEl?.removeEventListener('click', onPrev);
      pageNextEl?.removeEventListener('click', onNext);
      listEl?.removeEventListener('click', onListClick);
      detailContentEl?.removeEventListener('click', onDetailClick);
      overlayEl?.removeEventListener('click', onOverlayClick);
      window.removeEventListener('dexos:data:updated', onDataUpdated);
      host.clearMenu();
    },
  };
}
