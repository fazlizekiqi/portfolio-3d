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

  // ── Ambient bed ───────────────────────────────────────────────────────────────

  /**
   * startAmbient() — a meditative, breathing sound-bed that makes the interface
   * feel alive without calling attention to itself. Design principles:
   *
   *   BREATHE  — a 0.10 Hz amplitude LFO (~6 breaths/min, the parasympathetic
   *              resonance rate) on the warm noise layer.  Visitors won't notice
   *              it consciously; they'll feel the room is breathing with them.
   *
   *   RESONATE — pure sine waves only (no square/saw). Two root tones 8 Hz apart
   *              create a gentle alpha-wave beating — the rhythm of relaxed,
   *              meditative attention. Perfect-fifth and octave overtones above
   *              them sit in a consonant, restful chord.
   *
   *   EMERGE   — 5-second master fade-in. The sound should already be present
   *              when the visitor first notices it.
   *
   *   CRYSTALLINE — a soft singing-bowl tone surfaces every 20–40 s, fades in
   *              over 1.5 s and dissolves over the following 5 s. Never percussive.
   *
   * Four layers, all routed to a single mainGain for clean teardown:
   *   1. Root drone (130 + 138 Hz) — alpha beating + slow frequency drift
   *   2. Harmonic overtones (195 + 260 Hz) — perfect fifth + octave
   *   3. Warm breath-noise (bandpass 220 Hz, AM at 0.10 Hz)
   *   4. Crystalline shimmer (520 Hz sine, ultra-slow vibrato)
   */
  startAmbient() {
    if (!this._ctx || this._muted) return;
    if (this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const nodes = [];

    // Single output gain — fades in to unity over 5 s; stopAmbient ramps it to 0.
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(1.0, now + 5.0);
    mainGain.connect(this._master);

    // Helper: route osc → gain(gainVal) → mainGain
    const out = (osc, gainVal) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainVal, now);
      osc.connect(g);
      g.connect(mainGain);
    };

    // ── Layer 1: alpha-wave resonance ─────────────────────────────────────────
    // 130 Hz and 138 Hz sit 8 Hz apart → gentle beating at alpha frequency.
    // This is the tonal centre: warm, not bass-heavy.
    const root1 = ctx.createOscillator();
    root1.type = 'sine';
    root1.frequency.setValueAtTime(130, now);

    const root2 = ctx.createOscillator();
    root2.type = 'sine';
    root2.frequency.setValueAtTime(138, now);

    // Slow natural drift on root1 (0.07 Hz, ±0.7 Hz) — like a bowl's resonance
    // wandering as it rings. Keeps it from feeling static.
    const driftLfo = ctx.createOscillator();
    driftLfo.type = 'sine';
    driftLfo.frequency.setValueAtTime(0.07, now);
    const driftGain = ctx.createGain();
    driftGain.gain.setValueAtTime(0.7, now);
    driftLfo.connect(driftGain);
    driftGain.connect(root1.frequency);

    out(root1, 0.038);
    out(root2, 0.038);
    nodes.push(root1, root2, driftLfo);

    // ── Layer 2: harmonic overtones ───────────────────────────────────────────
    // Perfect fifth (195 Hz) and octave (260 Hz) above the root.
    // Pure consonance — the ear finds rest in these intervals.
    const fifth = ctx.createOscillator();
    fifth.type = 'sine';
    fifth.frequency.setValueAtTime(195, now);

    const octave = ctx.createOscillator();
    octave.type = 'sine';
    octave.frequency.setValueAtTime(260, now);

    out(fifth,  0.016);
    out(octave, 0.010);
    nodes.push(fifth, octave);

    // ── Layer 3: breathing warm noise ─────────────────────────────────────────
    // The meditative anchor. Bandpass noise at 220 Hz (warm, not harsh) with
    // amplitude modulated at 0.10 Hz — exactly 6 cycles/min, the "resonance
    // breathing" rate that activates the parasympathetic nervous system.
    // Visitors feel the space breathing with them without knowing why.
    const nbuf = ctx.createBufferSource();
    nbuf.buffer = this._makeNoiseBuffer(4.0);
    nbuf.loop = true;

    const nbp = ctx.createBiquadFilter();
    nbp.type = 'bandpass';
    nbp.frequency.setValueAtTime(220, now);
    nbp.Q.setValueAtTime(0.35, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.026, now);  // base level

    // Breathing LFO: output ±0.018 added to 0.026 → gain swells 0.008 → 0.044
    const breathLfo = ctx.createOscillator();
    breathLfo.type = 'sine';
    breathLfo.frequency.setValueAtTime(0.10, now);
    const breathDepth = ctx.createGain();
    breathDepth.gain.setValueAtTime(0.018, now);
    breathLfo.connect(breathDepth);
    breathDepth.connect(nGain.gain);

    nbuf.connect(nbp);
    nbp.connect(nGain);
    nGain.connect(mainGain);
    nodes.push(nbuf, breathLfo);

    // ── Layer 4: crystalline shimmer ──────────────────────────────────────────
    // A pure 520 Hz sine (C5) with an ultra-slow vibrato (0.04 Hz, ±7 Hz).
    // Adds spaciousness and 'alive' quality — barely audible, just felt.
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(520, now);

    const shimLfo = ctx.createOscillator();
    shimLfo.type = 'sine';
    shimLfo.frequency.setValueAtTime(0.04, now);
    const shimLfoG = ctx.createGain();
    shimLfoG.gain.setValueAtTime(7, now);
    shimLfo.connect(shimLfoG);
    shimLfoG.connect(shimmer.frequency);

    out(shimmer, 0.008);
    nodes.push(shimmer, shimLfo);

    nodes.forEach(n => n.start(now));

    this._drone = { nodes, mainGain };
    this._droneActive = true;
    this._scheduleAmbientPulse();
  },

  /**
   * _scheduleAmbientPulse() — a soft singing-bowl tone surfaces every 20–40 s.
   * It fades in slowly (1.5 s), holds briefly, then dissolves (total 7 s).
   * Never percussive. Like a monk softly striking a bowl across the room.
   */
  _scheduleAmbientPulse() {
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    const delay = 20000 + Math.random() * 20000;
    this._pulseTimer = setTimeout(() => {
      if (this._droneActive && !this._muted) {
        // 432 Hz — commonly used in meditation and sound-healing practice
        this._voice({ type: 'sine', f0: 432, f1: 432, dur: 7.0, peak: 0.016, attack: 1.5 });
      }
      if (this._droneActive) this._scheduleAmbientPulse();
    }, delay);
  },

  /** stopAmbient(fadeSec) — ramp mainGain to zero then stop all sources. */
  stopAmbient(fadeSec = 2.5) {
    if (this._pulseTimer) { clearTimeout(this._pulseTimer); this._pulseTimer = null; }
    if (!this._droneActive || !this._drone) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const { nodes, mainGain } = this._drone;

    mainGain.gain.cancelScheduledValues(now);
    mainGain.gain.setValueAtTime(mainGain.gain.value, now);
    mainGain.gain.linearRampToValueAtTime(0, now + fadeSec);

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
