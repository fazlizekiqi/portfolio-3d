/**
 * audio.js — Procedural Web Audio API AudioManager for portfolio-3d
 *
 * All sounds are synthesised at runtime — no audio files required.
 * Export: singleton `audio`
 */

const audio = {
  // ── Internal state ──────────────────────────────────────────────────────────
  _ctx: null,          // AudioContext (lazy)
  _master: null,       // GainNode → destination
  _drone: null,        // { osc1, osc2, lfo, lfoGain, filter, gain } | null
  _droneActive: false,
  _stepTimer: 0,       // seconds accumulator for footstep rhythm
  _muted: false,

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * resume() — create or resume the AudioContext.
   * Must be called from a user-gesture handler; subsequent calls are no-ops.
   */
  resume() {
    if (this._ctx && this._ctx.state === 'running') return;

    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return; // browser does not support Web Audio
      this._ctx = new Ctx();

      // Master gain — everything routes through this
      this._master = this._ctx.createGain();
      this._master.gain.setValueAtTime(this._muted ? 0 : 0.45, this._ctx.currentTime);
      this._master.connect(this._ctx.destination);
    }

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  },

  // ── Ambient drone ───────────────────────────────────────────────────────────

  /**
   * startAmbient() — two-oscillator blue-world drone with slow pitch LFO and
   * a lowpass filter. Fades in over 2.5 s to gain 0.045.
   */
  startAmbient() {
    if (!this._ctx || this._muted) return;
    if (this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    // Output gain (fades in)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 2.5);

    filter.connect(gain);
    gain.connect(this._master);

    // Fundamental oscillator — 55 Hz
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, now);
    osc1.connect(filter);
    osc1.start(now);

    // Slightly detuned oscillator — 110.4 Hz (upper octave + detune for beating)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110.4, now);
    osc2.connect(filter);
    osc2.start(now);

    // Slow pitch LFO — 0.12 Hz, ±1.5 Hz deviation applied to osc1
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(1.5, now); // ±1.5 Hz
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfo.start(now);

    this._drone = { osc1, osc2, lfo, lfoGain, filter, gain };
    this._droneActive = true;
  },

  /**
   * stopAmbient(fadeSec) — fade out gain then stop oscillators.
   */
  stopAmbient(fadeSec = 2.5) {
    if (!this._droneActive || !this._drone) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const { osc1, osc2, lfo, gain } = this._drone;

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

  // ── UI sounds ───────────────────────────────────────────────────────────────

  /**
   * playButtonClick() — short square-wave sweep 1100→550 Hz over 70 ms.
   */
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

    osc.connect(gain);
    gain.connect(this._master);

    osc.start(now);
    osc.stop(now + dur + 0.01);
  },

  /**
   * playTypewriterClick() — 13 ms white-noise burst through highpass + lowpass.
   * Call once per character typed.
   */
  playTypewriterClick() {
    if (!this._ctx || this._muted) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.013;
    const hpFreq = 1000 + Math.random() * 500; // 1000–1500 Hz

    const buffer = this._makeNoiseBuffer(dur);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(hpFreq, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(7000, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.011);

    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(this._master);

    source.start(now);
    source.stop(now + dur + 0.01);
  },

  /**
   * playSlideWhoosh() — 380 ms noise with bandpass sweeping 150→4500 Hz.
   */
  playSlideWhoosh() {
    if (!this._ctx || this._muted) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.38;

    const buffer = this._makeNoiseBuffer(dur);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(150, now);
    bp.frequency.linearRampToValueAtTime(4500, now + dur);
    bp.Q.setValueAtTime(0.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.10, now + 0.04);  // attack 40 ms
    gain.gain.linearRampToValueAtTime(0.001, now + dur);   // decay over full duration

    source.connect(bp);
    bp.connect(gain);
    gain.connect(this._master);

    source.start(now);
    source.stop(now + dur + 0.01);
  },

  /**
   * playIrisWhoosh() — 1.3 s dramatic bandpass sweep for world transition.
   * Bandpass: 60 → 9000 Hz then down to 1500 Hz.
   */
  playIrisWhoosh() {
    if (!this._ctx || this._muted) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 1.3;
    const peak = 0.65; // mid-point of sweep

    const buffer = this._makeNoiseBuffer(dur);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(60, now);
    bp.frequency.linearRampToValueAtTime(9000, now + peak);
    bp.frequency.linearRampToValueAtTime(1500, now + dur);
    bp.Q.setValueAtTime(0.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.20, now + 0.08);   // fast attack
    gain.gain.linearRampToValueAtTime(0.001, now + dur);    // fade to silence

    source.connect(bp);
    bp.connect(gain);
    gain.connect(this._master);

    source.start(now);
    source.stop(now + dur + 0.01);
  },

  playTimelineNode() {
    if (!this._ctx || this._muted) return;
    const t = this._ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain); gain.connect(this._master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.18);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.22);
    });
  },

  playScanBeep() {
    if (!this._ctx || this._muted) return;
    const t   = this._ctx.currentTime;
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.connect(gain); gain.connect(this._master);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.05);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t); osc.stop(t + 0.10);
  },

  // ── Footsteps ───────────────────────────────────────────────────────────────

  /**
   * tickFootsteps(isMoving, isRunning, delta)
   * Call every frame from the render loop with delta in seconds.
   */
  tickFootsteps(isMoving, isRunning, delta) {
    if (!isMoving) {
      this._stepTimer = 0;
      return;
    }

    this._stepTimer += delta;
    const interval = isRunning ? 0.28 : 0.46;

    if (this._stepTimer >= interval) {
      this._stepTimer -= interval;
      this._playFootstep(isRunning);
    }
  },

  /**
   * _playFootstep(isRunning) — 65 ms white-noise burst through a lowpass filter.
   */
  _playFootstep(isRunning) {
    if (!this._ctx || this._muted) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.065;
    const lpFreq = 380 + Math.random() * 140; // 380–520 Hz
    const peakGain = isRunning ? 0.055 : 0.038;

    const buffer = this._makeNoiseBuffer(dur);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lpFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.linearRampToValueAtTime(0.001, now + dur);

    source.connect(lp);
    lp.connect(gain);
    gain.connect(this._master);

    source.start(now);
    source.stop(now + dur + 0.01);
  },

  // ── Mute / gain control ─────────────────────────────────────────────────────

  /**
   * get muted — current mute state.
   */
  get muted() {
    return this._muted;
  },

  /**
   * toggle() — flip mute state, ramp master gain over 0.15 s.
   * Returns the new muted state.
   */
  toggle() {
    this._muted = !this._muted;

    if (this._master) {
      const now = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setValueAtTime(this._master.gain.value, now);
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : 0.45,
        now + 0.15
      );
    }

    return this._muted;
  },

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * _makeNoiseBuffer(durationSec) — returns a mono AudioBuffer filled with
   * white noise (random values in [-1, 1]).
   */
  _makeNoiseBuffer(durationSec) {
    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.ceil(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  },
};

export { audio };
