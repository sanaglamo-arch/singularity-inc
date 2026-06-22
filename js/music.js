/**
 * GAME_MUSIC — Procedural ambient music generator for Singularity Inc.
 * Web Audio API only. No external files, no network, no libraries.
 *
 * STUDIO overhaul (R20): a living, generative ambient bed — "neon-cosmos / Detroit".
 * Layered: soft detuned pad chords (multi-osc, lowpass + slow LFO on filter & detune),
 * a sub bass, a gentle arpeggio, and an optional light percussive tick. A portion of
 * everything is sent to a PROCEDURALLY GENERATED convolution reverb for space. Themes
 * (chord palette, tempo, brightness) crossfade smoothly with intensity/era so the
 * soundtrack evolves with the game.
 *
 * Public API is UNCHANGED — backward compatible: setEnabled, isEnabled, start, stop,
 * setVolume, getVolume, setIntensity. M.start()/M.stop() just work and sound great.
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
  var masterGain      = null;   // output node, kept modest
  var padBus          = null;   // GainNode for pad oscillators
  var padFilter       = null;   // LowpassBiquad on pad bus
  var bellBus         = null;   // GainNode for bell/arp tones
  var arpBus          = null;   // GainNode for the gentle arpeggio
  var tickBus         = null;   // GainNode for the light percussive tick
  var reverbBus       = null;   // send target -> convolver -> reverbReturn -> master
  var reverbReturn    = null;
  var convolver       = null;
  var filterLFO       = null;   // OscillatorNode modulating padFilter cutoff
  var filterLFOGain   = null;
  var schedulerTimer  = null;   // setInterval handle

  // Track active oscillators so we can stop them cleanly
  var activeNodes = [];

  // ── Musical constants ──────────────────────────────────────────────────────
  // D Dorian: D E F G A B C D  (relative minor feel with raised 6th)
  var ROOT_HZ = 146.83; // D3
  var SCALE_STEPS = [0, 2, 3, 5, 7, 9, 10];

  function midiToHz(semitone) {
    return ROOT_HZ * Math.pow(2, semitone / 12);
  }

  function buildPitches() {
    var pitches = [];
    for (var oct = 0; oct < 3; oct++) {
      for (var i = 0; i < SCALE_STEPS.length; i++) {
        pitches.push(SCALE_STEPS[i] + oct * 12);
      }
    }
    return pitches;
  }
  var PITCHES = buildPitches();

  // ── Themes / eras ───────────────────────────────────────────────────────────
  // Each theme = a chord-progression palette + character. Intensity selects/blends
  // a theme so the bed evolves from cold/sparse (startup) to warm/driving (ascension).
  var THEMES = [
    { // 0: cold dawn — sparse, low, distant
      name: 'dawn',
      chords: [[0,3,7,10],[0,3,7,14],[5,9,12,17],[0,3,7,12]],
      baseCutoff: 520, lfoDepth: 140, arpProb: 0.10, tickProb: 0.0, chordLen: [16,22]
    },
    { // 1: neon city — warmer, moving, gentle pulse
      name: 'neon',
      chords: [[0,3,7,10],[5,9,12,17],[2,5,9,14],[7,10,14,19]],
      baseCutoff: 820, lfoDepth: 240, arpProb: 0.30, tickProb: 0.45, chordLen: [13,18]
    },
    { // 2: ascension — bright, hopeful, fuller motion
      name: 'ascension',
      chords: [[0,3,7,14],[5,9,12,19],[7,10,14,21],[0,5,9,16]],
      baseCutoff: 1300, lfoDepth: 360, arpProb: 0.5, tickProb: 0.6, chordLen: [10,15]
    }
  ];

  function theme() {
    // Map intensity 0..1 onto the theme list with a small blend toward the next.
    var pos = intensity * (THEMES.length - 1);
    return THEMES[Math.max(0, Math.min(THEMES.length - 1, Math.round(pos)))];
  }

  // ── Utility ────────────────────────────────────────────────────────────────
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

  // ── Procedural convolution reverb impulse (generated, no files) ─────────────
  function makeImpulse(c, seconds, decay) {
    var rate = c.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = c.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  // ── Audio graph construction ───────────────────────────────────────────────
  function buildGraph() {
    try {
      ctx = new AudioCtx();

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Reverb send -> convolver -> return -> master
      try {
        reverbBus = ctx.createGain(); reverbBus.gain.setValueAtTime(1.0, ctx.currentTime);
        convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx, 3.4, 2.6);
        reverbReturn = ctx.createGain(); reverbReturn.gain.setValueAtTime(0.6, ctx.currentTime);
        reverbBus.connect(convolver); convolver.connect(reverbReturn); reverbReturn.connect(masterGain);
      } catch (e) { reverbBus = null; convolver = null; reverbReturn = null; }

      // Pad bus: oscillators → filter → padBus → master (+ reverb send)
      padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(800, ctx.currentTime);
      padFilter.Q.setValueAtTime(0.6, ctx.currentTime);

      padBus = ctx.createGain();
      padBus.gain.setValueAtTime(0.55, ctx.currentTime);
      padBus.connect(padFilter);
      padFilter.connect(masterGain);
      if (reverbBus) { var padSend = ctx.createGain(); padSend.gain.value = 0.45; padFilter.connect(padSend); padSend.connect(reverbBus); }

      // Slow LFO modulating the pad filter cutoff — the "breathing" motion.
      try {
        filterLFO = ctx.createOscillator();
        filterLFO.type = 'sine';
        filterLFO.frequency.setValueAtTime(0.06, ctx.currentTime); // very slow
        filterLFOGain = ctx.createGain();
        filterLFOGain.gain.setValueAtTime(160, ctx.currentTime);   // cutoff sweep depth (Hz)
        filterLFO.connect(filterLFOGain);
        filterLFOGain.connect(padFilter.frequency);
        filterLFO.start();
      } catch (e) { filterLFO = null; }

      // Bell bus: tones → reverb + a short feedback delay → master
      bellBus = ctx.createGain();
      bellBus.gain.setValueAtTime(0.36, ctx.currentTime);
      var bellDelay = ctx.createDelay(2.0);
      bellDelay.delayTime.setValueAtTime(0.42, ctx.currentTime);
      var bellFeedback = ctx.createGain();
      bellFeedback.gain.setValueAtTime(0.26, ctx.currentTime);
      bellDelay.connect(bellFeedback);
      bellFeedback.connect(bellDelay);
      bellBus.connect(bellDelay);
      bellDelay.connect(masterGain);
      bellBus.connect(masterGain);
      if (reverbBus) { var bellSend = ctx.createGain(); bellSend.gain.value = 0.5; bellBus.connect(bellSend); bellSend.connect(reverbBus); }

      // Arp bus — gentle plucked arpeggio, heavily reverbed
      arpBus = ctx.createGain();
      arpBus.gain.setValueAtTime(0.0, ctx.currentTime); // faded in by intensity
      arpBus.connect(masterGain);
      if (reverbBus) { var arpSend = ctx.createGain(); arpSend.gain.value = 0.55; arpBus.connect(arpSend); arpSend.connect(reverbBus); }

      // Tick bus — soft percussive heartbeat, mostly dry with a touch of room
      tickBus = ctx.createGain();
      tickBus.gain.setValueAtTime(0.0, ctx.currentTime);
      tickBus.connect(masterGain);
      if (reverbBus) { var tickSend = ctx.createGain(); tickSend.gain.value = 0.25; tickBus.connect(tickSend); tickSend.connect(reverbBus); }
    } catch (e) {
      ctx = null;
    }
  }

  // ── Node tracking helpers ──────────────────────────────────────────────────
  function trackNode(node, stopTime) { activeNodes.push({ node: node, stopTime: stopTime }); }

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
      try { activeNodes[i].node.stop(now); activeNodes[i].node.disconnect(); } catch (e) {}
    }
    activeNodes = [];
  }

  // ── Pad synthesis ──────────────────────────────────────────────────────────
  var padState = { chordIdx: 0, nextChordTime: 0, chordDuration: 14.0 };

  function schedulePad(when) {
    if (!ctx || !padBus) return;
    if (when < padState.nextChordTime) return;

    var th = theme();
    var chords = th.chords;
    padState.chordIdx = (padState.chordIdx + 1) % chords.length;
    padState.chordDuration = rand(th.chordLen[0], th.chordLen[1]);
    padState.nextChordTime = when + padState.chordDuration;
    var chord = chords[padState.chordIdx];

    for (var i = 0; i < chord.length; i++) {
      try {
        var freq = midiToHz(chord[i]);
        // Two detuned oscillators per tone for thickness
        for (var d = -1; d <= 1; d += 2) {
          var osc = ctx.createOscillator();
          osc.type = (i % 2 === 0) ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, when);
          osc.detune.setValueAtTime(d * rand(3, 9), when);
          // very slow detune drift via the LFO-like ramp for living motion
          osc.detune.linearRampToValueAtTime(d * rand(5, 12), when + padState.chordDuration);

          var env = ctx.createGain();
          env.gain.setValueAtTime(0, when);
          var atk = rand(2.5, 4.5);
          var peak = rand(0.04, 0.085);
          env.gain.linearRampToValueAtTime(peak, when + atk);
          var hold = padState.chordDuration - atk - 3.0; if (hold < 1) hold = 1;
          env.gain.setValueAtTime(peak, when + atk + hold);
          env.gain.linearRampToValueAtTime(0, when + padState.chordDuration + 1.5);

          osc.connect(env); env.connect(padBus);
          var stopAt = when + padState.chordDuration + 2.0;
          osc.start(when); osc.stop(stopAt);
          trackNode(osc, stopAt);
        }
      } catch (e) {}
    }

    // Slow sub-bass drone on root
    try {
      var bass = ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(ROOT_HZ * 0.5, when); // D2
      var bassEnv = ctx.createGain();
      bassEnv.gain.setValueAtTime(0, when);
      bassEnv.gain.linearRampToValueAtTime(0.07, when + 3.0);
      bassEnv.gain.setValueAtTime(0.07, when + padState.chordDuration - 2.0);
      bassEnv.gain.linearRampToValueAtTime(0, when + padState.chordDuration + 1.0);
      bass.connect(bassEnv); bassEnv.connect(padBus);
      var bassStop = when + padState.chordDuration + 1.5;
      bass.start(when); bass.stop(bassStop);
      trackNode(bass, bassStop);
    } catch (e) {}
  }

  // ── Bell synthesis ──────────────────────────────────────────────────────────
  var bellState = { nextBellTime: 0 };

  function scheduleBell(when) {
    if (!ctx || !bellBus) return;
    if (when < bellState.nextBellTime) return;

    var prob = 0.32 + intensity * 0.4;
    if (Math.random() > prob) { bellState.nextBellTime = when + rand(3, 8); return; }

    var isArp = Math.random() < (0.25 + intensity * 0.25);
    var noteCount = isArp ? randInt(3, 5) : 1;
    var noteSpacing = rand(0.12, 0.25);
    var poolStart = Math.floor(PITCHES.length * 0.3);
    var poolEnd = PITCHES.length - 1;

    for (var n = 0; n < noteCount; n++) {
      try {
        var freq = midiToHz(PITCHES[randInt(poolStart, poolEnd)]);
        var t = when + n * noteSpacing;

        var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        var osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 2, t);

        var env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(rand(0.06, 0.11), t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, t + rand(1.2, 2.8));

        var env2 = ctx.createGain();
        env2.gain.setValueAtTime(0, t);
        env2.gain.linearRampToValueAtTime(rand(0.01, 0.03), t + 0.02);
        env2.gain.exponentialRampToValueAtTime(0.001, t + rand(0.6, 1.4));

        osc.connect(env); env.connect(bellBus);
        osc2.connect(env2); env2.connect(bellBus);
        var stopAt = t + 3.5;
        osc.start(t); osc.stop(stopAt); osc2.start(t); osc2.stop(stopAt);
        trackNode(osc, stopAt); trackNode(osc2, stopAt);
      } catch (e) {}
    }

    var baseInterval = 4.5 - intensity * 2.0; if (baseInterval < 2.0) baseInterval = 2.0;
    bellState.nextBellTime = when + rand(baseInterval, baseInterval * 2.5);
  }

  // ── Gentle arpeggio ─────────────────────────────────────────────────────────
  // A soft plucked run following the current chord; density rises with the theme.
  var arpState = { nextTime: 0, step: 0 };

  function scheduleArp(when) {
    if (!ctx || !arpBus) return;
    if (when < arpState.nextTime) return;

    var th = theme();
    if (Math.random() > th.arpProb) { arpState.nextTime = when + rand(1.5, 4.0); return; }

    try {
      var chord = th.chords[padState.chordIdx % th.chords.length];
      var step = arpState.step % chord.length;
      arpState.step++;
      var semitone = chord[step] + 12; // an octave up for the pluck register
      var freq = midiToHz(semitone);

      var osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, when);
      var osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(freq * 2, when);
      var env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(0.05, when + 0.008);   // plucky attack
      env.gain.exponentialRampToValueAtTime(0.001, when + rand(0.5, 0.9));
      var env2 = ctx.createGain();
      env2.gain.setValueAtTime(0, when);
      env2.gain.linearRampToValueAtTime(0.014, when + 0.006);
      env2.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
      osc.connect(env); env.connect(arpBus);
      osc2.connect(env2); env2.connect(arpBus);
      var stopAt = when + 1.0;
      osc.start(when); osc.stop(stopAt); osc2.start(when); osc2.stop(stopAt);
      trackNode(osc, stopAt); trackNode(osc2, stopAt);
    } catch (e) {}

    // tempo: faster with intensity
    var stepTime = 0.42 - intensity * 0.18; if (stepTime < 0.18) stepTime = 0.18;
    arpState.nextTime = when + stepTime;
  }

  // ── Light percussive tick (soft heartbeat) ──────────────────────────────────
  var tickState = { nextTime: 0 };

  function scheduleTick(when) {
    if (!ctx || !tickBus) return;
    if (when < tickState.nextTime) return;

    var th = theme();
    if (th.tickProb <= 0 || Math.random() > th.tickProb) { tickState.nextTime = when + rand(0.7, 1.4); return; }

    try {
      // a soft filtered noise blip — body without harsh transient
      var len = Math.floor(ctx.sampleRate * 0.06);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, when); bp.Q.setValueAtTime(1.0, when);
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.05, when + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      src.connect(bp); bp.connect(env); env.connect(tickBus);
      src.start(when); src.stop(when + 0.08);
      trackNode(src, when + 0.1);
    } catch (e) {}

    // pulse period shortens with intensity (a calmer→driving heartbeat)
    var period = 0.95 - intensity * 0.25; if (period < 0.5) period = 0.5;
    tickState.nextTime = when + period;
  }

  // ── Texture: occasional high shimmer noise burst ───────────────────────────
  var shimmerState = { nextTime: 0 };

  function scheduleShimmer(when) {
    if (!ctx || !bellBus) return;
    if (when < shimmerState.nextTime) return;
    if (Math.random() > 0.15 + intensity * 0.25) { shimmerState.nextTime = when + rand(8, 18); return; }
    try {
      var bufLen = Math.floor(ctx.sampleRate * 0.8);
      var buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      var src = ctx.createBufferSource(); src.buffer = buffer;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(rand(3000, 7000), when); bp.Q.setValueAtTime(rand(4, 12), when);
      var sEnv = ctx.createGain();
      sEnv.gain.setValueAtTime(0, when);
      sEnv.gain.linearRampToValueAtTime(rand(0.03, 0.06), when + 0.15);
      sEnv.gain.linearRampToValueAtTime(0, when + 0.8);
      src.connect(bp); bp.connect(sEnv); sEnv.connect(bellBus);
      src.start(when);
      trackNode(src, when + 1.0);
    } catch (e) {}
    shimmerState.nextTime = when + rand(10, 22);
  }

  // ── Lookahead scheduler ────────────────────────────────────────────────────
  var SCHEDULE_INTERVAL = 25;   // ms
  var LOOKAHEAD         = 0.12; // seconds

  function scheduleLoop() {
    if (!ctx || !playing) return;
    try {
      var now = ctx.currentTime;
      var horizon = now + LOOKAHEAD;
      schedulePad(horizon);
      scheduleBell(horizon);
      scheduleArp(horizon);
      scheduleTick(horizon);
      scheduleShimmer(horizon);
      pruneNodes(now);
    } catch (e) {}
  }

  // ── Intensity / era effect: brightness, motion, layer balance ───────────────
  function applyIntensity() {
    if (!ctx || !padFilter) return;
    try {
      var now = ctx.currentTime;
      var th = theme();
      // Pad brightness from the active theme + a little extra from raw intensity.
      var cutoff = th.baseCutoff + intensity * 600;
      padFilter.frequency.cancelScheduledValues(now);
      padFilter.frequency.setValueAtTime(padFilter.frequency.value, now);
      padFilter.frequency.linearRampToValueAtTime(cutoff, now + 4.0);
      // LFO depth & speed: more motion as the world heats up.
      if (filterLFOGain) filterLFOGain.gain.linearRampToValueAtTime(th.lfoDepth, now + 4.0);
      if (filterLFO) filterLFO.frequency.linearRampToValueAtTime(0.05 + intensity * 0.12, now + 4.0);
      // Bell presence
      if (bellBus) bellBus.gain.linearRampToValueAtTime(0.34 + intensity * 0.18, now + 4.0);
      // Arpeggio fades in with intensity (silent at the calmest era)
      if (arpBus) arpBus.gain.linearRampToValueAtTime(0.18 * Math.min(1, intensity * 1.4), now + 4.0);
      // Tick (heartbeat) likewise rises, capped low so it never dominates
      if (tickBus) tickBus.gain.linearRampToValueAtTime(0.14 * Math.min(1, intensity * 1.2), now + 4.0);
    } catch (e) {}
  }

  // ── Master fade in/out (click-safe) ───────────────────────────────────────
  var MASTER_GAIN_BASE = 0.12;       // baseline music level
  var musicVol = 1;
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
      setTimeout(function () { try { if (cb) cb(); } catch (e) {} }, 2700);
    } catch (e) { if (cb) cb(); }
  }

  // ── Core start/stop logic ──────────────────────────────────────────────────
  function ensureContext() {
    if (!ctx) buildGraph();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function startPlayback() {
    if (playing) return;
    ensureContext();
    if (!ctx) return;
    playing = true;
    var now = ctx.currentTime;
    if (padState.nextChordTime < now) padState.nextChordTime = now;
    if (bellState.nextBellTime < now) bellState.nextBellTime = now;
    if (arpState.nextTime < now) arpState.nextTime = now;
    if (tickState.nextTime < now) tickState.nextTime = now;
    if (shimmerState.nextTime < now) shimmerState.nextTime = now;
    applyIntensity();
    fadeIn();
    schedulerTimer = setInterval(scheduleLoop, SCHEDULE_INTERVAL);
    scheduleLoop();
  }

  function stopPlayback() {
    if (!playing) return;
    playing = false;
    if (schedulerTimer !== null) { clearInterval(schedulerTimer); schedulerTimer = null; }
    fadeOut(function () { stopAllNodes(); });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    setEnabled: function (bool) {
      enabled = !!bool;
      if (enabled) startPlayback(); else stopPlayback();
    },
    isEnabled: function () { return enabled; },
    start: function () { if (enabled) startPlayback(); },
    stop: function () { stopPlayback(); },
    // Resume a context that was created off-gesture (browser autoplay policy leaves it
    // suspended). Call from the first real user gesture so the soundtrack becomes audible.
    resume: function () { if (!enabled) return; if (!playing) startPlayback(); else ensureContext(); },
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
      intensity = Math.max(0, Math.min(1, Number(n) || 0));
      applyIntensity();
    }
  };
}());
