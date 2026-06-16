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
    // soft, slightly detuned click — pleasant on rapid taps, never piercing
    tap: function () { voice(360 + Math.random() * 50, 0.07, 'triangle', 0.045, { attack: 0.004 }); },
    // two-note confirm
    buy: function () { voice(540, 0.09, 'sine', 0.055); setTimeout(function () { voice(720, 0.10, 'sine', 0.045); }, 55); },
    // ascending arpeggio sting with octave shimmer
    prestige: function () { seq([392, 523, 659, 784, 1047], 85, function (f) { voice(f, 0.32, 'sawtooth', 0.045); voice(f * 2, 0.18, 'sine', 0.02); }); },
    achievement: function () { voice(660, 0.12, 'sine', 0.055); setTimeout(function () { voice(880, 0.16, 'sine', 0.055); }, 85); },
    // bright triad chime
    milestone: function () { seq([523, 659, 784], 55, function (f) { voice(f, 0.22, 'triangle', 0.06); }); },
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
