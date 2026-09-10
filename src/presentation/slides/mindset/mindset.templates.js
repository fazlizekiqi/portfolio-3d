/**
 * mindset.templates.js — pure data + HTML-string builders for the How I Work
 * ("Developer Philosophy Hub") slide.
 */

const _base = import.meta.env.BASE_URL;

// ── Principle data ──────────────────────────────────────────────────────────
// pos = which corner the callout lives in; ref = patent-style reference letter.
export const CARDS = [
  { idx: '01', ref: 'A', pos: 'tl', title: 'Design First',
    caption: 'Scalable, reliable systems — by design, not by accident.',
    tags: ['API CONTRACTS', 'FAIL FAST', 'SCALE BY DEFAULT'],
    img: `${_base}how-i-work/1.png` },
  { idx: '02', ref: 'B', pos: 'tr', title: 'Clean Code',
    caption: 'Maintainable architecture that outlives the sprint.',
    tags: ['SOLID', 'DRY', 'READABLE'],
    img: `${_base}how-i-work/2.png` },
  { idx: '03', ref: 'C', pos: 'bl', title: 'Observe',
    caption: 'Measure everything, alert on what actually matters.',
    tags: ['METRICS', 'TRACING', 'ALERTING'],
    img: `${_base}how-i-work/3.png` },
  { idx: '04', ref: 'D', pos: 'br', title: 'Collaborate',
    caption: 'Async-first, feedback loops, shared ownership.',
    tags: ['ASYNC-FIRST', 'FEEDBACK LOOPS', 'SHARED OWNERSHIP'],
    img: `${_base}how-i-work/4.png` },
];

// ── Character traits (BUILT ON panel) ───────────────────────────────────────
export const TRAITS = [
  { title: 'Curiosity',   meaning: 'Always exploring better solutions.',
    icon: '<circle cx="9" cy="9" r="6"/><line x1="13.5" y1="13.5" x2="19" y2="19"/>' },
  { title: 'Discipline',  meaning: 'Consistent engineering practices.',
    icon: '<circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="4"/><circle cx="11" cy="11" r="0.6" fill="currentColor"/>' },
  { title: 'Empathy',     meaning: 'Understanding users and teammates.',
    icon: '<path d="M11 18.5C11 18.5 3 13.5 3 8.2 3 5.6 5 4 7.1 4 8.8 4 10.2 5 11 6.3 11.8 5 13.2 4 14.9 4 17 4 19 5.6 19 8.2 19 13.5 11 18.5 11 18.5Z"/>' },
  { title: 'Consistency', meaning: 'Reliable delivery over time.',
    icon: '<path d="M3 11C3 8.8 4.8 7 7 7 9.2 7 10.5 8.6 11 10 11.5 11.4 12.8 13 15 13 17.2 13 19 11.2 19 9 19 6.8 17.2 5 15 5"/><path d="M19 11C19 13.2 17.2 15 15 15 12.8 15 11.5 13.4 11 12 10.5 10.6 9.2 9 7 9 4.8 9 3 10.8 3 13 3 15.2 4.8 17 7 17"/>' },
];

/** Centre philosophy statement markup. */
export function buildStatementHTML() {
  return `
  <span class="_hiw-bracket _hiw-bracket-l"></span>
  <span class="_hiw-bracket _hiw-bracket-r"></span>
  <div class="_hiw-stmt-label">MY APPROACH</div>
  <div class="_hiw-stmt-main">Purposeful. Practical. People-first.</div>
  <div class="_hiw-stmt-sub">Building software that solves real problems and creates meaningful impact.</div>`;
}

/** "BUILT ON" character-traits panel markup. */
export function buildBuiltOnHTML() {
  return `
  <div class="_hiw-bo-header">BUILT ON</div>
  <div class="_hiw-bo-cols">
    ${TRAITS.map(t => `
      <div class="_hiw-bo-col">
        <span class="_hiw-bo-icon"><svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${t.icon}</svg></span>
        <span class="_hiw-bo-title">${t.title}</span>
        <span class="_hiw-bo-meaning">${t.meaning}</span>
      </div>`).join('')}
  </div>`;
}

/** One corner callout-block's inner markup for a given CARDS entry. */
export function buildCalloutHTML(c) {
  const tags = c.tags.map(t => `<span class="_hiw-blk-tag">${t}</span>`).join('');
  return `
    <span class="_hiw-cb _hiw-cb-tl"></span>
    <span class="_hiw-cb _hiw-cb-br"></span>
    <div class="_hiw-blk-hd">
      <span class="_hiw-blk-idx">${c.idx}</span>
      <span class="_hiw-blk-ref">REF ${c.ref}</span>
      <span class="_hiw-blk-dim">1:1</span>
    </div>
    <div class="_hiw-blk-title"></div>
    <div class="_hiw-blk-body">
      <div class="_hiw-blk-img">
        <img src="${c.img}" alt="" loading="lazy" />
        <span class="_hiw-blk-img-scan"></span>
      </div>
      <div class="_hiw-blk-rule"></div>
      <div class="_hiw-blk-cap">${c.caption}</div>
      <div class="_hiw-blk-tags">${tags}</div>
    </div>`;
}
