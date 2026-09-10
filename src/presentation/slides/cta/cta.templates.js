/**
 * cta.templates.js — pure data + HTML-string builders for the "Let's Connect"
 * slide's command-center HUD.
 */

import { ICON_LINKEDIN, ICON_GITHUB, ICON_EMAIL } from '../../icons.js';

export const CONTACTS = [
  { hex: 'in',         icon: ICON_LINKEDIN, label: 'LinkedIn', detail: 'linkedin.com/in/fazli-zekiqi', href: 'https://linkedin.com/in/fazli-zekiqi', external: true },
  { hex: '&lt;/&gt;',  icon: ICON_GITHUB,   label: 'GitHub',   detail: 'github.com/fazlizekiqi',       href: 'https://github.com/fazlizekiqi',       external: true },
  { hex: '&#9993;',    icon: ICON_EMAIL,    label: 'Email',    detail: 'fazlizekiqi1@hotmail.com',     href: 'mailto:fazlizekiqi1@hotmail.com',      external: false },
];

export const HUD_PANELS = [
  { pos: 'avail', title: 'AVAILABLE FOR', body: 'Freelance<br>Full-time<br>Collaborations', blink: true },
  { pos: 'based', title: 'BASED IN',      body: '\u{1F310} Earth',                          blink: false },
  { pos: 'focus', title: 'FOCUS AREAS',   body: 'Software Engineering<br>Backend Systems<br>Kafka &amp; Distributed Systems<br>Cloud Architecture', blink: false },
];

/** Left command panel inner markup. */
export function buildPanelHTML() {
  return `
  <span class="_cta2-corner _cta2-corner-tl"></span>
  <span class="_cta2-corner _cta2-corner-br"></span>
  <div class="_cta2-scanline"></div>
  <div class="_cta2-headline">
    <span class="_cta2-h1">Let's build something</span><br class="_cta2-br"><span class="_cta2-h2">amazing together.</span>
    <span class="_cta2-h-mobile">Let's Connect</span>
  </div>
  <div class="_cta2-sub">I'm always open to new opportunities, collaborations, and interesting projects.</div>
  <div class="_cta2-sub-mobile">Open to opportunities, freelance projects and collaborations.</div>
  <div class="_cta2-cards">
    ${CONTACTS.map(c => `
      <a class="_cta2-card" href="${c.href}" ${c.external ? 'target="_blank" rel="noopener"' : ''}>
        <span class="_cta2-hex">${c.hex}</span>
        <span class="_cta2-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg></span>
        <span class="_cta2-card-text">
          <span class="_cta2-card-label">${c.label}</span>
          <span class="_cta2-card-detail">${c.detail}</span>
        </span>
        <span class="_cta2-card-arrow">→</span>
      </a>`).join('')}
  </div>
  <div class="_cta2-status"><span class="_cta2-status-dot"></span>I typically respond within 24 hours</div>
`;
}

/** One floating HUD data-panel's inner markup. */
export function buildHudPanelHTML(p) {
  return `
    <div class="_cta2-hud-title">${p.blink ? '<span class="_cta2-hud-blink"></span>' : ''}${p.title}</div>
    <div class="_cta2-hud-body">${p.body}</div>`;
}
