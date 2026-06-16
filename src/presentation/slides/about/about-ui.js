/**
 * about-ui.js — DOM biometric scan panel (LEFT side) for the About Me
 * sequence: the scan-row labels, progress bar, "ANALYSIS COMPLETE" line and
 * the full-screen scan line. about-view.js drives these every frame from its
 * own 5-phase timeline.
 */

import { buildBioScanHTML } from './about.templates.js';
import './about-bioscan.css';

const _bioEl = document.createElement('div');
_bioEl.id = '_bio-scan';
_bioEl.innerHTML = buildBioScanHTML();
document.body.appendChild(_bioEl);

const _scanLine = document.createElement('div');
_scanLine.className = '_bio-scanline';
document.body.appendChild(_scanLine);

const _rows = [0,1,2,3].map(i => _bioEl.querySelector(`#_br${i}`));
const _fill = _bioEl.querySelector('#_brFill');
const _pct  = _bioEl.querySelector('#_brPct');
const _bar  = _bioEl.querySelector('#_brBar');
const _done = _bioEl.querySelector('#_brDone');

/** Reset the panel to its pre-show state (called from showAboutWireframe). */
export function resetAboutUI() {
  _rows.forEach(r => r.classList.remove('vis'));
  _done.classList.remove('vis');
  _bar.classList.remove('vis');
  _fill.style.width = '0%'; _pct.textContent = '0%';
  _scanLine.style.opacity = '0';
  _bioEl.style.opacity = '0';
}

export function setBioOpacity(value) {
  _bioEl.style.opacity = String(value);
}

export function showBar() {
  _bar.classList.add('vis');
}

export function setRowVisible(i) {
  _rows[i].classList.add('vis');
}

export function setProgress(pct) {
  _fill.style.width = `${pct}%`; _pct.textContent = `${pct}%`;
}

export function setDoneVisible() {
  _done.classList.add('vis');
}

export function setScanLine(opacity, topPercent) {
  _scanLine.style.opacity = opacity;
  if (topPercent !== undefined) _scanLine.style.top = `${topPercent}%`;
}

export function hideAboutUI() {
  _bioEl.style.opacity    = '0';
  _scanLine.style.opacity = '0';
}
