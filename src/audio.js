/**
 * audio.js — Procedural Web Audio API sound engine.
 *
 * All sounds are synthesised at runtime — no audio files needed.
 * One shared AudioContext and master gain route everything.
 *
 * Public API (singleton `audio`):
 *   resume()                          — must be called from a user gesture
 *   startAmbient() / stopAmbient()   — blue-world drone
 *   playButtonClick()                 — UI button press
 *   playTypewriterClick()             — per-character typing tick
 *   playSlideWhoosh()                 — slide transition
 *   playIrisWhoosh()                  — world-transition portal
 *   playBubbleSelect()                — skill bubble tap/click
 *   playTimelineNode()                — experience timeline dot reaches a node
 *   playScanBeep()                    — about-me scan milestone
 *   tickFootsteps(isMoving, isRun, dt)
 *   toggle()                          — mute / unmute
 */

const audio = {

  // ── Internal state ─────────────────────────────────────────────────────────
  _ctx:         null,
  _master:      null,
  _drone:       null,
  _droneActive: false,
  _stepTimer:   0,
  _muted:       false,

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Create or resume the AudioContext. Must be called from a user gesture. */
  resume() {
    if (this._ctx && this._ctx.state === 'running') return;

    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this._ctx = new Ctx();
      this._master = this._ctx.createGain();
      this._master.gain.setValueAtTime(this._muted ? 0 : 0.45, this._ctx.currentTime);
      this._master.connect(this._ctx.destination);
    }

    if (this._ctx.state === 'suspended') this._ctx.resume();
  },

  // ── Ambient drone ──────────────────────────────────────────────────────────

  /** Two-oscillator blue-world drone with slow pitch LFO. Fades in over 2.5 s. */
  startAmbient() {
    if (!this._ctx || this._muted || this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 2.5);
    filter.connect(gain);
    gain.connect(this._master);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    osc1.connect(filter);
    osc1.start(now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 110.4;
    osc2.connect(filter);
    osc2.start(now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1.5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfo.start(now);

    this._drone = { osc1, osc2, lfo, gain };
    this._droneActive = true;
  },

  /** Fade out the ambient drone over fadeSec seconds then stop oscillators. */
  stopAmbient(fadeSec = 2.5) {
    if (!this._droneActive || !this._drone) return;

    const { osc1, osc2, lfo, gain } = this._drone;
    const now = this._ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSec);

    const stopAt = now + fadeSec + 0.05;
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    lfo.stop(stopAt);

    this._drone = null;
    this._droneActive = false;
  },

  // ── UI sounds ──────────────────────────────────────────────────────────────

  /** Short square-wave sweep 1100 → 550 Hz (button press). */
  playButtonClick() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.07;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.linearRampToValueAtTime(550, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0.001, now + dur);

    osc.connect(gain); gain.connect(this._master);
    osc.start(now); osc.stop(now + dur + 0.01);
  },

  /** 13 ms noise burst through highpass + lowpass (typewriter key). */
  playTypewriterClick() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.013;

    const src = ctx.createBufferSource();
    src.buffer = this._makeNoiseBuffer(dur);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1000 + Math.random() * 500;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.011);

    src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(this._master);
    src.start(now); src.stop(now + dur + 0.01);
  },

  /**
   * Soft slide transition — a gentle sine glide (220 → 440 Hz) layered with a
   * narrow-band noise puff. Much easier on the ears than the old broadband sweep.
   */
  playSlideWhoosh() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Sine glide — the "signature" of the transition
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.22);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.028, now + 0.05);
    og.gain.linearRampToValueAtTime(0, now + 0.30);
    osc.connect(og); og.connect(this._master);
    osc.start(now); osc.stop(now + 0.33);

    // Narrow-band noise puff for texture
    const src = ctx.createBufferSource();
    src.buffer = this._makeNoiseBuffer(0.35);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.linearRampToValueAtTime(900, now + 0.18);
    bp.Q.value = 3.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.042, now + 0.06);
    ng.gain.linearRampToValueAtTime(0, now + 0.35);
    src.connect(bp); bp.connect(ng); ng.connect(this._master);
    src.start(now); src.stop(now + 0.37);
  },

  /**
   * Portal-opening iris sound — ascending harmonic sine chord with a soft noise
   * layer. Warm and cinematic instead of the old harsh broadband sweep.
   */
  playIrisWhoosh() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 1.4;

    // Three harmonically related sine tones rise together
    [[110, 0.0, 0.040], [220, 0.04, 0.025], [330, 0.08, 0.015]].forEach(([freq, delay, peak]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.linearRampToValueAtTime(freq * 3.5, now + delay + 0.85);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(peak, now + delay + 0.12);
      g.gain.linearRampToValueAtTime(0, now + delay + dur);
      osc.connect(g); g.connect(this._master);
      osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
    });

    // Soft noise underlayer for body/weight
    const src = ctx.createBufferSource();
    src.buffer = this._makeNoiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(160, now);
    bp.frequency.linearRampToValueAtTime(700, now + 0.65);
    bp.frequency.linearRampToValueAtTime(250, now + dur);
    bp.Q.value = 1.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.06, now + 0.12);
    ng.gain.linearRampToValueAtTime(0, now + dur);
    src.connect(bp); bp.connect(ng); ng.connect(this._master);
    src.start(now); src.stop(now + dur + 0.01);
  },

  // ── Interaction sounds ─────────────────────────────────────────────────────

  /** Harmonic sine ping for skill bubble select (three overtones, 150 ms decay). */
  playBubbleSelect() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    [[880, 0.048], [1320, 0.024], [1760, 0.010]].forEach(([freq, peak]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g); g.connect(this._master);
      osc.start(now); osc.stop(now + 0.25);
    });
  },

  /** Soft descending blip when the experience timeline dot reaches a node. */
  playTimelineNode() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.038, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.15);
  },

  /** Short 40 ms beep for the about-me biometric scan milestones. */
  playScanBeep() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.038, now + 0.005);
    g.gain.linearRampToValueAtTime(0, now + 0.042);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.05);
  },

  // ── Footsteps ──────────────────────────────────────────────────────────────

  /** Call every frame; fires a footstep sound at the right rhythm. */
  tickFootsteps(isMoving, isRunning, delta) {
    if (!isMoving) { this._stepTimer = 0; return; }
    this._stepTimer += delta;
    const interval = isRunning ? 0.28 : 0.46;
    if (this._stepTimer >= interval) {
      this._stepTimer -= interval;
      this._playFootstep(isRunning);
    }
  },

  _playFootstep(isRunning) {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.065;

    const src = ctx.createBufferSource();
    src.buffer = this._makeNoiseBuffer(dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380 + Math.random() * 140;

    const g = ctx.createGain();
    g.gain.setValueAtTime(isRunning ? 0.055 : 0.038, now);
    g.gain.linearRampToValueAtTime(0.001, now + dur);

    src.connect(lp); lp.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + dur + 0.01);
  },

  // ── Mute control ───────────────────────────────────────────────────────────

  get muted() { return this._muted; },

  /** Flip mute state, ramping master gain over 0.15 s. Returns new state. */
  toggle() {
    this._muted = !this._muted;
    if (this._master) {
      const now = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setValueAtTime(this._master.gain.value, now);
      this._master.gain.linearRampToValueAtTime(this._muted ? 0 : 0.45, now + 0.15);
    }
    return this._muted;
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Return a mono AudioBuffer of white noise for the given duration. */
  _makeNoiseBuffer(durationSec) {
    const ctx = this._ctx;
    const frames = Math.ceil(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  },
};

export { audio };
