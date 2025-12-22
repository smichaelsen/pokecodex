import { padId, typeClass } from './dom.js';

const pageSize = 12;

const resetListScroll = (listEl) => {
  listEl.scrollTop = 0;
  if (listEl.parentElement) {
    listEl.parentElement.scrollTop = 0;
  }
};

const badgeHtml = (t, typeInfo) => {
  const info = typeInfo?.[t];
  const label = info?.name || t || 'Typ';
  const style = info?.color ? ` style="background:${info.color};color:#111;"` : '';
  return `<span class="badge ${typeClass(t)}" data-type="${t}"${style}>${label}</span>`;
};

export function renderList(items, ctx) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (ctx.state.page > totalPages) ctx.state.page = totalPages;
  if (ctx.state.page < 1) ctx.state.page = 1;
  const start = (ctx.state.page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  if (!items.length) {
    ctx.listEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Keine Ergebnisse</div>';
  } else {
    ctx.listEl.innerHTML = paged
      .map((p) => {
        if (p.placeholder) {
          return (
            '<div class="card placeholder" data-placeholder="1">' +
              '<div class="thumb missing"></div>' +
              '<div>' +
                '<div class="id">Nr. ' + padId(p.id) + '</div>' +
                '<div class="name muted">—</div>' +
                '<div class="badges"></div>' +
              '</div>' +
            '</div>'
          );
        }
        const img = ctx.paths.spritePath(p.id);
        return (
          '<div class="card" data-slug="' + p.slug + '">' +
            '<div class="thumb"><img src="' + img + '" alt="' + (p.name?.de || 'Sprite') + '" loading="lazy" onerror="this.parentElement.classList.add(\'missing\'); this.remove();"></div>' +
            '<div>' +
              '<div class="id">Nr. ' + padId(p.id) + '</div>' +
              '<div class="name">' + (p.name?.de || p.name || 'Unbekannt') + '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');

    ctx.listEl.querySelectorAll('.card').forEach((el) => {
      if (el.dataset.placeholder) return;
      el.addEventListener('click', () => {
        const slug = el.getAttribute('data-slug');
        const found = ctx.state.pokemon.find((p) => p.slug === slug);
        if (found) ctx.showDetail(found);
      });
    });
  }

  if (ctx.pageInfoEl && ctx.pageProgressEl) {
    const progress = totalPages <= 1 ? 100 : Math.round(((ctx.state.page - 1) / (totalPages - 1)) * 100);
    ctx.pageProgressEl.style.width = progress + '%';
    ctx.pageInfoEl.querySelector('.progress')?.setAttribute('aria-valuenow', String(progress));
  }
  if (ctx.pagePrevEl) ctx.pagePrevEl.disabled = ctx.state.page <= 1;
  if (ctx.pageNextEl) ctx.pageNextEl.disabled = ctx.state.page >= totalPages;
}

export function showDetail(p, ctx, opts = {}) {
  if (p.placeholder) {
    ctx.detailEl.innerHTML =
      '<div class="detail-header"><h2 class="detail-title">Nr. ' +
      padId(p.id) +
      '</h2><div class="id">Leer</div></div><div class="empty">Keine Daten für diesen Eintrag.</div>';
    ctx.hideOverlay();
    return;
  }
  if (!opts.skipListSync) {
    const index = ctx.state.pokemon.findIndex((entry) => entry && entry.slug === p.slug);
    if (index >= 0) {
      const nextPage = Math.floor(index / pageSize) + 1;
      if (ctx.state.page !== nextPage) {
        ctx.state.page = nextPage;
        renderList(ctx.state.pokemon, ctx);
      }
      const card = ctx.listEl.querySelector('.card[data-slug="' + p.slug + '"]');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
  const img = ctx.paths.spritePath(p.id);
  const typeBadges = (p.types || []).map((t) => badgeHtml(t, ctx.typeInfo)).join('');
  const chimeAudio = new Audio(ctx.paths.chimePath(p.id));
  chimeAudio.preload = 'auto';
  chimeAudio.load();
  const nameAudio = new Audio(ctx.paths.nameAudioPath(p.id));
  nameAudio.preload = 'auto';
  nameAudio.load();
  const descAudio = new Audio(ctx.paths.descriptionAudioPath(p.id));
  descAudio.preload = 'auto';
  descAudio.load();

  const evolvesFrom = p.evolves_from
    ? (() => {
        const fromName = p.evolves_from_name || '???';
        const hasFrom = fromName !== '???';
        const fromId = p.evolves_from;
        const thumb = hasFrom
          ? '<div class="evo-thumb"><img src="' + ctx.paths.spritePath(fromId) + '" alt="' + fromName + '" onerror="this.parentElement.classList.add(\'missing\'); this.remove();"></div>'
          : '<div class="evo-thumb missing"></div>';
        const meta = '<div class="evo-meta"><div class="name">' + fromName + ' (#' + padId(fromId) + ')</div></div>';
        if (hasFrom && p.evolves_from_slug) {
          return '<button class="evo-row evo-link" data-slug="' + p.evolves_from_slug + '">' + thumb + meta + '</button>';
        }
        return '<div class="evo-row">' + thumb + meta + '</div>';
      })()
    : '';

  const evolutions = (p.evolutions || [])
    .map((e) => {
      const targetName = e?.target_name || e?.target || e || '???';
      const targetId = e?.target_id ? e.target_id : null;
      const hasTarget = targetName !== '???' && targetId;
      const cond = hasTarget && e && e.condition ? e.condition : '';
      const thumb = hasTarget
        ? '<div class="evo-thumb"><img src="' + ctx.paths.spritePath(targetId) + '" alt="' + targetName + '" onerror="this.parentElement.classList.add(\'missing\'); this.remove();"></div>'
        : '<div class="evo-thumb missing"></div>';
      const meta =
        '<div class="evo-meta"><div class="name">' +
        targetName +
        (targetId ? ' (#' + padId(targetId) + ')' : '') +
        '</div>' +
        (cond ? '<div class="cond">' + cond + '</div>' : '') +
        '</div>';
      if (hasTarget && e?.target_slug) {
        return '<button class="evo-row evo-link" data-slug="' + e.target_slug + '">' + thumb + meta + '</button>';
      }
      return '<div class="evo-row">' + thumb + meta + '</div>';
    })
    .join('');

  const evolutionHtml = evolvesFrom || evolutions
    ? '<div class="evo-list">' +
        (evolvesFrom ? '<div class="evo-block"><div class="meta">Vorentwicklung</div>' + evolvesFrom + '</div>' : '') +
        (evolutions ? '<div class="evo-block"><div class="meta">Entwicklungen</div>' + evolutions + '</div>' : '') +
      '</div>'
    : '<div class="evo-list"></div>';

  const move = p.signature_move_data;
  const moveBadge = move?.type ? badgeHtml(move.type, ctx.typeInfo) : '<span class="badge">Typ</span>';
  const moveHtml = move
    ? '<div class="move"><div><strong class="move-name" data-move="' + (move.slug || '') + '">' + (move.name?.de || 'Unbekannt') + '</strong><div class="meta">' + (move.description?.de || '') + '</div></div><div class="meta">' + moveBadge + '</div></div>'
    : '<div class="empty">Keine Signaturattacke hinterlegt.</div>';

  const closeBtn = ctx.isMobile() ? '<button class="close" aria-label="Schließen">✕</button>' : '';
  ctx.detailEl.innerHTML =
    '<div class="detail-header">' +
    closeBtn +
    '<h2 class="detail-title clickable">' +
    (p.name?.de || 'Unbekannt') +
    '</h2><div class="id">Nr. ' +
    padId(p.id) +
    '</div></div>' +
    '<div class="detail-body">' +
      '<div class="art clickable"><img src="' + img + '" alt="' + (p.name?.de || 'Illustration') + '" onerror="this.parentElement.classList.add(\'missing\'); this.parentElement.textContent=\'Kein Bild verfügbar\';"></div>' +
      '<div class="section"><h4>Beschreibung</h4><p class="entry clickable">' +
      (p.entry?.de || 'Keine Beschreibung') +
      '</p><div class="badges pokemon-types" style="margin-top:8px">' +
      typeBadges +
      '</div></div>' +
      '<div class="section"><h4>Entwicklung</h4>' +
      evolutionHtml +
      '</div>' +
      '<div class="section"><h4>Signaturattacke</h4><div class="moves">' +
      moveHtml +
      '</div></div>' +
    '</div>';

  const btn = ctx.detailEl.querySelector('.close');
  if (btn) btn.addEventListener('click', ctx.hideOverlay);

  const titleEl = ctx.detailEl.querySelector('.detail-title');
  if (titleEl) {
    titleEl.addEventListener('click', () => {
      nameAudio.currentTime = 0;
      nameAudio.play().catch(() => {});
    });
  }

  const artEl = ctx.detailEl.querySelector('.art');
  if (artEl) {
    artEl.addEventListener('click', () => {
      chimeAudio.currentTime = 0;
      chimeAudio.play().catch(() => {});
    });
  }

  const entryEl = ctx.detailEl.querySelector('.entry');
  if (entryEl) {
    entryEl.addEventListener('click', () => {
      descAudio.currentTime = 0;
      descAudio.play().catch(() => {});
    });
  }

  ctx.detailEl.querySelectorAll('.pokemon-types .badge[data-type]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      const typeName = el.getAttribute('data-type');
      if (!typeName) return;
      const audio = new Audio(ctx.paths.typeAudioPath(typeName));
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  });

  ctx.detailEl.querySelectorAll('.moves .badge[data-type]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      const typeName = el.getAttribute('data-type');
      if (!typeName) return;
      const audio = new Audio(ctx.paths.typeAudioPath(typeName));
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  });

  ctx.detailEl.querySelectorAll('.move-name[data-move]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      const slug = el.getAttribute('data-move');
      if (!slug) return;
      const audio = new Audio(ctx.paths.moveAudioPath(slug));
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  });

  ctx.detailEl.querySelectorAll('.evo-link').forEach((el) => {
    el.addEventListener('click', () => {
      const slug = el.getAttribute('data-slug');
      const found = ctx.state.pokemon.find((entry) => entry.slug === slug);
      if (found) ctx.showDetail(found);
    });
  });

  if (ctx.isMobile()) {
    ctx.detailEl.classList.add('active');
    ctx.overlayEl?.classList.add('active');
  } else {
    ctx.hideOverlay();
  }
}
