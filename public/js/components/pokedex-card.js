import { padId } from '../dom.js';
import { escapeHtml } from '../utils/escapeHtml.js';

const attrValue = (value) => escapeHtml(value || '');

class PokedexCard extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'slug', 'pid', 'name', 'img', 'placeholder', 'cond'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  renderCard({ slug, pid, name, img, placeholder, cond, variant }) {
    const idLabel = pid ? padId(pid) : '';
    const safeSlug = attrValue(slug);
    const safeName = attrValue(name || (placeholder ? '—' : 'Unbekannt'));
    const wrapperClass = 'card' + (variant === 'evolution' ? ' evo' : '');
    const thumbClass = variant === 'evolution' ? 'thumb evo-thumb' : 'thumb';
    const content =
      '<div class="' + wrapperClass + '"' + (safeSlug ? ' data-slug="' + safeSlug + '"' : '') + (placeholder ? ' data-placeholder="1"' : '') + '>' +
        '<div class="' + thumbClass + (placeholder || !img ? ' missing' : '') + '">' +
          (placeholder || !img
            ? ''
            : '<img src="' +
              attrValue(img) +
              '" alt="' +
              safeName +
              '" loading="lazy" onerror="this.parentElement.classList.add(\'missing\'); this.remove();">') +
        '</div>' +
        '<div>' +
          '<div class="id">Nr. ' + idLabel + '</div>' +
          '<div class="name' + (placeholder ? ' muted' : '') + '">' + safeName + '</div>' +
          (cond ? '<div class="cond">' + attrValue(cond) + '</div>' : '') +
        '</div>' +
      '</div>';

    const clickable = !!slug && !placeholder;
    if (!clickable || variant !== 'evolution') {
      return content;
    }
    return '<button class="evo-link" data-slug="' + safeSlug + '">' + content + '</button>';
  }

  render() {
    const variant = this.getAttribute('variant') || 'list';
    const placeholder = this.hasAttribute('placeholder');
    const slug = this.getAttribute('slug') || '';
    const pidRaw = this.getAttribute('pid') || '';
    const pid = pidRaw ? Number(pidRaw) : null;
    const name = this.getAttribute('name') || '';
    const img = this.getAttribute('img') || '';
    const cond = this.getAttribute('cond') || '';

    this.innerHTML = this.renderCard({
      slug,
      pid,
      name,
      img,
      placeholder,
      cond,
      variant,
    });
  }
}

customElements.define('pokedex-card', PokedexCard);
