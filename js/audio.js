/* Procedural SFX via WebAudio -> window.GAME_AUDIO. Off by default.
   No external audio files (zero external requests).
   R14: mastered through a master gain + limiter (compressor) so stacked SFX
   never clip or get harsh; gentle lowpass softens edges; voice cap stops pile-up
   on rapid tapping; new distinct stings for breakthrough / singularity / error. */
(function () {
  'use strict';
  var ctx = null, enabled = false;
  var master = null, limiter = null, lp = null;
  var voices = 0, MAX_VOICES = 14;   // hard cap so a tap storm can't pile up

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // master chain: [voices] -> lowpass -> master gain -> limiter -> out
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7200; lp.Q.value = 0.5;
      master = ctx.createGain(); master.gain.value = 0.85;
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 14; limiter.ratio.value = 6;
      limiter.attack.value = 0.003; limiter.release.value = 0.18;
      lp.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // a single shaped voice. envel: gentle exp attack + smooth release (no clicks).
  function voice(freq, dur, type, gain, opts) {
    if (!enabled) return;
    var c = ensure(); if (!c || !lp) return;
    if (voices >= MAX_VOICES) return;
    try {
      if (c.state === 'suspended') c.resume();
      opts = opts || {};
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      var t = c.currentTime;
      o.frequency.setValueAtTime(freq, t);
      if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.06, t + (opts.attack || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + (dur || 0.12) + 0.03);
      voices++;
      o.onended = function () { voices = Math.max(0, voices - 1); try { o.disconnect(); g.disconnect(); } catch (e) {} };
    } catch (e) {}
  }
  function seq(notes, step, build) { notes.forEach(function (n, i) { setTimeout(function () { build(n, i); }, i * step); }); }

  window.GAME_AUDIO = {
    setEnabled: function (b) { enabled = !!b; if (enabled) ensure(); },
    isEnabled: function () { return enabled; },
    // soft, slightly detuned click — pleasant on rapid taps, never piercing.
    // heat (0..1, the overclock combo) RAISES the pitch so a hot streak literally
    // climbs in tone — the slot-machine "almost there" feel (hook, first 90s).
    tap: function (heat) {
      var h = (typeof heat === 'number' && heat > 0) ? Math.max(0, Math.min(1, heat)) : 0;
      var base = 360 + h * 520;                 // 360Hz cold → ~880Hz fully overclocked
      voice(base + Math.random() * 50, 0.07, 'triangle', 0.045, { attack: 0.004 });
      // at high heat add a shimmer octave so the streak SPARKLES, not just rises
      if (h > 0.55) voice(base * 2, 0.05, 'sine', 0.02 * h, { attack: 0.003 });
    },
    // two-note confirm
    buy: function () { voice(540, 0.09, 'sine', 0.055); setTimeout(function () { voice(720, 0.10, 'sine', 0.045); }, 55); },
    // ascending arpeggio sting with octave shimmer
    prestige: function () { seq([392, 523, 659, 784, 1047], 85, function (f) { voice(f, 0.32, 'sawtooth', 0.045); voice(f * 2, 0.18, 'sine', 0.02); }); },
    achievement: function () { voice(660, 0.12, 'sine', 0.055); setTimeout(function () { voice(880, 0.16, 'sine', 0.055); }, 85); },
    // bright triad chime
    milestone: function () { seq([523, 659, 784], 55, function (f) { voice(f, 0.22, 'triangle', 0.06); }); },
    // parallel-timer completions — each a DISTINCT subtle cue so they're recognizable by ear.
    // build = a low→high "online" two-note (datacenter humming up).
    buildDone: function () { voice(330, 0.16, 'sine', 0.05); setTimeout(function () { voice(495, 0.20, 'triangle', 0.05); }, 110); },
    // research = a bright quick three-note run (distinct from build's low pair).
    researchDone: function () { seq([784, 988, 1319], 60, function (f) { voice(f, 0.14, 'sine', 0.045); }); },
    // hire = a warm welcoming fifth (a person joining the team).
    hireDone: function () { voice(523, 0.14, 'triangle', 0.05); setTimeout(function () { voice(784, 0.18, 'sine', 0.045); }, 90); },
    // funding = a rising celebratory jingle (item 5; happier/greener than prestige's arpeggio).
    funding: function () { seq([523, 659, 784, 1047], 70, function (f) { voice(f, 0.26, 'triangle', 0.05); voice(f * 1.5, 0.16, 'sine', 0.02); }); },
    // sparkle: quick high arpeggio
    insight: function () { seq([880, 1175, 1568, 2093], 48, function (f) { voice(f, 0.12, 'sine', 0.05); }); },
    // power-up: a rising glide + a confirming fifth (distinct from prestige)
    breakthrough: function () {
      voice(220, 0.45, 'sawtooth', 0.05, { glide: 660, attack: 0.02 });
      setTimeout(function () { voice(660, 0.16, 'sine', 0.05); voice(990, 0.16, 'sine', 0.03); }, 220);
    },
    // deep, vast swell for the Singularity reset
    singularity: function () {
      voice(110, 1.1, 'sine', 0.06, { glide: 440, attack: 0.06 });
      voice(165, 1.1, 'triangle', 0.03, { glide: 660, attack: 0.06 });
      seq([523, 659, 784, 1047, 1319], 130, function (f) { voice(f, 0.5, 'sine', 0.035); });
    },
    // low warning thud (incident / crisis)
    incident: function () { voice(160, 0.4, 'sawtooth', 0.06, { glide: 90 }); setTimeout(function () { voice(120, 0.5, 'sawtooth', 0.05, { glide: 70 }); }, 100); },
    // soft "can't" — a short low double-blip (no harsh buzzer)
    error: function () { voice(200, 0.08, 'sine', 0.04); setTimeout(function () { voice(150, 0.10, 'sine', 0.035); }, 70); },
    // lifecycle: quiet the engine when the tab is hidden, resume on return
    suspend: function () { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {} },
    resume: function () { try { if (enabled && ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} }
  };
})();
