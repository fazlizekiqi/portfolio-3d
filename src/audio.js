/**
 * audio.js — Procedural Web Audio AudioManager for portfolio-3d
 *
 * Direction: a futuristic operating system, not an arcade game. Every sound is
 * short, clean and quiet — the visitor should feel the interface is alive more
 * than consciously notice any single cue. All sounds are synthesised at runtime
 * (no audio files). Export: singleton `audio`.
 *
 * Internals are built from two small voices — `_voice` (an enveloped oscillator,
 * optionally band-limited) and `_noise` (an enveloped, filtered noise burst) —
 * so each public cue is a short recipe rather than 20 lines of node wiring.
 */

const audio = {
  // ── Internal state ──────────────────────────────────────────────────────────
  _ctx: null,          // AudioContext (lazy)
  _master: null,       // GainNode → destination
  _drone: null,        // bundle of ambient nodes | null
  _droneActive: false,
  _pulseTimer: null,   // setTimeout id for the occasional distant pulse
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

      // Master gain — everything routes through this. Kept moderate; individual
      // cues carry their own (low) levels so the mix stays in the background.
      this._master = this._ctx.createGain();
      this._master.gain.setValueAtTime(this._muted ? 0 : 0.42, this._ctx.currentTime);
      this._master.connect(this._ctx.destination);
    }

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  },

  // ── Ambient bed (4 layers) ────────────────────────────────────────────────────

  /**
   * startAmbient() — the most important sound. A deep, almost-static bed that
   * evolves slowly with no rhythm or melody, like an AI core idling in a quiet
   * server room. Four layers:
   *   1. low sine drone (48 + 72 Hz) with a slow pitch LFO
   *   2. soft high-passed noise (airy texture)
   *   3. slow shimmering pad (220 + 330 Hz) under a drifting lowpass
   *   4. an occasional distant digital pulse (scheduled separately)
   * Everything fades in over ~3 s and sits extremely low in the mix.
   */
  startAmbient() {
    if (!this._ctx || this._muted) return;
    if (this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const nodes = [];   // oscillators/sources to stop on teardown
    const gains = [];   // output gains to fade on teardown

    // ── Layer 1: low sine drone ──────────────────────────────────────────────
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(320, now);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(0.050, now + 3.0);
    droneFilter.connect(droneGain);
    droneGain.connect(this._master);
    gains.push(droneGain);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(48, now);
    osc1.connect(droneFilter);
    osc1.start(now);
    nodes.push(osc1);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(72, now);
    osc2.connect(droneFilter);
    osc2.start(now);
    nodes.push(osc2);

    // Slow pitch LFO (0.1 Hz, ±1.2 Hz) — gentle harmonic movement
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.10, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(1.2, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfo.start(now);
    nodes.push(lfo);

    // ── Layer 2: soft high-passed noise ──────────────────────────────────────
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._makeNoiseBuffer(2.0);
    noiseSrc.loop = true;
    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.setValueAtTime(2200, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.006, now + 3.5);
    noiseSrc.connect(noiseHP);
    noiseHP.connect(noiseGain);
    noiseGain.connect(this._master);
    noiseSrc.start(now);
    nodes.push(noiseSrc);
    gains.push(noiseGain);

    // ── Layer 3: slow shimmering pad ─────────────────────────────────────────
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(600, now);
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0, now);
    padGain.gain.linearRampToValueAtTime(0.012, now + 4.0);
    padFilter.connect(padGain);
    padGain.connect(this._master);
    gains.push(padGain);

    const pad1 = ctx.createOscillator();
    pad1.type = 'sine';
    pad1.frequency.setValueAtTime(220, now);
    pad1.connect(padFilter);
    pad1.start(now);
    nodes.push(pad1);

    const pad2 = ctx.createOscillator();
    pad2.type = 'sine';
    pad2.frequency.setValueAtTime(330, now);
    pad2.connect(padFilter);
    pad2.start(now);
    nodes.push(pad2);

    // Drifting filter LFO for the pad (0.05 Hz) — slow shimmer
    const padLfo = ctx.createOscillator();
    padLfo.type = 'sine';
    padLfo.frequency.setValueAtTime(0.05, now);
    const padLfoGain = ctx.createGain();
    padLfoGain.gain.setValueAtTime(260, now);
    padLfo.connect(padLfoGain);
    padLfoGain.connect(padFilter.frequency);
    padLfo.start(now);
    nodes.push(padLfo);

    this._drone = { nodes, gains };
    this._droneActive = true;

    // ── Layer 4: occasional distant digital pulse ────────────────────────────
    this._scheduleAmbientPulse();
  },

  /** Schedule the next faint background pulse 8–16 s out, then re-arm. */
  _scheduleAmbientPulse() {
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    const delay = 8000 + Math.random() * 8000;
    this._pulseTimer = setTimeout(() => {
      if (this._droneActive && !this._muted) {
        this._voice({
          type: 'sine', f0: 520, f1: 360, dur: 0.9, peak: 0.018, attack: 0.04,
          filter: { type: 'lowpass', freq: 1200 },
        });
      }
      if (this._droneActive) this._scheduleAmbientPulse();
    }, delay);
  },

  /** stopAmbient(fadeSec) — fade out every layer then stop its sources. */
  stopAmbient(fadeSec = 2.5) {
    if (this._pulseTimer) { clearTimeout(this._pulseTimer); this._pulseTimer = null; }
    if (!this._droneActive || !this._drone) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const { nodes, gains } = this._drone;

    gains.forEach(g => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fadeSec);
    });

    const stopAt = now + fadeSec + 0.05;
    nodes.forEach(n => { try { n.stop(stopAt); } catch (_) { /* already stopped */ } });

    this._drone = null;
    this._droneActive = false;
  },

  // ── UI sounds ─────────────────────────────────────────────────────────────────

  /**
   * playButtonClick() — activating a system command: a soft digital click layered
   * with a short confirmation tone. Not a mouse click.
   */
  playButtonClick() {
    if (!this._ctx || this._muted) return;
    // soft click body
    this._noise({ dur: 0.03, peak: 0.05, filter: { type: 'bandpass', freq: 1800, q: 0.9 } });
    // short confirmation tone underneath
    this._voice({ type: 'sine', f0: 880, f1: 660, dur: 0.10, peak: 0.05, attack: 0.004 });
  },

  /**
   * playHover() — a tiny upward chirp, almost subconscious, to invite
   * interaction. Extremely low level.
   */
  playHover() {
    if (!this._ctx || this._muted) return;
    this._voice({ type: 'sine', f0: 1300, f1: 1750, dur: 0.045, peak: 0.020, attack: 0.003 });
  },

  /**
   * playTypewriterClick() — tiny high-frequency tick, like a byte of data
   * arriving in a holographic display. Call once per character burst.
   */
  playTypewriterClick() {
    if (!this._ctx || this._muted) return;
    const hpFreq = 2600 + Math.random() * 800;
    this._noise({ dur: 0.012, peak: 0.045, attack: 0.001, filter: { type: 'highpass', freq: hpFreq } });
  },

  /**
   * playTitleShimmer() — a small rising shimmer under a large title appearing,
   * so information feels like it materialises rather than types.
   */
  playTitleShimmer() {
    if (!this._ctx || this._muted) return;
    this._voice({ type: 'sine', f0: 600, f1: 1500, dur: 0.45, peak: 0.022, attack: 0.06,
                  filter: { type: 'bandpass', freq: 1400, q: 0.7 } });
    this._noise({ dur: 0.45, peak: 0.008, attack: 0.08, filter: { type: 'highpass', freq: 3000 } });
  },

  /**
   * playCardOpen() — a HUD panel deploying: soft activation click → expanding
   * synth sweep → tiny holographic sparkle.
   */
  playCardOpen() {
    if (!this._ctx || this._muted) return;
    this._noise({ dur: 0.04, peak: 0.035, filter: { type: 'bandpass', freq: 1500, q: 0.8 } });
    this._voice({ type: 'sine', f0: 420, f1: 900, dur: 0.22, peak: 0.035, attack: 0.02,
                  filter: { type: 'lowpass', freq: 2200 } });
    this._voice({ type: 'sine', f0: 2100, f1: 2600, dur: 0.10, peak: 0.012, attack: 0.01, when: 0.14 });
  },

  /**
   * playSlideWhoosh() — switching interface layers: a soft rising tone, a brief
   * digital shimmer and a subtle low impact. Smooth, not a page flip.
   */
  playSlideWhoosh() {
    if (!this._ctx || this._muted) return;
    // soft rising tone
    this._voice({ type: 'sine', f0: 320, f1: 760, dur: 0.34, peak: 0.045, attack: 0.05,
                  filter: { type: 'lowpass', freq: 2600 } });
    // brief shimmer
    this._noise({ dur: 0.30, peak: 0.018, attack: 0.04, filter: { type: 'bandpass', freq: 3200, q: 0.7 } });
    // subtle low impact
    this._voice({ type: 'sine', f0: 150, f1: 90, dur: 0.18, peak: 0.040, attack: 0.004 });
  },

  /**
   * playSectionInit() — loading a new module inside the OS: a short power-up
   * pulse, a quick scan, faint data ticks and a single confirmation tone.
   */
  playSectionInit() {
    if (!this._ctx || this._muted) return;
    // power-up pulse
    this._voice({ type: 'sine', f0: 90, f1: 220, dur: 0.5, peak: 0.045, attack: 0.08,
                  filter: { type: 'lowpass', freq: 1400 } });
    // scan sweep
    this._noise({ dur: 0.6, peak: 0.020, attack: 0.1, when: 0.25, filter: { type: 'bandpass', freq: 2400, q: 0.8 } });
    // faint data ticks
    for (let i = 0; i < 4; i++) {
      this._voice({ type: 'sine', f0: 1800 + i * 220, f1: 1800 + i * 220, dur: 0.05, peak: 0.012,
                    attack: 0.002, when: 0.5 + i * 0.1 });
    }
    // confirmation tone
    this._voice({ type: 'sine', f0: 660, f1: 880, dur: 0.4, peak: 0.030, attack: 0.02, when: 1.0 });
  },

  /**
   * playIrisWhoosh() — the world-transition aperture: a deep activation pulse,
   * segmented mechanical movement, rising resonance and a soft bloom. A giant
   * futuristic lens opening, not a door.
   */
  playIrisWhoosh() {
    if (!this._ctx || this._muted) return;
    // deep activation pulse
    this._voice({ type: 'sine', f0: 70, f1: 150, dur: 0.5, peak: 0.13, attack: 0.02,
                  filter: { type: 'lowpass', freq: 900 } });
    // segmented mechanical movement — a handful of soft filtered ticks
    for (let i = 0; i < 6; i++) {
      this._noise({ dur: 0.05, peak: 0.04, when: 0.12 + i * 0.07,
                    filter: { type: 'bandpass', freq: 900 + i * 250, q: 1.2 } });
    }
    // rising resonance → soft bloom
    this._voice({ type: 'sine', f0: 220, f1: 1400, dur: 0.9, peak: 0.10, attack: 0.2, when: 0.2,
                  filter: { type: 'bandpass', freq: 1600, q: 0.5 } });
    this._noise({ dur: 0.7, peak: 0.05, attack: 0.4, when: 0.55, filter: { type: 'highpass', freq: 2400 } });
  },

  /**
   * playBubbleBurst() — a holographic node dissolving into particles: a tiny
   * pressure pop, a short digital sparkle and a scattered tail.
   */
  playBubbleBurst() {
    if (!this._ctx || this._muted) return;
    // pressure pop
    this._voice({ type: 'sine', f0: 700, f1: 240, dur: 0.08, peak: 0.045, attack: 0.003 });
    // sparkle + scatter
    this._noise({ dur: 0.10, peak: 0.030, attack: 0.002, filter: { type: 'highpass', freq: 3600 } });
    this._voice({ type: 'sine', f0: 2200, f1: 3000, dur: 0.06, peak: 0.012, attack: 0.004, when: 0.03 });
  },

  /**
   * playSuccess() — three warm ascending notes: mission accomplished, without
   * sounding gamified.
   */
  playSuccess() {
    if (!this._ctx || this._muted) return;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this._voice({ type: 'sine', f0: f, f1: f, dur: 0.5, peak: 0.05, attack: 0.02, when: i * 0.14,
                    filter: { type: 'lowpass', freq: 2600 } });
    });
  },

  /**
   * playTimelineNode() — two soft ascending sine pips, used as a timeline beat.
   */
  playTimelineNode() {
    if (!this._ctx || this._muted) return;
    this._voice({ type: 'sine', f0: 660, f1: 660, dur: 0.18, peak: 0.10, attack: 0.01 });
    this._voice({ type: 'sine', f0: 880, f1: 880, dur: 0.18, peak: 0.10, attack: 0.01, when: 0.06 });
  },

  /**
   * playScanBeep() — a faint data-particle tick emitted at biometric-scan
   * milestones. Soft and high, like a point being analysed.
   */
  playScanBeep() {
    if (!this._ctx || this._muted) return;
    this._voice({ type: 'sine', f0: 1200, f1: 1600, dur: 0.09, peak: 0.045, attack: 0.004,
                  filter: { type: 'bandpass', freq: 1800, q: 1.0 } });
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
   * _playFootstep(isRunning) — a soft electronic tap with a tiny energy
   * resonance, like walking on illuminated glass. Running adds a small pulse.
   */
  _playFootstep(isRunning) {
    if (!this._ctx || this._muted) return;
    const peak = isRunning ? 0.050 : 0.034;
    // soft tap
    this._noise({ dur: 0.06, peak, filter: { type: 'lowpass', freq: 420 + Math.random() * 140 } });
    // tiny energy resonance
    this._voice({ type: 'sine', f0: isRunning ? 240 : 200, f1: isRunning ? 150 : 130,
                  dur: 0.07, peak: peak * 0.5, attack: 0.003 });
  },

  // ── Mute / gain control ─────────────────────────────────────────────────────

  /** get muted — current mute state. */
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
      this._master.gain.linearRampToValueAtTime(this._muted ? 0 : 0.42, now + 0.15);
    }

    return this._muted;
  },

  // ── Internal voices ───────────────────────────────────────────────────────────

  /**
   * _voice(opts) — one enveloped oscillator, optionally band-limited.
   *   type, f0, f1=f0   waveform + start/end frequency (linear glide)
   *   dur, peak         length (s) + peak gain
   *   attack=0.005      attack time (s); decays exponentially to silence after
   *   when=0            start offset from now (s)
   *   filter            { type, freq, q? } biquad inserted before the gain
   */
  _voice({ type = 'sine', f0, f1 = f0, dur, peak, attack = 0.005, when = 0, filter = null }) {
    const ctx = this._ctx;
    const t = ctx.currentTime + when;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.q != null) f.Q.setValueAtTime(filter.q, t);
      osc.connect(f);
      f.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this._master);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /**
   * _noise(opts) — one enveloped, filtered white-noise burst.
   *   dur, peak, attack=0.005, when=0   as _voice
   *   filter   { type, freq, q? }       required band-limiting biquad
   */
  _noise({ dur, peak, attack = 0.005, when = 0, filter }) {
    const ctx = this._ctx;
    const t = ctx.currentTime + when;

    const src = ctx.createBufferSource();
    src.buffer = this._makeNoiseBuffer(dur);

    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.q != null) f.Q.setValueAtTime(filter.q, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    src.connect(f);
    f.connect(gain);
    gain.connect(this._master);

    src.start(t);
    src.stop(t + dur + 0.02);
  },

  /**
   * _makeNoiseBuffer(durationSec) — mono AudioBuffer of white noise in [-1, 1].
   */
  _makeNoiseBuffer(durationSec) {
    const ctx = this._ctx;
    const frameCount = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  },
};

export { audio };
