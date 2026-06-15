/**
 * templates.js — Pure HTML-string builders for each slide's body content.
 *
 * No DOM access, no imports from the app — only import.meta.env.BASE_URL.
 * Each function returns an HTML string consumed by showCard() in ui.js.
 */

const _base = import.meta.env.BASE_URL.replace(/\/$/, '');

const _imgMap = {
  seb:     `${_base}/experience/seb-wireframe.png`,
  cepheid: `${_base}/experience/cepheid-wireframe.png`,
  expleo:  `${_base}/experience/expleo-wireframe.png`,
};

function _imgFor(company) {
  const key = Object.keys(_imgMap).find(k => company.toLowerCase().includes(k));
  return key ? _imgMap[key] : null;
}

/** Timeline + job-block panel for the experience slide. */
export function buildExperienceHTML(body) {
  const blocks = body.split('\n\n').map((block, idx) => {
    const [role, company, stack] = block.split('\n');
    const img = _imgFor(company ?? '');
    const imgHTML = img
      ? `<img class="_exp-logo" src="${img}" alt="" />`
      : `<div class="_exp-logo _exp-logo-placeholder"></div>`;

    return `<div class="_exp-block" data-index="${idx}">
      ${imgHTML}
      <div class="_exp-text">
        <div class="_exp-role">${role ?? ''}</div>
        <div class="_exp-company">${company ?? ''}</div>
        <div class="_exp-stack">${stack ?? ''}</div>
      </div>
    </div>`;
  });

  const svgH = 300;
  const svgMarkup = `<svg id="_exp-tl-svg" class="_exp-tl-svg" width="26" height="${svgH}" viewBox="0 0 26 ${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="_exp-tl-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#00ccff" stop-opacity="0.90"/>
        <stop offset="100%" stop-color="#003388" stop-opacity="0.25"/>
      </linearGradient>
      <filter id="_exp-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="_exp-dot-glow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="3.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <line id="_exp-tl-line" x1="13" y1="0" x2="13" y2="${svgH}"
          stroke="rgba(0,100,180,0.35)" stroke-width="1.5" stroke-dasharray="3 4"/>
    <line id="_exp-tl-glow-line" x1="13" y1="0" x2="13" y2="0"
          stroke="url(#_exp-tl-grad)" stroke-width="2" stroke-linecap="round"/>
    ${blocks.map((_, i) =>
      `<circle class="_exp-tl-node" data-ni="${i}" cx="13" cy="${(i + 0.5) * (svgH / blocks.length)}" r="4"
        fill="rgba(0,120,180,0.6)" stroke="rgba(0,180,255,0.45)" stroke-width="1"
        filter="url(#_exp-glow)"/>`
    ).join('\n    ')}
    <circle id="_exp-tl-dot" cx="13" cy="0" r="5.5"
            fill="#00e5ff" filter="url(#_exp-dot-glow)" opacity="0.95"/>
  </svg>`;

  return `<div class="_exp-timeline-wrap">
    ${svgMarkup}
    <div class="_exp-cards">
      ${blocks.join('')}
    </div>
  </div>`;
}

/** Terminal boot sequence for the intro slide. */
export function buildIntroHTML() {
  const rows = [
    { delay: 0.25, prompt: true,  content: `<span class="_tb-blink-cursor">▌</span>&nbsp;ESTABLISHING_CONNECTION<span class="_tb-blink-cursor">...</span>` },
    { delay: 0.85, prompt: false, content: `<span class="_tb-key">ENGINEER </span><span class="_tb-val">FAZLI ZEKIQI</span>` },
    { delay: 1.30, prompt: false, content: `<span class="_tb-key">ROLE     </span><span class="_tb-val">SR. SOFTWARE ENGINEER</span>` },
    { delay: 1.75, prompt: false, content: `<span class="_tb-key">LOCATION </span><span class="_tb-val">STOCKHOLM, SWEDEN</span>` },
    { delay: 2.20, prompt: false, content: `<span class="_tb-key">FOCUS    </span><span class="_tb-val">DISTRIBUTED SYSTEMS</span>` },
    { delay: 2.80, prompt: false, content: `<span class="_tb-key">SYSTEMS  </span><span class="_tb-bar">██████████</span>&nbsp;<span class="_tb-pct">100% ONLINE</span>` },
    { delay: 3.40, prompt: true,  content: `<span class="_tb-blink-cursor">▌</span>` },
  ];
  const html = rows.map(r => {
    const promptHtml = r.prompt
      ? `<span class="_tb-prompt">&gt;</span>`
      : `<span class="_tb-prompt" style="opacity:0.35">&gt;</span>`;
    return `<div class="_tb-row" style="animation-delay:${r.delay}s">${promptHtml}&nbsp;${r.content}</div>`;
  }).join('');
  return `<div class="_term-boot">${html}</div>`;
}

