export function createDataController({ config = {}, dataUrl = 'data/pokemon.json', dispatchDataUpdated } = {}) {
  const state = {
    pokemon: [],
    typeInfo: config.typeInfo || {},
  };

  const loadPokemon = async ({ cacheBust, source = 'load' } = {}) => {
    const version = cacheBust ?? config.assetVersion ?? Date.now().toString();
    const res = await fetch(`${dataUrl}?v=${version}`);
    if (!res.ok) throw new Error('Failed to load data');
    state.pokemon = await res.json();
    if (typeof dispatchDataUpdated === 'function') {
      dispatchDataUpdated({ pokemon: state.pokemon, source });
    }
    return state.pokemon;
  };

  const getPokemon = () => state.pokemon;
  const getTypeInfo = () => state.typeInfo;
  const getMoveInfo = () => null;

  return {
    state,
    loadPokemon,
    getPokemon,
    getTypeInfo,
    getMoveInfo,
  };
}
