const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }
    .shell {
      width: min(1200px, 100%);
      background: linear-gradient(180deg, #e46363 0%, #c24a4a 50%, #a63a3a 100%);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
      border: 4px solid #6b1f1f;
      overflow: hidden;
      max-height: calc(100vh - 32px);
      touch-action: manipulation;
      position: relative;
    }
    .menu-button {
      position: absolute;
      top: 10px;
      right: 24px;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3px solid #4a0f0f;
      background: radial-gradient(circle at 35% 35%, #ffebee, #b71c1c 60%, #7f0000 100%);
      box-shadow: inset 0 3px 6px rgba(255, 255, 255, 0.35), inset 0 -4px 8px rgba(0, 0, 0, 0.35), 0 6px 10px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
      z-index: 5;
    }
    .menu-button::after {
      content: '';
      position: absolute;
      inset: 12px;
      border-radius: 50%;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.45), rgba(0, 0, 0, 0.2));
      box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.25);
    }
    .menu-button:active {
      transform: translateY(2px);
      box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -2px 6px rgba(0, 0, 0, 0.35), 0 3px 6px rgba(0, 0, 0, 0.25);
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.08);
      color: #fff;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    header .lights {
      display: flex;
      gap: 10px;
    }
    .light {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #42a5f5;
      border: 2px solid #1565c0;
      box-shadow: 0 0 12px rgba(66, 165, 245, 0.7);
      opacity: 0.35;
      transition: opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease;
    }
    .light.active {
      opacity: 1;
      transform: scale(1.05);
      box-shadow: 0 0 16px rgba(66, 165, 245, 0.9);
    }
    .content {
      display: grid;
      grid-template-columns: 360px 1fr;
      min-height: 600px;
      background: #d50000;
      padding: 12px;
      gap: 12px;
      height: calc(100vh - 140px);
      position: relative;
    }
    .content.screen-off ::slotted(.panel) {
      background: #0b0b0b;
      border-color: #0b0b0b;
      box-shadow: none;
    }
    .content.screen-off ::slotted(.panel) > * {
      opacity: 0;
      pointer-events: none;
    }
    .overlay {
      display: none;
    }
    @media (max-width: 960px) {
      .menu-button {
        top: 8px;
        right: 12px;
        width: 40px;
        height: 40px;
      }
      .content {
        grid-template-columns: 1fr;
        height: calc(100vh - 140px);
      }
      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(1px);
        z-index: 15;
      }
      .overlay.active {
        display: block;
      }
    }
  </style>
  <div class="shell">
    <button type="button" class="menu-button" id="menu-button" aria-label="Menü öffnen"></button>
    <header>
      <div class="lights">
        <div class="light"></div>
        <div class="light" style="background:#66bb6a;border-color:#2e7d32;box-shadow:0 0 12px rgba(102,187,106,0.7)"></div>
        <div class="light" style="background:#ffee58;border-color:#fbc02d;box-shadow:0 0 12px rgba(255,238,88,0.7)"></div>
      </div>
    </header>
    <div class="content" id="content">
      <slot name="list-panel"></slot>
      <slot name="detail-panel"></slot>
    </div>
    <div class="overlay" id="overlay"></div>
  </div>
`;

export class DexosDevice extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(template.content.cloneNode(true));
  }

  get contentElement() {
    return this.shadowRoot?.getElementById('content') ?? null;
  }

  get menuButton() {
    return this.shadowRoot?.getElementById('menu-button') ?? null;
  }

  get overlayElement() {
    return this.shadowRoot?.getElementById('overlay') ?? null;
  }

  get lightElements() {
    return Array.from(this.shadowRoot?.querySelectorAll('.light') ?? []);
  }
}

customElements.define('dexos-device', DexosDevice);

export default DexosDevice;
