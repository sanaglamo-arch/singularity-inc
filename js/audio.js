/* Procedural SFX via WebAudio -> window.GAME_AUDIO. Off by default.
   No external audio files (zero external requests).

   STUDIO overhaul (R20): every cue is a multi-layered envelope with body + tail,
   sharing a common tonal center and a single procedurally-generated convolution
   reverb send so the whole palette feels like one mastered instrument. The dry
   signal still runs through a gentle lowpass + master gain + limiter so stacked
   SFX never clip or get harsh; a voice cap stops pile-up on rapid tapping; nodes
   are always stopped/disconnected after their envelope (no oscillator leaks).

   Public API is UNCHANGED — every method previously called still exists with the
   same name/signature: setEnabled, isEnabled, setVolume, getVolume, tap, buy,
   prestige, achievement, milestone, buildDone, researchDone, hireDone, funding,
   insight, breakthrough, singularity, incident, error, release, suspend, resume. */
(function () {
  'use strict';
  var ctx = null, enabled = false;
  var master = null, limiter = null, lp = null;
  var dryBus = null, wetBus = null, convolver = null;   // shared reverb send
  var voices = 0, MAX_VOICES = 18;   // hard cap so a tap storm can't pile up
  var MASTER_BASE = 0.85;            // baseline master gain (the "100%" reference)
  var vol = 1;                       // user SFX volume 0..1 (scales MASTER_BASE)

  // ── Procedural convolution reverb impulse (no external files) ───────────────
  // A short, smooth room: stereo noise with exponential decay. Generated once.
  function makeImpulse(c, seconds, decay) {
    var rate = c.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = c.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        // slight early-reflection shaping + exponential tail
        var t = i / len;
        var env = Math.pow(1 - t, decay);
        d[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buf;
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // master chain: [dry+wet] -> lowpass -> master gain -> limiter -> out
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7600; lp.Q.value = 0.4;
      master = ctx.createGain(); master.gain.value = MASTER_BASE * vol;
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 14; limiter.ratio.value = 6;
      limiter.attack.value = 0.003; limiter.release.value = 0.18;
      lp.connect(master); master.connect(limiter); limiter.connect(ctx.destination);

      // dry + reverb send. Both feed the lowpass so the limiter catches everything.
      dryBus = ctx.createGain(); dryBus.gain.value = 1.0; dryBus.connect(lp);
      try {
        convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx, 1.6, 3.2);
        wetBus = ctx.createGain(); wetBus.gain.value = 0.5; // reverb return level
        var wetIn = ctx.createGain(); wetIn.gain.value = 1.0;
        // wetBus is the SEND target voices connect to; route send -> convolver -> wetIn -> lp
        wetBus.connect(convolver); convolver.connect(wetIn); wetIn.connect(lp);
      } catch (e) { convolver = null; wetBus = null; }
    } catch (e) { ctx = null; }
    return ctx;
  }

  // A single shaped voice: gentle exp attack + smooth release (no clicks), with
  // an adjustable reverb send. type/gain/dur as before; opts extends it.
  //  opts: { attack, glide, send (0..1 reverb), pan (-1..1), wave shaping via type }
  function voice(freq, dur, type, gain, opts) {
    if (!enabled) return;
    var c = ensure(); if (!c || !lp || !dryBus) return;
    if (voices >= MAX_VOICES) return;
    try {
      if (c.state === 'suspended') c.resume();
      opts = opts || {};
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      var t = c.currentTime;
      var d = dur || 0.12;
      o.frequency.setValueAtTime(freq, t);
      if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glide), t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.06, t + (opts.attack || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(dryBus);
      if (wetBus && opts.send) {
        var s = c.createGain();
        s.gain.value = Math.max(0, Math.min(1, opts.send));
        g.connect(s); s.connect(wetBus);
      }
      o.start(t); o.stop(t + d + 0.03);
      voices++;
      o.onended = function () { voices = Math.max(0, voices - 1); try { o.disconnect(); g.disconnect(); } catch (e) {} };
    } catch (e) {}
  }

  // A filtered noise "transient" layer — gives thuds/sparkles a real body/air.
  // dur short. tone: lowpass(=='thud') vs highpass/bandpass(=='air'). send for tail.
  function noise(dur, gain, kind, freq, send) {
    if (!enabled) return;
    var c = ensure(); if (!c || !lp || !dryBus) return;
    if (voices >= MAX_VOICES) return;
    try {
      if (c.state === 'suspended') c.resume();
      var d = dur || 0.12;
      var len = Math.max(1, Math.floor(c.sampleRate * d));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var arr = buf.getChannelData(0);
      for (var i = 0; i < len; i++) arr[i] = (Math.random() * 2 - 1);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter();
      if (kind === 'air') { f.type = 'highpass'; f.frequency.value = freq || 2400; f.Q.value = 0.7; }
      else if (kind === 'band') { f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 1.2; }
      else { f.type = 'lowpass'; f.frequency.value = freq || 320; f.Q.value = 0.8; }
      var g = c.createGain();
      var t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(dryBus);
      if (wetBus && send) { var sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(wetBus); }
      src.start(t); src.stop(t + d + 0.02);
      voices++;
      src.onended = function () { voices = Math.max(0, voices - 1); try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
    } catch (e) {}
  }

  function seq(notes, step, build) { notes.forEach(function (n, i) { setTimeout(function () { build(n, i); }, i * step); }); }

  window.GAME_AUDIO = {
    setEnabled: function (b) { enabled = !!b; if (enabled) ensure(); },
    isEnabled: function () { return enabled; },
    // SFX volume 0..1, scales the master gain. Applied live if the graph exists.
    setVolume: function (v) {
      vol = Math.max(0, Math.min(1, Number(v)));
      if (isNaN(vol)) vol = 1;
      if (master) { try { master.gain.value = MASTER_BASE * vol; } catch (e) {} }
    },
    getVolume: function () { return vol; },

    // ── CLICK / TAP ── soft tonal pluck with a faint body + tiny air, light reverb.
    // heat (0..1, the overclock combo) RAISES the pitch so a hot streak climbs in
    // tone — the slot-machine "almost there" feel (hook, first 90s).
    tap: function (heat) {
      var h = (typeof heat === 'number' && heat > 0) ? Math.max(0, Math.min(1, heat)) : 0;
      var base = 360 + h * 520;                 // 360Hz cold → ~880Hz fully overclocked
      var f = base + Math.random() * 40;
      voice(f, 0.085, 'triangle', 0.05, { attack: 0.003, glide: f * 0.96, send: 0.10 });
      voice(f * 2, 0.045, 'sine', 0.018 + 0.02 * h, { attack: 0.002, send: 0.06 });  // pluck overtone
      if (h > 0.5) voice(f * 3, 0.05, 'sine', 0.014 * h, { attack: 0.002, send: 0.12 }); // shimmer at heat
    },

    // ── BUY / PURCHASE ── warm confirm: rounded low body + clean upper fifth + soft tail.
    buy: function () {
      voice(392, 0.13, 'triangle', 0.055, { attack: 0.006, send: 0.14 });
      voice(523, 0.10, 'sine', 0.04, { attack: 0.004, send: 0.10 });
      setTimeout(function () {
        voice(784, 0.16, 'sine', 0.045, { attack: 0.004, send: 0.20 });
        voice(1175, 0.10, 'sine', 0.018, { attack: 0.003, send: 0.18 });
      }, 60);
    },

    // ── PRESTIGE ── ascending arpeggio with octave shimmer + reverb bloom.
    prestige: function () {
      seq([392, 523, 659, 784, 1047], 80, function (f, i) {
        voice(f, 0.34, 'sawtooth', 0.045, { attack: 0.006, send: 0.22 });
        voice(f * 2, 0.20, 'sine', 0.02, { attack: 0.004, send: 0.26 });
      });
    },

    // ── ACHIEVEMENT ── two warm chimes (rising fourth) with tails.
    achievement: function () {
      voice(660, 0.16, 'sine', 0.05, { attack: 0.004, send: 0.18 });
      voice(990, 0.10, 'sine', 0.018, { attack: 0.003, send: 0.14 });
      setTimeout(function () {
        voice(880, 0.22, 'sine', 0.05, { attack: 0.004, send: 0.24 });
        voice(1320, 0.12, 'sine', 0.018, { attack: 0.003, send: 0.20 });
      }, 90);
    },

    // ── MILESTONE / THRESHOLD ── bright chord stab (triad together) + air sparkle.
    milestone: function () {
      [523, 659, 784].forEach(function (f) {
        voice(f, 0.26, 'triangle', 0.05, { attack: 0.004, send: 0.22 });
        voice(f * 2, 0.16, 'sine', 0.015, { attack: 0.003, send: 0.24 });
      });
      noise(0.12, 0.025, 'air', 5000, 0.3);
    },

    // ── BUILD DONE ── low→high "online" two-note (datacenter humming up), with body.
    buildDone: function () {
      voice(330, 0.18, 'triangle', 0.05, { attack: 0.008, send: 0.16 });
      voice(165, 0.20, 'sine', 0.03, { attack: 0.01, send: 0.10 });
      setTimeout(function () { voice(495, 0.24, 'triangle', 0.05, { attack: 0.006, send: 0.22 }); voice(990, 0.14, 'sine', 0.016, { send: 0.20 }); }, 110);
    },

    // ── RESEARCH DONE ── bright quick three-note run, light and airy.
    researchDone: function () {
      seq([784, 988, 1319], 58, function (f) { voice(f, 0.16, 'sine', 0.045, { attack: 0.003, send: 0.22 }); voice(f * 1.5, 0.08, 'sine', 0.012, { send: 0.18 }); });
    },

    // ── HIRE DONE ── warm welcoming fifth (a person joining the team).
    hireDone: function () {
      voice(523, 0.16, 'triangle', 0.05, { attack: 0.006, send: 0.16 });
      setTimeout(function () { voice(784, 0.22, 'sine', 0.045, { attack: 0.005, send: 0.22 }); voice(1047, 0.12, 'sine', 0.016, { send: 0.18 }); }, 90);
    },

    // ── FUNDING ── positive sparkle: rising celebratory jingle + air shimmer.
    funding: function () {
      seq([523, 659, 784, 1047], 68, function (f, i) {
        voice(f, 0.28, 'triangle', 0.05, { attack: 0.005, send: 0.24 });
        voice(f * 1.5, 0.18, 'sine', 0.02, { attack: 0.004, send: 0.22 });
      });
      setTimeout(function () { noise(0.18, 0.022, 'air', 6000, 0.4); }, 120);
    },

    // ── INSIGHT ── quick high sparkle arpeggio.
    insight: function () {
      seq([880, 1175, 1568, 2093], 46, function (f) { voice(f, 0.14, 'sine', 0.05, { attack: 0.002, send: 0.26 }); });
      noise(0.1, 0.018, 'air', 7000, 0.4);
    },

    // ── BREAKTHROUGH / RELEASE ── rising shimmer: glide swell → confirming chord + air.
    breakthrough: function () {
      voice(220, 0.5, 'sawtooth', 0.05, { glide: 660, attack: 0.02, send: 0.26 });
      voice(110, 0.5, 'sine', 0.03, { glide: 330, attack: 0.03, send: 0.14 });
      setTimeout(function () {
        voice(660, 0.2, 'sine', 0.05, { attack: 0.004, send: 0.3 });
        voice(990, 0.2, 'sine', 0.03, { attack: 0.004, send: 0.3 });
        voice(1320, 0.16, 'sine', 0.016, { send: 0.3 });
        noise(0.25, 0.02, 'air', 6000, 0.5);
      }, 220);
    },
    // alias kept for the guarded G.on('release') call site (A.release ? ... : breakthrough)
    release: function () { this.breakthrough(); },

    // ── SINGULARITY / WIN ── climactic swell: deep rising sub + glowing chord cascade + air bloom.
    singularity: function () {
      voice(110, 1.2, 'sine', 0.06, { glide: 440, attack: 0.08, send: 0.2 });
      voice(165, 1.2, 'triangle', 0.03, { glide: 660, attack: 0.08, send: 0.2 });
      seq([523, 659, 784, 1047, 1319], 130, function (f, i) {
        voice(f, 0.6, 'sine', 0.038, { attack: 0.006, send: 0.34 });
        voice(f * 2, 0.4, 'sine', 0.014, { attack: 0.005, send: 0.36 });
      });
      setTimeout(function () { noise(0.6, 0.022, 'air', 5000, 0.6); }, 200);
    },

    // ── INCIDENT / EVENT ── dark thud: low filtered noise body + descending growl.
    incident: function () {
      noise(0.22, 0.06, 'thud', 220, 0.18);
      voice(160, 0.42, 'sawtooth', 0.055, { glide: 80, attack: 0.006, send: 0.16 });
      setTimeout(function () { voice(120, 0.5, 'sawtooth', 0.045, { glide: 60, send: 0.18 }); noise(0.18, 0.04, 'thud', 160, 0.2); }, 100);
    },

    // ── ERROR ── soft "can't": short low double-blip (no harsh buzzer).
    error: function () {
      voice(220, 0.09, 'sine', 0.04, { attack: 0.004, send: 0.08 });
      setTimeout(function () { voice(160, 0.11, 'sine', 0.035, { attack: 0.004, send: 0.08 }); }, 70);
    },

    // lifecycle: quiet the engine when the tab is hidden, resume on return
    suspend: function () { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {} },
    resume: function () { try { if (enabled && ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} }
  };
})();