/** Engineering stats dashboard for the about slide. */
export function buildAboutHTML() {
  return `<div class="_about-wrap">
    <div class="_about-stats-row">
      <div class="_ab-stat"><div class="_ab-val">6+</div><div class="_ab-lbl">YEARS EXP</div></div>
      <div class="_ab-stat"><div class="_ab-val">3</div><div class="_ab-lbl">COMPANIES</div></div>
      <div class="_ab-stat"><div class="_ab-val">29</div><div class="_ab-lbl">TECHNOLOGIES</div></div>
      <div class="_ab-stat"><div class="_ab-val">50+</div><div class="_ab-lbl">PROJECTS</div></div>
    </div>
    <div class="_ab-divider"></div>
    <div class="_ab-bio">
      Training · Running · Electronics · Robots
    </div>
  </div>`;
}

/**
 * Contact slide — 4 blueprint annotation buttons + collapsible message form.
 * EmailJS form IDs are preserved: #_cta-form, #_cta-name, #_cta-replyto,
 * #_cta-msg, #_cta-send-btn, #_cta-status.
 */
export function buildCtaHTML() {
  return `<div class="_cta-wrap">

    <!-- ── 4 blueprint action buttons ───────────────────────────────────── -->
    <nav class="_cta-actions">
      <a class="_cta-btn _cta-btn-linkedin" href="https://linkedin.com/in/fazli-zekiqi" target="_blank" rel="noopener">
        <span class="_cta-btn-icon">▶</span><span class="_cta-btn-label">LINKEDIN</span>
      </a>
      <a class="_cta-btn _cta-btn-github" href="https://github.com/fazlizekiqi" target="_blank" rel="noopener">
        <span class="_cta-btn-icon">▶</span><span class="_cta-btn-label">GITHUB</span>
      </a>
      <a class="_cta-btn _cta-btn-cv" href="${_base}/cv.pdf" download="Fazli_Zekiqi_CV.pdf">
        <span class="_cta-btn-icon">↓</span><span class="_cta-btn-label">RESUME</span>
      </a>
      <button type="button" class="_cta-btn _cta-btn-msg" id="_cta-msg-toggle">
        <span class="_cta-btn-icon">✉</span><span class="_cta-btn-label">MESSAGE ME</span>
      </button>
    </nav>

    <!-- ── Collapsible message form drawer ──────────────────────────────── -->
    <div class="_cta-drawer" id="_cta-drawer">
      <form class="_cta-drawer-form" id="_cta-form" novalidate>
        <input type="hidden" id="_cta-name" value="" />
        <label class="_cta-field">
          <span class="_cta-lbl">EMAIL <em>*</em></span>
          <input type="email" class="_cta-input" id="_cta-replyto" placeholder="your@email.com" maxlength="100" autocomplete="email" required />
        </label>
        <label class="_cta-field _cta-field-msg">
          <span class="_cta-lbl">MESSAGE <em>*</em></span>
          <textarea class="_cta-input _cta-textarea" id="_cta-msg" placeholder="Say something..." maxlength="1000" rows="3" required></textarea>
        </label>
        <div class="_cta-submit-row">
          <button type="submit" class="_cta-send-btn" id="_cta-send-btn">SEND</button>
          <span class="_cta-status" id="_cta-status"></span>
        </div>
      </form>
    </div>

  </div>`;
}
