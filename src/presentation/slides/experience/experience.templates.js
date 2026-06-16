/**
 * experience.templates.js — Pure HTML-string builder for the experience slide's
 * timeline + job-block panel.
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
