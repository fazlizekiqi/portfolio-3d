/**
 * bubbles-shared.js — plumbing shared by the Skills and Projects slides'
 * floating-bubble systems: the single `_entries` list both slides spawn
 * into, the raycaster/hover/click handling, generic pop/rise/tick animation
 * driving, entry teardown, and a small word-wrap helper.
 *
 * Each entry is a plain object the spawning module (skill-bubbles.js /
 * project-cards.js) builds and pushes via `pushEntry()`. Type-specific
 * per-frame behaviour is supplied as callbacks on the entry itself:
 *   riseMotion?(e, ease)      — position update while rising (skill bubbles only)
 *   onTick?(e, delta, elapsed) — perpetual motion once settled (float / orbit)
 *   respawn?()                 — called once a popped entry finishes bursting
 *   targetOpacity              — fade-in target (0.88 skill / 0.92 project)
 */

import * as THREE from 'three';
import { camera, renderer } from '../../scene.js';
import { LAYER } from '../../layers.js';
import { trackEvent } from '../../analytics.js';
import { audio } from '../../audio.js';

// ── Entries ───────────────────────────────────────────────────────────────────
/** @type {Array<object>} */
let _entries = [];
const _hideHooks = [];

export function getEntries()      { return _entries; }
export function pushEntry(entry)  { _entries.push(entry); }
/** Register a callback run when hideBubbles() clears the scene — lets a
 *  spawning module reset its own module-level animation state (e.g. orbit
 *  angle) without bubbles-shared.js needing to know it exists. */
export function onHide(fn)        { _hideHooks.push(fn); }

export function hideBubbles() {
  for (const e of _entries) _destroyEntry(e);
  _entries = [];
  _hideHooks.forEach(fn => fn());
}

export function destroyEntry(e, idx) { _destroyEntry(e, idx); }

function _destroyEntry(e, idx) {
  e.mesh.parent?.remove(e.mesh);
  e.mesh.geometry.dispose();
  const m = e.mesh.material;
  if (m.isShaderMaterial && m.uniforms) {
    if (m.uniforms.uOverlay?.value) m.uniforms.uOverlay.value.dispose();
    // uImage is shared from a texture cache — don't dispose it
  } else if (Array.isArray(m)) {
    m.forEach(x => { if (x.map) x.map.dispose(); x.dispose(); });
  } else {
    if (m.map) m.map.dispose();
    m.dispose();
  }
  if (e.labelMat) { if (e.labelMat.map) e.labelMat.map.dispose(); e.labelMat.dispose(); }
  if (idx !== undefined) _entries.splice(idx, 1);
}

// ── Word-wrap helper ─────────────────────────────────────────────────────────
export function wrapText(text, maxLen) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + w).length > maxLen) { lines.push(cur.trim()); cur = ''; }
    cur += w + ' ';
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// ── Tick ──────────────────────────────────────────────────────────────────────
const _RISE_DUR = 0.85;

export function tickBubbles(delta, elapsed) {
  if (!_entries.length) return;

  for (let i = _entries.length - 1; i >= 0; i--) {
    const e   = _entries[i];
    const mat = e.mesh.material;

    // Always tick shader time
    if (mat.isShaderMaterial && mat.uniforms) {
      mat.uniforms.uTime.value = elapsed;
    }

    // ── Pop / burst animation ────────────────────────────────────────────
    if (e.popping) {
      e.popTime += delta;
      const t = e.popTime / 0.28;
      if (t < 1.0) {
        const s  = 1.0 + t * 0.9;
        const op = Math.max(0, 1.0 - t);
        e.mesh.scale.setScalar(s);
        if (mat.isShaderMaterial) mat.uniforms.uOpacity.value = op * 0.88;
        else mat.opacity = op;
        if (e.labelMat) e.labelMat.opacity = op * 0.95;
      } else {
        _destroyEntry(e, i);
        e.respawn?.();
      }
      continue;
    }

    // ── Rise animation ───────────────────────────────────────────────────
    if (e.rising) {
      e.riseTime += delta;
      const t = Math.max(0, e.riseTime - e.riseDelay) / _RISE_DUR;
      if (t <= 0) continue;
      const progress = Math.min(1, t);
      const ease     = 1 - Math.pow(1 - progress, 3);
      if (mat.isShaderMaterial && mat.uniforms) mat.uniforms.uOpacity.value = ease * e.targetOpacity;
      else mat.opacity = ease * e.targetOpacity;
      if (e.labelMat) e.labelMat.opacity = ease * 0.95;

      e.riseMotion?.(e, ease);

      if (progress >= 1) {
        e.rising         = false;
        e.floatStartTime = elapsed;
        e.mesh.position.copy(e.basePos);
      }
      continue;
    }

    // ── Perpetual motion once settled ────────────────────────────────────
    e.onTick?.(e, delta, elapsed);
  }
}

