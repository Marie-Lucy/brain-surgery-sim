import { applyTranslations, createLangToggle } from './i18n';

/** Arrow used inside the pill buttons. */
const ARROW = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11 11 5M6 5h5v5"/></svg>`;

/**
 * Bioluminescent illustration of the case: the supraclinoid ICA, its
 * bifurcation into M1 and A1, the PCom below and the IC-PC aneurysm with
 * its bleb.
 */
const VESSEL_ART = `
<svg class="ss-glow" viewBox="0 0 240 300" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="ssArt" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#0369a1"/><stop offset="55%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <radialGradient id="ssSac" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#a7f3d0" stop-opacity="0.95"/><stop offset="100%" stop-color="#10b981" stop-opacity="0.25"/>
    </radialGradient>
    <filter id="ssBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.2" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/>
    </filter>
  </defs>
  <!-- ICA rising to the terminal bifurcation -->
  <path d="M112 290 C108 240 104 200 112 160 C118 130 120 112 120 96" stroke="url(#ssArt)" stroke-width="15" stroke-linecap="round" filter="url(#ssBlur)" opacity="0.9"/>
  <!-- M1 (lateral) and A1 (medial) -->
  <path d="M120 96 C150 86 180 84 214 64" stroke="#38bdf8" stroke-width="10" stroke-linecap="round" filter="url(#ssBlur)" opacity="0.85"/>
  <path d="M120 96 C92 82 62 74 26 62" stroke="#7dd3fc" stroke-width="7" stroke-linecap="round" filter="url(#ssBlur)" opacity="0.85"/>
  <!-- M2 trunks -->
  <path d="M214 64 C222 50 226 40 230 26 M214 64 C228 66 236 72 240 82" stroke="#7dd3fc" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
  <!-- PCom heading back and medially -->
  <path d="M108 196 C88 214 70 232 44 248" stroke="#67e8f9" stroke-width="4.5" stroke-linecap="round" filter="url(#ssBlur)"/>
  <!-- AChA -->
  <path d="M116 150 C136 170 150 190 160 218" stroke="#a5f3fc" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
  <!-- IC-PC aneurysm with its bleb -->
  <circle cx="146" cy="196" r="26" fill="url(#ssSac)" stroke="#34d399" stroke-width="2.2" filter="url(#ssBlur)"/>
  <path d="M118 194 C124 190 128 190 124 200" stroke="#6ee7b7" stroke-width="7" stroke-linecap="round"/>
  <circle cx="168" cy="214" r="6" fill="#6ee7b7" stroke="#10b981" stroke-width="1.6" filter="url(#ssBlur)"/>
  <!-- Optic nerve, faint -->
  <path d="M60 280 C56 240 48 200 30 150" stroke="#e0f2fe" stroke-width="9" stroke-linecap="round" opacity="0.35"/>
  <circle cx="120" cy="96" r="3" fill="#e0f2fe"/><circle cx="146" cy="196" r="3.4" fill="#ecfdf5"/>
</svg>`;


/**
 * Start screen (same content as before, restyled as a light, glassy landing card):
 * title, subtitle, language toggle, the educational-use disclaimer, the case,
 * the enter / demo buttons, the acknowledgement and the build version.
 * Resolves with the chosen mode.
 */
export function showStartScreen(parent: HTMLElement): Promise<'play' | 'demo'> {
  const el = document.createElement('div');
  el.className = 'start-screen ss';
  el.innerHTML = `
    <div class="ss-watermark" aria-hidden="true">NEUROSIM</div>
    <div class="ss-shell">
      <header class="ss-nav">
        <div class="ss-logo">
          <span class="ss-logo-mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 10.5h-5.5V5a1.5 1.5 0 0 0-3 0v5.5H5a1.5 1.5 0 0 0 0 3h5.5V19a1.5 1.5 0 0 0 3 0v-5.5H19a1.5 1.5 0 0 0 0-3z"/></svg></span>
          <span class="ss-logo-text">IC-PC Clip Sim</span>
        </div>
        <div class="ss-nav-right">
          <span class="ss-lang-lbl" data-i18n="start.language"></span>
          <span class="ss-lang"></span>
        </div>
      </header>

      <section class="ss-hero">
        <div class="ss-col ss-copy">
          <span class="ss-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linejoin="round"/></svg>NEURO · MICROSURGERY · SIM</span>
          <h1 class="ss-title" data-i18n="app.title"></h1>
          <p class="ss-lead" data-i18n="app.subtitle"></p>
          <p class="ss-case" data-i18n="start.case"></p>
          <div class="ss-cta">
            <button class="ss-pill ss-pill-dark ss-enter"><span data-i18n="start.begin"></span><span class="ss-arrow">${ARROW}</span></button>
            <button class="ss-pill ss-pill-light" id="start-demo"><span data-i18n="start.demo"></span><span class="ss-arrow green">${ARROW}</span></button>
          </div>
          <p class="ss-ack" data-i18n="start.ack"></p>
          <p class="ss-version mono" data-i18n="start.milestone"></p>
        </div>

        <div class="ss-col ss-center">
          <div class="ss-arch">
            <div class="ss-arch-bg"></div>
            <div class="ss-arch-art">${VESSEL_ART}</div>
            <div class="ss-float ss-float-top">
              <span class="ss-float-num">6.6 mm</span>
              <span class="ss-float-lbl">IC-PC</span>
            </div>
          </div>
        </div>

        <div class="ss-col ss-right">
          <div class="ss-glass">
            <span class="ss-badge"><span class="ss-warn-dot"></span><span data-i18n="start.disclaimerTitle"></span></span>
            <p class="ss-disclaimer" data-i18n="start.disclaimer"></p>
          </div>
        </div>
      </section>
    </div>`;
  el.querySelector('.ss-lang')!.appendChild(createLangToggle());
  parent.appendChild(el);
  applyTranslations(el);

  return new Promise((resolve) => {
    const go = (mode: 'play' | 'demo') => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 450);
      resolve(mode);
    };
    el.querySelector('.ss-enter')!.addEventListener('click', () => go('play'));
    el.querySelector('#start-demo')!.addEventListener('click', () => go('demo'));
  });
}
