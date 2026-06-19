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
  _master: null,       // GainNode → destination (global; mute rides this)
  _sfx: null,          // SFX/UI bus gain → master (separate from ambient bed)
  _drone: null,        // bundle of ambient nodes | null
  _droneActive: false,
  _layerGains: null,   // { layerName: GainNode } live ambient layer gains | null
  _aiTimer: null,      // setTimeout id for the arpeggio shimmer
  _deepTimer: null,    // setTimeout id for the orbital pulse
  _chordTimer: null,   // setTimeout id for the chord progression stepper
  _currentChord: null, // frequencies of the chord currently sounding (for the arp)
  _stepTimer: 0,       // seconds accumulator for footstep rhythm
  _muted: false,
  sfxVolume: 0.76,     // UI/SFX bus multiplier (dat.GUI)
  _arpStyle: 'default', // current arpeggio style, set per-slide via setArpStyle()

  // Ambient mixer — per-layer volume + on/off, all live-editable from dat.GUI.
  // `master` is the whole bed's level; the rest are per-layer multipliers where
  // 1.0 ≈ the level each layer was designed at.
  ambientMix: { master: 0.44, pad: 0.11, bass: 0.24, reverb: 0.71, arp: 2.0, pulse: 0.3, harmonica: 0.46, choir: 0.98 },
  ambientOn:  { master: true, pad: true, bass: false, reverb: true, arp: true, pulse: false, harmonica: false, choir: true },

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

      // SFX/UI bus — all interaction cues route here so their volume can be
      // tuned independently of the ambient bed (dat.GUI → audio.sfxVolume).
      this._sfx = this._ctx.createGain();
      this._sfx.gain.setValueAtTime(this.sfxVolume, this._ctx.currentTime);
      this._sfx.connect(this._master);
    }

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  },

  // ── Ambient bed — Interstellar-style harmonic space ──────────────────────────

  /**
   * startAmbient() — a slow, evolving, genuinely *harmonic* space ambient.
   *
   * The heart is a four-chord hymn (C–Am–F–G) played on organ-like tones and
   * cycled extremely slowly, so the harmony actually *moves* — yearning,
   * spacious, cinematic (Interstellar's pipe organ, not a static drone). It's
   * wrapped in a long cathedral reverb tail for the sense of a vast, near-silent
   * station, with a sparse high arpeggio shimmering above like distant stars.
   *
   * Continuous structure (all → mainGain, fades in over 8 s):
   *
   *   ORGAN PAD   Two banks (A/B) each render the current chord as four organ
   *               voices (fundamental + octave). On each chord change the silent
   *               bank is retuned and the two banks crossfade over 7 s — no click,
   *               no glissando, just one chord melting into the next. Held ~16 s
   *               per chord. A slow swell LFO makes the whole pad breathe.
   *   BASS ROOT   One sine an octave below the chord's root, gliding legato —
   *               weight on headphones without muddying small speakers.
   *   REVERB      A damped stereo feedback delay gives every voice a long, wide
   *               tail: the cathedral-in-space ambience.
   *
   * Scheduled events:
   *   Arpeggio    11–20 s — the chord tones shimmer upward one octave, sparse and
   *               soft: the Interstellar twinkle, stars not a clock. Routed through
   *               the brightness filter (so ambientBrighten() makes it sparkle) and
   *               into the reverb.
   *   Orbital pulse 20–40 s — a low reactor swell + echo, felt more than heard.
   */
  startAmbient() {
    if (!this._ctx || this._muted) return;
    if (this._droneActive) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const nodes = [];

    // Ambient master gain — fades in over 8 s; level/on-off live-editable via
    // dat.GUI (audio.ambientMix.master / audio.ambientOn.master).
    const initLevel = (name) => (this.ambientOn[name] ? this.ambientMix[name] : 0);
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(initLevel('master'), now + 8.0);
    mainGain.connect(this._master);

    // ── Cathedral reverb — damped stereo feedback delay ───────────────────────
    // reverbIn feeds two delay lines that cross-feed each other through lowpass
    // damping (warm tail) and pan hard-ish L/R for width. Loop gain < 1 so it
    // decays over several seconds — a vast, soft space. reverbOut is the wet
    // level knob exposed to the GUI.
    const reverbIn = ctx.createGain();
    const dL = ctx.createDelay(1.0); dL.delayTime.setValueAtTime(0.31, now);
    const dR = ctx.createDelay(1.0); dR.delayTime.setValueAtTime(0.43, now);
    const dampL = ctx.createBiquadFilter(); dampL.type = 'lowpass'; dampL.frequency.setValueAtTime(1600, now);
    const dampR = ctx.createBiquadFilter(); dampR.type = 'lowpass'; dampR.frequency.setValueAtTime(1600, now);
    const fbL = ctx.createGain(); fbL.gain.setValueAtTime(0.42, now);
    const fbR = ctx.createGain(); fbR.gain.setValueAtTime(0.42, now);
    const panL = ctx.createStereoPanner(); panL.pan.setValueAtTime(-0.5, now);
    const panR = ctx.createStereoPanner(); panR.pan.setValueAtTime(0.5, now);
    const wet  = ctx.createGain(); wet.gain.setValueAtTime(0.38, now);
    const reverbOut = ctx.createGain(); reverbOut.gain.setValueAtTime(initLevel('reverb'), now);
    reverbIn.connect(dL); reverbIn.connect(dR);
    dL.connect(dampL); dampL.connect(fbL); fbL.connect(dR);
    dR.connect(dampR); dampR.connect(fbR); fbR.connect(dL);
    dL.connect(panL); dR.connect(panR);
    panL.connect(wet); panR.connect(wet); wet.connect(reverbOut); reverbOut.connect(mainGain);

    // Shared brightness lowpass — the arpeggio passes through it (dry to mainGain
    // and into the reverb); ambientBrighten() opens it momentarily on interactions.
    const brightFilter = ctx.createBiquadFilter();
    brightFilter.type = 'lowpass';
    brightFilter.frequency.setValueAtTime(2600, now);
    brightFilter.connect(mainGain);
    brightFilter.connect(reverbIn);
    // Arpeggio bus (level knob) → brightness filter; orbital-pulse bus → mainGain.
    const arpGain = ctx.createGain(); arpGain.gain.setValueAtTime(initLevel('arp'), now);
    arpGain.connect(brightFilter);
    const pulseGain = ctx.createGain(); pulseGain.gain.setValueAtTime(initLevel('pulse'), now);
    pulseGain.connect(mainGain);

    // ── ORGAN PAD — the harmonic centre ───────────────────────────────────────
    // A slow Interstellar hymn. Each chord is voiced as four notes; common tones
    // between chords keep the crossfades smooth (good voice-leading).
    const CHORDS = [
      [261.63, 329.63, 392.00, 587.33], // C add9  (C  E  G  D)
      [220.00, 329.63, 392.00, 493.88], // A m7    (A  E  G  B)
      [174.61, 261.63, 349.23, 440.00], // F maj   (F  C  F  A)
      [196.00, 293.66, 392.00, 493.88], // G maj   (G  D  G  B)
    ];
    const NOTE_GAIN = [0.060, 0.052, 0.044, 0.032]; // lower notes carry more weight

    // Pad → lowpass → swell (organ breathing) → padOut (level knob) → mainGain,
    // with a send to reverb that scales with the pad's own level.
    const padSwell = ctx.createGain();
    padSwell.gain.setValueAtTime(0.9, now);
    const swellLfo = ctx.createOscillator();
    swellLfo.type = 'sine';
    swellLfo.frequency.setValueAtTime(0.04, now);
    const swellDepth = ctx.createGain();
    swellDepth.gain.setValueAtTime(0.12, now);
    swellLfo.connect(swellDepth);
    swellDepth.connect(padSwell.gain);
    nodes.push(swellLfo);

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(3000, now);
    padFilter.connect(padSwell);
    const padOut = ctx.createGain(); padOut.gain.setValueAtTime(initLevel('pad'), now);
    padSwell.connect(padOut); padOut.connect(mainGain);
    const reverbSend = ctx.createGain();
    reverbSend.gain.setValueAtTime(0.3, now);
    padOut.connect(reverbSend);
    reverbSend.connect(reverbIn);

    // A bank = four organ voices (fundamental + octave each), summed into one
    // gain we can crossfade. setChord() retunes all eight oscillators at once.
    const makeBank = () => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.connect(padFilter);
      const fund = [], oct = [];
      for (let i = 0; i < 4; i++) {
        const o1 = ctx.createOscillator(); o1.type = 'sine';
        const g1 = ctx.createGain(); g1.gain.setValueAtTime(NOTE_GAIN[i], now);
        o1.connect(g1); g1.connect(g);
        const o2 = ctx.createOscillator(); o2.type = 'sine';
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(NOTE_GAIN[i] * 0.35, now);
        o2.connect(g2); g2.connect(g);
        fund.push(o1); oct.push(o2);
        nodes.push(o1, o2);
      }
      const setChord = (freqs) => {
        const t = ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          fund[i].frequency.setValueAtTime(freqs[i], t);
          oct[i].frequency.setValueAtTime(freqs[i] * 2, t);
        }
      };
      return { gain: g.gain, setChord };
    };
    const bankA = makeBank();
    const bankB = makeBank();

    // Bass root — an octave below the chord's lowest note, gliding legato.
    const bassOsc = ctx.createOscillator(); bassOsc.type = 'sine';
    const bassGain = ctx.createGain(); bassGain.gain.setValueAtTime(0.05, now);
    const bassLP = ctx.createBiquadFilter();
    bassLP.type = 'lowpass'; bassLP.frequency.setValueAtTime(220, now);
    const bassOut = ctx.createGain(); bassOut.gain.setValueAtTime(initLevel('bass'), now);
    bassOsc.connect(bassLP); bassLP.connect(bassGain); bassGain.connect(bassOut); bassOut.connect(mainGain);
    nodes.push(bassOsc);

    // ── SPACE HARMONICA — soft reedy double-stop, vibrato, drenched in reverb ──
    // Two sawtooth voices (chord root + fifth, an octave up) through a bandpass
    // formant give the breathy free-reed honk; a 5 Hz vibrato and a very slow
    // tremolo keep it chilled and human. Routed to both mainGain and the reverb.
    const harmGain = ctx.createGain(); harmGain.gain.setValueAtTime(initLevel('harmonica'), now);
    harmGain.connect(mainGain); harmGain.connect(reverbIn);
    const harmTrem = ctx.createGain(); harmTrem.gain.setValueAtTime(0.6, now);
    harmTrem.connect(harmGain);
    const tremLfo = ctx.createOscillator(); tremLfo.type = 'sine'; tremLfo.frequency.setValueAtTime(0.07, now);
    const tremDepth = ctx.createGain(); tremDepth.gain.setValueAtTime(0.25, now);
    tremLfo.connect(tremDepth); tremDepth.connect(harmTrem.gain); nodes.push(tremLfo);
    const harmFilter = ctx.createBiquadFilter();
    harmFilter.type = 'bandpass'; harmFilter.frequency.setValueAtTime(950, now); harmFilter.Q.setValueAtTime(0.8, now);
    harmFilter.connect(harmTrem);
    const vibLfo = ctx.createOscillator(); vibLfo.type = 'sine'; vibLfo.frequency.setValueAtTime(5.2, now);
    const vibDepth = ctx.createGain(); vibDepth.gain.setValueAtTime(3.0, now); // ±3 Hz
    vibLfo.connect(vibDepth); nodes.push(vibLfo);
    const harmOscs = [];
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const og = ctx.createGain(); og.gain.setValueAtTime(k === 0 ? 0.020 : 0.013, now);
      vibDepth.connect(o.frequency);
      o.connect(og); og.connect(harmFilter);
      harmOscs.push(o); nodes.push(o);
    }
    const setHarmonica = (chord) => {
      const t = ctx.currentTime;
      harmOscs[0].frequency.setTargetAtTime(chord[0] * 2, t, 1.2);
      harmOscs[1].frequency.setTargetAtTime(chord[2] * 2, t, 1.2);
    };
    setHarmonica(CHORDS[0]);

    // ── COSMIC CHOIR — very soft high airy pad on the chord's upper tones ──────
    const choirGain = ctx.createGain(); choirGain.gain.setValueAtTime(initLevel('choir'), now);
    choirGain.connect(mainGain); choirGain.connect(reverbIn);
    const choirOscs = [];
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const og = ctx.createGain(); og.gain.setValueAtTime(0.010 - k * 0.002, now);
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.setValueAtTime(0.05 + k * 0.02, now);
      const ld = ctx.createGain(); ld.gain.setValueAtTime(0.004, now);
      lfo.connect(ld); ld.connect(og.gain);
      o.connect(og); og.connect(choirGain);
      choirOscs.push(o); nodes.push(o, lfo);
    }
    const setChoir = (chord) => {
      const t = ctx.currentTime;
      choirOscs[0].frequency.setTargetAtTime(chord[1] * 2, t, 2.0);
      choirOscs[1].frequency.setTargetAtTime(chord[2] * 2, t, 2.0);
      choirOscs[2].frequency.setTargetAtTime(chord[3] * 2, t, 2.0);
    };
    setChoir(CHORDS[0]);

    // First chord — rise in with the bed.
    bankA.setChord(CHORDS[0]);
    bankA.gain.linearRampToValueAtTime(1.0, now + 8.0);
    bassOsc.frequency.setValueAtTime(CHORDS[0][0] * 0.5, now);
    this._currentChord = CHORDS[0];

    nodes.forEach(n => n.start(now));

    this._drone = { nodes, mainGain, brightFilter };
    this._layerGains = {
      master: mainGain, pad: padOut, bass: bassOut, reverb: reverbOut,
      arp: arpGain, pulse: pulseGain, harmonica: harmGain, choir: choirGain,
    };
    this._droneActive = true;

    // ── Chord stepper — crossfade to the next chord every ~16 s ────────────────
    const XF = 7.0, HOLD = 16000;
    let chordIdx = 0, active = bankA, idle = bankB;
    const stepChord = () => {
      if (!this._droneActive) return;
      chordIdx = (chordIdx + 1) % CHORDS.length;
      const chord = CHORDS[chordIdx];
      const t = this._ctx.currentTime;
      idle.setChord(chord);
      active.gain.cancelScheduledValues(t);
      active.gain.setValueAtTime(active.gain.value, t);
      active.gain.linearRampToValueAtTime(0, t + XF);
      idle.gain.cancelScheduledValues(t);
      idle.gain.setValueAtTime(idle.gain.value, t);
      idle.gain.linearRampToValueAtTime(1.0, t + XF);
      bassOsc.frequency.setTargetAtTime(chord[0] * 0.5, t, 1.5);
      setHarmonica(chord);
      setChoir(chord);
      this._currentChord = chord;
      [active, idle] = [idle, active];
      this._chordTimer = setTimeout(stepChord, HOLD);
    };
    this._chordTimer = setTimeout(stepChord, HOLD);

    // Scheduled events.
    this._scheduleArpeggio();
    this._scheduleOrbitalPulse();
  },

  /**
   * _scheduleArpeggio() — schedules the next arpeggio burst based on the current
   * _arpStyle (set per-slide via setArpStyle). Each style has its own timing range
   * and pattern character so the music adapts to each slide's mood.
   */
  _scheduleArpeggio() {
    if (this._aiTimer) clearTimeout(this._aiTimer);
    const style = this._arpStyle;

    // Per-style timing [minMs, maxMs] — cascade/invitation are more frequent since
    // those slides are lively; breath/starfield are sparse for calm slides.
    const TIMING = {
      starfield:  [10000, 18000],
      cascade:    [4000,   7000],
      fanfare:    [6000,  10000],
      breath:     [12000, 18000],
      timeline:   [5000,   9000],
      scan:       [7000,  11000],
      invitation: [5000,   8000],
      ascent:     [6000,  10000],
      default:    [6000,  11000],
    };
    const [tMin, tMax] = TIMING[style] ?? TIMING.default;
    const delay = tMin + Math.random() * (tMax - tMin);

    this._aiTimer = setTimeout(() => {
      if (this._droneActive && !this._muted && this._currentChord) {
        const dest = this._layerGains?.arp ?? this._master;
        const ALL = ['starfield','cascade','fanfare','breath','timeline','scan','invitation','ascent'];
        const s = style === 'default' ? ALL[Math.floor(Math.random() * ALL.length)] : style;
        this._playArpPattern(s, this._currentChord, dest);
      }
      if (this._droneActive) this._scheduleArpeggio();
    }, delay);
  },

  /**
   * _playArpPattern(style, chord, dest) — play one arpeggio burst.
   * Each style has a distinct character matched to a slide's mood.
   */
  _playArpPattern(style, chord, dest) {
    switch (style) {
      case 'starfield': {
        // Sparse 2-3 notes, very high register, long decay — Intro: starfield drifting
        const notes = [...chord].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
        notes.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 4, f1: f * 4, dur: 2.5, peak: 0.008, attack: 0.1, when: i * 0.9, dest });
        });
        break;
      }
      case 'cascade': {
        // Fast ascending run up two octaves + high sparkle — Skills: energetic, lively
        const step = 0.18;
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 1.2, peak: 0.014, attack: 0.01, when: i * step, dest });
          this._voice({ type: 'sine', f0: f * 4, f1: f * 4, dur: 0.8, peak: 0.008, attack: 0.01, when: i * step + 0.08, dest });
        });
        this._voice({ type: 'sine', f0: chord[0] * 8, f1: chord[0] * 8, dur: 1.0, peak: 0.006, attack: 0.02, when: chord.length * step + 0.1, dest });
        break;
      }
      case 'fanfare': {
        // Near-simultaneous chord bloom — Projects: confident, decisive
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 2.2, peak: 0.013, attack: 0.04, when: i * 0.12, dest });
        });
        this._voice({ type: 'sine', f0: chord[0] * 4, f1: chord[0] * 4, dur: 1.8, peak: 0.010, attack: 0.08, when: 0.7, dest });
        break;
      }
      case 'breath': {
        // Very slow wide spread, long sustain — Mindset: contemplative, spacious
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 3.0, peak: 0.010, attack: 0.3, when: i * 0.8, dest });
        });
        break;
      }
      case 'timeline': {
        // Rhythmic ping-pong between low and high pairs — Experience: steady, measured
        const pairs = [
          [chord[0] * 2, chord[2] * 2],
          [chord[1] * 2, chord[3] * 2],
          [chord[0] * 2, chord[2] * 2],
        ];
        pairs.forEach(([lo, hi], i) => {
          this._voice({ type: 'sine', f0: lo, f1: lo, dur: 1.0, peak: 0.012, attack: 0.01, when: i * 0.5, dest });
          this._voice({ type: 'sine', f0: hi, f1: hi, dur: 1.0, peak: 0.010, attack: 0.01, when: i * 0.5 + 0.25, dest });
        });
        break;
      }
      case 'scan': {
        // Non-sequential order (3-1-4-2) with bandpass tint — About: mysterious
        const order = [chord[2], chord[0], chord[3], chord[1]];
        order.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 1.4, peak: 0.011, attack: 0.02,
                        when: i * 0.35, filter: { type: 'bandpass', freq: f * 2.5, q: 1.5 }, dest });
        });
        break;
      }
      case 'invitation': {
        // Warm ascending shimmer + two extra sparkles at top — CTA: welcoming, warm
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 1.8, peak: 0.013, attack: 0.025, when: i * 0.38, dest });
        });
        this._voice({ type: 'sine', f0: chord[0] * 4, f1: chord[0] * 4, dur: 1.4, peak: 0.010, attack: 0.02, when: chord.length * 0.38, dest });
        this._voice({ type: 'sine', f0: chord[2] * 4, f1: chord[2] * 4, dur: 1.2, peak: 0.008, attack: 0.02, when: chord.length * 0.38 + 0.2, dest });
        break;
      }
      case 'ascent': {
        // Two-octave walk: first octave then second — MyWorld: expanding wonder
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 1.5, peak: 0.012, attack: 0.02, when: i * 0.3, dest });
        });
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 4, f1: f * 4, dur: 1.2, peak: 0.009, attack: 0.02, when: chord.length * 0.3 + i * 0.25, dest });
        });
        break;
      }
      default: {
        // Original ascending shimmer — safe fallback
        chord.forEach((f, i) => {
          this._voice({ type: 'sine', f0: f * 2, f1: f * 2, dur: 1.6, peak: 0.012, attack: 0.02, when: i * 0.42, dest });
        });
        this._voice({ type: 'sine', f0: chord[0] * 4, f1: chord[0] * 4, dur: 1.8, peak: 0.008, attack: 0.03, when: 4 * 0.42, dest });
        break;
      }
    }

    // Eerie high tail — the soft gliding sine that originally ended the About
    // "scan" arpeggio, now under every style. Long attack + low peak + the arp
    // bus's reverb send keep it sitting smoothly in the background rather than
    // standing out as a distinct note.
    this._playArpTail(chord, dest);
  },

  /**
   * _playArpTail(chord, dest) — a single soft, slow high sine gliding between
   * two upper chord tones. Swells in gently and lingers, bathed in reverb, so
   * each arpeggio drifts off into a faint ethereal shimmer.
   */
  _playArpTail(chord, dest) {
    this._voice({ type: 'sine', f0: chord[1] * 4, f1: chord[3] * 4, dur: 3.0, peak: 0.005,
                  attack: 0.8, when: 0.4, filter: { type: 'bandpass', freq: chord[2] * 3, q: 0.7 }, dest });
  },

  /**
   * _scheduleOrbitalPulse() — every 20–40 s a low resonance swell at ≈110–165 Hz:
   * the station reactor somewhere far below. A smaller echo follows 5 s later as
   * if the pressure wave reflected off the far hull. Felt more than heard; its
   * absence would make the station feel dead.
   */
  _scheduleOrbitalPulse() {
    if (this._deepTimer) clearTimeout(this._deepTimer);
    const delay = 20000 + Math.random() * 20000;
    this._deepTimer = setTimeout(() => {
      if (this._droneActive && !this._muted) {
        const dest = this._layerGains?.pulse ?? this._master;
        const freq = 110 + Math.random() * 55;  // 110–165 Hz, audible on iPhone and up
        // primary swell — reactor pressurising
        this._voice({ type: 'sine', f0: freq, f1: freq, dur: 9.0, peak: 0.012, attack: 2.5,
                      filter: { type: 'lowpass', freq: 300 }, dest });
        // echo — slightly detuned, as if reflecting off the far hull
        this._voice({ type: 'sine', f0: freq * 0.97, f1: freq * 0.97, dur: 6.5, peak: 0.008,
                      attack: 1.8, when: 5.0, filter: { type: 'lowpass', freq: 260 }, dest });
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
    const base = 2600;
    f.frequency.cancelScheduledValues(now);
    f.frequency.setValueAtTime(f.frequency.value, now);
    f.frequency.linearRampToValueAtTime(base + addHz, now + 0.15);  // brighten fast
    f.frequency.linearRampToValueAtTime(base, now + durSec);         // settle slow
  },

  /** stopAmbient(fadeSec) — ramp mainGain to zero then stop all sources. */
  stopAmbient(fadeSec = 2.5) {
    if (this._aiTimer)    { clearTimeout(this._aiTimer);    this._aiTimer = null; }
    if (this._deepTimer)  { clearTimeout(this._deepTimer);  this._deepTimer = null; }
    if (this._chordTimer) { clearTimeout(this._chordTimer); this._chordTimer = null; }
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
    this._layerGains = null;
    this._droneActive = false;
  },

  // ── Live mixer (dat.GUI) ──────────────────────────────────────────────────────

  /**
   * _applyLayer(name) — push the current ambientMix/ambientOn state for one layer
   * onto its live gain node with a short ramp (no click). No-op if not running.
   */
  _applyLayer(name) {
    const node = this._layerGains?.[name];
    if (!node || !this._ctx) return;
    const level = this.ambientOn[name] ? this.ambientMix[name] : 0;
    const now = this._ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(level, now + 0.2);
  },

  /** setAmbientLevel(name, v) — set a layer's volume (0…2) live. */
  setAmbientLevel(name, v) {
    if (name in this.ambientMix) { this.ambientMix[name] = v; this._applyLayer(name); }
  },

  /** setAmbientEnabled(name, on) — stop/play a single ambient layer. */
  setAmbientEnabled(name, on) {
    if (name in this.ambientOn) { this.ambientOn[name] = on; this._applyLayer(name); }
  },

  /** setSfxVolume(v) — set the UI/SFX bus volume (0…2) live. */
  setSfxVolume(v) {
    this.sfxVolume = v;
    if (!this._sfx) return;
    const now = this._ctx.currentTime;
    this._sfx.gain.cancelScheduledValues(now);
    this._sfx.gain.setValueAtTime(this._sfx.gain.value, now);
    this._sfx.gain.linearRampToValueAtTime(v, now + 0.1);
  },

  /**
   * setArpStyle(slideName) — switch the arpeggio character to match a slide.
   * Reschedules the pending arpeggio timer so the new timing takes effect
   * immediately rather than waiting out the previous style's interval.
   */
  setArpStyle(slideName) {
    const MAP = {
      intro:      'starfield',
      skills:     'cascade',
      projects:   'fanfare',
      mindset:    'breath',
      experience: 'timeline',
      about:      'scan',
      cta:        'invitation',
      myworld:    'ascent',
    };
    const next = MAP[slideName] ?? 'default';
    if (this._arpStyle === next) return;
    this._arpStyle = next;
    if (this._droneActive) this._scheduleArpeggio();
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
    gain.connect(dest || this._sfx || this._master);

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
    gain.connect(this._sfx || this._master);

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
