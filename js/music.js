/**
 * GAME_MUSIC — Procedural ambient music generator for Singularity Inc.
 * Web Audio API only. No external files, no network, no libraries.
 * Dark sci-fi ambient: slow evolving pads + occasional bell/arpeggio tones.
 */
window.GAME_MUSIC = (function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  var enabled = false;
  var playing = false;
  var intensity = 0;          // 0..1, set via setIntensity()

  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    // Degrade gracefully — return a no-op API
    return {
      setEnabled: function () {},
      isEnabled:  function () { return false; },
      start:      function () {},
      stop:       function () {},
      setIntensity: function () {},
      setVolume:  function () {},
      getVolume:  function () { return 1; }
    };
  }

  // ── Audio graph (created lazily on first enable) ──────────────────────────
  var ctx             = null;
  var masterGain      = null;   // output node, kept ≤ 0.12
  var padBus          = null;   // GainNode for pad oscillators
  var padFilter       = null;   // LowpassBiquad on pad bus
  var bellBus         = null;   // GainNode for bell/arp tones
  var schedulerTimer  = null;   // setInterval handle
  var nextNoteTime    = 0;      // audioContext.currentTime of next scheduled event

  // Track active oscillators so we can stop them cleanly
  var activeNodes = [];

  // ── Musical constants ──────────────────────────────────────────────────────
  // D Dorian: D E F G A B C D  (relative minor feel with raised 6th)
  // Root = D3 (146.83 Hz) going up two octaves for arpeggios
  var ROOT_HZ = 146.83; // D3
  // Scale intervals in semitones (Dorian: 0 2 3 5 7 9 10)
  var SCALE_STEPS = [0, 2, 3, 5, 7, 9, 10];

  function midiToHz(semitone) {
    return ROOT_HZ * Math.pow(2, semitone / 12);
  }

  // Build pitch pool: two octaves of Dorian scale
  function buildPitches() {
    var pitches = [];
    for (var oct = 0; oct < 3; oct++) {
      for (var i = 0; i < SCALE_STEPS.length; i++) {
        pitches.push(SCALE_STEPS[i] + oct * 12);
      }
    }
    return pitches;
  }

  var PITCHES = buildPitches(); // semitones above D3

  // Pad chord voicings (semitones above root) — slow evolving
  var PAD_CHORDS = [
    [0, 3, 7, 10],   // Dm7
    [0, 3, 7, 14],   // Dm add9
    [5, 9, 12, 17],  // G major (IV in Dorian)
    [2, 5, 9, 14],   // Em7b5 flavor
    [7, 10, 14, 19], // Am7
    [0, 3, 7, 12],   // Dm octave
  ];

  // ── Utility ────────────────────────────────────────────────────────────────
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }
  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  // ── Audio graph construction ───────────────────────────────────────────────
  function buildGraph() {
    try {
      ctx = new AudioCtx();

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Pad bus: oscillators → filter → padBus → master
      padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(800, ctx.currentTime);
      padFilter.Q.setValueAtTime(0.5, ctx.currentTime);

      padBus = ctx.createGain();
      padBus.gain.setValueAtTime(0.55, ctx.currentTime);
      padBus.connect(padFilter);
      padFilter.connect(masterGain);

      // Bell bus: tones → gentle reverb sim (delay+feedback) → bellBus → master
      bellBus = ctx.createGain();
      bellBus.gain.setValueAtTime(0.38, ctx.currentTime);

      var bellDelay = ctx.createDelay(2.0);
      bellDelay.delayTime.setValueAtTime(0.45, ctx.currentTime);
      var bellFeedback = ctx.createGain();
      bellFeedback.gain.setValueAtTime(0.28, ctx.currentTime);
      bellDelay.connect(bellFeedback);
      bellFeedback.connect(bellDelay);

      bellBus.connect(bellDelay);
      bellDelay.connect(masterGain);
      bellBus.connect(masterGain);
    } catch (e) {
      ctx = null;
    }
  }

  // ── Node tracking helpers ──────────────────────────────────────────────────
  function trackNode(node, stopTime) {
    activeNodes.push({ node: node, stopTime: stopTime });
  }

  function pruneNodes(now) {
    var still = [];
    for (var i = 0; i < activeNodes.length; i++) {
      var entry = activeNodes[i];
      if (entry.stopTime < now - 0.5) {
        try { entry.node.disconnect(); } catch (e) {}
      } else {
        still.push(entry);
      }
    }
    activeNodes = still;
  }

  function stopAllNodes() {
    var now = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < activeNodes.length; i++) {
      try {
        activeNodes[i].node.stop(now);
        activeNodes[i].node.disconnect();
      } catch (e) {}
    }
    activeNodes = [];
  }

  // ── Pad synthesis ──────────────────────────────────────────────────────────
  // Slow-changing state for pad evolution
  var padState = {
    chordIdx: 0,
    nextChordTime: 0,
    chordDuration: 14.0,  // seconds per chord
    voices: []
  };

  function schedulePad(when) {
    if (!ctx || !padBus) return;

    var now = ctx.currentTime;
    // Advance chord?
    if (when >= padState.nextChordTime) {
      padState.chordIdx = (padState.chordIdx + 1) % PAD_CHORDS.length;
      // Vary chord duration slightly
      padState.chordDuration = rand(12, 20);
      padState.nextChordTime = when + padState.chordDuration;

      var chord = PAD_CHORDS[padState.chordIdx];

      // Create a new pad voice for each chord tone
      for (var i = 0; i < chord.length; i++) {
        try {
          var semitone = chord[i];
          var freq = midiToHz(semitone);

          // Two detuned oscillators per tone for thickness
          for (var d = -1; d <= 1; d += 2) {
            var osc = ctx.createOscillator();
            // Alternate between sine and triangle for subtle variation
            osc.type = (i % 2 === 0) ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, when);
            osc.detune.setValueAtTime(d * rand(3, 8), when);

            var env = ctx.createGain();
            env.gain.setValueAtTime(0, when);
            // Attack: slow fade in
            var atk = rand(2.5, 4.5);
            env.gain.linearRampToValueAtTime(rand(0.04, 0.09), when + atk);
            // Hold until near end of chord
            var hold = padState.chordDuration - atk - 3.0;
            if (hold < 1) hold = 1;
            env.gain.setValueAtTime(rand(0.04, 0.09), when + atk + hold);
            // Release
            env.gain.linearRampToValueAtTime(0, when + padState.chordDuration + 1.5);

            osc.connect(env);
            env.connect(padBus);

            var stopAt = when + padState.chordDuration + 2.0;
            osc.start(when);
            osc.stop(stopAt);
            trackNode(osc, stopAt);
          }
        } catch (e) {}
      }

      // Add a slow sub-bass drone on root
      try {
        var bass = ctx.createOscillator();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(ROOT_HZ * 0.5, when); // D2
        var bassEnv = ctx.createGain();
        bassEnv.gain.setValueAtTime(0, when);
        bassEnv.gain.linearRampToValueAtTime(0.06, when + 3.0);
        bassEnv.gain.setValueAtTime(0.06, when + padState.chordDuration - 2.0);
        bassEnv.gain.linearRampToValueAtTime(0, when + padState.chordDuration + 1.0);
        bass.connect(bassEnv);
        bassEnv.connect(padBus);
        var bassStop = when + padState.chordDuration + 1.5;
        bass.start(when);
        bass.stop(bassStop);
        trackNode(bass, bassStop);
      } catch (e) {}
    }
  }

  // ── Bell / Arpeggio synthesis ──────────────────────────────────────────────
  var bellState = {
    nextBellTime: 0,
    interval: 5.0  // seconds between bell events (varies)
  };

  function scheduleBell(when) {
    if (!ctx || !bellBus) return;
    if (when < bellState.nextBellTime) return;

    // Probability gate — sparser at low intensity
    var prob = 0.35 + intensity * 0.45;
    if (Math.random() > prob) {
      bellState.nextBellTime = when + rand(3, 8);
      return;
    }

    // Choose between single bell tone or short arpeggio
    var isArp = Math.random() < (0.3 + intensity * 0.3);
    var noteCount = isArp ? randInt(3, 5) : 1;
    var noteSpacing = rand(0.12, 0.25);

    // Pick a scale position weighted toward upper register
    var poolStart = Math.floor(PITCHES.length * 0.3);
    var poolEnd   = PITCHES.length - 1;

    for (var n = 0; n < noteCount; n++) {
      try {
        var semitone = PITCHES[randInt(poolStart, poolEnd)];
        var freq = midiToHz(semitone);
        var t = when + n * noteSpacing;

        var osc = ctx.createOscillator();
        // Sine with slight overtone via wave shaping via gain sum
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        // Faint octave harmonic
        var osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, t);

        var env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(rand(0.06, 0.12), t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, t + rand(1.2, 2.8));

        var env2 = ctx.createGain();
        env2.gain.setValueAtTime(0, t);
        env2.gain.linearRampToValueAtTime(rand(0.01, 0.03), t + 0.02);
        env2.gain.exponentialRampToValueAtTime(0.001, t + rand(0.6, 1.4));

        osc.connect(env);
        env.connect(bellBus);
        osc2.connect(env2);
        env2.connect(bellBus);

        var stopAt = t + 3.5;
        osc.start(t);
        osc.stop(stopAt);
        osc2.start(t);
        osc2.stop(stopAt);
        trackNode(osc, stopAt);
        trackNode(osc2, stopAt);
      } catch (e) {}
    }

    // Schedule next bell event
    var baseInterval = 4.5 - intensity * 2.0; // faster at higher intensity
    if (baseInterval < 2.0) baseInterval = 2.0;
    bellState.nextBellTime = when + rand(baseInterval, baseInterval * 2.5);
  }

  // ── Texture: occasional high shimmer noise burst ───────────────────────────
  var shimmerState = { nextTime: 0 };

  function scheduleShimmer(when) {
    if (!ctx || !bellBus) return;
    if (when < shimmerState.nextTime) return;
    if (Math.random() > 0.15 + intensity * 0.25) {
      shimmerState.nextTime = when + rand(8, 18);
      return;
    }
    try {
      // Band-passed noise for shimmer texture
      var bufLen = Math.floor(ctx.sampleRate * 0.8);
      var buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;

      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(rand(3000, 7000), when);
      bp.Q.setValueAtTime(rand(4, 12), when);

      var sEnv = ctx.createGain();
      sEnv.gain.setValueAtTime(0, when);
      sEnv.gain.linearRampToValueAtTime(rand(0.03, 0.07), when + 0.15);
      sEnv.gain.linearRampToValueAtTime(0, when + 0.8);

      src.connect(bp);
      bp.connect(sEnv);
      sEnv.connect(bellBus);

      src.start(when);
      // BufferSource stops automatically when buffer ends
      trackNode(src, when + 1.0);
    } catch (e) {}

    shimmerState.nextTime = when + rand(10, 22);
  }

  // ── Lookahead scheduler ────────────────────────────────────────────────────
  var SCHEDULE_INTERVAL = 25;   // ms
  var LOOKAHEAD         = 0.12; // seconds ahead to schedule

  function scheduleLoop() {
    if (!ctx || !playing) return;
    try {
      var now = ctx.currentTime;
      var horizon = now + LOOKAHEAD;

      schedulePad(horizon);
      scheduleBell(horizon);
      scheduleShimmer(horizon);
      pruneNodes(now);
    } catch (e) {}
  }

  // ── Intensity effect: filter cutoff + bell bus gain ────────────────────────
  function applyIntensity() {
    if (!ctx || !padFilter || !bellBus) return;
    try {
      var now = ctx.currentTime;
      // Filter cutoff: 600 Hz at 0, 2400 Hz at 1 (subtle brightening)
      var cutoff = 600 + intensity * 1800;
      padFilter.frequency.linearRampToValueAtTime(cutoff, now + 4.0);
      // Bell presence: slightly louder at high intensity
      var bGain = 0.38 + intensity * 0.18;
      bellBus.gain.linearRampToValueAtTime(bGain, now + 4.0);
    } catch (e) {}
  }

  // ── Master fade in/out (click-safe) ───────────────────────────────────────
  var MASTER_GAIN_BASE = 0.12;       // baseline music level (the "100%" reference)
  var musicVol = 1;                  // user music volume 0..1 (scales MASTER_GAIN_BASE)
  function masterTarget() { return MASTER_GAIN_BASE * musicVol; }

  function fadeIn() {
    if (!ctx || !masterGain) return;
    try {
      var now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(masterTarget(), now + 3.5);
    } catch (e) {}
  }

  function fadeOut(cb) {
    if (!ctx || !masterGain) { if (cb) cb(); return; }
    try {
      var now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 2.5);
      setTimeout(function () {
        try { if (cb) cb(); } catch (e) {}
      }, 2700);
    } catch (e) { if (cb) cb(); }
  }

  // ── Core start/stop logic ──────────────────────────────────────────────────
  function ensureContext() {
    if (!ctx) {
      buildGraph();
    }
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
  }

  function startPlayback() {
    if (playing) return;
    ensureContext();
    if (!ctx) return;

    playing = true;
    // Reset scheduler state so notes begin immediately
    if (padState.nextChordTime < ctx.currentTime) {
      padState.nextChordTime = ctx.currentTime;
    }
    if (bellState.nextBellTime < ctx.currentTime) {
      bellState.nextBellTime = ctx.currentTime;
    }
    if (shimmerState.nextTime < ctx.currentTime) {
      shimmerState.nextTime = ctx.currentTime;
    }

    applyIntensity();
    fadeIn();
    schedulerTimer = setInterval(scheduleLoop, SCHEDULE_INTERVAL);
    scheduleLoop(); // immediate first pass
  }

  function stopPlayback() {
    if (!playing) return;
    playing = false;
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    fadeOut(function () {
      stopAllNodes();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    setEnabled: function (bool) {
      enabled = !!bool;
      if (enabled) {
        startPlayback();
      } else {
        stopPlayback();
      }
    },

    isEnabled: function () {
      return enabled;
    },

    start: function () {
      // Only actually play if enabled
      if (enabled) {
        startPlayback();
      }
    },

    stop: function () {
      stopPlayback();
    },

    // Music volume 0..1, scales the master target. Applied live (smooth ramp) while playing.
    setVolume: function (v) {
      musicVol = Math.max(0, Math.min(1, Number(v)));
      if (isNaN(musicVol)) musicVol = 1;
      if (ctx && masterGain && playing) {
        try {
          var now = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(masterGain.gain.value, now);
          masterGain.gain.linearRampToValueAtTime(masterTarget(), now + 0.3);
        } catch (e) {}
      }
    },
    getVolume: function () { return musicVol; },

    setIntensity: function (n) {
      // Clamp to 0..1
      intensity = Math.max(0, Math.min(1, Number(n) || 0));
      applyIntensity();
    }
  };
}());
