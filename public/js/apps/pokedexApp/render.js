import { padId, typeClass } from '../../dom.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

export const PAGE_SIZE = 12;

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const getContrastColor = (hex) => {
  try {
    const { r, g, b } = hexToRgb(hex);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128 ? '#fff' : '#111';
  } catch (error) {
    return '#111';
  }
};

const badgeHtml = (t, typeInfo) => {
  const info = typeInfo?.[t];
  const label = escapeHtml(info?.name || t || 'Typ');
  const style = info?.color
    ? ` style="background:${info.color};color:${getContrastColor(info.color)};"`
    : '';
  const safeType = escapeHtml(t || '');
  return `<span class="badge ${typeClass(t)}" data-type="${safeType}"${style}>${label}</span>`;
};

export function renderList(items, ctx) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (ctx.state.page > totalPages) ctx.state.page = totalPages;
  if (ctx.state.page < 1) ctx.state.page = 1;
  const start = (ctx.state.page - 1) * PAGE_SIZE;
  const paged = items.slice(start, start + PAGE_SIZE);

  if (!items.length) {
    ctx.listEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Keine Ergebnisse</div>';
  } else {
    ctx.listEl.innerHTML = paged
      .map((p) => {
        if (p.range) {
          const startId = p.startId ?? p.id ?? 0;
          const endId = p.endId ?? p.startId ?? p.id ?? 0;
          const label =
            startId === endId
              ? 'Nr. ' + padId(startId)
              : 'Nr. ' + padId(startId) + ' - Nr. ' + padId(endId);
          return (
            '<div class="card range" data-placeholder="1">' +
            '<div class="thumb missing"></div>' +
            '<div>' +
            '<div class="id">' +
            label +
            '</div>' +
            '<div class="name muted">—</div>' +
            '</div>' +
            '</div>'
          );
        }
        if (p.placeholder) {
          return '<pokedex-card placeholder pid="' + p.id + '"></pokedex-card>';
        }
        const img = ctx.paths.spritePath(p.id);
        const slug = escapeHtml(p.slug || '');
        const name = escapeHtml(p.name?.de || p.name || 'Unbekannt');
        const isNew = ctx.seenSlugs && p.slug ? !ctx.seenSlugs.has(p.slug) : false;
        return (
          '<pokedex-card pid="' +
          p.id +
          '" slug="' +
          slug +
          '" name="' +
          name +
          '" img="' +
          img +
          '"' +
          (isNew ? ' new="1"' : '') +
          '></pokedex-card>'
        );
      })
      .join('');

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
    const detailTarget = ctx.detailContentEl || ctx.detailPanelEl;
    if (!detailTarget) return;
    detailTarget.innerHTML =
      '<div class="detail-header"><h2 class="detail-title">Nr. ' +
      padId(p.id) +
      '</h2><div class="id">Leer</div></div><div class="empty">Keine Daten für diesen Eintrag.</div>';
    ctx.hideOverlay();
    return;
  }
  if (!opts.skipListSync) {
    const index = ctx.state.pokemon.findIndex((entry) => entry && entry.slug === p.slug);
    if (index >= 0) {
      const nextPage = Math.floor(index / PAGE_SIZE) + 1;
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
  const preloadAudio = (url) => {
    if (!ctx.audio?.preload || !url) return null;
    return ctx.audio.preload(url);
  };
  const typeBadges = (p.types || []).map((t) => badgeHtml(t, ctx.typeInfo)).join('');
  (p.types || []).forEach((typeSlug) => {
    if (!typeSlug) return;
    preloadAudio(ctx.paths.typeAudioPath(typeSlug));
  });
  const chimeUrl = ctx.paths.chimePath(p.id);
  const nameUrl = ctx.paths.nameAudioPath(p.id);
  const descUrl = ctx.paths.descriptionAudioPath(p.id);
  const chimeAudio = preloadAudio(chimeUrl);
  const nameAudio = preloadAudio(nameUrl);
  const descAudio = preloadAudio(descUrl);
  const moveSlugRaw = p.signature_move_data?.slug || p.signature_move;
  if (moveSlugRaw) {
    preloadAudio(ctx.paths.moveAudioPath(moveSlugRaw));
  }

  ctx.detailAudio = {
    chimeAudio,
    chimeUrl,
    nameAudio,
    nameUrl,
    descAudio,
    descUrl,
  };

  const evolvesFrom = p.evolves_from
    ? (() => {
        const fromNameRaw = p.evolves_from_name || '???';
        const hasFrom = fromNameRaw !== '???';
        const fromId = p.evolves_from;
        const attrs = [
          'variant="evolution"',
          'pid="' + fromId + '"',
          'name="' + escapeHtml(fromNameRaw) + '"',
        ];
        if (!hasFrom) {
          attrs.push('placeholder');
        } else if (p.evolves_from_slug) {
          attrs.push('slug="' + escapeHtml(p.evolves_from_slug) + '"');
        }
        if (hasFrom) {
          attrs.push('img="' + ctx.paths.spritePath(fromId) + '"');
        }
        return '<pokedex-card ' + attrs.join(' ') + '></pokedex-card>';
      })()
    : '';

  const evolutions = (p.evolutions || [])
    .map((e) => {
      const targetNameRaw = e?.target_name || e?.target || e || '???';
      const targetId = e?.target_id ? e.target_id : null;
      const hasTarget = targetNameRaw !== '???' && targetId;
      const cond = hasTarget && e && e.condition ? e.condition : '';
      const attrs = [
        'variant="evolution"',
        'name="' + escapeHtml(targetNameRaw) + '"',
      ];
      if (targetId) {
        attrs.push('pid="' + targetId + '"');
      }
      if (!hasTarget) {
        attrs.push('placeholder');
      } else if (e?.target_slug) {
        attrs.push('slug="' + escapeHtml(e.target_slug) + '"');
      }
      if (hasTarget) {
        attrs.push('img="' + ctx.paths.spritePath(targetId) + '"');
      }
      if (cond) {
        attrs.push('cond="' + escapeHtml(cond) + '"');
      }
      return '<pokedex-card ' + attrs.join(' ') + '></pokedex-card>';
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
  const moveSlug = escapeHtml(move?.slug || '');
  const moveHtml = move
    ? '<div class="move"><div><strong class="move-name" data-move="' + moveSlug + '">' + escapeHtml(move.name?.de || 'Unbekannt') + '</strong><div class="meta">' + escapeHtml(move.description?.de || '') + '</div></div><div class="meta">' + moveBadge + '</div></div>'
    : '<div class="empty">Keine Signaturattacke hinterlegt.</div>';

  const closeBtn = ctx.isMobile() ? '<button class="close" aria-label="Schließen">✕</button>' : '';
  const detailTarget = ctx.detailContentEl || ctx.detailPanelEl;
  if (!detailTarget) return;
  detailTarget.innerHTML =
    '<div class="detail-header">' +
    closeBtn +
    '<h2 class="detail-title clickable">' +
    escapeHtml(p.name?.de || 'Unbekannt') +
    '</h2><div class="id">Nr. ' +
    padId(p.id) +
    '</div></div>' +
    '<div class="detail-body">' +
      '<div class="art clickable"><img src="' + img + '" alt="' + escapeHtml(p.name?.de || 'Illustration') + '" onerror="this.parentElement.classList.add(\'missing\'); this.parentElement.textContent=\'Kein Bild verfügbar\';"></div>' +
      '<div class="section"><h4>Beschreibung</h4><p class="entry clickable">' +
      escapeHtml(p.entry?.de || 'Keine Beschreibung') +
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

  const openOverlay = opts.openMobileOverlay !== false;
  if (ctx.isMobile() && openOverlay) {
    ctx.detailPanelEl.classList.add('active');
    ctx.overlayEl?.classList.add('active');
  } else if (!ctx.isMobile()) {
    ctx.hideOverlay();
  }
}
