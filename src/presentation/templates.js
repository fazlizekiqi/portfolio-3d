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
 * Interactive contact cards + CV download for the CTA slide.
 * Place a cv.pdf in /public/ for the download link to work.
 */
export function buildCtaHTML() {
  return `<div class="_cta-wrap">

    <a class="_cta-link _cta-email" href="mailto:fazlizekiqi1@hotmail.com" style="animation-delay:0.25s">
      <div class="_cta-service-row">
        <div class="_cta-icon">✉</div>
        <div class="_cta-service-info">
          <div class="_cta-service-name">EMAIL</div>
          <div class="_cta-service-desc">DIRECT MESSAGE</div>
        </div>
      </div>
      <div class="_cta-value">fazlizekiqi1@hotmail.com</div>
      <div class="_cta-connect">SEND A MESSAGE <span class="_cta-connect-arrow">→</span></div>
    </a>

    <a class="_cta-link _cta-linkedin" href="https://linkedin.com/in/fazli-zekiqi" target="_blank" rel="noopener" style="animation-delay:0.45s">
      <div class="_cta-service-row">
        <div class="_cta-icon" style="font-weight:900;font-size:14px;letter-spacing:0">in</div>
        <div class="_cta-service-info">
          <div class="_cta-service-name">LINKEDIN</div>
          <div class="_cta-service-desc">PROFESSIONAL NETWORK</div>
        </div>
      </div>
      <div class="_cta-value">fazli-zekiqi</div>
      <div class="_cta-connect">VIEW PROFILE <span class="_cta-connect-arrow">→</span></div>
    </a>

    <a class="_cta-link _cta-github" href="https://github.com/fazlizekiqi" target="_blank" rel="noopener" style="animation-delay:0.65s">
      <div class="_cta-service-row">
        <div class="_cta-icon" style="font-size:18px">⌥</div>
        <div class="_cta-service-info">
          <div class="_cta-service-name">GITHUB</div>
          <div class="_cta-service-desc">OPEN SOURCE · CODE</div>
        </div>
      </div>
      <div class="_cta-value">fazlizekiqi</div>
      <div class="_cta-connect">EXPLORE REPOS <span class="_cta-connect-arrow">→</span></div>
    </a>

    <a class="_cta-link _cta-cv" href="${_base}/cv.pdf" download="Fazli_Zekiqi_CV.pdf" style="animation-delay:0.85s">
      <div class="_cta-service-row">
        <div class="_cta-icon" style="font-size:16px">↓</div>
        <div class="_cta-service-info">
          <div class="_cta-service-name">RÉSUMÉ</div>
          <div class="_cta-service-desc">PDF · ONE PAGE</div>
        </div>
      </div>
      <div class="_cta-value">Fazli_Zekiqi_CV.pdf</div>
      <div class="_cta-connect">DOWNLOAD CV <span class="_cta-connect-arrow">→</span></div>
    </a>

    <div class="_cta-tagline">// OPEN TO OPPORTUNITIES &amp; COLLABORATIONS</div>

    <div class="_guestbook">
      <button class="_gb-toggle" id="_gb-toggle">+ LEAVE A MESSAGE</button>
      <form class="_gb-form" id="_gb-form" style="display:none">
        <input type="text" class="_gb-name" placeholder="YOUR NAME (OPTIONAL)" maxlength="60" autocomplete="name" />
        <textarea class="_gb-msg" placeholder="SAY SOMETHING..." maxlength="400" rows="3" required></textarea>
        <button type="submit" class="_gb-submit">SEND MESSAGE →</button>
        <div class="_gb-status" id="_gb-status"></div>
      </form>
    </div>
  </div>`;
}
