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

  if (state.pokemon.length) {
    const firstReal = state.pokemon.find((p) => !p.placeholder);
    ctx.showDetail(firstReal || state.pokemon[0]);
  }
  overlayEl?.addEventListener('click', hideOverlay);
}

boot();