// ── Click / hover ─────────────────────────────────────────────────────────────
let _raycaster  = new THREE.Raycaster();
_raycaster.layers.enable(LAYER.BLUE);   // bubbles live on layer 1
let _mouse      = new THREE.Vector2(-9999, -9999);
let _listening  = false;
let _downX = 0, _downY = 0;
let _hoveredEntry = null;   // currently hovered project card entry

export function getHoveredEntry() { return _hoveredEntry; }

export function ensureClickListener() {
  if (_listening) return;
  _listening = true;
  // pointerdown on the canvas — record where the press started
  renderer.domElement.addEventListener('pointerdown', _onDown);
  // pointerup on document so OrbitControls pointer-capture can't swallow it
  document.addEventListener('pointerup', _onUp);
  renderer.domElement.addEventListener('pointermove', _onMove);
}

function _updateMouse(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  _mouse.x   =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  _mouse.y   = -((clientY - rect.top)  / rect.height) * 2 + 1;
}

function _onDown(event) {
  _downX = event.clientX;
  _downY = event.clientY;
}

function _onUp(event) {
  // Only treat as a click if the pointer barely moved (not an orbit drag)
  const dx = event.clientX - _downX;
  const dy = event.clientY - _downY;
  if (Math.sqrt(dx * dx + dy * dy) > 8) return;
  if (!_entries.length) return;

  _updateMouse(event.clientX, event.clientY);
  _raycaster.setFromCamera(_mouse, camera);

  // Force matrixWorld to be current for billboarded spheres
  const meshes = _entries.filter(e => !e.popping).map(e => {
    e.mesh.updateMatrixWorld(true);
    return e.mesh;
  });

  const hits = _raycaster.intersectObjects(meshes, false);
  if (!hits.length) return;

  const entry = _entries.find(e => e.mesh === hits[0].object && !e.popping);
  if (!entry) return;

  if (entry.isProject && entry.item.url) {
    trackEvent('project_click', entry.item.label);
    audio.playButtonClick();
    window.open(entry.item.url, '_blank', 'noopener,noreferrer');
    return;
  }

  // Trigger burst pop — a holographic node dissolving into particles
  entry.popping = true;
  entry.popTime = 0;
  audio.playBubbleBurst();
}

function _onMove(event) {
  if (!_entries.length) return;
  _updateMouse(event.clientX, event.clientY);
  _raycaster.setFromCamera(_mouse, camera);
  const hits = _raycaster.intersectObjects(_entries.map(e => e.mesh), false);
  const hit  = hits.length ? _entries.find(e => e.mesh === hits[0].object && !e.popping) : null;
  renderer.domElement.style.cursor = hits.length ? 'pointer' : '';

  const newHovered = hit?.isProject ? hit : null;
  if (newHovered !== _hoveredEntry) {
    _hoveredEntry = newHovered;
    if (_hoveredEntry) {
      audio.playHover();
      document.dispatchEvent(new CustomEvent('proj-card-hover'));
    }
  }
}
