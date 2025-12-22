import { createPaths } from './paths.js';
import { renderList, showDetail } from './render.js';

const config = window.__POKEDEX_CONFIG__ || {};
const state = { pokemon: [], types: config.typeInfo || {}, page: 1 };

const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const pagePrevEl = document.getElementById('page-prev');
const pageNextEl = document.getElementById('page-next');
const pageInfoEl = document.getElementById('page-info');
const pageProgressEl = document.getElementById('page-progress');
const overlayEl = document.getElementById('overlay');

const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
const hideOverlay = () => {
  detailEl.classList.remove('active');
  overlayEl?.classList.remove('active');
};

const paths = createPaths(config);

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
  paths,
  isMobile,
  hideOverlay,
  showDetail: null,
  detailAudio: null,
};

ctx.showDetail = (p, opts) => showDetail(p, ctx, opts);

const preloadAudio = (url) => {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.load();
};

async function boot() {
  const res = await fetch(`data/pokemon.json?v=${config.assetVersion || ''}`);
  state.pokemon = await res.json();
  state.page = 1;
  renderList(state.pokemon, ctx);

  (config.typeNames || []).forEach((typeName) => {
    preloadAudio(paths.typeAudioPath(typeName));
  });
  (config.moveSlugs || []).forEach((slug) => {
    preloadAudio(paths.moveAudioPath(slug));
  });

  pagePrevEl?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderList(state.pokemon, ctx);
    }
  });
  pageNextEl?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.pokemon.length / 12));
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
      const audio = new Audio(paths.typeAudioPath(typeName));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const moveName = target.closest('.move-name[data-move]');
    if (moveName) {
      event.stopPropagation();
      const slug = moveName.getAttribute('data-move');
      if (!slug) return;
      const audio = new Audio(paths.moveAudioPath(slug));
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
}

boot();
