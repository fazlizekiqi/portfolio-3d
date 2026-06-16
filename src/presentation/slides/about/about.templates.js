/**
 * about.templates.js — Pure HTML-string builder for the about slide's
 * engineering-stats dashboard (the body-panel content, distinct from the
 * biometric scan overlay driven by about-wireframe.js).
 */

import { YEARS_EXPERIENCE } from '../../slides.js';

/** Biometric scan panel markup (LEFT side) for the about-wireframe sequence. */
export function buildBioScanHTML() {
  return `
  <div class="_bio-hdr"><div class="_bio-hdr-dot"></div>BIOMETRIC SCAN</div>
  <div class="_bio-sep"></div>
  <div class="_bio-row" id="_br0"><span class="_bio-k">HEAD / BRAIN </span><span class="_bio-v">ARCHITECTURE: DISTRIBUTED</span></div>
  <div class="_bio-row" id="_br1"><span class="_bio-k">CHEST / CORE </span><span class="_bio-v">${YEARS_EXPERIENCE}+ YEARS IN PRODUCTION</span></div>
  <div class="_bio-row" id="_br2"><span class="_bio-k">ARMS / STACK </span><span class="_bio-v">JAVA · KAFKA · GCP · K8S</span></div>
  <div class="_bio-row" id="_br3"><span class="_bio-k">LEGS / BASE  </span><span class="_bio-v">STOCKHOLM, SWEDEN</span></div>
  <div class="_bio-bar-wrap" id="_brBar">
    <div class="_bio-bar-lbl"><span>SCAN PROGRESS</span><span id="_brPct">0%</span></div>
    <div class="_bio-bar-track"><div class="_bio-bar-fill" id="_brFill"></div></div>
  </div>
  <div class="_bio-done" id="_brDone"><span>▋ ANALYSIS COMPLETE</span><div class="_bio-done-bar"></div></div>
`;
}

/** Engineering stats dashboard for the about slide. */
export function buildAboutHTML() {
  return `<div class="_about-wrap">
    <div class="_about-stats-row">
      <div class="_ab-stat"><div class="_ab-val">${YEARS_EXPERIENCE}+</div><div class="_ab-lbl">YEARS EXP</div></div>
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
