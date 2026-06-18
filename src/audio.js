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
  _aiTimer: null,      // setTimeout id for AI-presence events (Layer 3)
  _deepTimer: null,    // setTimeout id for deep-space events (Layer 4)
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

  // ── Ambient bed — observation deck overlooking deep space ────────────────────

  /**
   * startAmbient() — a continuous, evolving space-ambient bed.
   * 80% space / 20% technology. The visitor sits inside a quiet orbital
   * observation deck: calm, intelligent, spacious. Nothing demands attention;
   * everything encourages curiosity. The bed fades into the background after a
   * minute while still making the experience feel immersive and premium.
   * No rhythm, no melody, no loop the ear can latch onto.
   *
   * Four continuous layers summed into a single mainGain (fades in over 8 s):
   *
   *   1. STATION HUM    warm bass chord (55 / 82 / 110 Hz) behind a steep lowpass
   *                     at 200 Hz — the dominant voice; the physical mass of the
   *                     station. Ultra-slow pitch drift, breathes over minutes.
   *   2. ATMOSPHERIC    narrow filtered noise (HP 280 → LP 750 Hz) — pressurised
   *                     air inside the hull. Barely there; prevents dead silence.
   *   3. HARMONIC       five quiet sines (110–440 Hz) each with its own amplitude
   *                     LFO at a different rate — the hull's resonance forever
   *                     shifting colour, never settling into an obvious chord.
   *   4. GLASS          ultra-faint high sines (1200 / 1800 Hz) through the shared
   *                     brightness lowpass — the observation window alive with
   *                     refracted starlight. Only noticed when brightened.
   *
   * Scheduled events:
   *   Cosmic resonance  15–30 s — a distant tonal event: overtone bloom, spectral
   *                     shimmer, or spatial harmonic. Rare, unhurried, spacious.
   *   Orbital pulse     20–40 s — a very low swell (≈40–50 Hz, peak 0.004) then
   *                     a smaller echo 5 s later: the reactor far below, felt more
   *                     than heard.
   */
  startAmbient() {
    if (!this._ctx || this._muted) return;
    if (this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const nodes = [];

    // Single output gain — fades in over 8 s so the bed is present before
    // the visitor consciously notices it.
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(1.0, now + 8.0);
    mainGain.connect(this._master);

    // Shared brightness lowpass — glass layer and cosmic shimmer events pass
    // through it; ambientBrighten() opens it momentarily on interactions.
    const brightFilter = ctx.createBiquadFilter();
    brightFilter.type = 'lowpass';
    brightFilter.frequency.setValueAtTime(1500, now);
    brightFilter.connect(mainGain);

    // Helper: osc → gain(level) → destination (mainGain by default)
    const out = (osc, level, dest = mainGain) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, now);
      osc.connect(g);
      g.connect(dest);
    };
    // Helper: a slow pitch-drift LFO bound to an oscillator's frequency
    const drift = (osc, rateHz, depthHz) => {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(rateHz, now);
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(depthHz, now);
      lfo.connect(dg);
      dg.connect(osc.frequency);
      nodes.push(lfo);
    };

    // ── Layer 1: STATION HUM ──────────────────────────────────────────────────
    // The dominant voice — the physical mass of the station. Three warm bass
    // sines behind a gentle lowpass, each drifting independently over minutes.
    const droneLP = ctx.createBiquadFilter();
    droneLP.type = 'lowpass';
    droneLP.frequency.setValueAtTime(280, now);
    droneLP.Q.setValueAtTime(0.5, now);
    droneLP.connect(mainGain);

    // 82/110/146 Hz — audible on laptop speakers, felt on headphones.
    [[82.41, 0.042, 0.009, 0.18],
     [110,   0.068, 0.012, 0.22],
     [146.83,0.052, 0.007, 0.14]].forEach(([freq, level, rate, depth]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      out(osc, level, droneLP);
      drift(osc, rate, depth);
      nodes.push(osc);
    });

    // ── Layer 2: ATMOSPHERIC AIR ──────────────────────────────────────────────
    // Narrow-band noise — pressurised air inside the hull. Barely audible;
    // prevents the silence feeling dead without adding noise-floor character.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this._makeNoiseBuffer(5.0);
    windSrc.loop = true;

    const windHP = ctx.createBiquadFilter();
    windHP.type = 'highpass';
    windHP.frequency.setValueAtTime(280, now);
    const windLP = ctx.createBiquadFilter();
    windLP.type = 'lowpass';
    windLP.frequency.setValueAtTime(750, now);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.008, now);
    // slow amplitude breathing (0.03 Hz, ±0.004)
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.03, now);
    const windDepth = ctx.createGain();
    windDepth.gain.setValueAtTime(0.004, now);
    windLfo.connect(windDepth);
    windDepth.connect(windGain.gain);

    const windPan = ctx.createStereoPanner();
    // very slow stereo drift (0.012 Hz, ±0.45)
    const panLfo = ctx.createOscillator();
    panLfo.type = 'sine';
    panLfo.frequency.setValueAtTime(0.012, now);
    const panDepth = ctx.createGain();
    panDepth.gain.setValueAtTime(0.45, now);
    panLfo.connect(panDepth);
    panDepth.connect(windPan.pan);

    windSrc.connect(windHP);
    windHP.connect(windLP);
    windLP.connect(windPan);
    windPan.connect(windGain);
    windGain.connect(mainGain);
    nodes.push(windSrc, windLfo, panLfo);

    // ── Layer 3: HARMONIC SHIMMER ─────────────────────────────────────────────
    // Five warm sines (110–440 Hz) with independent amplitude LFOs at different
    // rates. Never a static chord — colour shifts constantly, like the hull's
    // metal resonating faintly under the drone.
    [[110, 0.020, 0.019, 0.012],
     [165, 0.025, 0.022, 0.014],
     [220, 0.030, 0.017, 0.016],
     [330, 0.016, 0.013, 0.010],
     [440, 0.010, 0.009, 0.006]].forEach(([freq, base, rate, depth]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(base, now);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(rate, now);
      const ld = ctx.createGain();
      ld.gain.setValueAtTime(depth, now);
      lfo.connect(ld);
      ld.connect(g.gain);
      osc.connect(g);
      g.connect(mainGain);
      nodes.push(osc, lfo);
    });

    // ── Layer 4: GLASS INTERFACE ──────────────────────────────────────────────
    // Ultra-faint high sines through the brightness lowpass. Almost imperceptible
    // at rest; only surface as added sheen when ambientBrighten() opens the filter.
    [[1200, 0.0022, 0.03, 4],
     [1800, 0.0015, 0.02, 3]].forEach(([freq, level, rate, depth]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      out(osc, level, brightFilter);
      drift(osc, rate, depth);
      nodes.push(osc);
    });

    nodes.forEach(n => n.start(now));

    this._drone = { nodes, mainGain, brightFilter };
    this._droneActive = true;

    // Scheduled atmospheric events — rare, unhurried.
    this._scheduleCosmicResonance();
    this._scheduleOrbitalPulse();
  },

  /**
   * _scheduleCosmicResonance() — rare atmospheric events every 15–30 s.
   * A single distant tonal event surfaces from the void: an overtone bloom,
   * a spectral shimmer through the observation glass, or a spatial harmonic
   * drifting from another compartment. Always slow, quiet, and spacious —
   * noticed only subconsciously.
   */
  _scheduleCosmicResonance() {
    if (this._aiTimer) clearTimeout(this._aiTimer);
    const delay = 8000 + Math.random() * 10000;
    this._aiTimer = setTimeout(() => {
      if (this._droneActive && !this._muted) {
        const bright = this._drone?.brightFilter ?? this._master;
        const pick = Math.floor(Math.random() * 3);
        if (pick === 0) {
          // distant overtone — a single tone blooms slowly from the void
          const freq = 330 + Math.random() * 220;
          this._voice({ type: 'sine', f0: freq, f1: freq, dur: 8.0, peak: 0.008, attack: 2.5 });
        } else if (pick === 1) {
          // spectral shimmer — light refracting through the observation glass
          this._voice({ type: 'sine', f0: 880, f1: 920, dur: 5.0, peak: 0.006, attack: 2.0, dest: bright });
          this._noise({ dur: 1.2, peak: 0.004, attack: 0.8, when: 0.5,
                        filter: { type: 'bandpass', freq: 5000, q: 0.5 } });
        } else {
          // spatial harmonic — tonal drift, as if resonating in a distant compartment
          this._voice({ type: 'sine', f0: 185, f1: 200, dur: 9.0, peak: 0.007, attack: 3.0 });
        }
      }
      if (this._droneActive) this._scheduleCosmicResonance();
    }, delay);
  },

  /**
   * _scheduleOrbitalPulse() — every 20–40 s a very low resonance swell at
   * ≈38–52 Hz (peak 0.004): the station reactor somewhere far below, almost
   * imperceptible. A smaller echo follows 5 s later as if the pressure wave
   * reflected off the far hull. Felt more than heard; its absence would make
   * the station feel dead.
   */
  _scheduleOrbitalPulse() {
    if (this._deepTimer) clearTimeout(this._deepTimer);
    const delay = 20000 + Math.random() * 20000;
    this._deepTimer = setTimeout(() => {
      if (this._droneActive && !this._muted) {
        const freq = 55 + Math.random() * 18;  // 55–73 Hz, audible on most speakers
        // primary swell — reactor pressurising
        this._voice({ type: 'sine', f0: freq, f1: freq, dur: 9.0, peak: 0.008, attack: 2.5,
                      filter: { type: 'lowpass', freq: 180 } });
        // echo — slightly detuned, as if reflecting off the far hull
        this._voice({ type: 'sine', f0: freq * 0.97, f1: freq * 0.97, dur: 6.5, peak: 0.005,
                      attack: 1.8, when: 5.0, filter: { type: 'lowpass', freq: 160 } });
      }
      if (this._droneActive) this._scheduleOrbitalPulse();
    }, delay);
  },

  /**
   * ambientBrighten(addHz, durSec) — a dynamic reaction: momentarily open the
   * ambient brightness lowpass to let harmonic sheen through, then settle back.
   * Used on slide change / card open so the background feels connected to the
   * interface rather than separate from it. No-op when the bed isn't running.
   */
  ambientBrighten(addHz = 2600, durSec = 1.0) {
    if (!this._droneActive || !this._drone || this._muted) return;
    const f = this._drone.brightFilter;
    const now = this._ctx.currentTime;
    const base = 1500;
    f.frequency.cancelScheduledValues(now);
    f.frequency.setValueAtTime(f.frequency.value, now);
    f.frequency.linearRampToValueAtTime(base + addHz, now + 0.15);  // brighten fast
    f.frequency.linearRampToValueAtTime(base, now + durSec);         // settle slow
  },

  /** stopAmbient(fadeSec) — ramp mainGain to zero then stop all sources. */
  stopAmbient(fadeSec = 2.5) {
    if (this._aiTimer)   { clearTimeout(this._aiTimer);   this._aiTimer = null; }
    if (this._deepTimer) { clearTimeout(this._deepTimer); this._deepTimer = null; }
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
   *   dest              output node to connect to (defaults to master)
   */
  _voice({ type = 'sine', f0, f1 = f0, dur, peak, attack = 0.005, when = 0, filter = null, dest = null }) {
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
    gain.connect(dest || this._master);

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
