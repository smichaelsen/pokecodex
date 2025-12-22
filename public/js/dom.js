export const padId = (id) => id.toString().padStart(3, '0');

export const typeClass = (t) =>
  'type-' + (t || '').toLowerCase().replace(/\s+/g, '-');
