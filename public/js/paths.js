export function createPaths(config = {}) {
  const assetVersion = config.assetVersion || '';
  const audioVersions = config.audioVersions || {};
  const spriteVersions = config.spriteVersions || {};
  const padId = (id) => id.toString().padStart(3, '0');

  return {
    spritePath: (id) => {
      const key = padId(id);
      const version = spriteVersions?.[key] || assetVersion;
      return `assets/sprites/${key}.png?v=${version}`;
    },
    chimePath: (id) => {
      const version = audioVersions?.chimes?.[id] || assetVersion;
      return `audio/chimes/${id}.ogg?v=${version}`;
    },
    nameAudioPath: (id) => {
      const version = audioVersions?.names?.[id] || assetVersion;
      return `audio/de/pokemon/${id}.mp3?v=${version}`;
    },
    descriptionAudioPath: (id) => {
      const version = audioVersions?.descriptions?.[id] || assetVersion;
      return `audio/de/descriptions/${id}.mp3?v=${version}`;
    },
    typeAudioPath: (typeName) => {
      const version = audioVersions?.types?.[typeName] || assetVersion;
      return `audio/de/types/${typeName}.mp3?v=${version}`;
    },
    moveAudioPath: (slug) => {
      const version = audioVersions?.moves?.[slug] || assetVersion;
      return `audio/de/moves/${slug}.mp3?v=${version}`;
    },
  };
}
